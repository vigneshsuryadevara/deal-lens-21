import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { AnalysisInputs, LiveAnalysisResult } from "@/types/analysis";

export const DEFAULT_INPUTS: AnalysisInputs = {
  company: "Helix Analytics",
  sector: "Software & SaaS",
  geography: "North America",
  revenue: 412,
  ebitda: 78,
  growth: 24,
  ebitdaMargin: 19,
  netDebt: -45,
  dealType: "Strategic M&A",
  context: "",
};

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;
const CLIENT_TIMEOUT_MS = 60_000;

export type AnalysisStatus = "idle" | "loading" | "success" | "error";

interface AnalysisContextValue {
  inputs: AnalysisInputs;
  setInputs: (partial: Partial<AnalysisInputs>) => void;
  result: LiveAnalysisResult | null;
  status: AnalysisStatus;
  error: string | null;
  retryCount: number;
  runAnalysis: () => Promise<void>;
  retry: () => Promise<void>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

// Friendly error messages mapped from server responses
function friendlyError(raw: string): string {
  if (raw.toLowerCase().includes("timeout") || raw.toLowerCase().includes("aborted")) {
    return "The analysis timed out. The results shown are based on our transaction dataset. Try again for live market data.";
  }
  if (raw.includes("ANTHROPIC_API_KEY") || raw.includes("configuration")) {
    return "Server configuration issue. Please contact support.";
  }
  if (raw.includes("429") || raw.toLowerCase().includes("rate limit")) {
    return "Service is busy. Please wait a moment and try again.";
  }
  if (raw.includes("422") || raw.toLowerCase().includes("invalid inputs")) {
    return "Please check your inputs — revenue must be a positive number.";
  }
  if (raw.includes("502") || raw.includes("503") || raw.includes("504")) {
    return "Analysis service temporarily unavailable. Showing dataset-based results.";
  }
  if (raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("network")) {
    return "Network error. Please check your connection and try again.";
  }
  return "Analysis failed. Showing dataset-based results. You can retry for live data.";
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputsState] = useState<AnalysisInputs>(DEFAULT_INPUTS);
  const [result, setResult] = useState<LiveAnalysisResult | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const setInputs = useCallback((partial: Partial<AnalysisInputs>) => {
    setInputsState((prev) => {
      const next = { ...prev, ...partial };
      // Keep ebitdaMargin in sync when revenue/ebitda change
      if (
        (partial.revenue !== undefined || partial.ebitda !== undefined) &&
        partial.ebitdaMargin === undefined
      ) {
        const rev = partial.revenue ?? prev.revenue;
        const eb = partial.ebitda ?? prev.ebitda;
        next.ebitdaMargin =
          rev > 0 ? Math.round((eb / rev) * 1000) / 10 : prev.ebitdaMargin;
      }
      return next;
    });
  }, []);

  const attemptAnalysis = useCallback(
    async (attempt: number): Promise<void> => {
      // Cancel any previous in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const timeoutId = setTimeout(
        () => controller.abort(),
        CLIENT_TIMEOUT_MS,
      );

      try {
        const resp = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(inputs),
        });

        clearTimeout(timeoutId);

        // The server returns a result even on fallback (200), so any non-2xx
        // here is a hard server-side error worth retrying.
        if (!resp.ok) {
          let serverMsg = `HTTP ${resp.status}`;
          try {
            const payload = (await resp.json()) as { error?: string; details?: string[] };
            serverMsg = payload.details
              ? payload.details.join("; ")
              : (payload.error ?? serverMsg);
          } catch {
            // ignore JSON parse error on error body
          }
          throw new Error(serverMsg);
        }

        let data: LiveAnalysisResult;
        try {
          data = (await resp.json()) as LiveAnalysisResult;
        } catch {
          throw new Error("Server returned malformed response");
        }

        // Basic shape guard — prevent crashes if server somehow returns garbage
        if (!data || typeof data !== "object" || !data.company) {
          throw new Error("Unexpected response shape from server");
        }

        setResult(data);
        setStatus("success");
        setError(null);
        setRetryCount(0);
      } catch (err) {
        clearTimeout(timeoutId);

        const isAbort =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.includes("abort"));

        // If we aborted intentionally (new request came in), don't update state
        if (isAbort && abortRef.current?.signal.aborted) return;

        const rawMsg = err instanceof Error ? err.message : "Unknown error";

        // Retry on network/timeout errors up to MAX_RETRIES
        const isRetryable =
          isAbort ||
          rawMsg.includes("fetch") ||
          rawMsg.includes("network") ||
          rawMsg.includes("502") ||
          rawMsg.includes("503") ||
          rawMsg.includes("504");

        if (isRetryable && attempt < MAX_RETRIES) {
          setRetryCount(attempt + 1);
          await delay(RETRY_DELAY_MS * (attempt + 1));
          return attemptAnalysis(attempt + 1);
        }

        setError(friendlyError(rawMsg));
        setStatus("error");
        setRetryCount(0);
      }
    },
    [inputs],
  );

  const runAnalysis = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setRetryCount(0);
    await attemptAnalysis(0);
  }, [attemptAnalysis]);

  const retry = useCallback(async () => {
    await runAnalysis();
  }, [runAnalysis]);

  return (
    <AnalysisContext.Provider
      value={{ inputs, setInputs, result, status, error, retryCount, runAnalysis, retry }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within <AnalysisProvider>");
  return ctx;
}
