import { TRANSACTIONS } from "./transactions";

export const ANALYSIS = {
  company: "Helix Analytics",
  sector: "Software & SaaS",
  geography: "North America",
  asOf: "2025-05-13T00:00:00Z",
  ltmRevenue: 412e6,
  ltmEbitda: 78e6,
  growth: 24,
  ebitdaMargin: 19,
  netDebt: -45e6, // net cash
};

const evRev = TRANSACTIONS.map(t => t.evRevenue).sort((a, b) => a - b);
const evEbitda = TRANSACTIONS.map(t => t.evEbitda).filter(x => x > 0).sort((a, b) => a - b);
const median = (arr: number[]) => arr[Math.floor(arr.length / 2)];
const pct = (arr: number[], p: number) => arr[Math.floor((arr.length - 1) * p)];

export const STATS = {
  medianEvRev: median(evRev),
  medianEvEbitda: median(evEbitda),
  p25EvRev: pct(evRev, 0.25),
  p75EvRev: pct(evRev, 0.75),
  p25EvEbitda: pct(evEbitda, 0.25),
  p75EvEbitda: pct(evEbitda, 0.75),
};

export const VALUATION_METHODS = [
  { label: "Precedent Transactions (EV/EBITDA)", low: STATS.p25EvEbitda * ANALYSIS.ltmEbitda, high: STATS.p75EvEbitda * ANALYSIS.ltmEbitda, base: STATS.medianEvEbitda * ANALYSIS.ltmEbitda },
  { label: "Precedent Transactions (EV/Revenue)", low: STATS.p25EvRev * ANALYSIS.ltmRevenue, high: STATS.p75EvRev * ANALYSIS.ltmRevenue, base: STATS.medianEvRev * ANALYSIS.ltmRevenue },
  { label: "Trading Comparables", low: 2800e6, high: 4200e6, base: 3400e6 },
  { label: "Discounted Cash Flow", low: 3100e6, high: 4900e6, base: 3950e6 },
  { label: "LBO (20% IRR)", low: 2400e6, high: 3600e6, base: 3000e6 },
  { label: "52-Week Trading Range", low: 2600e6, high: 3850e6, base: 3225e6 },
];

export const COMMENTARY = [
  "Helix trades at a premium to the median software take-private multiple, reflecting durable ARR mix and 24% YoY growth.",
  "Strategic premium of 18–25% appears warranted given platform scarcity and limited mid-cap targets in the workflow analytics segment.",
  "Sponsor universe is well-capitalized; financing markets remain constructive for sub-$5B LBOs with high recurring revenue.",
  "Synergy case for industrial-software strategics could support a 30%+ premium under a competitive process.",
];

export const MARKET_OBSERVATIONS = [
  { label: "EV/EBITDA premium to S&P 500 software", value: "+12.4%", tone: "positive" as const },
  { label: "Sponsor share of $1B+ software deals (LTM)", value: "62%", tone: "neutral" as const },
  { label: "Median deal premium to undisturbed", value: "31%", tone: "neutral" as const },
  { label: "Take-private activity vs. 5Y avg", value: "+38%", tone: "positive" as const },
];

export const RECENT_SEARCHES = [
  { name: "Helix Analytics", sector: "Software & SaaS", date: "2025-05-13" },
  { name: "Aurora BioSystems", sector: "Healthcare", date: "2025-05-09" },
  { name: "Ironclad Logistics", sector: "Industrials", date: "2025-05-05" },
  { name: "Northwind Energy", sector: "Energy & Power", date: "2025-04-28" },
  { name: "Vertex Payments", sector: "Financial Services", date: "2025-04-22" },
];

export const SAVED_ANALYSES = [
  { id: "s1", name: "Helix Analytics", sector: "Software & SaaS", impliedEv: 3850e6, updated: "2025-05-13", status: "Live" },
  { id: "s2", name: "Aurora BioSystems", sector: "Healthcare", impliedEv: 1420e6, updated: "2025-05-09", status: "In Review" },
  { id: "s3", name: "Ironclad Logistics", sector: "Industrials", impliedEv: 2750e6, updated: "2025-05-05", status: "Final" },
  { id: "s4", name: "Northwind Energy", sector: "Energy & Power", impliedEv: 5200e6, updated: "2025-04-28", status: "Live" },
  { id: "s5", name: "Vertex Payments", sector: "Financial Services", impliedEv: 980e6, updated: "2025-04-22", status: "Final" },
  { id: "s6", name: "Cobalt Materials", sector: "Industrials", impliedEv: 1840e6, updated: "2025-04-18", status: "Archived" },
];

export const ASSUMPTIONS = [
  { id: "a1", category: "Add-Backs", label: "Stock-based compensation", value: 18.4, unit: "$M", note: "Normalized to 4.5% of revenue" },
  { id: "a2", category: "Add-Backs", label: "Restructuring charges", value: 6.2, unit: "$M", note: "FY24 reorganization" },
  { id: "a3", category: "Add-Backs", label: "M&A transaction costs", value: 3.1, unit: "$M", note: "Two completed bolt-ons" },
  { id: "a4", category: "Debt Adjustments", label: "Total debt", value: 0, unit: "$M", note: "No funded debt outstanding" },
  { id: "a5", category: "Debt Adjustments", label: "Cash & equivalents", value: 78.0, unit: "$M", note: "Excludes restricted cash" },
  { id: "a6", category: "Debt Adjustments", label: "Capitalized leases", value: 12.5, unit: "$M", note: "ASC 842 operating leases" },
  { id: "a7", category: "Other", label: "Minority interest", value: 4.8, unit: "$M", note: "JV with regional partner" },
  { id: "a8", category: "Other", label: "Earnout liability", value: 9.2, unit: "$M", note: "Two prior acquisitions; vests 2026" },
  { id: "a9", category: "Other", label: "Pension underfunding", value: 0, unit: "$M", note: "No defined benefit obligations" },
  { id: "a10", category: "Working Capital", label: "NWC adjustment", value: -3.4, unit: "$M", note: "vs. trailing 12-month average" },
];
