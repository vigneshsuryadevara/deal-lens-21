import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { FootballField } from "@/components/charts/FootballField";
import { VALUATION_METHODS, COMMENTARY, MARKET_OBSERVATIONS, ANALYSIS, STATS } from "@/data/analysis";
import { fmtCurrency } from "@/lib/format";
import { StatPill } from "@/components/common/StatPill";
import { Quote, TrendingUp } from "lucide-react";

const impliedEv = STATS.medianEvEbitda * ANALYSIS.ltmEbitda;
const equityValue = impliedEv - ANALYSIS.netDebt;
const lowEv = Math.min(...VALUATION_METHODS.map(m => m.low));
const highEv = Math.max(...VALUATION_METHODS.map(m => m.high));

function ValueCard({ label, low, high, base, accent }: { label: string; low: number; high: number; base: number; accent?: boolean }) {
  return (
    <div className={`rounded-md border bg-surface-1 px-3.5 py-3 ${accent ? "border-accent/40" : "border-border"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[18px] font-semibold leading-none text-foreground num">{fmtCurrency(base)}</div>
      <div className="mt-1 text-[11px] text-muted-foreground num">{fmtCurrency(low)} – {fmtCurrency(high)}</div>
    </div>
  );
}

export function OverviewTab() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-12 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <ValueCard label="Valuation Range" low={lowEv} high={highEv} base={impliedEv} accent />
        <ValueCard label="Equity Value (Base)" low={lowEv * 1.01} high={highEv * 1.01} base={equityValue} />
        <ValueCard label="Per Diluted Share*" low={lowEv / 65} high={highEv / 65} base={equityValue / 65} />
        <ValueCard label="Implied LTM Multiple" low={STATS.p25EvEbitda} high={STATS.p75EvEbitda} base={STATS.medianEvEbitda} />
      </div>

      <Panel className="col-span-12 lg:col-span-8">
        <PanelHeader>
          <PanelTitle>Football Field — Implied Enterprise Value</PanelTitle>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-gradient-to-r from-primary/60 to-accent/60" /> Range
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-px bg-foreground" /> Base case
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-px bg-accent" /> Implied
            </span>
          </div>
        </PanelHeader>
        <div className="px-4 py-5">
          <FootballField methods={VALUATION_METHODS} currentImplied={impliedEv} />
        </div>
      </Panel>

      <Panel className="col-span-12 lg:col-span-4">
        <PanelHeader>
          <PanelTitle>Analyst Commentary</PanelTitle>
          <StatPill tone="positive">High Confidence</StatPill>
        </PanelHeader>
        <div className="space-y-3 px-4 py-3.5">
          {COMMENTARY.map((c, i) => (
            <div key={i} className="flex gap-2.5 text-[12px] leading-relaxed text-foreground/90">
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-accent/70" />
              <p>{c}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-2.5 text-[10px] text-muted-foreground">
          Last updated by <span className="text-foreground">M. Reyes</span> · 12 min ago
        </div>
      </Panel>

      <Panel className="col-span-12">
        <PanelHeader>
          <PanelTitle>Market Observations</PanelTitle>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Trailing 12 months
          </span>
        </PanelHeader>
        <div className="grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
          {MARKET_OBSERVATIONS.map((o) => (
            <div key={o.label} className="px-4 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{o.label}</div>
              <div className={`mt-1 text-[18px] font-semibold num ${o.tone === "positive" ? "text-positive" : "text-foreground"}`}>
                {o.value}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
