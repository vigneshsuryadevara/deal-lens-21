import { useMemo } from "react";
import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { StatPill } from "@/components/common/StatPill";
import { useAnalysis } from "@/context/AnalysisContext";
import { BUYERS, getBuyersForSector, type Buyer } from "@/data/buyers";
import { fmtCurrency } from "@/lib/format";
import { Building2, Briefcase, Star, Tag } from "lucide-react";
import { motion } from "framer-motion";

function AppetiteGauge({ score }: { score: number }) {
  const color = score >= 85 ? "bg-positive" : score >= 70 ? "bg-accent" : "bg-muted-foreground";
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

function SectorTag({ sector, isCurrent }: { sector: string; isCurrent: boolean }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${
      isCurrent
        ? "bg-accent/20 text-accent border border-accent/30"
        : "bg-surface-2 text-muted-foreground border border-border"
    }`}>
      {sector}
    </span>
  );
}

function BuyerCard({ buyer, isTop, currentSector }: { buyer: Buyer; isTop: boolean; currentSector: string }) {
  const Icon = buyer.type === "Strategic" ? Building2 : Briefcase;
  const sectorFitScore = buyer.sectors.includes(currentSector as Buyer["sectors"][number]) ? buyer.appetite : Math.round(buyer.appetite * 0.4);

  return (
    <div className={`group flex flex-col gap-2.5 rounded-md border bg-surface-1 p-3.5 transition-colors hover:border-border-strong ${
      isTop ? "border-accent/40 bg-accent/5" : "border-border"
    }`}>
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface-2 font-mono text-[11px] font-semibold text-foreground">
          {buyer.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate text-[13px] font-medium text-foreground">{buyer.name}</h4>
              {isTop && <Star className="h-2.5 w-2.5 fill-accent text-accent" />}
            </div>
            <StatPill tone={buyer.type === "Strategic" ? "neutral" : "warning"}>
              <Icon className="h-2.5 w-2.5" />{buyer.type}
            </StatPill>
          </div>
          <div className="text-[10.5px] text-muted-foreground">
            {buyer.hq}{buyer.aum && ` · ${buyer.aum}`}
          </div>
        </div>
      </div>

      {/* Sector coverage tags */}
      <div className="flex flex-wrap gap-1">
        {buyer.sectors.map(s => (
          <SectorTag key={s} sector={s} isCurrent={s === currentSector} />
        ))}
      </div>

      <p className="text-[11.5px] leading-relaxed text-foreground/80">{buyer.rationale}</p>

      <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2">
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {currentSector} Fit
          </div>
          <AppetiteGauge score={sectorFitScore} />
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
            <div key={d.target} className="flex items-center justify-between text-[11px]">
              <span className="text-foreground/90">{d.target}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] ${d.sector === currentSector ? "text-accent" : "text-muted-foreground/60"}`}>
                  {d.sector === currentSector ? "●" : "○"}
                </span>
                <span className="text-muted-foreground num">{fmtCurrency(d.size)} · {d.year}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BuyersTab() {
  const { result, inputs } = useAnalysis();
  const topIds = new Set<string>(result?.topBuyerIds ?? []);
  const currentSector = inputs.sector;

  const sorted = useMemo(() => {
    // Primary: AI-highlighted buyers first
    // Secondary: buyers who cover this specific sector
    // Tertiary: appetite × sectorFit score
    return [...BUYERS].sort((a, b) => {
      const aTop = topIds.has(a.id) ? 2 : 0;
      const bTop = topIds.has(b.id) ? 2 : 0;
      const aSector = a.sectors.includes(currentSector as Buyer["sectors"][number]) ? 1 : 0;
      const bSector = b.sectors.includes(currentSector as Buyer["sectors"][number]) ? 1 : 0;
      const aScore = aTop + aSector;
      const bScore = bTop + bSector;
      if (aScore !== bScore) return bScore - aScore;
      return (b.appetite * b.sectorFit) - (a.appetite * a.sectorFit);
    });
  }, [topIds, currentSector]);

  const sponsors = sorted.filter(b => b.type === "Sponsor");
  const strategics = sorted.filter(b => b.type === "Strategic");
  const sectorBuyerCount = BUYERS.filter(b => b.sectors.includes(currentSector as Buyer["sectors"][number])).length;

  return (
    <div className="space-y-3">
      {/* Sector context banner */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-1 px-3.5 py-2.5">
        <Tag className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] text-foreground">
          Showing <span className="font-semibold text-accent">{sectorBuyerCount} buyers</span> active in{" "}
          <span className="font-semibold">{currentSector}</span>
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          ● = prior deal in this sector · ★ = AI-identified
        </span>
      </div>

      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-3">
            <PanelTitle>Financial Sponsors</PanelTitle>
            <StatPill>{sponsors.length}</StatPill>
            {topIds.size > 0 && (
              <StatPill tone="positive">
                {[...topIds].filter(id => sponsors.some(b => b.id === id)).length} highlighted
              </StatPill>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            Ranked by {currentSector} sector fit + deployment appetite
          </span>
        </PanelHeader>
        <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {sponsors.map(b => (
            <BuyerCard key={b.id} buyer={b} isTop={topIds.has(b.id)} currentSector={currentSector} />
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
                {[...topIds].filter(id => strategics.some(b => b.id === id)).length} highlighted
              </StatPill>
            )}
          </div>
        </PanelHeader>
        <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {strategics.map(b => (
            <BuyerCard key={b.id} buyer={b} isTop={topIds.has(b.id)} currentSector={currentSector} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
