import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { StatPill } from "@/components/common/StatPill";
import { useAnalysis } from "@/context/AnalysisContext";
import { BUYERS } from "@/data/buyers";
import { fmtCurrency } from "@/lib/format";
import { Building2, Briefcase, Star } from "lucide-react";
import { motion } from "framer-motion";

function AppetiteGauge({ score }: { score: number }) {
  const tone =
    score >= 85 ? "positive" : score >= 70 ? "accent" : "muted";
  const color =
    tone === "positive"
      ? "bg-positive"
      : tone === "accent"
        ? "bg-accent"
        : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full ${color}`}
        />
      </div>
      <span className="text-[10px] font-medium num text-foreground">{score}</span>
    </div>
  );
}

function BuyerCard({
  buyer,
  isTop,
}: {
  buyer: (typeof BUYERS)[number];
  isTop: boolean;
}) {
  const Icon = buyer.type === "Strategic" ? Building2 : Briefcase;
  return (
    <div
      className={`group flex flex-col gap-2.5 rounded-md border bg-surface-1 p-3.5 transition-colors hover:border-border-strong ${
        isTop ? "border-accent/40 bg-accent/5" : "border-border"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface-2 font-mono text-[11px] font-semibold text-foreground">
          {buyer.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate text-[13px] font-medium text-foreground">
                {buyer.name}
              </h4>
              {isTop && <Star className="h-2.5 w-2.5 fill-accent text-accent" />}
            </div>
            <StatPill tone={buyer.type === "Strategic" ? "neutral" : "warning"}>
              <Icon className="h-2.5 w-2.5" />
              {buyer.type}
            </StatPill>
          </div>
          <div className="text-[10.5px] text-muted-foreground">
            {buyer.hq}
            {buyer.aum && ` · ${buyer.aum}`}
          </div>
        </div>
      </div>

      <p className="text-[11.5px] leading-relaxed text-foreground/80">{buyer.rationale}</p>

      <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2">
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sector Fit
          </div>
          <AppetiteGauge score={buyer.sectorFit} />
        </div>
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Appetite
          </div>
          <AppetiteGauge score={buyer.appetite} />
        </div>
      </div>

      <div className="border-t border-border/60 pt-2">
        <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Acquisitions
        </div>
        <div className="space-y-0.5">
          {buyer.pastDeals.slice(0, 3).map((d) => (
            <div
              key={d.target}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="text-foreground/90">{d.target}</span>
              <span className="text-muted-foreground num">
                {fmtCurrency(d.size)} · {d.year}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BuyersTab() {
  const { result } = useAnalysis();
  const topIds = new Set<string>(result?.topBuyerIds ?? []);

  // Sort: top buyers first within each group
  const sorted = [...BUYERS].sort((a, b) => {
    const aTop = topIds.has(a.id) ? 1 : 0;
    const bTop = topIds.has(b.id) ? 1 : 0;
    if (aTop !== bTop) return bTop - aTop;
    return b.sectorFit * b.appetite - a.sectorFit * a.appetite;
  });

  const sponsors = sorted.filter((b) => b.type === "Sponsor");
  const strategics = sorted.filter((b) => b.type === "Strategic");

  return (
    <div className="space-y-3">
      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-3">
            <PanelTitle>Financial Sponsors</PanelTitle>
            <StatPill>{sponsors.length}</StatPill>
            {topIds.size > 0 && (
              <StatPill tone="positive">
                {[...topIds].filter((id) => sponsors.some((b) => b.id === id)).length} highlighted
              </StatPill>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {topIds.size > 0 ? "★ Highlighted = identified by analysis" : "Ranked by appetite × sector fit"}
          </span>
        </PanelHeader>
        <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {sponsors.map((b) => (
            <BuyerCard key={b.id} buyer={b} isTop={topIds.has(b.id)} />
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-3">
            <PanelTitle>Strategic Acquirers</PanelTitle>
            <StatPill>{strategics.length}</StatPill>
            {topIds.size > 0 && (
              <StatPill tone="positive">
                {[...topIds].filter((id) => strategics.some((b) => b.id === id)).length} highlighted
              </StatPill>
            )}
          </div>
        </PanelHeader>
        <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {strategics.map((b) => (
            <BuyerCard key={b.id} buyer={b} isTop={topIds.has(b.id)} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
