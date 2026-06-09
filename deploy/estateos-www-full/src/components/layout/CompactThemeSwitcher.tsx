"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { useLocale } from "@/contexts/LocaleContext";
import ContactMessagesNavButton from "@/components/contact/ContactMessagesNavButton";

type DockTheme = "light" | "dark";

export default function CompactThemeSwitcher({
  className = "",
  showMessages = false,
}: {
  className?: string;
  showMessages?: boolean;
}) {
  const { dict } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const value: DockTheme = resolvedTheme === "light" ? "light" : "dark";

  const onChange = (next: DockTheme) => {
    setTheme(next as ThemePreference);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => onChange("light")}
        aria-label={dict.theme.light}
        title={dict.theme.light}
        className={`flex flex-1 items-center justify-center rounded-full py-2 transition-colors ${
          value === "light"
            ? "bg-[var(--eos-surface-strong)] text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)]"
            : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
        }`}
      >
        <Sun className="size-3.5" aria-hidden />
      </button>
      {showMessages ? (
        <ContactMessagesNavButton compact className="shrink-0 rounded-full border-0 bg-transparent p-1.5 shadow-none" />
      ) : null}
      <button
        type="button"
        onClick={() => onChange("dark")}
        aria-label={dict.theme.dark}
        title={dict.theme.dark}
        className={`flex flex-1 items-center justify-center rounded-full py-2 transition-colors ${
          value === "dark"
            ? "bg-[var(--eos-surface-strong)] text-[var(--eos-text)] shadow-[var(--eos-shadow-soft)]"
            : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
        }`}
      >
        <Moon className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
