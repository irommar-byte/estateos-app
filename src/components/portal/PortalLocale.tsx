"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LOCALES, isLocale, type Locale } from "@/i18n/config";
import { portalDateLocale, portalPlural, portalTranslate, type PortalVars } from "@/i18n/portal/translate";

type PortalLocaleValue = {
  locale: Locale;
  /** Tłumaczenie: klucz to polski tekst, `{zmienne}` w nawiasach klamrowych. */
  t: (text: string, vars?: PortalVars) => string;
  /** Odmiana liczebnika: `p(3, 'oferta|oferty|ofert')`. */
  p: (n: number, plForms: string) => string;
  /** Do toLocaleString / toLocaleDateString. */
  dateLocale: string;
  setLocale: (next: Locale) => void;
};

const fallback: PortalLocaleValue = {
  locale: "pl",
  t: (text, vars) => portalTranslate("pl", text, vars),
  p: (n, forms) => portalPlural("pl", n, forms),
  dateLocale: "pl-PL",
  setLocale: () => {},
};

const PortalLocaleContext = createContext<PortalLocaleValue>(fallback);

const storageKey = (token: string) => `eos_portal_locale_${token}`;

/** Funkcje tłumaczące dla danego języka — także dla komponentu, który sam trzyma stan języka. */
export function portalLocaleValue(locale: Locale, setLocale: (next: Locale) => void): PortalLocaleValue {
  return {
    locale,
    t: (text, vars) => portalTranslate(locale, text, vars),
    p: (n, forms) => portalPlural(locale, n, forms),
    dateLocale: portalDateLocale(locale),
    setLocale,
  };
}

/**
 * Stan języka panelu. Startuje z języka zapisanego przy kliencie; zmiana od razu przełącza
 * cały panel i zapisuje wybór na serwerze (u osoby towarzyszącej — tylko w tej przeglądarce).
 */
export function usePortalLocaleState(token: string | null, initial: Locale | null | undefined, isPartner: boolean): PortalLocaleValue {
  const [locale, setLocaleState] = useState<Locale>(isLocale(initial) ? initial : "pl");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = token && isPartner ? window.localStorage.getItem(storageKey(token)) : null;
    } catch {
      stored = null;
    }
    setLocaleState(isLocale(stored) ? stored : isLocale(initial) ? initial : "pl");
  }, [initial, isPartner, token]);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      if (token) window.localStorage.setItem(storageKey(token), locale);
    } catch {
      /* prywatne okno */
    }
  }, [locale, token]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      if (!token) return;
      void fetch(`/api/crm/client-portal/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_locale", locale: next }),
      }).catch(() => null);
    },
    [token],
  );

  return useMemo(() => portalLocaleValue(locale, setLocale), [locale, setLocale]);
}

/**
 * Język panelu poza samym panelem (podstrony, pasek powrotu na stronie oferty) —
 * ostatni wybór zapamiętany w tej przeglądarce.
 */
export function useStoredPortalLocale(token: string | null | undefined): PortalLocaleValue {
  const [locale, setLocale] = useState<Locale>("pl");
  useEffect(() => {
    try {
      const stored = token ? window.localStorage.getItem(storageKey(token)) : null;
      if (isLocale(stored)) setLocale(stored);
    } catch {
      /* zostaje polski */
    }
  }, [token]);
  return useMemo(() => portalLocaleValue(locale, setLocale), [locale]);
}

export function PortalLocaleProvider({ value, children }: { value: PortalLocaleValue; children: React.ReactNode }) {
  return <PortalLocaleContext.Provider value={value}>{children}</PortalLocaleContext.Provider>;
}

export function usePortalLocale(): PortalLocaleValue {
  return useContext(PortalLocaleContext);
}

const LABEL: Record<Locale, string> = { pl: "PL", en: "EN", uk: "UA" };
const NAME: Record<Locale, string> = { pl: "Polski", en: "English", uk: "Українська" };

/** Przełącznik PL / EN / UA w czarnym nagłówku panelu. */
export function PortalLanguageSwitch() {
  const { locale, setLocale, t } = usePortalLocale();
  return (
    <div role="radiogroup" aria-label={t("Język panelu")} className="flex items-center rounded-full border border-[#D8C3A0]/35 p-0.5">
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={NAME[code]}
            title={NAME[code]}
            onClick={() => !active && setLocale(code)}
            className={`min-w-[38px] rounded-full px-2.5 py-1.5 text-[11px] font-bold tracking-[0.08em] transition-colors ${
              active ? "bg-[#D8C3A0] text-black" : "text-[#D8C3A0] hover:bg-white/10"
            }`}
          >
            {LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}
