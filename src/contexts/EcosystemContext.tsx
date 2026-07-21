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
import { usePathname } from "next/navigation";

export type EcosystemVertical = "home" | "car";

export type EcosystemSwitchRequest = {
  to: EcosystemVertical;
  href: string;
  from: EcosystemVertical;
};

type EcosystemContextValue = {
  vertical: EcosystemVertical;
  /** Which Home/Car pill is highlighted — null on homepage until scroll/click. */
  navHighlight: EcosystemVertical | null;
  setVertical: (next: EcosystemVertical) => void;
  setNavHighlight: (next: EcosystemVertical | null) => void;
  requestVerticalSwitch: (to: EcosystemVertical, href: string) => void;
  clearVerticalSwitch: () => void;
  pendingSwitch: EcosystemSwitchRequest | null;
  isHome: boolean;
  isCar: boolean;
};

const STORAGE_KEY = "estateos_active_vertical";
const EcosystemContext = createContext<EcosystemContextValue | undefined>(undefined);

function inferVerticalFromPath(pathname: string): EcosystemVertical {
  return pathname.startsWith("/cars") ? "car" : "home";
}

function isHomepagePath(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}

export function EcosystemProvider({ children }: { children: ReactNode }) {
  const [vertical, setVerticalState] = useState<EcosystemVertical>("home");
  const [navHighlight, setNavHighlightState] = useState<EcosystemVertical | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<EcosystemSwitchRequest | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isHomepagePath(window.location.pathname)) {
      setNavHighlightState(null);
      if (stored === "home" || stored === "car") {
        setVerticalState(stored);
      }
      return;
    }
    if (stored === "home" || stored === "car") {
      setVerticalState(stored);
      setNavHighlightState(stored);
      return;
    }
    const inferred = inferVerticalFromPath(window.location.pathname);
    setVerticalState(inferred);
    setNavHighlightState(inferred);
  }, []);

  const setVertical = useCallback((next: EcosystemVertical) => {
    setVerticalState(next);
    setNavHighlightState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const setNavHighlight = useCallback((next: EcosystemVertical | null) => {
    setNavHighlightState(next);
  }, []);

  const requestVerticalSwitch = useCallback(
    (to: EcosystemVertical, href: string) => {
      setVerticalState((from) => {
        setNavHighlightState(to);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, to);
        }
        setPendingSwitch({ from, to, href });
        return from;
      });
    },
    [],
  );

  const clearVerticalSwitch = useCallback(() => {
    setPendingSwitch(null);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (isHomepagePath(pathname)) {
      setNavHighlightState(null);
      return;
    }
    const inferred = inferVerticalFromPath(pathname);
    setVerticalState((prev) => (prev === inferred ? prev : inferred));
    setNavHighlightState(inferred);
  }, [pathname]);

  const value = useMemo<EcosystemContextValue>(
    () => ({
      vertical,
      navHighlight,
      setVertical,
      setNavHighlight,
      requestVerticalSwitch,
      clearVerticalSwitch,
      pendingSwitch,
      isHome: vertical === "home",
      isCar: vertical === "car",
    }),
    [vertical, navHighlight, setVertical, setNavHighlight, requestVerticalSwitch, clearVerticalSwitch, pendingSwitch],
  );

  return <EcosystemContext.Provider value={value}>{children}</EcosystemContext.Provider>;
}

export function useEcosystem() {
  const ctx = useContext(EcosystemContext);
  if (!ctx) {
    return {
      vertical: "home" as EcosystemVertical,
      navHighlight: null as EcosystemVertical | null,
      setVertical: () => {},
      setNavHighlight: () => {},
      requestVerticalSwitch: () => {},
      clearVerticalSwitch: () => {},
      pendingSwitch: null,
      isHome: true,
      isCar: false,
    };
  }
  return ctx;
}
