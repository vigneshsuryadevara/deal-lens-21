import {
  createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode,
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
const CLIENT_TIMEOUT_MS = 65_000;
const RESULT_CACHE_TTL = 5 * 60_000; // 5 minutes

export type AnalysisStatus = "idle" | "loading" | "success" | "error";

interface CachedResult {
  result: LiveAnalysisResult;
  key: string;
  timestamp: number;
}

interface AnalysisContextValue {
  inputs: AnalysisInputs;
  setInputs: (partial: Partial<AnalysisInputs>) => void;
  result: LiveAnalysisResult | null;
  status: AnalysisStatus;
  error: string | null;
  retryCount: number;
  runAnalysis: () => Promise<void>;
  retry: () => Promise<void>;
  isFallback: boolean;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

function makeCacheKey(inp: AnalysisInputs): string {
  return `${inp.company}|${inp.sector}|${inp.geography}|${inp.revenue}|${inp.ebitda}|${inp.growth}|${inp.dealType}`;
}

function friendlyError(raw: string): string {
  if (raw.toLowerCase().includes("timeout") || raw.toLowerCase().includes("aborted"))
    return "The analysis timed out. Results shown are from our transaction dataset. Retry for live market data.";
  if (raw.includes("ANTHROPIC_API_KEY") || raw.includes("configuration"))
    return "Server configuration issue. Please contact support.";
  if (raw.includes("429") || raw.toLowerCase().includes("rate limit"))
    return "Service is busy. Please wait a moment and retry.";
  if (raw.includes("422") || raw.toLowerCase().includes("invalid inputs"))
    return "Please check your inputs — revenue must be a positive number.";
  if (raw.includes("502") || raw.includes("503") || raw.includes("504"))
    return "Analysis service temporarily unavailable. Showing dataset-based results.";
  if (raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("network"))
    return "Network error. Please check your connection and retry.";
  return "Analysis failed. Showing dataset-based results. Retry for live data.";
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
  const [isFallback, setIsFallback] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<CachedResult | null>(null);

  const setInputs = useCallback((partial: Partial<AnalysisInputs>) => {
    setInputsState((prev) => {
      const next = { ...prev, ...partial };
      if ((partial.revenue !== undefined || partial.ebitda !== undefined) && partial.ebitdaMargin === undefined) {
        const rev = partial.revenue ?? prev.revenue;
        const eb = partial.ebitda ?? prev.ebitda;
        next.ebitdaMargin = rev > 0 ? Math.round((eb / rev) * 1000) / 10 : prev.ebitdaMargin;
      }
      return next;
    });
  }, []);

  const attemptAnalysis = useCallback(
    async (inp: AnalysisInputs, attempt: number): Promise<void> => {
      // Check cache
      const cacheKey = makeCacheKey(inp);
      if (cacheRef.current && cacheRef.current.key === cacheKey &&
          Date.now() - cacheRef.current.timestamp < RESULT_CACHE_TTL) {
        setResult(cacheRef.current.result);
        setStatus("success");
        setError(null);
        setRetryCount(0);
        setIsFallback(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

      try {
        const resp = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(inp),
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          let serverMsg = `HTTP ${resp.status}`;
          try {
            const payload = (await resp.json()) as { error?: string; details?: string[] };
            serverMsg = payload.details ? payload.details.join("; ") : (payload.error ?? serverMsg);
          } catch {}
          throw new Error(serverMsg);
        }

        let data: LiveAnalysisResult;
        try {
          data = (await resp.json()) as LiveAnalysisResult;
        } catch {
          throw new Error("Server returned malformed response");
        }

        if (!data || typeof data !== "object" || !data.company) {
          throw new Error("Unexpected response shape from server");
        }

        // Detect fallback (dataNote contains "fallback")
        const isFb = Boolean(data.dataNote?.toLowerCase().includes("fallback"));
        setIsFallback(isFb);

        // Cache successful results
        cacheRef.current = { result: data, key: cacheKey, timestamp: Date.now() };

        setResult(data);
        setStatus("success");
        setError(null);
        setRetryCount(0);
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
        if (isAbort && abortRef.current?.signal.aborted) return;

        const rawMsg = err instanceof Error ? err.message : "Unknown error";
        const isRetryable = isAbort || rawMsg.includes("fetch") || rawMsg.includes("network") ||
          rawMsg.includes("502") || rawMsg.includes("503") || rawMsg.includes("504");

        if (isRetryable && attempt < MAX_RETRIES) {
          setRetryCount(attempt + 1);
          await delay(RETRY_DELAY_MS * (attempt + 1));
          return attemptAnalysis(inp, attempt + 1);
        }

        setError(friendlyError(rawMsg));
        setStatus("error");
        setRetryCount(0);
      }
    },
    [],
  );

  const runAnalysis = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setRetryCount(0);
    await attemptAnalysis(inputs, 0);
  }, [inputs, attemptAnalysis]);

  const retry = useCallback(async () => {
    // Invalidate cache on retry
    cacheRef.current = null;
    await runAnalysis();
  }, [runAnalysis]);

  const value = useMemo(() => ({
    inputs, setInputs, result, status, error, retryCount, runAnalysis, retry, isFallback,
  }), [inputs, setInputs, result, status, error, retryCount, runAnalysis, retry, isFallback]);

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within <AnalysisProvider>");
  return ctx;
}
