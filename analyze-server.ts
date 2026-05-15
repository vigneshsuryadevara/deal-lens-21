/**
 * analyze-server.ts — Optimized for speed.
 *
 * WHAT MAKES IT FAST:
 * 1. Market data fetch runs in PARALLEL with AI call (not before it)
 * 2. max_tokens: 600 — AI only writes commentary + IDs, numbers pre-filled
 * 3. Prompt asks for minimal JSON — just the text fields AI needs to write
 * 4. Pre-computed values (valuation, stats, bridge) injected after AI responds
 * 5. Yahoo Finance timeout: 3s max (was 5s)
 * 6. AI timeout: 20s (was 25s)
 *
 * Expected: 2–5 seconds total
 */

import { TRANSACTIONS } from "../data/transactions";
import { BUYERS, getBuyersForSector } from "../data/buyers";
import type { AnalysisInputs, LiveAnalysisResult } from "../types/analysis";
import { scoreTransactions, computeValuationStats } from "../services/comps/index";
import { runDcf, runLbo, buildFootballField } from "../services/financials/index";

const AI_TIMEOUT_MS = 20_000;
const MODEL = process.env["AI_MODEL"] ?? "claude-haiku-4-5-20251001";

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";
class CircuitBreaker {
  private state: CBState = "CLOSED";
  private failures = 0;
  private lastFail = 0;
  private halfOks = 0;
  isOpen(): boolean {
    if (this.state === "OPEN" && Date.now() - this.lastFail > 60_000) {
      this.state = "HALF_OPEN"; this.halfOks = 0; return false;
    }
    return this.state === "OPEN";
  }
  ok() {
    if (this.state === "HALF_OPEN" && ++this.halfOks >= 2) { this.state = "CLOSED"; this.failures = 0; }
    else if (this.state === "CLOSED") this.failures = 0;
  }
  fail() { this.lastFail = Date.now(); if (++this.failures >= 4) this.state = "OPEN"; }
}
const cb = new CircuitBreaker();

// ─── Input validation ─────────────────────────────────────────────────────────
export interface ValidationError { field: string; message: string; }

function clamp(v: unknown, min: number, max: number, fb: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fb;
}
function sanitize(v: unknown, maxLen = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().replace(/[\x00-\x1F\x7F]/g, " ").slice(0, maxLen);
}

export function validateAndSanitize(raw: unknown): { inputs: AnalysisInputs; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { inputs: defaultInputs(), errors: [{ field: "body", message: "Must be JSON object" }] };
  const r = raw as Record<string, unknown>;
  const company = sanitize(r.company) || "Unknown Company";
  const sector = sanitize(r.sector) || "General";
  const geography = sanitize(r.geography) || "North America";
  const dealType = sanitize(r.dealType) || "Strategic M&A";
  const context = sanitize(r.context, 400);
  if (!sanitize(r.company)) errors.push({ field: "company", message: "Required" });
  const revenue = clamp(r.revenue, 0.1, 1_000_000, 0);
  const ebitda = clamp(r.ebitda, -100_000, 1_000_000, 0);
  const growth = clamp(r.growth, -100, 10_000, 0);
  const netDebt = clamp(r.netDebt, -1_000_000, 1_000_000, 0);
  if (revenue <= 0) errors.push({ field: "revenue", message: "Must be > 0" });
  const rawMargin = clamp(r.ebitdaMargin, -100, 100, 0);
  const ebitdaMargin = revenue > 0 ? (rawMargin !== 0 ? rawMargin : (ebitda / revenue) * 100) : 0;
  return { inputs: { company, sector, geography, revenue, ebitda, growth, ebitdaMargin: Math.round(ebitdaMargin * 10) / 10, netDebt, dealType, context }, errors };
}

function defaultInputs(): AnalysisInputs {
  return { company: "Unknown", sector: "General", geography: "North America", revenue: 100, ebitda: 20, growth: 10, ebitdaMargin: 20, netDebt: 0, dealType: "Strategic M&A", context: "" };
}

