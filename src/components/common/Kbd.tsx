export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-surface-2 px-1 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}
