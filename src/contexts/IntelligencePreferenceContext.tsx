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
const API_PATH = "/api/discovery/intelligence-preference";

type IntelligencePreferenceContextValue = {
  enabled: boolean;
  decided: boolean;
  hydrated: boolean;
  synced: boolean;
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

function persistLocal(enabled: boolean, decided: boolean) {
  writeBool(ENABLED_KEY, enabled);
  writeBool(DECIDED_KEY, decided);
}

async function patchServer(enabled: boolean): Promise<void> {
  try {
    await fetch(API_PATH, {
      method: "PATCH",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  } catch {
    /* best-effort — local cache remains */
  }
}

export function IntelligencePreferenceProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [decided, setDecided] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const savedEnabled = readBool(ENABLED_KEY);
    const savedDecided = readBool(DECIDED_KEY) === true;
    setEnabledState(savedEnabled === true);
    setDecided(savedDecided);
    setHydrated(true);

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(API_PATH, { credentials: "include", cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          setSynced(true);
          return;
        }
        if (!res.ok) {
          setSynced(true);
          return;
        }
        const data = (await res.json()) as {
          success?: boolean;
          enabled?: boolean;
          decided?: boolean;
        };
        if (!data?.success || cancelled) {
          setSynced(true);
          return;
        }
        const nextEnabled = data.enabled === true;
        const nextDecided = data.decided === true;
        setEnabledState(nextEnabled);
        setDecided(nextDecided);
        persistLocal(nextEnabled, nextDecided);
      } catch {
        /* keep localStorage */
      } finally {
        if (!cancelled) setSynced(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    setDecided(true);
    persistLocal(next, true);
    void patchServer(next);
  }, []);

  const decide = useCallback((enable: boolean) => {
    setEnabledState(enable);
    setDecided(true);
    persistLocal(enable, true);
    void patchServer(enable);
  }, []);

  const value = useMemo(
    () => ({ enabled, decided, hydrated, synced, setEnabled, decide }),
    [enabled, decided, hydrated, synced, setEnabled, decide],
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
