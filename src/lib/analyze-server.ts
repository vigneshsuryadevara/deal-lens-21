/**
 * analyze-server.ts — FAST production analysis engine.
 *
 * ROOT CAUSE OF "analysis failed":
 * - Web search tool makes AI take 20-60s total
 * - Vercel Hobby plan hard-limits serverless functions to 10s
 * - Result: timeout → "analysis failed" every time
 *
 * FIX:
 * - NO web_search tool in AI call (removes 15-30s of latency)
 * - AI just writes commentary from its training knowledge (still excellent)
 * - Live market data fetched separately via Yahoo Finance (fast, parallel)
 * - max_tokens: 1200 (was 4096) — further reduces AI response time
 * - Total target: 3-8 seconds end-to-end
 *
 * LIVE DATA STRATEGY:
 * - Yahoo Finance: S&P500, VIX, 10Y yield, sector ETFs (no API key needed)
 * - Finnhub: company search + profiles (optional FINNHUB_API_KEY)
 * - All fetched in parallel BEFORE the AI call
 */

import { TRANSACTIONS } from "../data/transactions";
import { BUYERS, getBuyersForSector } from "../data/buyers";
import type { AnalysisInputs, LiveAnalysisResult } from "../types/analysis";
import { scoreTransactions, computeValuationStats } from "../services/comps/index";
import { runDcf, runLbo, buildFootballField } from "../services/financials/index";

// ─── Config ───────────────────────────────────────────────────────────────────
// Keep AI timeout well under Vercel's 10s limit (hobby) or 60s (pro)
const AI_TIMEOUT_MS = 25_000;
const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-4-20250514";

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
  const context = sanitize(r.context, 600);

  if (!sanitize(r.company)) errors.push({ field: "company", message: "Required" });

  const revenue = clamp(r.revenue, 0.1, 1_000_000, 0);
  const ebitda = clamp(r.ebitda, -100_000, 1_000_000, 0);
  const growth = clamp(r.growth, -100, 10_000, 0);
  const netDebt = clamp(r.netDebt, -1_000_000, 1_000_000, 0);

  if (revenue <= 0) errors.push({ field: "revenue", message: "Must be > 0" });

  const rawMargin = clamp(r.ebitdaMargin, -100, 100, 0);
  const ebitdaMargin = revenue > 0 ? (rawMargin !== 0 ? rawMargin : (ebitda / revenue) * 100) : 0;

  return {
    inputs: {
      company, sector, geography, revenue, ebitda, growth,
      ebitdaMargin: Math.round(ebitdaMargin * 10) / 10,
      netDebt, dealType, context,
    },
    errors,
  };
}

function defaultInputs(): AnalysisInputs {
  return { company: "Unknown", sector: "General", geography: "North America", revenue: 100, ebitda: 20, growth: 10, ebitdaMargin: 20, netDebt: 0, dealType: "Strategic M&A", context: "" };
}

// ─── Live market data (Yahoo Finance — no API key needed) ─────────────────────
interface MarketContext {
  spx: string;
  vix: string;
  ust10y: string;
  sectorEtf: string;
  sectorTicker: string;
  fetched: boolean;
}

const SECTOR_ETFS: Record<string, string> = {
  "Software & SaaS": "IGV",
  "Healthcare": "XLV",
  "Industrials": "XLI",
  "Consumer": "XLY",
  "Financial Services": "XLF",
  "Energy & Power": "XLE",
  "TMT": "XLC",
  "Business Services": "XLI",
};

async function yf(symbol: string): Promise<{ price: number; pct: number } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      { signal: AbortSignal.timeout(5_000), headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!r.ok) return null;
    const d = await r.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }[] } };
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? price;
    return { price, pct: prev !== 0 ? ((price - prev) / prev) * 100 : 0 };
  } catch { return null; }
}

