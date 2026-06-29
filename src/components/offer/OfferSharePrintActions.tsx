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

  const onPrint = useCallback(() => {
    setError(null);
    printOfferShareBrochure();
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
          onClick={onPrint}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white/60 px-5 py-3 text-xs font-bold uppercase tracking-widest text-[#141416] transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <Printer size={14} />
          Wydrukuj
        </button>
        <button
          type="button"
          onClick={() => void onPdf()}
          disabled={pdfBusy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#b8922e]/35 bg-[#b8922e]/10 px-5 py-3 text-xs font-bold uppercase tracking-widest text-[#8a6e2f] transition hover:bg-[#b8922e]/15 disabled:opacity-60 dark:text-[#d4af37]"
        >
          <Download size={14} />
          {pdfBusy ? 'Generuję PDF…' : 'Pobierz PDF'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
