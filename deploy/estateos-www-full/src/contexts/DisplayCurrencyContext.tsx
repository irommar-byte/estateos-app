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
import type { DisplayCurrencyPreference } from "@/lib/money/types";

const STORAGE_KEY = "estateos_display_currency";
export const DISPLAY_CURRENCY_COOKIE = "estateos_display_currency";

type DisplayCurrencyContextValue = {
  preference: DisplayCurrencyPreference;
  setPreference: (next: DisplayCurrencyPreference) => void;
  hydrated: boolean;
};

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | null>(null);

function isPreference(value: string | null | undefined): value is DisplayCurrencyPreference {
  return value === "PLN" || value === "EUR" || value === "LISTING";
}

function setPreferenceCookie(next: DisplayCurrencyPreference) {
  document.cookie = `${DISPLAY_CURRENCY_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<DisplayCurrencyPreference>("LISTING");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isPreference(saved)) {
        setPreferenceState(saved);
        setPreferenceCookie(saved);
      } else {
        setPreferenceState("LISTING");
        setPreferenceCookie("LISTING");
        window.localStorage.setItem(STORAGE_KEY, "LISTING");
      }
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, []);

  const setPreference = useCallback((next: DisplayCurrencyPreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* noop */
    }
    setPreferenceCookie(next);
  }, []);

  const value = useMemo(
    () => ({ preference, setPreference, hydrated }),
    [preference, setPreference, hydrated],
  );

  return (
    <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  const ctx = useContext(DisplayCurrencyContext);
  if (!ctx) {
    throw new Error("useDisplayCurrency must be used within DisplayCurrencyProvider");
  }
  return ctx;
}
