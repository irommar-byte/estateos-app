'use client';

import { useEffect, useState } from 'react';
import { loadOfferSheetBlob, type OfferSheetStyleParam } from '@/lib/offerSharePrint';

/** Podgląd ofertówki = dokładnie ten obraz, który trafi do PDF, JPEG i druku. */
export default function OfferSheetImage({ offerId, style, className = '' }: { offerId: number; style: OfferSheetStyleParam; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setSrc(null);
    setFailed(false);
    loadOfferSheetBlob(offerId, style)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [offerId, style]);

  return (
    <div className={`eos-sheet-preview ${className}`} data-ready={src ? '1' : '0'}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Podgląd ofertówki A4" className="eos-sheet-preview__img" />
      ) : (
        <div className="eos-sheet-preview__skeleton">
          <span>{failed ? 'Nie udało się przygotować podglądu.' : 'Składam kartkę A4…'}</span>
        </div>
      )}
    </div>
  );
}
