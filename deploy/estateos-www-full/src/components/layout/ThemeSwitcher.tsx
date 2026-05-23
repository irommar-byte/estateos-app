"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { useLocale } from "@/contexts/LocaleContext";

const OPTIONS: Array<{
  id: ThemePreference;
  Icon: typeof Sun;
}> = [
  { id: "light", Icon: Sun },
  { id: "system", Icon: Monitor },
  { id: "dark", Icon: Moon },
];

export default function ThemeSwitcher({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { dict } = useLocale();
  const { theme, setTheme } = useTheme();

  const labels: Record<ThemePreference, string> = {
    light: dict.theme.light,
    system: dict.theme.system,
    dark: dict.theme.dark,
  };

  return (
    <div
      role="radiogroup"
      aria-label={dict.theme.label}
      className={`eos-segmented-control ${className}`}
    >
      {OPTIONS.map(({ id, Icon }) => {
        const selected = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={labels[id]}
            title={labels[id]}
            onClick={() => setTheme(id)}
            className={`relative z-10 flex ${compact ? "h-9 w-9" : "h-9 w-10"} items-center justify-center rounded-full transition-colors ${
              selected ? "eos-theme-switcher-icon" : "eos-theme-switcher-idle"
            }`}
          >
            {selected && (
              <motion.span
                layoutId="estateos-theme-switcher-pill"
                className="eos-theme-switcher-pill absolute inset-0 -z-10 rounded-full"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className={`size-4 ${selected ? "eos-theme-switcher-icon" : "eos-theme-switcher-idle"}`} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
