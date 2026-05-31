"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
};

const STORAGE_KEY = "estateos_theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(preference: ThemePreference) {
  const resolved = preference === "system" ? resolveSystemTheme() : preference;
  const root = document.documentElement;

  root.dataset.theme = resolved;
  root.classList.toggle("light", resolved === "light");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;

  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const next: ThemePreference =
      saved === "light" || saved === "dark" || saved === "system" ? saved : "dark";
    setThemeState(next);
    setResolvedTheme(applyTheme(next));
  }, []);

  useLayoutEffect(() => {
    setResolvedTheme(applyTheme(theme));

    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => setResolvedTheme(applyTheme("system"));
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    setResolvedTheme(applyTheme(next));
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeInitScript() {
  const code = `
    (function() {
      try {
        if (!localStorage.getItem("${STORAGE_KEY}")) {
          localStorage.setItem("${STORAGE_KEY}", "dark");
        }
        if (!localStorage.getItem("estateos_display_currency")) {
          localStorage.setItem("estateos_display_currency", "LISTING");
          document.cookie = "estateos_display_currency=LISTING;path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax";
        }
        var saved = localStorage.getItem("${STORAGE_KEY}") || "dark";
        var resolved = saved === "system"
          ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
          : saved;
        var root = document.documentElement;
        root.dataset.theme = resolved;
        root.classList.toggle("light", resolved === "light");
        root.classList.toggle("dark", resolved !== "light");
        root.style.colorScheme = resolved;
      } catch (_) {
        document.documentElement.classList.add("dark");
        document.documentElement.dataset.theme = "dark";
        document.documentElement.style.colorScheme = "dark";
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
