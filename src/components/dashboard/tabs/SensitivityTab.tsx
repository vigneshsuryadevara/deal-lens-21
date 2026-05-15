import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { SensitivityMatrix } from "@/components/charts/SensitivityMatrix";
import { useAnalysis } from "@/context/AnalysisContext";
import { TRANSACTIONS } from "@/data/transactions";
import { fmtCurrency, fmtMultiple } from "@/lib/format";

function getMedianEvEbitda(compIds?: string[]) {
  const src = compIds?.length
    ? TRANSACTIONS.filter((t) => compIds.includes(t.id))
    : TRANSACTIONS;
  const arr = src
    .filter((t) => t.evEbitda > 0)
    .map((t) => t.evEbitda)
    .sort((a, b) => a - b);
  return arr[Math.floor(arr.length / 2)] ?? 28;
}

export function SensitivityTab() {
  const { inputs, result } = useAnalysis();

  const ebitda = inputs.ebitda * 1e6;
  const netDebt = inputs.netDebt * 1e6;

  const medianEE = result?.stats.medianEvEbitda ?? getMedianEvEbitda(result?.relevantCompIds);
  const p25EE = result?.stats.p25EvEbitda ?? medianEE - 4;
  const p75EE = result?.stats.p75EvEbitda ?? medianEE + 4;

  const bear  = { label: "Bear Case",  desc: `EBITDA −10% · ${fmtMultiple(p25EE)}`,  ev: ebitda * 0.9 * p25EE };
  const base  = { label: "Base Case",  desc: `EBITDA flat · ${fmtMultiple(medianEE)}`, ev: ebitda * medianEE };
  const bull  = { label: "Bull Case",  desc: `EBITDA +10% · ${fmtMultiple(p75EE)}`, ev: ebitda * 1.1 * p75EE };

  return (
    <div className="space-y-3">
      <Panel>
        <PanelHeader>
          <PanelTitle>EV Sensitivity — EBITDA × Multiple</PanelTitle>
          <span className="text-[10px] text-muted-foreground">
            Hover cells to highlight scenario · Base multiple {fmtMultiple(medianEE)}
          </span>
        </PanelHeader>
        <div className="px-4 py-4">
          <SensitivityMatrix baseEbitda={ebitda} baseMultiple={medianEE} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Equity Value Sensitivity — Less Net Debt</PanelTitle>
          <span className="text-[10px] text-muted-foreground num">
            {netDebt < 0
              ? `Net cash ${fmtCurrency(Math.abs(netDebt))}`
              : `Net debt ${fmtCurrency(netDebt)}`}
          </span>
        </PanelHeader>
        <div className="px-4 py-4">
          <SensitivityMatrix
            baseEbitda={ebitda}
            baseMultiple={medianEE}
            netDebt={netDebt}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {[bear, base, bull].map((c, i) => (
          <div
            key={c.label}
            className={`rounded-md border bg-surface-1 px-4 py-3 ${
              i === 1 ? "border-accent/40" : "border-border"
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {c.label}
            </div>
            <div className="mt-1 text-[20px] font-semibold text-foreground num">
              {fmtCurrency(c.ev)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.desc}</div>
            <div className="mt-1 text-[10px] text-muted-foreground num">
              Equity: {fmtCurrency(c.ev - netDebt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
