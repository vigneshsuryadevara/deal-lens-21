import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { AnalysisInputs, LiveAnalysisResult } from "@/types/analysis";

// ─── defaults mirror the static seed data so the UI renders instantly ─────────
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

export type AnalysisStatus = "idle" | "loading" | "success" | "error";

interface AnalysisContextValue {
  inputs: AnalysisInputs;
  setInputs: (partial: Partial<AnalysisInputs>) => void;
  result: LiveAnalysisResult | null;
  status: AnalysisStatus;
  error: string | null;
  runAnalysis: () => Promise<void>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputsState] = useState<AnalysisInputs>(DEFAULT_INPUTS);
  const [result, setResult] = useState<LiveAnalysisResult | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const setInputs = useCallback((partial: Partial<AnalysisInputs>) => {
    setInputsState((prev) => ({ ...prev, ...partial }));
  }, []);

  const runAnalysis = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error((payload as { error?: string }).error ?? `HTTP ${resp.status}`);
      }

      const data = (await resp.json()) as LiveAnalysisResult;
      setResult(data);
      setStatus("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setStatus("error");
    }
  }, [inputs]);

  return (
    <AnalysisContext.Provider value={{ inputs, setInputs, result, status, error, runAnalysis }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within <AnalysisProvider>");
  return ctx;
}
