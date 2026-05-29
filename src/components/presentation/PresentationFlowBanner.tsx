"use client";

import { useEffect, useState } from "react";
import { Info, ChevronRight } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { getPresentationFlowDictionary } from "@/i18n/presentationFlowDictionary";

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

  return (
    <div className="theme-aware-dashboard mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3 text-[var(--eos-text)]">
      <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs font-semibold leading-relaxed flex-1">{text}</p>
      <ChevronRight size={16} className="text-amber-500 shrink-0 mt-0.5" />
    </div>
  );
}
