/**
 * Comparable company matching engine.
 * Scores transactions by exact sector match, revenue scale, margin, growth, recency.
 * Now uses the Transaction.sector field for precise sector filtering.
 */

import type { Transaction } from "@/data/transactions";

export interface CompsFilter {
  sector: string;
  revenue: number;       // $M
  ebitdaMargin: number;  // %
  growth: number;        // %
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

function marginSimilarity(target: number, tx: number): number {
  return Math.max(0, 100 - (Math.abs(target - tx) / 30) * 100);
}

function growthSimilarity(target: number, tx: number): number {
  return Math.max(0, 100 - (Math.abs(target - tx) / 40) * 100);
}

function recencyScore(dateStr: string): number {
  const age = new Date().getFullYear() - new Date(dateStr).getFullYear();
  return Math.max(0, 100 - age * 15);
}

function revenueScaleScore(targetRevenue: number, txDealValue: number): number {
  // Compare implied deal size — rough proxy: target rev * 10x = deal value
  const impliedDeal = targetRevenue * 10;
  const ratio = Math.min(impliedDeal, txDealValue) / Math.max(impliedDeal, txDealValue);
  return ratio * 100;
}

export function scoreTransactions(
  transactions: Transaction[],
  filter: CompsFilter,
): ScoredTransaction[] {
  return transactions
    .map((tx) => {
      // Exact sector match = 100, cross-sector = 0 (strict filtering)
      const sectorMatch = tx.sector === filter.sector ? 100 : 0;

      const breakdown = {
        sectorMatch,
        revenueScale: revenueScaleScore(filter.revenue, tx.dealValue / 1e6),
        marginProfile: marginSimilarity(filter.ebitdaMargin, tx.ebitdaMargin),
        growthProfile: growthSimilarity(filter.growth, tx.growth),
        recency: recencyScore(tx.date),
      };

      // Sector match is the gate: if sector doesn't match, cap similarity at 15
      // so cross-sector comps appear at bottom, never pollute the top set
      const raw =
        breakdown.sectorMatch * 0.40 +
        breakdown.recency * 0.25 +
        breakdown.growthProfile * 0.18 +
        breakdown.marginProfile * 0.12 +
        breakdown.revenueScale * 0.05;

      const similarity = sectorMatch === 0
        ? Math.min(raw, 15)   // cross-sector: deprioritised
        : Math.round(raw);

      return { ...tx, similarity, scoreBreakdown: breakdown };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

export function selectBestComps(
  transactions: Transaction[],
  filter: CompsFilter,
  count = 8,
): ScoredTransaction[] {
  const scored = scoreTransactions(transactions, filter);

  // Prefer at least 4 same-sector comps; fill remainder cross-sector
  const sameSector = scored.filter(t => t.sector === filter.sector);
  const crossSector = scored.filter(t => t.sector !== filter.sector);

  const selected = [
    ...sameSector.slice(0, count),
    ...crossSector.slice(0, Math.max(0, count - sameSector.length)),
  ].slice(0, count);

  return selected;
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
  const evRev = comps.map(t => t.evRevenue).sort((a, b) => a - b);
  const evEb = comps.filter(t => t.evEbitda > 0).map(t => t.evEbitda).sort((a, b) => a - b);

  const p = (arr: number[], q: number) =>
    arr.length ? arr[Math.max(0, Math.floor((arr.length - 1) * q))] : 0;
  const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

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
