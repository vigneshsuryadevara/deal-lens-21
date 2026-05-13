import { motion } from "framer-motion";
import { fmtCurrency } from "@/lib/format";

type Method = { label: string; low: number; high: number; base: number };

export function FootballField({ methods, currentImplied }: { methods: Method[]; currentImplied: number }) {
  const all = methods.flatMap(m => [m.low, m.high, m.base]);
  const min = Math.min(...all, currentImplied) * 0.92;
  const max = Math.max(...all, currentImplied) * 1.04;
  const range = max - min;
  const pct = (v: number) => ((v - min) / range) * 100;

  // ticks
  const ticks = 5;
  const tickValues = Array.from({ length: ticks }, (_, i) => min + (range * i) / (ticks - 1));

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {methods.map((m, i) => {
          const left = pct(m.low);
          const width = pct(m.high) - pct(m.low);
          const basePct = pct(m.base);
          return (
            <div key={m.label} className="grid grid-cols-[180px_1fr_140px] items-center gap-3 text-[11px]">
              <div className="truncate text-muted-foreground">{m.label}</div>
              <div className="relative h-6">
                <div className="absolute inset-y-0 left-0 right-0 rounded-sm bg-surface-2/50" />
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: `${width}%`, opacity: 1 }}
                  transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
                  style={{ left: `${left}%` }}
                  className="absolute inset-y-1 rounded-sm bg-gradient-to-r from-primary/50 via-primary/70 to-accent/60"
                />
                <div
                  className="absolute top-0 h-6 w-px bg-foreground"
                  style={{ left: `${basePct}%` }}
                  title="Base case"
                />
                <div
                  className="absolute -top-0.5 -ml-1 h-2 w-2 rotate-45 bg-foreground"
                  style={{ left: `${basePct}%` }}
                />
              </div>
              <div className="text-right text-foreground num">
                {fmtCurrency(m.low)} – {fmtCurrency(m.high)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative ml-[180px] mr-[140px] mt-2 h-4 border-t border-border">
        {tickValues.map((t, i) => (
          <div
            key={i}
            className="absolute top-0 -translate-x-1/2 text-[10px] text-muted-foreground num"
            style={{ left: `${(i / (ticks - 1)) * 100}%` }}
          >
            <div className="mx-auto h-1.5 w-px bg-border" />
            <div className="mt-0.5">{fmtCurrency(t)}</div>
          </div>
        ))}
        <div
          className="absolute -top-[68px] z-10 -translate-x-1/2"
          style={{ left: `${pct(currentImplied)}%` }}
        >
          <div className="h-[60px] w-px bg-accent" />
          <div className="mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent num">
            Implied {fmtCurrency(currentImplied)}
          </div>
        </div>
      </div>
    </div>
  );
}
