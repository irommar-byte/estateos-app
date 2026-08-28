"use client";

import { useEffect, useSyncExternalStore } from "react";

let stackDepth = 0;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return stackDepth;
}

function notify() {
  listeners.forEach((cb) => cb());
}

/** Push a modal onto the global stack; returns cleanup to pop. */
export function pushModalStack(): () => void {
  stackDepth += 1;
  notify();
  if (stackDepth === 1) {
    document.body.style.overflow = "hidden";
  }
  let popped = false;
  return () => {
    if (popped) return;
    popped = true;
    stackDepth = Math.max(0, stackDepth - 1);
    notify();
    if (stackDepth === 0) {
      document.body.style.overflow = "";
    }
  };
}

/** Current number of open modals (for nested z-index). */
export function useModalStackDepth(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}

/** Hook: manage body scroll-lock with stack safety. */
export function useModalStack(active: boolean): number {
  const depth = useModalStackDepth();

  useEffect(() => {
    if (!active) return;
    return pushModalStack();
  }, [active]);

  return depth;
}

/** Resolve z-index class for a modal at given nesting level. */
export function modalZIndexClass(nestingLevel: number): string {
  if (nestingLevel > 0) return "eos-z-modal-nested";
  return "eos-z-modal";
}
