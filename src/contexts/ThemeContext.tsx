"use client";

import {
  createContext,
  useCallback,
  useContext,
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

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(saved)) return saved;
  } catch {
    /* ignore storage errors */
  }
  return "system";
}

function resolveSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeColorMeta(resolved: ResolvedTheme) {
  const color = resolved === "light" ? "#f0f2f6" : "#050505";
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = preference === "system" ? resolveSystemTheme() : preference;
  const root = document.documentElement;

  root.dataset.theme = resolved;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  updateThemeColorMeta(resolved);

  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") return "dark";
    return applyTheme(readStoredTheme());
  });

  useLayoutEffect(() => {
    setResolvedTheme(applyTheme(theme));

    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setResolvedTheme(applyTheme("system"));
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore storage errors */
    }
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
        if (!localStorage.getItem("estateos_display_currency")) {
          localStorage.setItem("estateos_display_currency", "LISTING");
          document.cookie = "estateos_display_currency=LISTING;path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax";
        }
        var saved = localStorage.getItem("${STORAGE_KEY}");
        var preference = (saved === "light" || saved === "dark" || saved === "system") ? saved : "system";
        var resolved = preference === "system"
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : preference;
        var root = document.documentElement;
        root.dataset.theme = resolved;
        root.classList.remove("light", "dark");
        root.classList.add(resolved);
        root.style.colorScheme = resolved;
        var color = resolved === "light" ? "#f0f2f6" : "#050505";
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "theme-color");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", color);
      } catch (_) {
        var fallback = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        document.documentElement.classList.add(fallback);
        document.documentElement.dataset.theme = fallback;
        document.documentElement.style.colorScheme = fallback;
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
