'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Image as ImageIcon, Printer } from 'lucide-react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import { fetchOfferSharePrintAccess } from '@/lib/offerSharePrintAccess';
import {
  downloadOfferShareJpeg,
  downloadOfferSharePdf,
  offerSharePrintFilename,
  printOfferShareBrochure,
  type OfferShareDownloadFormat,
} from '@/lib/offerSharePrint';
import { eosBtn } from '@/components/ui/eosButtonStyles';

type OfferSharePrintActionsProps = {
  card: OfferShareCard;
};

type BusyAction = 'print' | OfferShareDownloadFormat;

export default function OfferSharePrintActions({ card }: OfferSharePrintActionsProps) {
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchOfferSharePrintAccess().then((ok) => {
      if (!cancelled) setAllowed(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onPrint = useCallback(async () => {
    setError(null);
    setBusy('print');
    try {
      await printOfferShareBrochure();
    } catch {
      setError('Nie udało się przygotować wydruku. Spróbuj ponownie.');
    } finally {
      setBusy(null);
    }
  }, []);

  const onDownload = useCallback(
    async (format: OfferShareDownloadFormat) => {
      const root = document.getElementById('offer-share-print-brochure');
      if (!root) {
        setError('Nie udało się przygotować ulotki do pobrania.');
        return;
      }
      setError(null);
      setBusy(format);
      try {
        const filename = offerSharePrintFilename(card, format);
        if (format === 'jpeg') {
          await downloadOfferShareJpeg(root, filename);
        } else {
          await downloadOfferSharePdf(root, filename);
        }
      } catch {
        setError(
          format === 'jpeg'
            ? 'Nie udało się wygenerować JPEG. Spróbuj ponownie lub użyj PDF.'
            : 'Nie udało się wygenerować PDF. Spróbuj ponownie lub użyj JPEG / „Wydrukuj”.',
        );
      } finally {
        setBusy(null);
      }
    },
    [card],
  );

  if (!allowed) return null;

  const disabled = busy != null;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void onPrint()}
          disabled={disabled}
          className={eosBtn('secondary', { block: true })}
        >
          <Printer size={14} />
          {busy === 'print' ? 'Przygotowuję…' : 'Wydrukuj'}
        </button>
        <button
          type="button"
          onClick={() => void onDownload('pdf')}
          disabled={disabled}
          className={eosBtn('promote', { block: true })}
        >
          <Download size={14} />
          {busy === 'pdf' ? 'Generuję PDF…' : 'Pobierz PDF'}
        </button>
        <button
          type="button"
          onClick={() => void onDownload('jpeg')}
          disabled={disabled}
          className={eosBtn('secondary', { block: true })}
        >
          <ImageIcon size={14} />
          {busy === 'jpeg' ? 'Generuję JPEG…' : 'Pobierz JPEG'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