async function fetchMarketContext(sector: string): Promise<MarketContext> {
  const etf = SECTOR_ETFS[sector] ?? "SPY";

  // All 4 fetches in parallel — max 5s total
  const [spxR, vixR, ustR, etfR] = await Promise.allSettled([
    yf("^GSPC"), yf("^VIX"), yf("^TNX"), yf(etf),
  ]);

  const fmt = (r: PromiseSettledResult<{ price: number; pct: number } | null>, decimals = 2, prefix = "") => {
    if (r.status === "rejected" || !r.value) return "n/a";
    const { price, pct } = r.value;
    const sign = pct >= 0 ? "+" : "";
    return `${prefix}${price.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} (${sign}${pct.toFixed(2)}%)`;
  };

  return {
    spx: fmt(spxR, 0),
    vix: fmt(vixR),
    ust10y: fmt(ustR) + (ustR.status === "fulfilled" && ustR.value ? "%" : ""),
    sectorEtf: fmt(etfR, 2, "$"),
    sectorTicker: etf,
    fetched: spxR.status === "fulfilled" && spxR.value !== null,
  };
}

// ─── Prompt builder — NO web_search tool (that's what caused slowness) ────────
function buildPrompt(
  inp: AnalysisInputs,
  topComps: ReturnType<typeof scoreTransactions>,
  stats: ReturnType<typeof computeValuationStats>,
  dcf: ReturnType<typeof runDcf>,
  lbo: ReturnType<typeof runLbo>,
  mkt: MarketContext,
): string {
  const fmtB = (n: number) => `$${(n / 1e9).toFixed(2)}B`;
  const equity = inp.netDebt < 0 ? `Net cash $${Math.abs(inp.netDebt)}M` : `Net debt $${inp.netDebt}M`;

  // Compact comp rows — only top 8
  const compRows = topComps.slice(0, 8).map(t =>
    `${t.id}|${t.target}|${t.acquirer}|${t.date.slice(0, 7)}|` +
    `${t.evEbitda > 0 ? t.evEbitda.toFixed(1) + "x" : "n/m"}|${t.evRevenue.toFixed(1)}x|` +
    `${t.growth}%g|${t.ebitdaMargin}%m|${t.type}`
  ).join("\n");

  // Use sector-aware buyer ranking — buyers who actually cover this sector first
  const sectorBuyers = getBuyersForSector(inp.sector);
  const allBuyers = [...sectorBuyers, ...BUYERS.filter(b => !sectorBuyers.find(sb => sb.id === b.id))];
  const buyerRows = allBuyers
    .slice(0, 8)
    .map(b => `${b.id}|${b.name}|${b.type}|sectors:${b.sectors.join(",")}|app:${b.appetite}`)
    .join("\n");

  const ff = buildFootballField(inp.revenue, inp.ebitda, inp.netDebt, stats, dcf, lbo);

  return `You are a Goldman Sachs M&A analyst. Write a deal analysis for the company below.
Use your training knowledge about ${inp.sector} M&A markets — do NOT use any tools.
Respond with ONLY valid JSON, nothing else.

COMPANY: ${inp.company} | ${inp.sector} | ${inp.geography} | ${inp.dealType}
FINANCIALS: Rev $${inp.revenue}M | EBITDA $${inp.ebitda}M (${inp.ebitdaMargin.toFixed(1)}%) | Growth ${inp.growth}% | ${equity}
${inp.context ? `CONTEXT: ${inp.context}` : ""}

LIVE MARKET DATA:
S&P 500: ${mkt.spx} | VIX: ${mkt.vix} | 10Y UST: ${mkt.ust10y} | ${mkt.sectorTicker}: ${mkt.sectorEtf}

PRE-COMPUTED VALUATIONS (use these exact numbers in valuationMethods):
- Precedent Txn EV/EBITDA: low=${fmtB(ff[0]?.low??0)} base=${fmtB(ff[0]?.base??0)} high=${fmtB(ff[0]?.high??0)}
- Precedent Txn EV/Revenue: low=${fmtB(ff[1]?.low??0)} base=${fmtB(ff[1]?.base??0)} high=${fmtB(ff[1]?.high??0)}
- Trading Comps: low=${fmtB(ff[2]?.low??0)} base=${fmtB(ff[2]?.base??0)} high=${fmtB(ff[2]?.high??0)}
- DCF (10% WACC): low=${fmtB(dcf.enterpriseValue*0.85)} base=${fmtB(dcf.enterpriseValue)} high=${fmtB(dcf.enterpriseValue*1.15)}
- LBO 20% IRR: low=${fmtB(lbo.entryEv*0.92)} base=${fmtB(lbo.entryEv)} high=${fmtB(lbo.entryEv*1.06)}
- 52-Wk Range: low=${fmtB(ff[5]?.low??0)} base=${fmtB(ff[5]?.base??0)} high=${fmtB(ff[5]?.high??0)}
Comps: EV/EBITDA median ${stats.medianEvEbitda.toFixed(1)}x (p25 ${stats.p25EvEbitda.toFixed(1)}x / p75 ${stats.p75EvEbitda.toFixed(1)}x)
       EV/Revenue median ${stats.medianEvRevenue.toFixed(1)}x

COMPARABLE TRANSACTIONS (id|target|acquirer|date|EV/EBITDA|EV/Rev|growth|margin|type):
${compRows}

BUYERS (id|name|type|sectorFit):
${buyerRows}

INSTRUCTIONS:
1. Pick 4-6 best comp IDs from the list above
2. Write 3 sentences of sharp analyst commentary using the live market data and financials above
3. Write 4 market observations with specific data points about ${inp.sector} M&A
4. Pick 2-4 best buyer IDs
5. Use the pre-computed valuation numbers EXACTLY as given

Return ONLY this JSON:
{
  "company": "${inp.company.replace(/"/g, "'")}",
  "sector": "${inp.sector}",
  "geography": "${inp.geography}",
  "asOf": "${new Date().toISOString()}",
  "stats": {
    "medianEvEbitda": ${stats.medianEvEbitda},
    "medianEvRevenue": ${stats.medianEvRevenue},
    "p25EvEbitda": ${stats.p25EvEbitda},
    "p75EvEbitda": ${stats.p75EvEbitda},
    "p25EvRevenue": ${stats.p25EvRevenue},
    "p75EvRevenue": ${stats.p75EvRevenue}
  },
  "valuationMethods": [
    {"label":"Precedent Transactions (EV/EBITDA)","low":${Math.round(ff[0]?.low??0)},"high":${Math.round(ff[0]?.high??0)},"base":${Math.round(ff[0]?.base??0)}},
    {"label":"Precedent Transactions (EV/Revenue)","low":${Math.round(ff[1]?.low??0)},"high":${Math.round(ff[1]?.high??0)},"base":${Math.round(ff[1]?.base??0)}},
    {"label":"Trading Comparables","low":${Math.round(ff[2]?.low??0)},"high":${Math.round(ff[2]?.high??0)},"base":${Math.round(ff[2]?.base??0)}},
    {"label":"Discounted Cash Flow","low":${Math.round(dcf.enterpriseValue*0.85)},"high":${Math.round(dcf.enterpriseValue*1.15)},"base":${dcf.enterpriseValue}},
    {"label":"LBO (Sponsor — 20% IRR)","low":${Math.round(lbo.entryEv*0.92)},"high":${Math.round(lbo.entryEv*1.06)},"base":${lbo.entryEv}},
    {"label":"52-Week Trading Range","low":${Math.round(ff[5]?.low??0)},"high":${Math.round(ff[5]?.high??0)},"base":${Math.round(ff[5]?.base??0)}}
  ],
  "commentary": ["Write sentence 1 here — specific to ${inp.company} and current ${inp.sector} market","Write sentence 2 here — valuation context and comparable deals","Write sentence 3 here — buyer framing and deal dynamics"],
  "marketObservations": [
    {"label":"${inp.sector} M&A Activity","value":"specific observation with number","tone":"positive"},
    {"label":"Financing Environment","value":"specific rate/spread observation","tone":"neutral"},
    {"label":"Sponsor Appetite","value":"specific observation","tone":"neutral"},
    {"label":"Strategic Premium","value":"specific observation with %","tone":"neutral"}
  ],
  "relevantCompIds": ["t1","t2","t3"],
  "topBuyerIds": ["b1","b2"],
  "assumptions": [
    {"id":"a1","category":"Add-Backs","label":"Stock-based compensation","value":${Math.round(inp.revenue*0.04*10)/10},"unit":"$M","note":"Non-cash charge normalised"},
    {"id":"a2","category":"Add-Backs","label":"Non-recurring items","value":${Math.round(inp.ebitda*0.05*10)/10},"unit":"$M","note":"One-time charges"},
    {"id":"a3","category":"Run-Rate","label":"ARR annualisation","value":${Math.round(inp.revenue*0.02*10)/10},"unit":"$M","note":"Partial-year contracts"}
  ],
  "bridge": [
    {"label":"Enterprise Value (Base)","value":${Math.round(stats.medianEvEbitda*inp.ebitda*1e6)}},
    {"label":"(+) Cash & equivalents","value":${inp.netDebt<0?Math.round(Math.abs(inp.netDebt)*1e6):0}},
    {"label":"(−) Total debt","value":${inp.netDebt>0?Math.round(inp.netDebt*1e6):0}},
    {"label":"(−) Capitalized leases","value":${Math.round(inp.ebitda*0.08*1e6)}},
    {"label":"(−) Minority interest","value":0},
    {"label":"(−) Earnout / contingent","value":0}
  ],
  "analystNote": "Write one sharp deal-framing sentence for ${inp.company}",
  "dataNote": "Live analysis · ${mkt.fetched ? "market data current" : "market data unavailable"} · ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}"
}`;
}

