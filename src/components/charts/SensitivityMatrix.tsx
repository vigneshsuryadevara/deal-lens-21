import { useState } from "react";
import { fmtCurrency, fmtMultiple } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SensitivityMatrix({
  baseEbitda,
  baseMultiple,
  netDebt = 0,
}: {
  baseEbitda: number;
  baseMultiple: number;
  netDebt?: number;
}) {
  const ebitdaSteps = [-15, -10, -5, 0, 5, 10, 15].map(
    (p) => baseEbitda * (1 + p / 100),
  );
  const multSteps = [-4, -2, -1, 0, 1, 2, 4].map((d) => baseMultiple + d);

  // When netDebt is provided, display equity value instead of EV
  const cellValue = (e: number, m: number) => {
    const ev = e * m;
    return netDebt !== 0 ? ev - netDebt : ev;
  };

  const grid = ebitdaSteps.map((e) => multSteps.map((m) => cellValue(e, m)));
  const flat = grid.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <div>
          {netDebt !== 0 ? "Equity Value" : "Enterprise Value"}: EBITDA scenario ↓
          &nbsp;·&nbsp; EV/EBITDA multiple →
        </div>
        <div className="num">Base: {fmtCurrency(cellValue(baseEbitda, baseMultiple))}</div>
      </div>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-surface-2">
              <th className="border-b border-r border-border px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                EBITDA / Mult.
              </th>
              {multSteps.map((m, c) => (
                <th
                  key={c}
                  className={cn(
                    "border-b border-border px-2 py-1.5 text-right num font-medium text-muted-foreground",
                    hover?.c === c && "bg-primary/10 text-foreground",
                    c === 3 && "border-x border-x-border-strong text-foreground",
                  )}
                >
                  {fmtMultiple(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ebitdaSteps.map((e, r) => (
              <tr key={r}>
                <th
                  className={cn(
                    "border-r border-border bg-surface-2 px-2 py-1.5 text-right num font-medium text-muted-foreground",
                    hover?.r === r && "bg-primary/10 text-foreground",
                    r === 3 && "border-y border-y-border-strong text-foreground",
                  )}
                >
                  {fmtCurrency(e)}
                </th>
                {multSteps.map((m, c) => {
                  const v = grid[r][c];
                  const t = max === min ? 0.5 : (v - min) / (max - min);
                  const isBase = r === 3 && c === 3;
                  return (
                    <td
                      key={c}
                      onMouseEnter={() => setHover({ r, c })}
                      onMouseLeave={() => setHover(null)}
                      className={cn(
                        "relative border-b border-border px-2 py-1.5 text-right num transition-colors cursor-default",
                        hover?.r === r && "bg-primary/[0.06]",
                        hover?.c === c && "bg-primary/[0.06]",
                        hover?.r === r && hover?.c === c && "bg-primary/15 text-foreground",
                        isBase &&
                          "outline outline-1 outline-accent/70 bg-accent/10 text-foreground font-semibold",
                      )}
                      style={{
                        color:
                          !isBase && hover?.r !== r && hover?.c !== c
                            ? `oklch(${0.65 + t * 0.2} ${0.04 + t * 0.06} 240)`
                            : undefined,
                      }}
                    >
                      {fmtCurrency(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
