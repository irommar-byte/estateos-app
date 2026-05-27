"use client";

import { Moon, Sun } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function FloatingPreferencesDock() {
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();

  const isDark = theme !== "light";

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-2 py-1.5 shadow-[0_12px_34px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setTheme("light")}
            aria-label="Light mode"
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
              !isDark ? "bg-white text-black" : "text-white/65 hover:text-white"
            }`}
          >
            <Sun className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            aria-label="Dark mode"
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
              isDark ? "bg-white text-black" : "text-white/65 hover:text-white"
            }`}
          >
            <Moon className="size-3.5" />
          </button>
        </div>

        <div className="h-5 w-px bg-white/10" />

        <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setLocale("pl")}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
              locale === "pl" ? "bg-emerald-400 text-black" : "text-white/65 hover:text-white"
            }`}
          >
            PL
          </button>
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
              locale === "en" ? "bg-emerald-400 text-black" : "text-white/65 hover:text-white"
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );
}
