import { memo } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { FootballField } from "@/components/charts/FootballField";
import { useAnalysis } from "@/context/AnalysisContext";
import { TRANSACTIONS } from "@/data/transactions";
import { COMMENTARY as SEED_COMMENTARY, MARKET_OBSERVATIONS as SEED_OBSERVATIONS } from "@/data/analysis";
import { fmtCurrency, fmtMultiple } from "@/lib/format";
import { StatPill } from "@/components/common/StatPill";
import { Quote, TrendingUp, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

function buildValuationMethods(
  inputs: ReturnType<typeof useAnalysis>["inputs"],
  result: ReturnType<typeof useAnalysis>["result"],
) {
  if (result?.valuationMethods?.length) return result.valuationMethods;

  const evRevArr = TRANSACTIONS.map((t) => t.evRevenue).sort((a, b) => a - b);
  const evEbArr = TRANSACTIONS.filter((t) => t.evEbitda > 0).map((t) => t.evEbitda).sort((a, b) => a - b);
  const p = (arr: number[], q: number) => arr[Math.floor((arr.length - 1) * q)] ?? 0;
  const rev = inputs.revenue * 1e6;
  const eb = inputs.ebitda * 1e6;
  const medEE = p(evEbArr, 0.5);
  const medER = p(evRevArr, 0.5);

  return [
    { label: "Precedent Transactions (EV/EBITDA)", low: p(evEbArr, 0.25) * eb, high: p(evEbArr, 0.75) * eb, base: medEE * eb },
    { label: "Precedent Transactions (EV/Revenue)", low: p(evRevArr, 0.25) * rev, high: p(evRevArr, 0.75) * rev, base: medER * rev },
    { label: "Trading Comparables", low: medEE * 0.78 * eb, high: medEE * 1.05 * eb, base: medEE * 0.88 * eb },
    { label: "Discounted Cash Flow", low: medEE * 0.82 * eb, high: medEE * 1.25 * eb, base: medEE * 1.03 * eb },
    { label: "LBO (Sponsor — 20% IRR)", low: medEE * 0.68 * eb, high: medEE * 0.95 * eb, base: medEE * 0.80 * eb },
    { label: "52-Week Trading Range", low: medEE * 0.72 * eb, high: medEE * 1.10 * eb, base: medEE * 0.91 * eb },
  ];
}

const ValueCard = memo(function ValueCard({
  label, low, high, base, accent, unit,
}: { label: string; low: number; high: number; base: number; accent?: boolean; unit?: "currency" | "multiple" }) {
  const fmt = unit === "multiple" ? fmtMultiple : fmtCurrency;
  return (
    <div className={`flex flex-col gap-1.5 rounded-md border bg-surface-1 px-3.5 py-3 transition-colors hover:border-border-strong ${accent ? "border-accent/40" : "border-border"}`}>
      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[17px] font-semibold leading-none text-foreground num">{fmt(base)}</div>
      <div className="text-[10.5px] text-muted-foreground num">{fmt(low)} – {fmt(high)}</div>
    </div>
  );
});

export const OverviewTab = memo(function OverviewTab() {
  const { inputs, result, status, isFallback, retry } = useAnalysis();
  const isLoading = status === "loading";

  const valuationMethods = buildValuationMethods(inputs, result);
  const stats = result?.stats ?? (() => {
    const evRevArr = TRANSACTIONS.map((t) => t.evRevenue).sort((a, b) => a - b);
    const evEbArr = TRANSACTIONS.filter((t) => t.evEbitda > 0).map((t) => t.evEbitda).sort((a, b) => a - b);
    const p = (arr: number[], q: number) => arr[Math.floor((arr.length - 1) * q)] ?? 0;
    return { medianEvEbitda: p(evEbArr, 0.5), medianEvRevenue: p(evRevArr, 0.5), p25EvEbitda: p(evEbArr, 0.25), p75EvEbitda: p(evEbArr, 0.75), p25EvRevenue: p(evRevArr, 0.25), p75EvRevenue: p(evRevArr, 0.75) };
  })();

  const commentary = result?.commentary?.length ? result.commentary : SEED_COMMENTARY;
  const observations = result?.marketObservations?.length ? result.marketObservations : SEED_OBSERVATIONS;

  const baseMethod = valuationMethods.find((m) => m.label.includes("EV/EBITDA")) ?? valuationMethods[0];
  const lowEv = baseMethod?.low ?? 0;
  const highEv = baseMethod?.high ?? 0;
  const impliedEv = stats.medianEvEbitda * inputs.ebitda * 1e6;
  const netDebtAbs = inputs.netDebt * 1e6;
  const equityValue = impliedEv - netDebtAbs;

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-12 gap-3 animate-pulse">
        <div className="col-span-12 grid grid-cols-4 gap-2">
          {[0,1,2,3].map((i) => (
            <div key={i} className="h-20 rounded-md border border-border bg-surface-1" />
          ))}
        </div>
        <div className="col-span-12 lg:col-span-8 h-72 rounded-md border border-border bg-surface-1" />
        <div className="col-span-12 lg:col-span-4 h-72 rounded-md border border-border bg-surface-1" />
        <div className="col-span-12 h-24 rounded-md border border-border bg-surface-1" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-3">
      {isFallback && (
        <div className="col-span-12 flex items-center justify-between rounded-md border border-warning/30 bg-warning/5 px-4 py-2">
          <div className="flex items-center gap-2 text-[11px] text-warning">
            <AlertTriangle className="h-3 w-3" />
            Dataset analysis active — live AI commentary unavailable. Figures derived from precedent transaction database.
          </div>
          <button
            onClick={() => retry()}
            className="flex items-center gap-1 text-[10px] text-warning/80 hover:text-warning"
          >
            <RefreshCw className="h-3 w-3" /> Retry with live AI
          </button>
        </div>
      )}

      <div className="col-span-12 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <ValueCard label="Implied Enterprise Value (Base)" low={lowEv} high={highEv} base={impliedEv} accent />
        <ValueCard label="Equity Value (Base)" low={lowEv - netDebtAbs} high={highEv - netDebtAbs} base={equityValue} />
        <ValueCard label="Implied EV/EBITDA Range" low={stats.p25EvEbitda} high={stats.p75EvEbitda} base={stats.medianEvEbitda} unit="multiple" />
        <ValueCard label="Implied EV/Revenue Range" low={stats.p25EvRevenue} high={stats.p75EvRevenue} base={stats.medianEvRevenue} unit="multiple" />
      </div>

      <Panel className="col-span-12 lg:col-span-8">
        <PanelHeader>
          <PanelTitle>Valuation — Football Field</PanelTitle>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-gradient-to-r from-primary/60 to-accent/60" />Range
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-px bg-foreground" />Base case
            </span>
          </div>
        </PanelHeader>
        <div className="px-4 py-5">
          <FootballField methods={valuationMethods} currentImplied={impliedEv} />
        </div>
      </Panel>

      <Panel className="col-span-12 lg:col-span-4">
        <PanelHeader>
          <PanelTitle>Analyst Commentary</PanelTitle>
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <StatPill tone={result && !isFallback ? "positive" : "neutral"}>
              {result && !isFallback ? "Live" : "Dataset"}
            </StatPill>
          )}
        </PanelHeader>
        <div className="space-y-3 px-4 py-3.5">
          {commentary.map((c, i) => (
            <div key={i} className="flex gap-2.5 text-[11.5px] leading-relaxed text-foreground/90">
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-accent/70" />
              <p>{c}</p>
            </div>
          ))}
        </div>
        {result?.analystNote && (
          <div className="border-t border-border px-4 py-2 text-[10px] italic text-muted-foreground/70">
            {result.analystNote}
          </div>
        )}
        <div className="border-t border-border px-4 py-2 text-[9.5px] text-muted-foreground">
          {result?.dataNote ?? "Based on precedent transaction dataset · Run analysis to refresh"}
        </div>
      </Panel>

      <Panel className="col-span-12">
        <PanelHeader>
          <PanelTitle>Market Observations</PanelTitle>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {result && !isFallback ? "Live web-sourced" : "Dataset-based"}
          </span>
        </PanelHeader>
        <div className="grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
          {observations.slice(0, 8).map((o) => (
            <div key={o.label} className="px-4 py-3">
              <div className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">{o.label}</div>
              <div className={`mt-1 text-[16px] font-semibold num ${o.tone === "positive" ? "text-positive" : o.tone === "negative" ? "text-destructive" : "text-foreground"}`}>
                {o.value}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
});
