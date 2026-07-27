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

const ENABLED_KEY = "estateos_intelligence_enabled";
const DECIDED_KEY = "estateos_intelligence_decided_v1";

type IntelligencePreferenceContextValue = {
  enabled: boolean;
  decided: boolean;
  hydrated: boolean;
  setEnabled: (next: boolean) => void;
  /** Marks onboarding as resolved and optionally enables. */
  decide: (enable: boolean) => void;
};

const IntelligencePreferenceContext = createContext<IntelligencePreferenceContextValue | null>(
  null,
);

function readBool(key: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* quiet */
  }
}

export function IntelligencePreferenceProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [decided, setDecided] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedEnabled = readBool(ENABLED_KEY);
    const savedDecided = readBool(DECIDED_KEY) === true || savedEnabled !== null;
    setEnabledState(savedEnabled === true);
    setDecided(savedDecided);
    setHydrated(true);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    writeBool(ENABLED_KEY, next);
    writeBool(DECIDED_KEY, true);
    setDecided(true);
  }, []);

  const decide = useCallback((enable: boolean) => {
    setEnabledState(enable);
    writeBool(ENABLED_KEY, enable);
    writeBool(DECIDED_KEY, true);
    setDecided(true);
  }, []);

  const value = useMemo(
    () => ({ enabled, decided, hydrated, setEnabled, decide }),
    [enabled, decided, hydrated, setEnabled, decide],
  );

  return (
    <IntelligencePreferenceContext.Provider value={value}>
      {children}
    </IntelligencePreferenceContext.Provider>
  );
}

export function useIntelligencePreference() {
  const ctx = useContext(IntelligencePreferenceContext);
  if (!ctx) {
    throw new Error("useIntelligencePreference must be used within IntelligencePreferenceProvider");
  }
  return ctx;
}