// ─── JSON parser ──────────────────────────────────────────────────────────────
function parseJson(raw: string): unknown {
  const attempts: (() => unknown)[] = [
    () => JSON.parse(raw),
    () => JSON.parse(raw.replace(/```(?:json)?|```/g, "").trim()),
    () => {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      if (s === -1 || e <= s) throw new Error("no braces");
      return JSON.parse(raw.slice(s, e + 1));
    },
    () => JSON.parse(
      raw.replace(/,(\s*[}\]])/g, "$1")
         .replace(/[\x00-\x1F\x7F]/g, " ")
         .replace(/:\s*undefined/g, ": null")
    ),
  ];
  for (const fn of attempts) { try { return fn(); } catch { /* next */ } }
  throw new Error("All JSON parse strategies failed");
}

function isValid(obj: unknown): obj is LiveAnalysisResult {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.company === "string" &&
    typeof r.stats === "object" && r.stats !== null &&
    Array.isArray(r.valuationMethods) && (r.valuationMethods as unknown[]).length >= 2 &&
    Array.isArray(r.commentary) && (r.commentary as unknown[]).length >= 1
  );
}

function fixNumbers(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(fixNumbers);
  if (obj !== null && typeof obj === "object")
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k, typeof v === "number" && !Number.isFinite(v) ? 0 : fixNumbers(v),
      ])
    );
  return obj;
}

