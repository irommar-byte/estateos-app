"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  detectInAppBrowser,
  dismissIabBanner,
  isIabBannerDismissed,
  openInSystemBrowser,
} from "@/lib/inAppBrowser";

/**
 * Facebook / Instagram open links in a limited in-app browser.
 * Never auto-navigate (x-safari-https / Chrome intent wysyłały ludzi
 * w pusty ekran albo poza ofertę). Zostaje tylko ręczny CTA.
 */
export default function OpenInSystemBrowserGate() {
  const ctx = useMemo(() => detectInAppBrowser(), []);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ctx.isSocialInAppBrowser) return;
    if (isIabBannerDismissed()) return;
    const t = window.setTimeout(() => setVisible(true), 280);
    return () => window.clearTimeout(t);
  }, [ctx.isSocialInAppBrowser]);

  if (!ctx.isSocialInAppBrowser || !visible) return null;

  const browserName = ctx.isIOS ? "Safari" : ctx.isAndroid ? "Chrome" : "przeglądarce";

  return (
    <div
      className="fixed inset-x-0 top-0 z-[2147483646] px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
      role="dialog"
      aria-label="Otwórz w przeglądarce systemowej"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-amber-400/40 bg-[#111]/95 px-3.5 py-3 text-white shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">
            Podgląd Facebook / Instagram
          </p>
          <p className="mt-1 text-sm leading-snug text-white/90">
            Galeria i powiększanie zdjęć działają w pełnej przeglądarce. Otwórz EstateOS w {browserName}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openInSystemBrowser(window.location.href)}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-black"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Otwórz w {browserName}
            </button>
            {ctx.isIOS ? (
              <p className="w-full text-[10px] leading-relaxed text-white/55">
                Albo: ⋯ u dołu → <span className="text-white/85">Otwórz w Safari</span>
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          aria-label="Zamknij"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70"
          onClick={() => {
            dismissIabBanner();
            setVisible(false);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
