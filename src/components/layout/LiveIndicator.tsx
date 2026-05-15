import { useState, useEffect, useCallback } from "react";

// Live market tickers shown in the top bar — fetched from Yahoo Finance public API
// Tickers relevant to M&A bankers: S&P 500, credit spreads proxy, VIX, deal financing benchmarks
const TICKERS = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "LQD", label: "IG Credit" },
  { symbol: "^TNX", label: "10Y UST" },
];

interface TickerData {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  pct: number | null;
}

async function fetchTicker(symbol: string): Promise<{ price: number; change: number; pct: number } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!r.ok) return null;
    const d = await r.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }[] } };
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? price;
    const change = price - prev;
    const pct = prev !== 0 ? (change / prev) * 100 : 0;
    return { price, change, pct };
  } catch {
    return null;
  }
}

export function LiveIndicator() {
  const [tickers, setTickers] = useState<TickerData[]>(
    TICKERS.map(t => ({ ...t, price: null, change: null, pct: null }))
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(TICKERS.map(t => fetchTicker(t.symbol)));
    setTickers(TICKERS.map((t, i) => {
      const r = results[i];
      return r.status === "fulfilled" && r.value
        ? { ...t, price: r.value.price, change: r.value.change, pct: r.value.pct }
        : { ...t, price: null, change: null, pct: null };
    }));
    setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 90 seconds (Yahoo Finance rate limit friendly)
    const interval = setInterval(refresh, 90_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const hasData = tickers.some(t => t.price !== null);

  return (
    <div className="flex items-center gap-3">
      {hasData && tickers.map(t => (
        t.price !== null ? (
          <div key={t.symbol} className="flex items-center gap-1.5 text-[10px]">
            <span className="text-muted-foreground">{t.label}</span>
            <span className="font-medium num text-foreground">
              {t.symbol === "^VIX" || t.symbol === "^TNX"
                ? t.price.toFixed(2)
                : t.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {t.pct !== null && (
              <span className={`num ${t.pct >= 0 ? "text-positive" : "text-destructive"}`}>
                {t.pct >= 0 ? "+" : ""}{t.pct.toFixed(2)}%
              </span>
            )}
          </div>
        ) : null
      ))}

      <button
        onClick={refresh}
        disabled={loading}
        title={lastUpdated ? `Last updated ${lastUpdated}` : "Fetch live market data"}
        className="flex items-center gap-1 rounded border border-border bg-surface-1 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-40"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${loading ? "bg-warning animate-pulse" : hasData ? "bg-positive" : "bg-muted-foreground"}`} />
        {loading ? "Updating…" : hasData ? "LIVE" : "OFFLINE"}
      </button>
    </div>
  );
}
