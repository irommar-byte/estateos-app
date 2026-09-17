'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Download, FileImage, FileText, Printer } from 'lucide-react';
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
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = useCallback(
    async (action: BusyAction) => {
      const root = document.getElementById('offer-share-print-brochure');
      if (!root && action !== 'print') {
        setError('Nie udało się przygotować ulotki do pobrania.');
        return;
      }
      setError(null);
      setBusy(action);
      setOpen(false);
      try {
        if (action === 'print') {
          await printOfferShareBrochure();
          return;
        }
        if (!root) return;
        const filename = offerSharePrintFilename(card, action);
        if (action === 'jpeg') {
          await downloadOfferShareJpeg(root, filename);
        } else {
          await downloadOfferSharePdf(root, filename);
        }
      } catch {
        setError(
          action === 'print'
            ? 'Nie udało się przygotować wydruku. Spróbuj ponownie.'
            : action === 'jpeg'
              ? 'Nie udało się wygenerować JPEG. Spróbuj ponownie lub użyj PDF.'
              : 'Nie udało się wygenerować PDF. Spróbuj ponownie lub użyj JPEG.',
        );
      } finally {
        setBusy(null);
      }
    },
    [card],
  );

  if (!allowed) return null;

  const disabled = busy != null;
  const label =
    busy === 'print'
      ? 'Przygotowuję wydruk…'
      : busy === 'pdf'
        ? 'Generuję PDF…'
        : busy === 'jpeg'
          ? 'Generuję JPEG…'
          : 'Ofertówka';

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        className={eosBtn('promote', { block: true })}
      >
        <FileText size={14} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_40px_rgba(20,20,22,0.18)] dark:border-white/10 dark:bg-[#141418]"
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => void run('print')}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-[#141416] hover:bg-black/[0.04] dark:text-white dark:hover:bg-white/[0.06]"
          >
            <Printer size={15} className="opacity-70" />
            Wydrukuj
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => void run('pdf')}
            className="flex w-full items-center gap-3 border-t border-black/8 px-4 py-3 text-left text-sm font-semibold text-[#141416] hover:bg-black/[0.04] dark:border-white/8 dark:text-white dark:hover:bg-white/[0.06]"
          >
            <Download size={15} className="opacity-70" />
            Pobierz PDF
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => void run('jpeg')}
            className="flex w-full items-center gap-3 border-t border-black/8 px-4 py-3 text-left text-sm font-semibold text-[#141416] hover:bg-black/[0.04] dark:border-white/8 dark:text-white dark:hover:bg-white/[0.06]"
          >
            <FileImage size={15} className="opacity-70" />
            Pobierz JPEG
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
