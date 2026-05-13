import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { SensitivityMatrix } from "@/components/charts/SensitivityMatrix";
import { ANALYSIS, STATS } from "@/data/analysis";
import { fmtCurrency, fmtMultiple } from "@/lib/format";

export function SensitivityTab() {
  return (
    <div className="space-y-3">
      <Panel>
        <PanelHeader>
          <PanelTitle>EV Sensitivity — EBITDA × Multiple</PanelTitle>
          <span className="text-[10px] text-muted-foreground">Hover cells to highlight scenario</span>
        </PanelHeader>
        <div className="px-4 py-4">
          <SensitivityMatrix baseEbitda={ANALYSIS.ltmEbitda} baseMultiple={STATS.medianEvEbitda} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Equity Value Sensitivity (Less Net Debt)</PanelTitle>
          <span className="text-[10px] text-muted-foreground num">Net cash {fmtCurrency(Math.abs(ANALYSIS.netDebt))}</span>
        </PanelHeader>
        <div className="px-4 py-4">
          <SensitivityMatrix baseEbitda={ANALYSIS.ltmEbitda} baseMultiple={STATS.medianEvEbitda} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {[
          { label: "Bear Case", desc: "EBITDA −10% · 24.0x", value: ANALYSIS.ltmEbitda * 0.9 * 24, tone: "negative" },
          { label: "Base Case", desc: `EBITDA flat · ${fmtMultiple(STATS.medianEvEbitda)}`, value: ANALYSIS.ltmEbitda * STATS.medianEvEbitda, tone: "accent" },
          { label: "Bull Case", desc: "EBITDA +10% · 36.0x", value: ANALYSIS.ltmEbitda * 1.1 * 36, tone: "positive" },
        ].map(c => (
          <div key={c.label} className={`rounded-md border bg-surface-1 px-4 py-3 ${c.tone === "accent" ? "border-accent/40" : "border-border"}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-[20px] font-semibold text-foreground num">{fmtCurrency(c.value)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
