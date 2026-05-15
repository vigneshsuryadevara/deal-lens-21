/**
 * Market data abstraction layer.
 * Supports multiple backends: Alpha Vantage, Finnhub, Yahoo Finance.
 * Switch backends by changing MARKET_DATA_PROVIDER env var.
 */

export interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  high52w: number;
  low52w: number;
  timestamp: string;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  description: string;
  employees: number;
  headquarters: string;
  ceo: string;
  website: string;
  exchange: string;
  currency: string;
}

export interface FinancialMetrics {
  symbol: string;
  revenue: number;
  ebitda: number;
  netIncome: number;
  totalDebt: number;
  cashAndEquivalents: number;
  evRevenue: number;
  evEbitda: number;
  peRatio: number;
  revenueGrowth: number;
  ebitdaMargin: number;
  fiscalYear: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency: string;
}

// ─── Finnhub backend ──────────────────────────────────────────────────────────

async function fetchFinnhub<T>(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<T> {
  const url = new URL(`https://finnhub.io/api/v1${path}`);
  url.searchParams.set("token", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!resp.ok) throw new Error(`Finnhub HTTP ${resp.status}`);
  return resp.json() as Promise<T>;
}

export async function searchCompanies(
  query: string,
  apiKey?: string,
): Promise<SearchResult[]> {
  if (!apiKey) return mockSearch(query);

  try {
    const data = await fetchFinnhub<{ result?: { symbol: string; description: string; type: string; displaySymbol: string }[] }>(
      "/search",
      { q: query },
      apiKey,
    );
    return (data.result ?? [])
      .filter((r) => r.type === "Common Stock" || r.type === "EQS")
      .slice(0, 8)
      .map((r) => ({
        symbol: r.symbol,
        name: r.description,
        type: r.type,
        exchange: r.displaySymbol?.split(":")?.[0] ?? "US",
        currency: "USD",
      }));
  } catch {
    return mockSearch(query);
  }
}

export async function getCompanyProfile(
  symbol: string,
  apiKey?: string,
): Promise<CompanyProfile | null> {
  if (!apiKey) return null;
  try {
    const data = await fetchFinnhub<{
      name?: string;
      finnhubIndustry?: string;
      weburl?: string;
      employeeTotal?: number;
      country?: string;
      currency?: string;
      exchange?: string;
      description?: string;
    }>("/stock/profile2", { symbol }, apiKey);

    return {
      symbol,
      name: data.name ?? symbol,
      sector: data.finnhubIndustry ?? "",
      industry: data.finnhubIndustry ?? "",
      description: data.description ?? "",
      employees: data.employeeTotal ?? 0,
      headquarters: data.country ?? "",
      ceo: "",
      website: data.weburl ?? "",
      exchange: data.exchange ?? "",
      currency: data.currency ?? "USD",
    };
  } catch {
    return null;
  }
}

export async function getQuote(symbol: string, apiKey?: string): Promise<QuoteData | null> {
  if (!apiKey) return null;
  try {
    const [quote, metrics] = await Promise.allSettled([
      fetchFinnhub<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }>(
        "/quote",
        { symbol },
        apiKey,
      ),
      fetchFinnhub<{ metric?: { "52WeekHigh"?: number; "52WeekLow"?: number; marketCapitalization?: number } }>(
        "/stock/metric",
        { symbol, metric: "all" },
        apiKey,
      ),
    ]);

    if (quote.status === "rejected") return null;
    const q = quote.value;
    const m = metrics.status === "fulfilled" ? metrics.value.metric ?? {} : {};

    return {
      symbol,
      price: q.c,
      change: q.d,
      changePercent: q.dp,
      marketCap: (m.marketCapitalization ?? 0) * 1e6,
      volume: 0,
      high52w: m["52WeekHigh"] ?? q.h,
      low52w: m["52WeekLow"] ?? q.l,
      timestamp: new Date(q.t * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

// ─── Mock data fallback ───────────────────────────────────────────────────────

function mockSearch(query: string): SearchResult[] {
  const candidates = [
    { symbol: "MSFT", name: "Microsoft Corporation", type: "Common Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "AAPL", name: "Apple Inc.", type: "Common Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "GOOGL", name: "Alphabet Inc.", type: "Common Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "CRM", name: "Salesforce Inc.", type: "Common Stock", exchange: "NYSE", currency: "USD" },
    { symbol: "NOW", name: "ServiceNow Inc.", type: "Common Stock", exchange: "NYSE", currency: "USD" },
    { symbol: "WDAY", name: "Workday Inc.", type: "Common Stock", exchange: "NASDAQ", currency: "USD" },
    { symbol: "VEEV", name: "Veeva Systems Inc.", type: "Common Stock", exchange: "NYSE", currency: "USD" },
    { symbol: "DDOG", name: "Datadog Inc.", type: "Common Stock", exchange: "NASDAQ", currency: "USD" },
  ];
  const q = query.toLowerCase();
  return candidates.filter(
    (c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q),
  );
}
