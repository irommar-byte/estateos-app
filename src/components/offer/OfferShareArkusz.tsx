'use client';

import { useEffect } from 'react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import OfferSheetImage from '@/components/offer/OfferSheetImage';
import { OFFER_SHEET_STYLES, useOfferSheetStyle } from '@/components/offer/offerSheetStyle';
import { exportOfferSharePdfBase64, offerSharePrintFilename } from '@/lib/offerSharePrint';

type NativeBridge = {
  ReactNativeWebView?: { postMessage: (payload: string) => void };
  estateosExportSheet?: () => Promise<void>;
};

function post(payload: Record<string, unknown>) {
  const bridge = window as Window & NativeBridge;
  bridge.ReactNativeWebView?.postMessage(JSON.stringify(payload));
}

/** Ofertówka w aplikacji: agent wybiera styl, widzi kartkę, a przyciski aplikacji eksportują wybrany styl. */
export default function OfferShareArkusz({ card, initialStyle }: { card: OfferShareCard; initialStyle?: string }) {
  const [style, pick] = useOfferSheetStyle(initialStyle);

  useEffect(() => {
    const bridge = window as Window & NativeBridge;
    bridge.estateosExportSheet = async () => {
      try {
        const base64 = await exportOfferSharePdfBase64(card.id, style);
        post({ type: 'file', format: 'pdf', filename: offerSharePrintFilename(card, 'pdf'), base64 });
      } catch {
        post({ type: 'error', message: 'Nie udało się przygotować ofertówki.' });
      }
    };
    post({ type: 'ready' });
    return () => {
      delete bridge.estateosExportSheet;
    };
  }, [card, style]);

  return (
    <div className="offer-share-arkusz-page">
      <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-[#111113]/95 px-3 py-3 backdrop-blur">
        {OFFER_SHEET_STYLES.map((option) => {
          const active = option.id === style;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => pick(option.id)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold transition ${
                active ? 'bg-white text-[#15171a]' : 'bg-white/10 text-white/80'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="px-3 pb-6 pt-1">
        <OfferSheetImage offerId={card.id} style={style} />
      </div>
    </div>
  );
}
