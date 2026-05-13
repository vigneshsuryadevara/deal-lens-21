export const fmtCurrency = (n: number, opts: { compact?: boolean; prefix?: string } = {}) => {
  const { compact = true, prefix = "$" } = opts;
  if (n === 0) return `${prefix}0`;
  const abs = Math.abs(n);
  if (!compact) return `${n < 0 ? "-" : ""}${prefix}${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  let v = abs, s = "";
  if (abs >= 1e9) { v = abs / 1e9; s = "B"; }
  else if (abs >= 1e6) { v = abs / 1e6; s = "M"; }
  else if (abs >= 1e3) { v = abs / 1e3; s = "K"; }
  const formatted = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return `${n < 0 ? "-" : ""}${prefix}${formatted}${s}`;
};

export const fmtMultiple = (n: number) => `${n.toFixed(1)}x`;
export const fmtPercent = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};
export const fmtMonthYear = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};
