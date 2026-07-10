"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export type EcosystemVertical = "home" | "car";

type EcosystemContextValue = {
  vertical: EcosystemVertical;
  setVertical: (next: EcosystemVertical) => void;
  isHome: boolean;
  isCar: boolean;
};

const STORAGE_KEY = "estateos_active_vertical";
const EcosystemContext = createContext<EcosystemContextValue | undefined>(undefined);

function inferVerticalFromPath(pathname: string): EcosystemVertical {
  return pathname.startsWith("/cars") ? "car" : "home";
}

export function EcosystemProvider({ children }: { children: ReactNode }) {
  const [vertical, setVerticalState] = useState<EcosystemVertical>("home");
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "home" || stored === "car") {
      setVerticalState(stored);
      return;
    }
    setVerticalState(inferVerticalFromPath(window.location.pathname));
  }, []);

  const setVertical = useCallback((next: EcosystemVertical) => {
    setVerticalState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const inferred = inferVerticalFromPath(pathname);
    setVerticalState((prev) => (prev === inferred ? prev : inferred));
  }, [pathname]);

  const value = useMemo<EcosystemContextValue>(
    () => ({
      vertical,
      setVertical,
      isHome: vertical === "home",
      isCar: vertical === "car",
    }),
    [vertical, setVertical],
  );

  return <EcosystemContext.Provider value={value}>{children}</EcosystemContext.Provider>;
}

export function useEcosystem() {
  const ctx = useContext(EcosystemContext);
  if (!ctx) {
    return {
      vertical: "home" as EcosystemVertical,
      setVertical: () => {},
      isHome: true,
      isCar: false,
    };
  }
  return ctx;
}
