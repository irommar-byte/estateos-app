"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";

export type GroupTone = "ink" | "gold" | "green" | "blue" | "rose" | "slate";

const TONES: Record<GroupTone, { bg: string; fg: string }> = {
  ink: { bg: "#15171A", fg: "#D8C3A0" },
  gold: { bg: "#F4EBDA", fg: "#7A5F33" },
  green: { bg: "#E5F3EC", fg: "#2F7D58" },
  blue: { bg: "#E7EEF8", fg: "#2F5D9E" },
  rose: { bg: "#FBEAE6", fg: "#B4432F" },
  slate: { bg: "#EEECE8", fg: "#5B574F" },
};

/** Zapamiętany stan zwinięcia grup (w tej przeglądarce). */
export function usePortalGroups(token: string | null, defaults: Record<string, boolean>) {
  const key = token ? `eos-portal-groups:${token}` : null;
  const [open, setOpenMap] = useState<Record<string, boolean>>(defaults);
  useEffect(() => {
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setOpenMap((cur) => ({ ...cur, ...(JSON.parse(raw) as Record<string, boolean>) }));
    } catch {
      /* ignore */
    }
  }, [key]);
  const persist = useCallback(
    (next: Record<string, boolean>) => {
      if (!key) return;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  const setOpen = useCallback(
    (id: string, value: boolean) =>
      setOpenMap((cur) => {
        const next = { ...cur, [id]: value };
        persist(next);
        return next;
      }),
    [persist],
  );
  const setAll = useCallback(
    (ids: string[], value: boolean) =>
      setOpenMap((cur) => {
        const next = { ...cur, ...Object.fromEntries(ids.map((id) => [id, value])) };
        persist(next);
        return next;
      }),
    [persist],
  );
  const isOpen = useCallback((id: string) => open[id] ?? defaults[id] ?? true, [open, defaults]);
  return { isOpen, setOpen, setAll };
}

/**
 * Zwijana grupa panelu: kolorowa ikona, tytuł, jedno zdanie podsumowania, plakietka „wymaga uwagi”
 * (mruga, gdy w środku jest coś nowego). Treść zostaje w DOM po zwinięciu — dzwonek i skróty
 * mogą do niej przewinąć po rozwinięciu.
 */
export default function PortalGroup({
  id,
  title,
  summary,
  icon: Icon,
  tone,
  open,
  onToggle,
  badge,
  blink,
  children,
}: {
  id: string;
  title: string;
  summary?: React.ReactNode;
  icon: LucideIcon;
  tone: GroupTone;
  open: boolean;
  onToggle: () => void;
  badge?: number;
  blink?: boolean;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  const attention = Boolean(blink && badge);
  return (
    <section id={`grp-${id}`} data-group={id} className={`eos-group ${attention ? "eos-group--attention" : ""}`}>
      <button type="button" className="eos-group__head" onClick={onToggle} aria-expanded={open} aria-controls={`grp-body-${id}`}>
        <span className="eos-group__icon relative" style={{ background: t.bg, color: t.fg }}>
          <Icon className="size-[19px]" />
          {badge ? (
            <span
              className={`absolute -right-1.5 -top-1.5 flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-extrabold text-white ${
                blink ? "eos-badge-blink bg-[#C2412D]" : "bg-[#8C877D]"
              }`}
              aria-label={`${badge} do sprawdzenia`}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold text-[#15171A]">{title}</span>
          {summary ? <span className="mt-0.5 block truncate text-[12.5px] text-[#6F6A61]">{summary}</span> : null}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F6F3EE]">
          <ChevronDown className="size-4 text-[#5B574F]" />
        </motion.span>
      </button>
      <motion.div
        id={`grp-body-${id}`}
        initial={false}
        animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ overflow: "hidden" }}
        aria-hidden={!open}
      >
        <div className="space-y-5 border-t border-[#F0EBE3] px-4 pb-5 pt-4 sm:px-5">{children}</div>
      </motion.div>
    </section>
  );
}
