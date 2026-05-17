/**
 * AnalysisContext — Two-phase analysis:
 *
 * Phase 1 (INSTANT — <200ms): Run DCF, LBO, comps scoring in the browser.
 *   Show results immediately. No server needed. Never fails.
 *
 * Phase 2 (ASYNC — 3-8s): Fetch AI commentary from server.
 *   Enhances the display when ready. If it fails → Phase 1 results remain.
 *   User never sees a blank screen or error.
 */

import {
  createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode,
} from "react";
import type { AnalysisInputs, LiveAnalysisResult } from "@/types/analysis";
import { TRANSACTIONS } from "@/data/transactions";
import { BUYERS, getBuyersForSector } from "@/data/buyers";
import { scoreTransactions, computeValuationStats } from "@/services/comps/index";
import { runDcf, runLbo, buildFootballField } from "@/services/financials/index";

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

export type AnalysisStatus = "idle" | "loading" | "enhancing" | "success" | "error";

interface AnalysisContextValue {
  inputs: AnalysisInputs;
  setInputs: (partial: Partial<AnalysisInputs>) => void;
  result: LiveAnalysisResult | null;
  status: AnalysisStatus;
  error: string | null;
  isFallback: boolean;
  runAnalysis: () => Promise<void>;
  retry: () => Promise<void>;
}

const Ctx = createContext<AnalysisContextValue | null>(null);