// ─── Live market data — 3s timeout, non-blocking ──────────────────────────────
const SECTOR_ETFS: Record<string, string> = {
  "Software & SaaS": "IGV", "Healthcare": "XLV", "Industrials": "XLI",
  "Consumer": "XLY", "Financial Services": "XLF", "Energy & Power": "XLE",
  "TMT": "XLC", "Business Services": "XLI",
};

async function fetchMarketData(sector: string): Promise<string> {
  const etf = SECTOR_ETFS[sector] ?? "SPY";
  try {
    const [spxR, etfR] = await Promise.allSettled([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=2d`, { signal: AbortSignal.timeout(3_000), headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${etf}?interval=1d&range=2d`, { signal: AbortSignal.timeout(3_000), headers: { "User-Agent": "Mozilla/5.0" } }),
    ]);

    const parse = async (r: PromiseSettledResult<Response>) => {
      if (r.status === "rejected" || !r.value.ok) return null;
      const d = await r.value.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }[] } };
      const m = d?.chart?.result?.[0]?.meta;
      if (!m?.regularMarketPrice) return null;
      const pct = m.chartPreviousClose ? ((m.regularMarketPrice - m.chartPreviousClose) / m.chartPreviousClose * 100) : 0;
      return `${m.regularMarketPrice.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`;
    };

    const [spx, etfVal] = await Promise.all([parse(spxR), parse(etfR)]);
    if (!spx && !etfVal) return "Market data unavailable";
    return `S&P 500: ${spx ?? "n/a"} | ${etf}: ${etfVal ?? "n/a"}`;
  } catch {
    return "Market data unavailable";
  }
}

// ─── SLIM prompt — AI only writes text, numbers pre-filled ───────────────────
// KEY OPTIMIZATION: We ask AI to return ONLY the text fields (commentary,
// marketObservations, analystNote, relevantCompIds, topBuyerIds).
// All numbers are computed locally and merged in after. This cuts
// output tokens from ~1500 to ~400, making it 3x faster.

interface SlimAIResponse {
  commentary: string[];
  marketObservations: { label: string; value: string; tone: "positive" | "negative" | "neutral" }[];
  relevantCompIds: string[];
  topBuyerIds: string[];
  analystNote: string;
}

function buildPrompt(
  inp: AnalysisInputs,
  topComps: ReturnType<typeof scoreTransactions>,
  stats: ReturnType<typeof computeValuationStats>,
  dcf: ReturnType<typeof runDcf>,
  lbo: ReturnType<typeof runLbo>,
  marketData: string,
): string {
  const fmtB = (n: number) => `$${(n / 1e9).toFixed(1)}B`;
  const equity = inp.netDebt < 0 ? `net cash $${Math.abs(inp.netDebt)}M` : `net debt $${inp.netDebt}M`;

  const compRows = topComps.slice(0, 6).map(t =>
    `${t.id}|${t.target}|${t.acquirer}|${t.date.slice(0, 7)}|${t.evEbitda > 0 ? t.evEbitda.toFixed(1) + "x" : "n/m"}EV/E|${t.evRevenue.toFixed(1)}x EV/R|${t.type}`
  ).join("\n");

  const sectorBuyers = getBuyersForSector(inp.sector).slice(0, 6);
  const buyerRows = sectorBuyers.map(b => `${b.id}|${b.name}|${b.type}`).join("\n");

  return `M&A analyst. Analyze this deal. Respond ONLY with the JSON below — nothing else.

DEAL: ${inp.company} | ${inp.sector} | ${inp.geography} | Rev $${inp.revenue}M | EBITDA $${inp.ebitda}M (${inp.ebitdaMargin.toFixed(1)}%) | Growth ${inp.growth}% | ${equity}${inp.context ? ` | ${inp.context}` : ""}
MARKET: ${marketData}
VALUATIONS: Comps EV/EBITDA ${stats.medianEvEbitda.toFixed(1)}x | EV/Rev ${stats.medianEvRevenue.toFixed(1)}x | DCF ${fmtB(dcf.enterpriseValue)} | LBO(20%IRR) ${fmtB(lbo.entryEv)}

COMPARABLE TRANSACTIONS (pick 3-5 IDs):
${compRows}

SECTOR BUYERS (pick 2-4 IDs):
${buyerRows}

Return ONLY this JSON (no markdown, no extra text):
{"commentary":["1 sentence about ${inp.company} profile and positioning","1 sentence on valuation vs comps","1 sentence on buyer framing"],"marketObservations":[{"label":"${inp.sector} M&A","value":"short observation","tone":"positive"},{"label":"Financing","value":"short observation","tone":"neutral"},{"label":"Sponsor Appetite","value":"short observation","tone":"neutral"},{"label":"Deal Premium","value":"short observation","tone":"neutral"}],"relevantCompIds":["t1","t2","t3"],"topBuyerIds":["b1","b2"],"analystNote":"one sharp sentence"}`;
}

