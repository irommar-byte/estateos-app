"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { IntelligenceChoice } from "@/lib/crm/clientIntelligence";

type Props = {
  label: string;
  hint?: string;
  value: number;
  options: IntelligenceChoice[];
  onChange: (next: number) => void;
  accent?: string;
  optionAccent?: (value: number) => string;
};

export default function EosGlowSelect({
  label,
  hint,
  value,
  options,
  onChange,
  accent,
  optionAccent,
}: Props) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((item) => item.value === value) || options[0];
  const glow = accent || optionAccent?.(value) || "#34d399";

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: number) => {
    onChange(next);
    setOpen(false);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 720);
  };

  return (
    <div ref={rootRef} className={`eos-glow-select ${open ? "is-open" : ""} ${flash ? "is-flash" : ""}`}>
      <p className="text-xs font-bold text-[var(--eos-muted)]">{label}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-[var(--eos-text)]/65">{hint}</p> : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className="eos-glow-select__value"
        style={{ ["--eos-glow" as string]: glow }}
      >
        <span>{selected?.label}</span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul id={listId} role="listbox" className="eos-glow-select__list">
          {options.map((option) => {
            const active = option.value === value;
            const tone = optionAccent?.(option.value) || glow;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(option.value)}
                  className={`eos-glow-select__option ${active ? "is-active" : ""}`}
                  style={{ ["--eos-glow" as string]: tone }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
