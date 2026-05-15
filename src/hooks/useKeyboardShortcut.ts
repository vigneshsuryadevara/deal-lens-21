import { useEffect, useCallback } from "react";

type ModifierKeys = {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: ModifierKeys = {},
): void {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (modifiers.ctrl !== undefined && e.ctrlKey !== modifiers.ctrl) return;
      if (modifiers.meta !== undefined && e.metaKey !== modifiers.meta) return;
      if (modifiers.shift !== undefined && e.shiftKey !== modifiers.shift) return;
      if (modifiers.alt !== undefined && e.altKey !== modifiers.alt) return;

      // Don't fire when typing in an input/textarea
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        if (key !== "Enter") return;
      }

      e.preventDefault();
      callback();
    },
    [key, callback, modifiers],
  );

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}
