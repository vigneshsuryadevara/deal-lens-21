import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { ArrowUpRight, MapPin, Layers, Clock, Loader2 } from "lucide-react";
import { useAnalysis } from "@/context/AnalysisContext";
import { TRANSACTIONS } from "@/data/transactions";
import { fmtCurrency, fmtMultiple, fmtPercent, fmtDate } from "@/lib/format";
import { StatPill } from "@/components/common/StatPill";

function AnimatedNumber({
  value,
  formatter,
}: {
  value: number;
  formatter: (n: number) => string;
}) {
  const m = useMotionValue(0);
  const text = useTransform(m, (n) => formatter(n));
  useEffect(() => {
    const c = animate(m, value, { duration: 0.9, ease: "easeOut" });
    return c.stop;
  }, [value, m]);
  return <motion.span className="num">{text}</motion.span>;
}

function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: { text: string; tone: "positive" | "negative" | "neutral" };
  tone?: "neutral" | "accent";
}) {
  return (
    <div className="group relative flex flex-col justify-between gap-2 rounded-md border border-border bg-surface-1 px-3.5 py-3 transition-colors hover:border-border-strong">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {tone === "accent" && <ArrowUpRight className="h-3 w-3 text-accent" />}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[20px] font-semibold leading-none tracking-tight text-foreground num">
          {value}
        </div>
        {sub && <StatPill tone={sub.tone}>{sub.text}</StatPill>}
      </div>
    </div>
  );
}

// Compute stats from static data as the default baseline
function getBaseStats(compIds?: string[]) {
  const set = compIds?.length
    ? TRANSACTIONS.filter((t) => compIds.includes(t.id))
    : TRANSACTIONS;
  const evRev = set.map((t) => t.evRevenue).sort((a, b) => a - b);
  const evEbitda = set
    .filter((t) => t.evEbitda > 0)
    .map((t) => t.evEbitda)
    .sort((a, b) => a - b);
  const median = (arr: number[]) => arr[Math.floor(arr.length / 2)] ?? 0;
  return {
    medianEvRevenue: median(evRev),
    medianEvEbitda: median(evEbitda),
  };
}

export function AnalysisHeader() {
  const { inputs, result, status } = useAnalysis();

  const stats = result?.stats
    ? result.stats
    : getBaseStats(result?.relevantCompIds);

  const impliedEv = stats.medianEvEbitda * inputs.ebitda * 1e6;
  const asOf = result?.asOf ?? new Date().toISOString();
  const isLoading = status === "loading";

  return (
    <div className="border-b border-border bg-background">
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : null}
              <h1 className="text-[22px] font-semibold leading-none tracking-tight text-foreground">
                {inputs.company}
              </h1>
              <StatPill tone={status === "success" ? "positive" : "neutral"}>
                {status === "success" ? "Live" : "Seed"}
              </StatPill>
              <StatPill>{inputs.dealType}</StatPill>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {inputs.sector}
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {inputs.geography}
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                As of {fmtDate(asOf)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Data coverage
            </span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 w-12 rounded-full ${
                    status === "success" && i < 4
                      ? "bg-positive"
                      : i < 3
                        ? "bg-positive"
                        : "bg-positive/40"
                  }`}
                />
              ))}
              <span className="ml-1 text-[10px] font-medium text-positive num">
                {status === "success" ? "Live" : "High"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Kpi
            label="LTM Revenue"
            value={
              <AnimatedNumber
                value={inputs.revenue * 1e6}
                formatter={fmtCurrency}
              />
            }
            sub={{ text: `+${inputs.growth}% YoY`, tone: "positive" }}
          />
          <Kpi
            label="LTM EBITDA"
            value={
              <AnimatedNumber
                value={inputs.ebitda * 1e6}
                formatter={fmtCurrency}
              />
            }
            sub={{ text: `${inputs.ebitdaMargin}% Margin`, tone: "neutral" }}
          />
          <Kpi
            label="Median EV / EBITDA"
            value={
              <AnimatedNumber
                value={stats.medianEvEbitda}
                formatter={fmtMultiple}
              />
            }
            sub={{
              text: result
                ? `${fmtMultiple(result.stats.p25EvEbitda)}–${fmtMultiple(result.stats.p75EvEbitda)}`
                : "IQR range",
              tone: "neutral",
            }}
          />
          <Kpi
            label="Median EV / Revenue"
            value={
              <AnimatedNumber
                value={stats.medianEvRevenue}
                formatter={fmtMultiple}
              />
            }
            sub={{
              text: result
                ? `${fmtMultiple(result.stats.p25EvRevenue)}–${fmtMultiple(result.stats.p75EvRevenue)}`
                : "IQR range",
              tone: "neutral",
            }}
          />
          <Kpi
            label="Implied Enterprise Value"
            value={
              <AnimatedNumber value={impliedEv} formatter={fmtCurrency} />
            }
            sub={{ text: "Base case", tone: "positive" }}
            tone="accent"
          />
        </div>
      </div>
    </div>
  );
}