// ─── Phase 1: instant client-side computation ─────────────────────────────────
function computeInstantResult(inp: AnalysisInputs): LiveAnalysisResult {
  const scored = scoreTransactions(TRANSACTIONS, {
    sector: inp.sector, revenue: inp.revenue,
    ebitdaMargin: inp.ebitdaMargin, growth: inp.growth,
  });
  const top = scored.slice(0, 8);
  const stats = computeValuationStats(top);
  const dcf = runDcf({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const lbo = runLbo({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const ff = buildFootballField(inp.revenue, inp.ebitda, inp.netDebt, stats, dcf, lbo);
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
  const eq = inp.netDebt < 0 ? `net cash of $${Math.abs(inp.netDebt)}M` : `net debt of $${inp.netDebt}M`;

  return {
    company: inp.company,
    sector: inp.sector,
    geography: inp.geography,
    asOf: new Date().toISOString(),
    stats: {
      medianEvEbitda: stats.medianEvEbitda, medianEvRevenue: stats.medianEvRevenue,
      p25EvEbitda: stats.p25EvEbitda, p75EvEbitda: stats.p75EvEbitda,
      p25EvRevenue: stats.p25EvRevenue, p75EvRevenue: stats.p75EvRevenue,
    },
    valuationMethods: [
      { label: "Precedent Transactions (EV/EBITDA)", low: Math.round(ff[0]?.low ?? 0), high: Math.round(ff[0]?.high ?? 0), base: Math.round(ff[0]?.base ?? 0) },
      { label: "Precedent Transactions (EV/Revenue)", low: Math.round(ff[1]?.low ?? 0), high: Math.round(ff[1]?.high ?? 0), base: Math.round(ff[1]?.base ?? 0) },
      { label: "Trading Comparables", low: Math.round(ff[2]?.low ?? 0), high: Math.round(ff[2]?.high ?? 0), base: Math.round(ff[2]?.base ?? 0) },
      { label: "Discounted Cash Flow", low: Math.round(dcf.enterpriseValue * 0.85), high: Math.round(dcf.enterpriseValue * 1.15), base: dcf.enterpriseValue },
      { label: "LBO (Sponsor — 20% IRR)", low: Math.round(lbo.entryEv * 0.92), high: Math.round(lbo.entryEv * 1.06), base: lbo.entryEv },
      { label: "52-Week Trading Range", low: Math.round(ff[5]?.low ?? 0), high: Math.round(ff[5]?.high ?? 0), base: Math.round(ff[5]?.base ?? 0) },
    ],
    commentary: [
      `${inp.company} generates $${inp.revenue}M LTM revenue at a ${inp.ebitdaMargin.toFixed(1)}% EBITDA margin with ${inp.growth}% YoY growth — a profile consistent with premium ${inp.sector} assets in the current deal environment.`,
      `Against ${top.length} sector-matched precedent transactions, the dataset supports a median EV/EBITDA of ${stats.medianEvEbitda.toFixed(1)}x and EV/Revenue of ${stats.medianEvRevenue.toFixed(1)}x, implying an enterprise value range of ${fmt(stats.p25EvEbitda * inp.ebitda * 1e6)}–${fmt(stats.p75EvEbitda * inp.ebitda * 1e6)}.`,
      `DCF analysis at 10% WACC implies ${fmt(dcf.enterpriseValue)} enterprise value; a financial sponsor targeting 20% IRR supports an entry of ${fmt(lbo.entryEv)}, with the company carrying ${eq}.`,
    ],
    marketObservations: [
      { label: "Sector Comps", value: `${top.length} transactions`, tone: "neutral" },
      { label: "Median EV/EBITDA", value: `${stats.medianEvEbitda.toFixed(1)}x`, tone: "neutral" },
      { label: "DCF Implied EV", value: fmt(dcf.enterpriseValue), tone: "neutral" },
      { label: "LBO Entry (20% IRR)", value: fmt(lbo.entryEv), tone: "neutral" },
    ],
    relevantCompIds: top.map(t => t.id),
    topBuyerIds: getBuyersForSector(inp.sector).slice(0, 4).map(b => b.id),
    assumptions: [
      { id: "a1", category: "Add-Backs", label: "Stock-based compensation", value: Math.round(inp.revenue * 0.04 * 10) / 10, unit: "$M", note: "Non-cash charge" },
      { id: "a2", category: "Add-Backs", label: "Non-recurring items", value: Math.round(inp.ebitda * 0.05 * 10) / 10, unit: "$M", note: "One-time charges" },
      { id: "a3", category: "Run-Rate", label: "ARR annualisation", value: Math.round(inp.revenue * 0.02 * 10) / 10, unit: "$M", note: "Partial-year contracts" },
    ],
    bridge: [
      { label: "Enterprise Value (Base)", value: Math.round(stats.medianEvEbitda * inp.ebitda * 1e6) },
      { label: "(+) Cash & equivalents", value: inp.netDebt < 0 ? Math.round(Math.abs(inp.netDebt) * 1e6) : 0 },
      { label: "(−) Total debt", value: inp.netDebt > 0 ? Math.round(inp.netDebt * 1e6) : 0 },
      { label: "(−) Capitalized leases", value: Math.round(inp.ebitda * 0.08 * 1e6) },
      { label: "(−) Minority interest", value: 0 },
      { label: "(−) Earnout / contingent", value: 0 },
    ],
    analystNote: `${inp.company}: ${inp.sector} deal at ${stats.medianEvEbitda.toFixed(1)}x EV/EBITDA median · ${top.length} comparable transactions`,
    dataNote: "Instant analysis · Enhancing with live AI commentary…",
  };
}

// ─── Phase 2: merge AI commentary into the instant result ─────────────────────
function mergeAiResult(base: LiveAnalysisResult, ai: LiveAnalysisResult): LiveAnalysisResult {
  return {
    ...base,
    commentary: ai.commentary?.length ? ai.commentary : base.commentary,
    marketObservations: ai.marketObservations?.length ? ai.marketObservations : base.marketObservations,
    relevantCompIds: ai.relevantCompIds?.length ? ai.relevantCompIds : base.relevantCompIds,
    topBuyerIds: ai.topBuyerIds?.length ? ai.topBuyerIds : base.topBuyerIds,
    analystNote: ai.analystNote ?? base.analystNote,
    dataNote: ai.dataNote ?? "Live AI analysis",
  };
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputsState] = useState<AnalysisInputs>(DEFAULT_INPUTS);
  const [result, setResult] = useState<LiveAnalysisResult | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const setInputs = useCallback((partial: Partial<AnalysisInputs>) => {
    setInputsState(prev => {
      const next = { ...prev, ...partial };
      if ((partial.revenue !== undefined || partial.ebitda !== undefined) && partial.ebitdaMargin === undefined) {
        const rev = partial.revenue ?? prev.revenue;
        const eb = partial.ebitda ?? prev.ebitda;
        next.ebitdaMargin = rev > 0 ? Math.round((eb / rev) * 1000) / 10 : prev.ebitdaMargin;
      }
      return next;
    });
  }, []);

  const runAnalysis = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setIsFallback(false);

    // ── PHASE 1: instant results in browser (<200ms) ───────────────────────
    setStatus("loading");
    const instant = computeInstantResult(inputs);
    setResult(instant);
    setStatus("enhancing"); // show results immediately, AI enhancing in background

    // ── PHASE 2: AI enhancement (async, best-effort) ──────────────────────
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(inputs),
      });

      if (controller.signal.aborted) return;

      if (resp.ok) {
        const ai = await resp.json() as LiveAnalysisResult;
        if (!controller.signal.aborted && ai?.company) {
          setResult(mergeAiResult(instant, ai));
          setIsFallback(false);
        }
      }
      // If AI fails → keep instant results, no error shown
    } catch {
      // Network error or timeout → keep instant results silently
    }

    if (!controller.signal.aborted) {
      setStatus("success");
    }
  }, [inputs]);

  const retry = useCallback(async () => {
    await runAnalysis();
  }, [runAnalysis]);

  const value = useMemo(() => ({
    inputs, setInputs, result, status, error, isFallback, runAnalysis, retry,
  }), [inputs, setInputs, result, status, error, isFallback, runAnalysis, retry]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnalysis must be used within <AnalysisProvider>");
  return ctx;
}
