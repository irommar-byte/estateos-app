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
              selected ? "text-[var(--eos-contrast)]" : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
            }`}
          >
            {selected && (
              <motion.span
                layoutId="estateos-theme-switcher-pill"
                className="absolute inset-0 -z-10 rounded-full bg-[var(--eos-text)] shadow-[var(--eos-shadow-soft)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
