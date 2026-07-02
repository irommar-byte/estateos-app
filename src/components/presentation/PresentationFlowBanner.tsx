"use client";

import { useEffect, useState } from "react";
import { Info, ChevronRight } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { getPresentationFlowDictionary } from "@/i18n/presentationFlowDictionary";
import { requestPresentationFlowOpen } from "@/lib/presentationFlowEvents";

type Variant = "crm" | "dealroom";

export default function PresentationFlowBanner({ variant }: { variant: Variant }) {
  const { locale } = useLocale();
  const t = getPresentationFlowDictionary(locale);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/presentation-flow/pending", { credentials: "include" });
        const data = await res.json();
        if (!cancelled) setHasPending(Boolean(data?.step));
      } catch {
        if (!cancelled) setHasPending(false);
      }
    };
    void check();
    const id = setInterval(check, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!hasPending) return null;

  const text = variant === "crm" ? t.hints.crmBanner : t.hints.dealRoomBanner;
  const openLabel = variant === "crm" ? t.hints.crmBannerOpen : t.hints.dealRoomBannerOpen;

  return (
    <button
      type="button"
      onClick={() => requestPresentationFlowOpen()}
      aria-label={openLabel}
      className="theme-aware-dashboard mb-4 w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3 text-left text-[var(--eos-text)] transition-colors hover:bg-amber-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
    >
      <Info size={18} className="text-amber-500 shrink-0 mt-0.5" aria-hidden />
      <p className="text-xs font-semibold leading-relaxed flex-1">{text}</p>
      <ChevronRight size={16} className="text-amber-500 shrink-0 mt-0.5" aria-hidden />
    </button>
  );
}
