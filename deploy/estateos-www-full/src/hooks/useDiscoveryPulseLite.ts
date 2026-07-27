"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeDiscoveryUpdated } from "@/lib/discovery/clientEvents";

export type DiscoveryPulseLite = {
  stageLabel: string;
  progress: number;
  confidence: number;
  contradictionIndex: number;
  directionLine: string;
  suggestion: string;
  summaryLine?: string;
};

/**
 * Shared lite pulse for Phase 5 surfaces — one quiet fetch, event-driven refresh.
 */
export function useDiscoveryPulseLite() {
  const [pulse, setPulse] = useState<DiscoveryPulseLite | null>(null);
  const [auth, setAuth] = useState<"unknown" | "guest" | "user">("unknown");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/discovery/pulse", { credentials: "include", cache: "no-store" });
      if (res.status === 401) {
        setAuth("guest");
        setPulse(null);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const next = data?.pulse as DiscoveryPulseLite | undefined;
      if (!next) return;
      setPulse(next);
      setAuth("user");
    } catch {
      // quiet
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeDiscoveryUpdated(() => void load()), [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  return { pulse, auth, reload: load };
}