// ─── Merge AI text with pre-computed numbers ──────────────────────────────────
function mergeResult(
  ai: SlimAIResponse,
  inp: AnalysisInputs,
  stats: ReturnType<typeof computeValuationStats>,
  dcf: ReturnType<typeof runDcf>,
  lbo: ReturnType<typeof runLbo>,
  ff: ReturnType<typeof buildFootballField>,
  marketData: string,
): LiveAnalysisResult {
  return {
    company: inp.company,
    sector: inp.sector,
    geography: inp.geography,
    asOf: new Date().toISOString(),
    stats: {
      medianEvEbitda: stats.medianEvEbitda,
      medianEvRevenue: stats.medianEvRevenue,
      p25EvEbitda: stats.p25EvEbitda,
      p75EvEbitda: stats.p75EvEbitda,
      p25EvRevenue: stats.p25EvRevenue,
      p75EvRevenue: stats.p75EvRevenue,
    },
    valuationMethods: [
      { label: "Precedent Transactions (EV/EBITDA)", low: Math.round(ff[0]?.low ?? 0), high: Math.round(ff[0]?.high ?? 0), base: Math.round(ff[0]?.base ?? 0) },
      { label: "Precedent Transactions (EV/Revenue)", low: Math.round(ff[1]?.low ?? 0), high: Math.round(ff[1]?.high ?? 0), base: Math.round(ff[1]?.base ?? 0) },
      { label: "Trading Comparables", low: Math.round(ff[2]?.low ?? 0), high: Math.round(ff[2]?.high ?? 0), base: Math.round(ff[2]?.base ?? 0) },
      { label: "Discounted Cash Flow", low: Math.round(dcf.enterpriseValue * 0.85), high: Math.round(dcf.enterpriseValue * 1.15), base: dcf.enterpriseValue },
      { label: "LBO (Sponsor — 20% IRR)", low: Math.round(lbo.entryEv * 0.92), high: Math.round(lbo.entryEv * 1.06), base: lbo.entryEv },
      { label: "52-Week Trading Range", low: Math.round(ff[5]?.low ?? 0), high: Math.round(ff[5]?.high ?? 0), base: Math.round(ff[5]?.base ?? 0) },
    ],
    commentary: ai.commentary?.length ? ai.commentary : [`${inp.company} analysis complete.`],
    marketObservations: ai.marketObservations?.length ? ai.marketObservations : [
      { label: "Market Data", value: marketData, tone: "neutral" },
    ],
    relevantCompIds: ai.relevantCompIds ?? [],
    topBuyerIds: ai.topBuyerIds ?? [],
    assumptions: [
      { id: "a1", category: "Add-Backs", label: "Stock-based compensation", value: Math.round(inp.revenue * 0.04 * 10) / 10, unit: "$M", note: "Non-cash charge" },
      { id: "a2", category: "Add-Backs", label: "Non-recurring items", value: Math.round(inp.ebitda * 0.05 * 10) / 10, unit: "$M", note: "One-time charges" },
      { id: "a3", category: "Run-Rate", label: "ARR annualisation", value: Math.round(inp.revenue * 0.02 * 10) / 10, unit: "$M", note: "Partial-year contracts" },
    ],
    bridge: [
      { label: "Enterprise Value (Base)", value: Math.round(stats.medianEvEbitda * inp.ebitda * 1e6) },
      { label: "(+) Cash & equivalents", value: inp.netDebt < 0 ? Math.round(Math.abs(inp.netDebt) * 1e6) : 0 },
      { label: "(−) Total debt", value: inp.netDebt > 0 ? Math.round(inp.netDebt * 1e6) : 0 },
      { label: "(−) Capitalized leases", value: Math.round(inp.ebitda * 0.08 * 1e6) },
      { label: "(−) Minority interest", value: 0 },
      { label: "(−) Earnout / contingent", value: 0 },
    ],
    analystNote: ai.analystNote ?? `${inp.company}: ${inp.sector} deal at ${stats.medianEvEbitda.toFixed(1)}x EV/EBITDA.`,
    dataNote: `Live analysis · ${marketData.includes("n/a") ? "market data partial" : "market data live"} · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
  };
}

// ─── JSON parser ──────────────────────────────────────────────────────────────
function parseSlimResponse(raw: string): SlimAIResponse {
  const tries = [
    () => JSON.parse(raw),
    () => JSON.parse(raw.replace(/```(?:json)?|```/g, "").trim()),
    () => { const s = raw.indexOf("{"), e = raw.lastIndexOf("}"); return JSON.parse(raw.slice(s, e + 1)); },
    () => JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1").replace(/[\x00-\x1F\x7F]/g, " ")),
  ];
  for (const fn of tries) { try { const r = fn() as SlimAIResponse; if (r?.commentary) return r; } catch {} }
  throw new Error("parse failed");
}

// ─── Fallback using local models ──────────────────────────────────────────────
function buildFallback(inp: AnalysisInputs): LiveAnalysisResult {
  const scored = scoreTransactions(TRANSACTIONS, { sector: inp.sector, revenue: inp.revenue, ebitdaMargin: inp.ebitdaMargin, growth: inp.growth });
  const top = scored.slice(0, 8);
  const stats = computeValuationStats(top);
  const dcf = runDcf({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const lbo = runLbo({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const ff = buildFootballField(inp.revenue, inp.ebitda, inp.netDebt, stats, dcf, lbo);
  const f = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
  const eq = inp.netDebt < 0 ? `net cash of $${Math.abs(inp.netDebt)}M` : `net debt of $${inp.netDebt}M`;

  const aiSlim: SlimAIResponse = {
    commentary: [
      `${inp.company} generates $${inp.revenue}M LTM revenue at ${inp.ebitdaMargin.toFixed(1)}% EBITDA margin with ${inp.growth}% YoY growth — a profile consistent with premium ${inp.sector} assets.`,
      `Against ${top.length} sector-matched precedent transactions, the dataset supports ${stats.medianEvEbitda.toFixed(1)}x EV/EBITDA and ${stats.medianEvRevenue.toFixed(1)}x EV/Revenue, implying a valuation range of ${f(stats.p25EvEbitda * inp.ebitda * 1e6)}–${f(stats.p75EvEbitda * inp.ebitda * 1e6)}.`,
      `DCF implies ${f(dcf.enterpriseValue)} enterprise value; a financial sponsor at 20% IRR supports ${f(lbo.entryEv)} entry — the company carries ${eq}. Re-run for live AI commentary.`,
    ],
    marketObservations: [
      { label: "Sector Comps Scored", value: `${top.length} transactions`, tone: "neutral" },
      { label: "Median EV/EBITDA", value: `${stats.medianEvEbitda.toFixed(1)}x`, tone: "neutral" },
      { label: "DCF Implied EV", value: f(dcf.enterpriseValue), tone: "neutral" },
      { label: "LBO Entry (20% IRR)", value: f(lbo.entryEv), tone: "neutral" },
    ],
    relevantCompIds: top.map(t => t.id),
    topBuyerIds: getBuyersForSector(inp.sector).slice(0, 4).map(b => b.id),
    analystNote: `Dataset analysis — ${top.length} transactions scored with DCF & LBO models. Re-run for live commentary.`,
  };

  return mergeResult(aiSlim, inp, stats, dcf, lbo, ff, "Dataset mode");
}

function safeLog(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message.replace(/sk-ant-[A-Za-z0-9\-_]+/g, "[KEY]") : String(err);
  console.error(`[analyze] ${label}: ${msg.slice(0, 200)}`);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function runAnalysis(inputs: AnalysisInputs, apiKey: string): Promise<LiveAnalysisResult> {
  const t0 = Date.now();
  const tid = Math.random().toString(36).slice(2, 7).toUpperCase();
  console.log(`[${tid}] start: ${inputs.company}`);

  if (cb.isOpen()) return buildFallback(inputs);

  // ── All local computation (sync, ~5ms) ────────────────────────────────────
  const scored = scoreTransactions(TRANSACTIONS, { sector: inputs.sector, revenue: inputs.revenue, ebitdaMargin: inputs.ebitdaMargin, growth: inputs.growth });
  const stats = computeValuationStats(scored.slice(0, 8));
  const dcf = runDcf({ revenue: inputs.revenue, ebitda: inputs.ebitda, growth: inputs.growth, ebitdaMargin: inputs.ebitdaMargin, netDebt: inputs.netDebt });
  const lbo = runLbo({ revenue: inputs.revenue, ebitda: inputs.ebitda, growth: inputs.growth, ebitdaMargin: inputs.ebitdaMargin, netDebt: inputs.netDebt });
  const ff = buildFootballField(inputs.revenue, inputs.ebitda, inputs.netDebt, stats, dcf, lbo);
  const prompt = buildPrompt(inputs, scored, stats, dcf, lbo, "fetching...");

  // ── Market data + AI call run IN PARALLEL ────────────────────────────────
  // This is the key speed fix — market data no longer blocks the AI call
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  const [mktResult, aiResult] = await Promise.allSettled([
    fetchMarketData(inputs.sector),
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,  // AI writes ONLY text — numbers come from local models
        messages: [{ role: "user", content: prompt }],
      }),
    }),
  ]);

  clearTimeout(timer);

  const marketData = mktResult.status === "fulfilled" ? mktResult.value : "Market data unavailable";
  console.log(`[${tid}] parallel fetch done: ${Date.now() - t0}ms`);

  // Handle AI response
  if (aiResult.status === "rejected") {
    safeLog("AI fetch failed", aiResult.reason);
    cb.fail();
    return buildFallback(inputs);
  }

  const resp = aiResult.value;
  if (!resp.ok) {
    const status = resp.status;
    safeLog(`HTTP ${status}`, new Error(await resp.text().catch(() => "").then(b => b.slice(0, 200))));
    if (status === 429 || status >= 500) { cb.fail(); return buildFallback(inputs); }
    cb.fail();
    return buildFallback(inputs);
  }

  let data: { content?: { type: string; text?: string }[] };
  try { data = await resp.json() as typeof data; }
  catch (err) { safeLog("envelope parse", err); cb.fail(); return buildFallback(inputs); }

  const textBlocks = (data.content ?? []).filter(b => b.type === "text" && b.text);
  if (!textBlocks.length) { cb.fail(); return buildFallback(inputs); }

  const raw = textBlocks[textBlocks.length - 1].text!;
  console.log(`[${tid}] AI: ${raw.length} chars, ${Date.now() - t0}ms total`);

  let aiResponse: SlimAIResponse;
  try { aiResponse = parseSlimResponse(raw); }
  catch (err) { safeLog("parse failed", err); cb.fail(); return buildFallback(inputs); }

  cb.ok();
  const result = mergeResult(aiResponse, inputs, stats, dcf, lbo, ff, marketData);
  console.log(`[${tid}] ✓ done in ${Date.now() - t0}ms`);
  return result;
}
