"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Compass, Bookmark, Sparkles, ArrowRight } from "lucide-react";
import { subscribeDiscoveryUpdated } from "@/lib/discovery/clientEvents";

export default function EstateOsGuidePanel() {
  const [guide, setGuide] = useState<{ nextStep?: { title?: string; action?: string }; confidence?: number } | null>(null);

  const refreshGuide = useCallback(() => {
    void fetch("/api/guide/context", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setGuide(payload?.guide || null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshGuide();
    return subscribeDiscoveryUpdated(refreshGuide);
  }, [refreshGuide]);

  const title = guide?.nextStep?.title || "Zacznijmy od tego, co jest dla Ciebie ważne.";
  return (
    <section className="relative z-30 mx-auto -mt-8 mb-10 w-[calc(100%-2rem)] max-w-6xl sm:-mt-10 sm:w-[calc(100%-3rem)]">
      <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-black/55 p-5 backdrop-blur-2xl sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-200">
                <Sparkles size={16} />
              </span>
              <div>
                <p className="text-sm font-black text-white">EstateOS Guide</p>
                <p className="text-xs text-white/55">Przewodnik po Twojej decyzji mieszkaniowej</p>
              </div>
            </div>
            <h2 className="mt-5 max-w-xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Guide uczy się z Twoich cichych decyzji na ofertach — pasuje, nie dla mnie, na poważnie — i podpowiada kolejny krok bez formularza i presji.
              Głębsze Discovery™ (przesuwanie kart) zostaje w aplikacji mobilnej; na www gust buduje się naturalnie przy przeglądaniu.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-[34rem] lg:grid-cols-1">
            <Link href={guide?.nextStep?.action === "TROPES" ? "/oferty" : "/odkryj-mape"} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 transition hover:bg-white/[0.1]">
              <Compass size={17} className="text-amber-200" />
              <span className="flex-1 text-sm font-semibold text-white">Znajdź przestrzeń dla siebie</span>
              <ArrowRight size={15} className="text-amber-200 transition group-hover:translate-x-0.5" />
            </Link>
            <Link href="/moj-kierunek" className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 transition hover:bg-white/[0.1]">
              <Bookmark size={17} className="text-amber-200" />
              <span className="flex-1 text-sm font-semibold text-white">Zobacz mój kierunek</span>
              <ArrowRight size={15} className="text-amber-200 transition group-hover:translate-x-0.5" />
            </Link>
            <Link href="/oferty" className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 transition hover:bg-white/[0.1]">
              <Sparkles size={17} className="text-amber-200" />
              <span className="flex-1 text-sm font-semibold text-white">Oceń oferty · ucz gust</span>
              <ArrowRight size={15} className="text-amber-200 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
