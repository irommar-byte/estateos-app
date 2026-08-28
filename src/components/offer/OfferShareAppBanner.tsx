'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  buildOfferAndroidIntentUrl,
  buildOfferAppSchemeUrl,
  detectMobileAppContext,
  ESTATEOS_APP_STORE_URL,
} from '@/lib/estateosAppLinks';

const DISMISS_KEY = 'estateos:share-app-banner-dismissed';

type Props = {
  offerId: number;
  canonicalUrl: string;
  offerTitle?: string;
};

export default function OfferShareAppBanner({ offerId, canonicalUrl, offerTitle }: Props) {
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState('');

  const ctx = useMemo(() => detectMobileAppContext(), []);

  useEffect(() => {
    if (!ctx.showCustomBanner) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, [ctx.showCustomBanner]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const openApp = useCallback(() => {
    if (ctx.isAndroid) {
      window.location.href = buildOfferAndroidIntentUrl(offerId, canonicalUrl);
      return;
    }
    if (ctx.isIOS) {
      setToast('Otwieranie aplikacji EstateOS™…');
      window.location.href = buildOfferAppSchemeUrl(offerId);
      window.setTimeout(() => {
        setToast('Jeśli aplikacja się nie otworzyła, pobierz ją z App Store.');
      }, 2200);
      return;
    }
    window.open(ESTATEOS_APP_STORE_URL, '_blank', 'noopener,noreferrer');
  }, [canonicalUrl, ctx.isAndroid, ctx.isIOS, offerId]);

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 eos-z-share-banner border-b border-black/10 bg-[#f2f2f4]/95 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] backdrop-blur-xl dark:border-white/10 dark:bg-[#1c1c1e]/95"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 px-3 py-2.5">
          <div className="size-11 shrink-0 overflow-hidden rounded-[22%] border border-black/8 bg-[#141416] shadow-sm dark:border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/apple-touch-icon.png" alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[#141416] dark:text-white">EstateOS™</p>
            <p className="truncate text-[11px] text-[#5c5c66] dark:text-[#9a9aa8]">
              {offerTitle ? `Oferta w aplikacji` : `Oferta #${offerId} w aplikacji`}
            </p>
          </div>
          <button
            type="button"
            onClick={openApp}
            className="shrink-0 rounded-full bg-[#007aff] px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition active:scale-[0.98]"
          >
            Otwórz
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Zamknij"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#8e8e93] transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div aria-hidden className="h-[calc(env(safe-area-inset-top)+3.5rem)]" />
      {toast ? (
        <div
          className="pointer-events-none fixed inset-x-3 eos-z-share-banner mx-auto max-w-md rounded-2xl bg-[#141416]/92 px-4 py-3 text-center text-xs font-medium text-white shadow-xl backdrop-blur-md dark:bg-black/90"
          style={{ top: 'calc(env(safe-area-inset-top) + 4.5rem)' }}
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
