'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import { fetchOfferSharePrintAccess } from '@/lib/offerSharePrintAccess';
import {
  downloadOfferSharePdf,
  offerSharePrintFilename,
  printOfferShareBrochure,
} from '@/lib/offerSharePrint';
import { eosBtn } from '@/components/ui/eosButtonStyles';

type OfferSharePrintActionsProps = {
  card: OfferShareCard;
};

export default function OfferSharePrintActions({ card }: OfferSharePrintActionsProps) {
  const [allowed, setAllowed] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
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
    setPdfBusy(true);
    try {
      await printOfferShareBrochure();
    } catch {
      setError('Nie udało się przygotować wydruku. Spróbuj ponownie.');
    } finally {
      setPdfBusy(false);
    }
  }, []);

  const onPdf = useCallback(async () => {
    const root = document.getElementById('offer-share-print-brochure');
    if (!root) {
      setError('Nie udało się przygotować ulotki do PDF.');
      return;
    }
    setError(null);
    setPdfBusy(true);
    try {
      await downloadOfferSharePdf(root, offerSharePrintFilename(card));
    } catch {
      setError('Nie udało się wygenerować PDF. Spróbuj ponownie lub użyj „Wydrukuj”.');
    } finally {
      setPdfBusy(false);
    }
  }, [card]);

  if (!allowed) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void onPrint()}
          disabled={pdfBusy}
          className={eosBtn('secondary', { block: true })}
        >
          <Printer size={14} />
          Wydrukuj
        </button>
        <button
          type="button"
          onClick={() => void onPdf()}
          disabled={pdfBusy}
          className={eosBtn('promote', { block: true })}
        >
          <Download size={14} />
          {pdfBusy ? 'Generuję PDF…' : 'Pobierz PDF'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
