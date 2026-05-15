/**
 * Comparable company matching engine.
 * Scores companies by sector, revenue scale, margin profile, and growth.
 */

import type { Transaction } from "@/data/transactions";

export interface CompsFilter {
  sector: string;
  revenue: number;      // $M
  ebitdaMargin: number; // %
  growth: number;       // %
  dealType?: string;
  maxTransactions?: number;
}

export interface ScoredTransaction extends Transaction {
  similarity: number;  // 0-100
  scoreBreakdown: {
    sectorMatch: number;
    revenueScale: number;
    marginProfile: number;
    growthProfile: number;
    recency: number;
  };
}

// Sector keyword matching
const SECTOR_KEYWORDS: Record<string, string[]> = {
  "Software & SaaS": ["software", "saas", "cloud", "analytics", "erp", "crm", "platform", "tech"],
  "Healthcare": ["health", "med", "pharma", "bio", "clinical", "life sciences"],
  "Industrials": ["industrial", "manufacturing", "engineering", "aerospace", "defense"],
  "Consumer": ["consumer", "retail", "ecommerce", "brand", "lifestyle"],
  "Financial Services": ["financial", "fintech", "payments", "banking", "insurance", "wealth"],
  "Energy & Power": ["energy", "oil", "gas", "power", "utilities", "renewables"],
  "TMT": ["telecom", "media", "technology", "digital", "internet", "broadcasting"],
  "Business Services": ["services", "consulting", "outsourcing", "staffing", "logistics"],
};

function sectorSimilarity(targetSector: string, transaction: Transaction): number {
  // Perfect match
  const target = targetSector.toLowerCase();
  const keywords = SECTOR_KEYWORDS[targetSector] ?? [];

  // Check if transaction rationale/notes contain sector keywords
  const txText = (transaction.rationale + " " + transaction.notes).toLowerCase();
  const matchCount = keywords.filter((kw) => txText.includes(kw)).length;
  const keywordScore = Math.min((matchCount / Math.max(keywords.length, 1)) * 100, 100);

  // Software & SaaS transactions generally apply to software sector inputs
  const isSaasTx = ["software", "saas", "cloud", "analytics", "erp", "crm"].some(
    (kw) => txText.includes(kw),
  );
  const isSaasTarget = target.includes("software") || target.includes("saas") || target.includes("tech");
  const crossSaasBonus = isSaasTx && isSaasTarget ? 30 : 0;

  return Math.min(keywordScore + crossSaasBonus, 100);
}

function revenueScaleSimilarity(targetRevenue: number, txDealValue: number): number {
  // Compare on deal value vs implied target size (rough proxy)
  const impliedTargetDealValue = targetRevenue * 10; // rough 10x revenue guess
  const ratio = Math.min(txDealValue, impliedTargetDealValue) / Math.max(txDealValue, impliedTargetDealValue);
  return ratio * 100;
}

function marginSimilarity(targetMargin: number, txMargin: number): number {
  const diff = Math.abs(targetMargin - txMargin);
  // Within 5pp = 100, degrades linearly to 0 at 30pp
  return Math.max(0, 100 - (diff / 30) * 100);
}

function growthSimilarity(targetGrowth: number, txGrowth: number): number {
  const diff = Math.abs(targetGrowth - txGrowth);
  return Math.max(0, 100 - (diff / 40) * 100);
}

function recencyScore(dateStr: string): number {
  const txYear = new Date(dateStr).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = currentYear - txYear;
  // 2024+ = 100, 2023 = 85, 2022 = 70, older = decays
  return Math.max(0, 100 - age * 15);
}

export function scoreTransactions(
  transactions: Transaction[],
  filter: CompsFilter,
): ScoredTransaction[] {
  return transactions
    .map((tx) => {
      const breakdown = {
        sectorMatch: sectorSimilarity(filter.sector, tx),
        revenueScale: revenueScaleSimilarity(filter.revenue, tx.dealValue / 1e6),
        marginProfile: marginSimilarity(filter.ebitdaMargin, tx.ebitdaMargin),
        growthProfile: growthSimilarity(filter.growth, tx.growth),
        recency: recencyScore(tx.date),
      };

      // Weighted average: sector is most important, then recency, then financials
      const similarity =
        breakdown.sectorMatch * 0.35 +
        breakdown.recency * 0.25 +
        breakdown.growthProfile * 0.20 +
        breakdown.marginProfile * 0.12 +
        breakdown.revenueScale * 0.08;

      return { ...tx, similarity: Math.round(similarity), scoreBreakdown: breakdown };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

export function selectBestComps(
  transactions: Transaction[],
  filter: CompsFilter,
  count = 8,
): ScoredTransaction[] {
  const scored = scoreTransactions(transactions, filter);
  return scored.slice(0, count);
}

export interface ValuationStats {
  medianEvEbitda: number;
  medianEvRevenue: number;
  p25EvEbitda: number;
  p75EvEbitda: number;
  p25EvRevenue: number;
  p75EvRevenue: number;
  meanEvEbitda: number;
  meanEvRevenue: number;
  count: number;
  ebitdaCount: number;
}

export function computeValuationStats(comps: Transaction[]): ValuationStats {
  const evRev = comps.map((t) => t.evRevenue).sort((a, b) => a - b);
  const evEb = comps.filter((t) => t.evEbitda > 0).map((t) => t.evEbitda).sort((a, b) => a - b);

  const p = (arr: number[], q: number) =>
    arr.length ? arr[Math.max(0, Math.floor((arr.length - 1) * q))] : 0;
  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  return {
    medianEvEbitda: p(evEb, 0.5),
    medianEvRevenue: p(evRev, 0.5),
    p25EvEbitda: p(evEb, 0.25),
    p75EvEbitda: p(evEb, 0.75),
    p25EvRevenue: p(evRev, 0.25),
    p75EvRevenue: p(evRev, 0.75),
    meanEvEbitda: mean(evEb),
    meanEvRevenue: mean(evRev),
    count: comps.length,
    ebitdaCount: evEb.length,
  };
}
