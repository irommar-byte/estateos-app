'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileImage, FileText, Printer, X } from 'lucide-react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import { fetchOfferSharePrintAccess } from '@/lib/offerSharePrintAccess';
import {
  downloadOfferShareJpeg,
  downloadOfferSharePdf,
  offerSharePrintFilename,
  printOfferShareBrochure,
  type OfferShareDownloadFormat,
} from '@/lib/offerSharePrint';
import OfferSheetImage from '@/components/offer/OfferSheetImage';
import { OFFER_SHEET_STYLES, useOfferSheetStyle } from '@/components/offer/offerSheetStyle';

type BusyAction = 'print' | OfferShareDownloadFormat;

const ERRORS: Record<BusyAction, string> = {
  print: 'Nie udało się przygotować wydruku. Spróbuj ponownie.',
  pdf: 'Nie udało się wygenerować PDF. Spróbuj ponownie lub pobierz JPEG.',
  jpeg: 'Nie udało się wygenerować JPEG. Spróbuj ponownie lub pobierz PDF.',
};

const BUSY_LABEL: Record<BusyAction, string> = {
  print: 'Przygotowuję wydruk…',
  pdf: 'Generuję PDF…',
  jpeg: 'Generuję JPEG…',
};

/** Ofertówka: agent wybiera styl na żywym podglądzie, potem drukuje albo pobiera PDF/JPEG. */
export default function OfferSharePrintActions({ card }: { card: OfferShareCard }) {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [style, pick] = useOfferSheetStyle();
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, busy]);

  const openPicker = () => {
    setError(null);
    setOpen(true);
  };

  const run = useCallback(
    async (action: BusyAction) => {
      setError(null);
      setBusy(action);
      try {
        if (action === 'print') await printOfferShareBrochure(card.id, style);
        else if (action === 'jpeg') await downloadOfferShareJpeg(card.id, style, offerSharePrintFilename(card, 'jpeg'));
        else await downloadOfferSharePdf(card.id, style, offerSharePrintFilename(card, 'pdf'));
      } catch {
        setError(ERRORS[action]);
      } finally {
        setBusy(null);
      }
    },
    [card, style],
  );

  if (!allowed) return null;


  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="eos-lux-btn eos-lux-btn--primary w-full justify-start px-5"
      >
        <FileText size={15} className="eos-lux-btn__icon" />
        <span className="flex-1 text-left">Ofertówka — wybierz styl i pobierz</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ofertówka"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="flex max-h-[100dvh] w-full max-w-[980px] flex-col overflow-hidden bg-[#f6f3ee] text-[#15171a] sm:max-h-[92dvh] sm:rounded-[28px] dark:bg-[#141312] dark:text-[#f3eee6]">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#77736c]">Ofertówka · A4</p>
                <h2 className="text-[18px] font-semibold tracking-[-0.01em]">Wybierz styl karty</h2>
              </div>
              <button
                type="button"
                aria-label="Zamknij"
                disabled={busy != null}
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.06] transition hover:rotate-90 hover:bg-black/[0.1] active:scale-90 dark:bg-white/[0.08] dark:hover:bg-white/[0.14]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <div className="flex shrink-0 gap-2 overflow-x-auto px-5 py-3 sm:w-[260px] sm:flex-col sm:overflow-visible sm:border-r sm:border-black/10 sm:py-5 dark:sm:border-white/10">
                {OFFER_SHEET_STYLES.map((option) => {
                  const active = option.id === style;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => pick(option.id)}
                      className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition duration-300 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-0.5 active:scale-[0.98] sm:w-full ${
                        active
                          ? 'border-[#15171a] bg-[#15171a] text-white dark:border-[#f3eee6] dark:bg-[#f3eee6] dark:text-[#15171a]'
                          : 'border-black/10 bg-white hover:border-black/30 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/30'
                      }`}
                    >
                      <span className="block text-[14px] font-semibold">{option.label}</span>
                      <span className={`mt-0.5 hidden text-[12px] leading-snug sm:block ${active ? 'opacity-75' : 'text-[#77736c]'}`}>
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#e9e5de] px-4 py-5 sm:px-8 dark:bg-[#0c0b0a]">
                <div className="mx-auto max-w-[520px]">
                  <OfferSheetImage offerId={card.id} style={style} />
                </div>
              </div>
            </div>

            <div className="border-t border-black/10 px-5 py-4 dark:border-white/10">
              {error ? <p className="mb-3 text-[12px] text-red-600 dark:text-red-400">{error}</p> : null}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void run('print')}
                  aria-busy={busy === 'print'}
                  className="eos-lux-btn eos-lux-btn--primary"
                >
                  <Printer size={15} className="eos-lux-btn__icon" />
                  {busy === 'print' ? BUSY_LABEL.print : 'Drukuj'}
                </button>
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void run('pdf')}
                  aria-busy={busy === 'pdf'}
                  className="eos-lux-btn eos-lux-btn--ghost"
                >
                  <Download size={15} className="eos-lux-btn__icon" />
                  {busy === 'pdf' ? BUSY_LABEL.pdf : 'Pobierz PDF'}
                </button>
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void run('jpeg')}
                  aria-busy={busy === 'jpeg'}
                  className="eos-lux-btn eos-lux-btn--ghost"
                >
                  <FileImage size={15} className="eos-lux-btn__icon" />
                  {busy === 'jpeg' ? BUSY_LABEL.jpeg : 'Pobierz JPEG'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
