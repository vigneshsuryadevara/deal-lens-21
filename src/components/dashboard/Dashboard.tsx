import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnalysisHeader } from "./AnalysisHeader";
import { OverviewTab } from "./tabs/OverviewTab";
import { CompsTab } from "./tabs/CompsTab";
import { SensitivityTab } from "./tabs/SensitivityTab";
import { AssumptionsTab } from "./tabs/AssumptionsTab";
import { BuyersTab } from "./tabs/BuyersTab";
import { useAnalysis } from "@/context/AnalysisContext";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "comps", label: "Comparable Transactions" },
  { id: "assumptions", label: "Assumptions" },
  { id: "sensitivity", label: "Sensitivity Analysis" },
  { id: "buyers", label: "Buyer Universe" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function Dashboard() {
  const [tab, setTab] = useState<TabId>("overview");
  const { inputs, status } = useAnalysis();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <AnalysisHeader />

      <div className="sticky top-0 z-10 flex items-center gap-0 border-b border-border bg-background px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-3 py-2.5 text-[12px] font-medium transition-colors",
              tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tab === t.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute inset-x-2 -bottom-px h-px bg-accent"
                transition={{ duration: 0.2 }}
              />
            )}
          </button>
        ))}
        <div className="ml-auto text-[10px] text-muted-foreground">
          {status === "loading" ? (
            <span className="animate-pulse text-primary">Analyzing {inputs.company}…</span>
          ) : status === "success" ? (
            <span>
              {inputs.company} · {inputs.sector}
            </span>
          ) : (
            <span>Workspace · M&A Group</span>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {tab === "overview" && <OverviewTab />}
            {tab === "comps" && <CompsTab />}
            {tab === "sensitivity" && <SensitivityTab />}
            {tab === "assumptions" && <AssumptionsTab />}
            {tab === "buyers" && <BuyersTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
