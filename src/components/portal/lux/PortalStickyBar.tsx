"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { usePortalLocale } from "@/components/portal/PortalLocale";

export type StickyChip = { id: string; label: string; badge?: number; blink?: boolean };

/**
 * Przypięty pasek po zjechaniu poniżej nagłówka: biuro i bieżący etap, skróty do grup
 * (z plakietkami), dzwonek i rozmowa. Klient nigdy nie musi przewijać na górę, żeby się odnaleźć.
 */
export default function PortalStickyBar({
  agencyName,
  agencyLogo,
  stageLabel,
  done,
  total,
  chips,
  activeChip,
  onChip,
  bell,
  onChat,
}: {
  agencyName: string;
  agencyLogo?: string | null;
  stageLabel: string;
  done: number;
  total: number;
  chips: StickyChip[];
  activeChip: string | null;
  onChip: (id: string) => void;
  bell: React.ReactNode;
  onChat: () => void;
}) {
  const { t } = usePortalLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const header = document.getElementById("portal-header");
    if (!header || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { rootMargin: "-40px 0px 0px 0px" });
    io.observe(header);
    return () => io.disconnect();
  }, []);

  const monogram = (agencyName || "E").trim().charAt(0).toUpperCase();
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="bar"
          initial={{ y: -80 }}
          animate={{ y: 0 }}
          exit={{ y: -80 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="fixed inset-x-0 top-0 z-[60] bg-black/92 pt-[env(safe-area-inset-top)] text-[#F6F3EE] shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur-md"
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="flex items-center gap-3 py-2.5">
              {agencyLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agencyLogo} alt={agencyName} className="h-7 max-w-[72px] rounded-md bg-white object-contain p-0.5" />
              ) : (
                <span className="lux-serif flex size-8 shrink-0 items-center justify-center rounded-full border border-[#D8C3A0] text-[14px] text-[#D8C3A0]">
                  {monogram}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{stageLabel}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#D8C3A0]/22">
                    <span className="block h-full rounded-full bg-[#D8C3A0] transition-[width] duration-700" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-[#D8C3A0]">
                    {done}/{total}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onChat}
                aria-label={t("Napisz do agenta")}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#D8C3A0] text-black"
              >
                <MessageCircle className="size-4" />
              </button>
              {bell}
            </div>
            <nav aria-label={t("Sekcje panelu")} className="eos-chips -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2.5 sm:mx-0 sm:px-0">
              {chips.map((chip) => {
                const active = chip.id === activeChip;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => onChip(chip.id)}
                    aria-current={active ? "true" : undefined}
                    className={`relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors ${
                      active ? "bg-[#F6F3EE] text-black" : "bg-white/[0.08] text-[#E9E3D8] hover:bg-white/[0.14]"
                    }`}
                  >
                    {chip.label}
                    {chip.badge ? (
                      <span
                        className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-extrabold text-white ${
                          chip.blink ? "eos-badge-blink bg-[#C2412D]" : "bg-[#8C877D]"
                        }`}
                      >
                        {chip.badge > 9 ? "9+" : chip.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
