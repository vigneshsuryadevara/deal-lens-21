import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { ArrowUpRight, MapPin, Layers, Clock } from "lucide-react";
import { ANALYSIS, STATS } from "@/data/analysis";
import { fmtCurrency, fmtMultiple, fmtPercent, fmtDate } from "@/lib/format";
import { StatPill } from "@/components/common/StatPill";

function AnimatedNumber({ value, formatter }: { value: number; formatter: (n: number) => string }) {
  const m = useMotionValue(0);
  const text = useTransform(m, (n) => formatter(n));
  useEffect(() => {
    const c = animate(m, value, { duration: 0.9, ease: "easeOut" });
    return c.stop;
  }, [value, m]);
  return <motion.span className="num">{text}</motion.span>;
}

function Kpi({
  label, value, sub, tone = "neutral",
}: { label: string; value: React.ReactNode; sub?: { text: string; tone: "positive" | "negative" | "neutral" }; tone?: "neutral" | "accent" }) {
  return (
    <div className="group relative flex flex-col justify-between gap-2 rounded-md border border-border bg-surface-1 px-3.5 py-3 transition-colors hover:border-border-strong">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        {tone === "accent" && <ArrowUpRight className="h-3 w-3 text-accent" />}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[20px] font-semibold leading-none text-foreground num tracking-tight">{value}</div>
        {sub && <StatPill tone={sub.tone}>{sub.text}</StatPill>}
      </div>
    </div>
  );
}

const impliedEv = STATS.medianEvEbitda * ANALYSIS.ltmEbitda;

export function AnalysisHeader() {
  return (
    <div className="border-b border-border bg-background">
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold leading-none tracking-tight text-foreground">{ANALYSIS.company}</h1>
              <StatPill tone="positive">Active</StatPill>
              <StatPill>Private</StatPill>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{ANALYSIS.sector}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ANALYSIS.geography}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />As of {fmtDate(ANALYSIS.asOf)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Coverage</span>
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-12 rounded-full bg-positive" />
              <div className="h-1 w-12 rounded-full bg-positive" />
              <div className="h-1 w-12 rounded-full bg-positive" />
              <div className="h-1 w-12 rounded-full bg-positive/40" />
              <span className="ml-1 text-[10px] font-medium text-positive num">High</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Kpi label="LTM Revenue" value={<AnimatedNumber value={ANALYSIS.ltmRevenue} formatter={fmtCurrency} />} sub={{ text: `+${ANALYSIS.growth}% YoY`, tone: "positive" }} />
          <Kpi label="LTM EBITDA" value={<AnimatedNumber value={ANALYSIS.ltmEbitda} formatter={fmtCurrency} />} sub={{ text: `${ANALYSIS.ebitdaMargin}% Margin`, tone: "neutral" }} />
          <Kpi label="Median EV / EBITDA" value={<AnimatedNumber value={STATS.medianEvEbitda} formatter={fmtMultiple} />} sub={{ text: `${fmtMultiple(STATS.p25EvEbitda)}–${fmtMultiple(STATS.p75EvEbitda)}`, tone: "neutral" }} />
          <Kpi label="Median EV / Revenue" value={<AnimatedNumber value={STATS.medianEvRev} formatter={fmtMultiple} />} sub={{ text: `${fmtMultiple(STATS.p25EvRev)}–${fmtMultiple(STATS.p75EvRev)}`, tone: "neutral" }} />
          <Kpi label="Implied Enterprise Value" value={<AnimatedNumber value={impliedEv} formatter={fmtCurrency} />} sub={{ text: "Base case", tone: "positive" }} tone="accent" />
        </div>
      </div>
    </div>
  );
}

export { impliedEv };
