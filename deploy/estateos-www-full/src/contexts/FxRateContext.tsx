"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_EUR_PLN_RATE } from "@/lib/money/constants";
import type { FxRateSnapshot } from "@/lib/money/types";

type FxRateContextValue = {
  rate: number;
  rateDate: string | null;
  source: string;
  refresh: () => Promise<void>;
};

const FxRateContext = createContext<FxRateContextValue | null>(null);

const SESSION_CACHE_KEY = "estateos_fx_eur_pln_v1";

export function FxRateProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<FxRateSnapshot>({
    rate: DEFAULT_EUR_PLN_RATE,
    date: new Date().toISOString().slice(0, 10),
    source: "fallback",
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/fx/eur-pln", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const rate = Number(data?.rate ?? data?.eurPln);
      if (!res.ok || !Number.isFinite(rate) || rate <= 0) return;
      const next: FxRateSnapshot = {
        rate,
        date: String(data?.date || data?.rateDate || new Date().toISOString().slice(0, 10)),
        source: String(data?.source || "NBP"),
      };
      setSnapshot(next);
      try {
        sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
    } catch {
      /* keep last snapshot */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as FxRateSnapshot;
        if (cached?.rate > 0) setSnapshot(cached);
      }
    } catch {
      /* noop */
    }
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      rate: snapshot.rate,
      rateDate: snapshot.date,
      source: snapshot.source,
      refresh,
    }),
    [snapshot, refresh],
  );

  return <FxRateContext.Provider value={value}>{children}</FxRateContext.Provider>;
}

export function useFxRate() {
  const ctx = useContext(FxRateContext);
  if (!ctx) {
    throw new Error("useFxRate must be used within FxRateProvider");
  }
  return ctx;
}
