'use client';

import { useEffect, useRef, useState } from 'react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import OfferSharePrintBrochure from '@/components/offer/OfferSharePrintBrochure';
import { exportOfferSharePdfBase64, offerSharePrintFilename } from '@/lib/offerSharePrint';

type NativeBridge = {
  ReactNativeWebView?: { postMessage: (payload: string) => void };
  estateosExportSheet?: () => Promise<void>;
};

function post(payload: Record<string, unknown>) {
  const bridge = window as Window & NativeBridge;
  bridge.ReactNativeWebView?.postMessage(JSON.stringify(payload));
}

/** Pełny ekran tej samej kartki A4, którą na WWW zapisuje się jako ofertówkę. */
export default function OfferShareArkusz({ card }: { card: OfferShareCard }) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const fitRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 794, height: 1123, scale: 0.6 });

  useEffect(() => {
    const fit = () => {
      const page = pageRef.current;
      const sheet = fitRef.current;
      if (!page || !sheet) return;
      const width = sheet.offsetWidth || 794;
      const height = sheet.offsetHeight || 1123;
      if (width < 40 || height < 40) return;
      const scale = Math.min((page.clientWidth - 12) / width, (page.clientHeight - 12) / height);
      setBox({ width, height, scale: Number.isFinite(scale) && scale > 0.05 && scale < 3 ? scale : 0.45 });
    };
    fit();
    const timer = window.setTimeout(fit, 60);
    window.addEventListener('resize', fit);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', fit);
    };
  }, [card.id]);

  useEffect(() => {
    const bridge = window as Window & NativeBridge;
    bridge.estateosExportSheet = async () => {
      const root = document.getElementById('offer-share-print-brochure');
      if (!root) {
        post({ type: 'error', message: 'Nie udało się przygotować ofertówki.' });
        return;
      }
      try {
        const base64 = await exportOfferSharePdfBase64(root);
        post({
          type: 'file',
          format: 'pdf',
          filename: offerSharePrintFilename(card, 'pdf'),
          base64,
        });
      } catch {
        post({ type: 'error', message: 'Nie udało się przygotować ofertówki.' });
      }
    };
    post({ type: 'ready' });
    return () => {
      delete bridge.estateosExportSheet;
    };
  }, [card]);

  return (
    <div ref={pageRef} className="offer-share-arkusz-page">
      <div style={{ width: box.width * box.scale, height: box.height * box.scale }}>
        <div
          ref={fitRef}
          className="offer-share-arkusz-fit"
          style={{ transform: `scale(${box.scale})` }}
        >
          <OfferSharePrintBrochure card={card} inline />
        </div>
      </div>
    </div>
  );
}
