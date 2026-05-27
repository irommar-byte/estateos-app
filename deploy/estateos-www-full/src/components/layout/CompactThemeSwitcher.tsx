"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { useLocale } from "@/contexts/LocaleContext";
import EosSegmentedControl from "@/components/ui/EosSegmentedControl";

type DockTheme = "light" | "dark";

export default function CompactThemeSwitcher({ className = "" }: { className?: string }) {
  const { dict } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const value: DockTheme = resolvedTheme === "light" ? "light" : "dark";

  const onChange = (next: DockTheme) => {
    setTheme(next as ThemePreference);
  };

  return (
    <div className={className}>
      <EosSegmentedControl<DockTheme>
        layoutId="estateos-theme-segment"
        value={value}
        onChange={onChange}
        ariaLabel={dict.theme.label}
        compact
        options={[
          {
            value: "light",
            label: dict.theme.light,
            title: dict.theme.light,
            icon: <Sun className="size-3.5" aria-hidden />,
          },
          {
            value: "dark",
            label: dict.theme.dark,
            title: dict.theme.dark,
            icon: <Moon className="size-3.5" aria-hidden />,
          },
        ]}
      />
    </div>
  );
}
