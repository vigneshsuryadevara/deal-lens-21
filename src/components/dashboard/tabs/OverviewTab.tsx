import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { FootballField } from "@/components/charts/FootballField";
import { useAnalysis } from "@/context/AnalysisContext";
import { TRANSACTIONS } from "@/data/transactions";
import {
  COMMENTARY as SEED_COMMENTARY,
  MARKET_OBSERVATIONS as SEED_OBSERVATIONS,
} from "@/data/analysis";
import { fmtCurrency, fmtMultiple } from "@/lib/format";
import { StatPill } from "@/components/common/StatPill";
import { Quote, TrendingUp, Loader2 } from "lucide-react";

// Build valuation methods from live stats + target financials
function buildValuationMethods(
  inputs: ReturnType<typeof useAnalysis>["inputs"],
  result: ReturnType<typeof useAnalysis>["result"],
) {
  if (result?.valuationMethods?.length) return result.valuationMethods;

  // Fallback: derive from static transaction medians
  const evRevArr = TRANSACTIONS.map((t) => t.evRevenue).sort((a, b) => a - b);
  const evEbArr = TRANSACTIONS.filter((t) => t.evEbitda > 0)
    .map((t) => t.evEbitda)
    .sort((a, b) => a - b);
  const p = (arr: number[], q: number) => arr[Math.floor((arr.length - 1) * q)];
  const rev = inputs.revenue * 1e6;
  const eb = inputs.ebitda * 1e6;

  return [
    {
      label: "Precedent Transactions (EV/EBITDA)",
      low: p(evEbArr, 0.25) * eb,
      high: p(evEbArr, 0.75) * eb,
      base: p(evEbArr, 0.5) * eb,
    },
    {
      label: "Precedent Transactions (EV/Revenue)",
      low: p(evRevArr, 0.25) * rev,
      high: p(evRevArr, 0.75) * rev,
      base: p(evRevArr, 0.5) * rev,
    },
    { label: "Trading Comparables", low: 2800e6, high: 4200e6, base: 3400e6 },
    { label: "Discounted Cash Flow", low: 3100e6, high: 4900e6, base: 3950e6 },
    { label: "LBO (Sponsor — 20% IRR)", low: 2400e6, high: 3600e6, base: 3000e6 },
    { label: "52-Week Trading Range", low: 2600e6, high: 3850e6, base: 3225e6 },
  ];
}

function ValueCard({
  label,
  low,
  high,
  base,
  accent,
}: {
  label: string;
  low: number;
  high: number;
  base: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border bg-surface-1 px-3.5 py-3 ${accent ? "border-accent/40" : "border-border"}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-[18px] font-semibold leading-none text-foreground num">
        {fmtCurrency(base)}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground num">
        {fmtCurrency(low)} – {fmtCurrency(high)}
      </div>
    </div>
  );
}

export function OverviewTab() {
  const { inputs, result, status } = useAnalysis();
  const isLoading = status === "loading";

  const valuationMethods = buildValuationMethods(inputs, result);
  const commentary = result?.commentary?.length ? result.commentary : SEED_COMMENTARY;
  const observations = result?.marketObservations?.length
    ? result.marketObservations
    : SEED_OBSERVATIONS;

  const stats = result?.stats ?? (() => {
    const evEbArr = TRANSACTIONS.filter((t) => t.evEbitda > 0)
      .map((t) => t.evEbitda)
      .sort((a, b) => a - b);
    const evRevArr = TRANSACTIONS.map((t) => t.evRevenue).sort((a, b) => a - b);
    const p = (arr: number[], q: number) => arr[Math.floor((arr.length - 1) * q)];
    return {
      medianEvEbitda: p(evEbArr, 0.5),
      medianEvRevenue: p(evRevArr, 0.5),
      p25EvEbitda: p(evEbArr, 0.25),
      p75EvEbitda: p(evEbArr, 0.75),
      p25EvRevenue: p(evRevArr, 0.25),
      p75EvRevenue: p(evRevArr, 0.75),
    };
  })();

  const impliedEv = stats.medianEvEbitda * inputs.ebitda * 1e6;
  const netDebtAbs = inputs.netDebt * 1e6;
  const equityValue = impliedEv - netDebtAbs;
  const lowEv = Math.min(...valuationMethods.map((m) => m.low));
  const highEv = Math.max(...valuationMethods.map((m) => m.high));

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <ValueCard
          label="Valuation Range"
          low={lowEv}
          high={highEv}
          base={impliedEv}
          accent
        />
        <ValueCard
          label="Equity Value (Base)"
          low={lowEv - netDebtAbs}
          high={highEv - netDebtAbs}
          base={equityValue}
        />
        <ValueCard
          label="Per Diluted Share*"
          low={lowEv / 65e6}
          high={highEv / 65e6}
          base={equityValue / 65e6}
        />
        <ValueCard
          label="Implied LTM Multiple"
          low={stats.p25EvEbitda}
          high={stats.p75EvEbitda}
          base={stats.medianEvEbitda}
        />
      </div>

      <Panel className="col-span-12 lg:col-span-8">
        <PanelHeader>
          <PanelTitle>Football Field — Implied Enterprise Value</PanelTitle>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-gradient-to-r from-primary/60 to-accent/60" />
              Range
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-px bg-foreground" />
              Base case
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
            <StatPill tone={result ? "positive" : "neutral"}>
              {result ? "Live" : "Seed"}
            </StatPill>
          )}
        </PanelHeader>
        <div className="space-y-3 px-4 py-3.5">
          {commentary.map((c, i) => (
            <div
              key={i}
              className="flex gap-2.5 text-[12px] leading-relaxed text-foreground/90"
            >
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-accent/70" />
              <p>{c}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-2.5 text-[10px] text-muted-foreground">
          {result?.dataNote ?? "Based on precedent transaction dataset · Run analysis to refresh"}
        </div>
      </Panel>

      <Panel className="col-span-12">
        <PanelHeader>
          <PanelTitle>Market Observations</PanelTitle>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            Trailing 12 months
          </span>
        </PanelHeader>
        <div className="grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
          {observations.map((o) => (
            <div key={o.label} className="px-4 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {o.label}
              </div>
              <div
                className={`mt-1 text-[18px] font-semibold num ${
                  o.tone === "positive"
                    ? "text-positive"
                    : o.tone === "negative"
                      ? "text-destructive"
                      : "text-foreground"
                }`}
              >
                {o.value}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