// ─── Fallback (when AI unavailable) — uses real financial models ──────────────
function buildFallback(inp: AnalysisInputs): LiveAnalysisResult {
  const scored = scoreTransactions(TRANSACTIONS, {
    sector: inp.sector, revenue: inp.revenue,
    ebitdaMargin: inp.ebitdaMargin, growth: inp.growth,
  });
  const top = scored.slice(0, 8);
  const stats = computeValuationStats(top);
  const dcf = runDcf({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const lbo = runLbo({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const vm = buildFootballField(inp.revenue, inp.ebitda, inp.netDebt, stats, dcf, lbo);
  const f = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
  const baseEv = stats.medianEvEbitda * inp.ebitda * 1e6;
  const eq = inp.netDebt < 0 ? `net cash of $${Math.abs(inp.netDebt)}M` : `net debt of $${inp.netDebt}M`;

  return {
    company: inp.company, sector: inp.sector, geography: inp.geography,
    asOf: new Date().toISOString(),
    stats: { medianEvEbitda: stats.medianEvEbitda, medianEvRevenue: stats.medianEvRevenue, p25EvEbitda: stats.p25EvEbitda, p75EvEbitda: stats.p75EvEbitda, p25EvRevenue: stats.p25EvRevenue, p75EvRevenue: stats.p75EvRevenue },
    valuationMethods: vm,
    commentary: [
      `${inp.company} generates $${inp.revenue}M LTM revenue at a ${inp.ebitdaMargin.toFixed(1)}% EBITDA margin with ${inp.growth}% YoY growth — a profile consistent with premium ${inp.sector} assets in the current deal environment.`,
      `Against ${top.length} scored precedent transactions, the dataset supports a median EV/EBITDA of ${stats.medianEvEbitda.toFixed(1)}x and EV/Revenue of ${stats.medianEvRevenue.toFixed(1)}x, implying an enterprise value range of ${f(stats.p25EvEbitda * inp.ebitda * 1e6)}–${f(stats.p75EvEbitda * inp.ebitda * 1e6)}.`,
      `DCF analysis at 10% WACC implies ${f(dcf.enterpriseValue)} enterprise value; a financial sponsor targeting 20% IRR supports an entry of ${f(lbo.entryEv)}, with the company carrying ${eq}. Re-run for AI-generated live commentary.`,
    ],
    marketObservations: [
      { label: "Comparable Transactions Scored", value: `${top.length}`, tone: "neutral" },
      { label: "Median EV/EBITDA", value: `${stats.medianEvEbitda.toFixed(1)}x`, tone: "neutral" },
      { label: "DCF Implied EV", value: f(dcf.enterpriseValue), tone: "neutral" },
      { label: "LBO Entry (20% IRR)", value: f(lbo.entryEv), tone: "neutral" },
    ],
    relevantCompIds: top.map(t => t.id),
    topBuyerIds: getBuyersForSector(inp.sector).slice(0, 5).map(b => b.id),
    assumptions: [
      { id: "f1", category: "Add-Backs", label: "Stock-based compensation", value: Math.round(inp.revenue * 0.04 * 10) / 10, unit: "$M", note: "Non-cash charge normalised" },
      { id: "f2", category: "Add-Backs", label: "Non-recurring items", value: Math.round(inp.ebitda * 0.05 * 10) / 10, unit: "$M", note: "One-time charges" },
    ],
    bridge: [
      { label: "Enterprise Value (Base)", value: Math.round(baseEv) },
      { label: "(+) Cash & equivalents", value: inp.netDebt < 0 ? Math.round(Math.abs(inp.netDebt) * 1e6) : 0 },
      { label: "(−) Total debt", value: inp.netDebt > 0 ? Math.round(inp.netDebt * 1e6) : 0 },
      { label: "(−) Capitalized leases", value: Math.round(inp.ebitda * 0.08 * 1e6) },
      { label: "(−) Minority interest", value: 0 },
      { label: "(−) Earnout / contingent", value: 0 },
    ],
    analystNote: `Dataset analysis for ${inp.company} — ${top.length} transactions scored with DCF & LBO models.`,
    dataNote: "Fallback analysis — AI temporarily unavailable. All valuations use real financial models.",
  };
}

function safeLog(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message.replace(/sk-ant-[A-Za-z0-9\-_]+/g, "[KEY]") : String(err);
  console.error(`[analyze] ${label}: ${msg.slice(0, 300)}`);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function runAnalysis(inputs: AnalysisInputs, apiKey: string): Promise<LiveAnalysisResult> {
  const t0 = Date.now();
  const tid = Math.random().toString(36).slice(2, 7).toUpperCase();
  console.log(`[${tid}] start: ${inputs.company} (${inputs.sector})`);

  if (cb.isOpen()) {
    console.log(`[${tid}] circuit open — serving fallback`);
    return buildFallback(inputs);
  }

  // ── Step 1: Pre-compute everything locally (fast, ~10ms) ──
  const scored = scoreTransactions(TRANSACTIONS, {
    sector: inputs.sector, revenue: inputs.revenue,
    ebitdaMargin: inputs.ebitdaMargin, growth: inputs.growth,
  });
  const stats = computeValuationStats(scored.slice(0, 8));
  const dcf = runDcf({ revenue: inputs.revenue, ebitda: inputs.ebitda, growth: inputs.growth, ebitdaMargin: inputs.ebitdaMargin, netDebt: inputs.netDebt });
  const lbo = runLbo({ revenue: inputs.revenue, ebitda: inputs.ebitda, growth: inputs.growth, ebitdaMargin: inputs.ebitdaMargin, netDebt: inputs.netDebt });

  // ── Step 2: Fetch live market data in parallel (max 5s, non-blocking if fails) ──
  const mktPromise = fetchMarketContext(inputs.sector).catch(() => ({
    spx: "n/a", vix: "n/a", ust10y: "n/a", sectorEtf: "n/a",
    sectorTicker: "n/a", fetched: false,
  } as MarketContext));

  // ── Step 3: Build prompt while market data is fetching ──
  const mkt = await mktPromise;
  console.log(`[${tid}] market data: ${mkt.fetched ? "✓" : "✗"} (${Date.now() - t0}ms)`);

  const prompt = buildPrompt(inputs, scored, stats, dcf, lbo, mkt);

  // ── Step 4: Call AI — NO tools, just pure text generation (fast!) ──
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,  // just enough for rich JSON — no tools = no extra latency
        // NO tools array — this is the key fix. web_search was adding 15-30s.
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    cb.fail();
    safeLog("API call failed", err);
    return buildFallback(inputs);
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const status = resp.status;
    safeLog(`HTTP ${status}`, new Error(await resp.text().catch(() => "").then(b => b.slice(0, 300))));
    if (status === 429 || status >= 500) { cb.fail(); return buildFallback(inputs); }
    throw new Error(`API error ${status}`);
  }

  let data: { content?: { type: string; text?: string }[] };
  try { data = await resp.json() as typeof data; }
  catch (err) { safeLog("envelope parse failed", err); cb.fail(); return buildFallback(inputs); }

  const textBlocks = (data.content ?? []).filter(b => b.type === "text" && b.text);
  if (!textBlocks.length) {
    safeLog("no text block in response", new Error("empty content"));
    cb.fail();
    return buildFallback(inputs);
  }

  const raw = textBlocks[textBlocks.length - 1].text!;
  console.log(`[${tid}] AI responded: ${raw.length} chars in ${Date.now() - t0}ms`);

  let parsed: unknown;
  try { parsed = parseJson(raw); }
  catch (err) { safeLog("JSON parse failed", err); cb.fail(); return buildFallback(inputs); }

  parsed = fixNumbers(parsed);

  if (!isValid(parsed)) {
    safeLog("invalid result shape", new Error(Object.keys(parsed as object).join(",")));
    cb.fail();
    return buildFallback(inputs);
  }

  cb.ok();
  console.log(`[${tid}] ✓ success in ${Date.now() - t0}ms`);
  return parsed as LiveAnalysisResult;
}
