import { Search, Bookmark, Download, ChevronDown, Settings } from "lucide-react";
import { LiveIndicator } from "./LiveIndicator";
import { Link } from "@tanstack/react-router";
import { Kbd } from "@/components/common/Kbd";

export function TopBar() {
  return (
    <header className="flex h-12 items-center gap-3 border-b border-border bg-background px-4">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-primary-foreground">
          <span className="font-mono text-[11px] font-bold">C</span>
        </div>
        <span className="font-mono text-[13px] font-semibold tracking-[0.2em] text-foreground">COMPS</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Terminal</span>
      </Link>

      <div className="mx-3 h-5 w-px bg-border" />

      <div className="relative flex max-w-md flex-1 items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search companies, transactions, sectors…"
          className="h-8 w-full rounded border border-border bg-surface-1 pl-8 pr-16 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
        />
        <div className="absolute right-2 flex items-center gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LiveIndicator />
        <Link
          to="/saved"
          className="flex items-center gap-1.5 rounded border border-border bg-surface-1 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          <Bookmark className="h-3 w-3" />
          Saved
        </Link>
        <button className="flex items-center gap-1.5 rounded border border-border bg-surface-1 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-border-strong hover:bg-surface-2">
          <Download className="h-3 w-3" />
          Export
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        <button className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-1 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
          <Settings className="h-3.5 w-3.5" />
        </button>
        <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-semibold text-primary-foreground">
          MR
        </div>
      </div>
    </header>
  );
}
