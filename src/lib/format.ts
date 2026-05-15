const CURRENCY_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const CURRENCY_FULL_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const MULTIPLE_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const PCT_FMT = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function fmtCurrency(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return CURRENCY_FMT.format(v);
}

export function fmtCurrencyFull(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return CURRENCY_FULL_FMT.format(v);
}

export function fmtMultiple(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "—";
  return `${MULTIPLE_FMT.format(v)}x`;
}

export function fmtPercent(v: number, decimals = 1): string {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(decimals)}%`;
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function fmtMonthYear(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric", month: "short",
    });
  } catch {
    return iso;
  }
}

export function fmtNumber(v: number, decimals = 0): string {
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(v);
}
