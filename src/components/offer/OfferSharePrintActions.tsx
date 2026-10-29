'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileImage, FileText, X } from 'lucide-react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import { fetchOfferSharePrintAccess } from '@/lib/offerSharePrintAccess';
import {
  downloadOfferShareJpeg,
  downloadOfferSharePdf,
  offerSharePrintFilename,
  type OfferShareDownloadFormat,
} from '@/lib/offerSharePrint';
import OfferSheetImage from '@/components/offer/OfferSheetImage';
import { OFFER_SHEET_STYLES, useOfferSheetStyle } from '@/components/offer/offerSheetStyle';

type BusyAction = OfferShareDownloadFormat;

const ERRORS: Record<BusyAction, string> = {
  pdf: 'Nie udało się wygenerować PDF. Spróbuj ponownie lub pobierz JPEG.',
  jpeg: 'Nie udało się wygenerować JPEG. Spróbuj ponownie lub pobierz PDF.',
};

const BUSY_LABEL: Record<BusyAction, string> = {
  pdf: 'Przygotowuję…',
  jpeg: 'Przygotowuję…',
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
        if (action === 'jpeg') await downloadOfferShareJpeg(card.id, style, offerSharePrintFilename(card, 'jpeg'));
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
        className="eos-sheet-btn eos-sheet-btn--primary eos-sheet-btn--trigger w-full justify-start px-5"
      >
        <FileText size={15} className="eos-sheet-btn__icon" />
        <span className="flex-1 text-left">Ofertówka — wybierz styl i pobierz</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ofertówka"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-md sm:items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="flex max-h-[100dvh] w-full max-w-[980px] flex-col overflow-hidden bg-[#f7f5f0] text-[#15171a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.55)] sm:max-h-[92dvh] sm:rounded-[28px]">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#77736c]">Ofertówka · A4</p>
                <h2 className="text-[18px] font-semibold tracking-[-0.01em]">Wybierz styl karty</h2>
              </div>
              <button
                type="button"
                aria-label="Zamknij"
                disabled={busy != null}
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.06] transition hover:rotate-90 hover:bg-black/[0.1] active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <div className="flex shrink-0 gap-2 overflow-x-auto px-5 py-3 sm:w-[260px] sm:flex-col sm:overflow-visible sm:border-r sm:border-black/10 sm:py-5">
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
                          ? 'border-[#15171a] bg-[#15171a] text-white shadow-[0_12px_28px_-14px_rgba(0,0,0,0.6)]'
                          : 'border-black/10 bg-white text-[#15171a] hover:border-[#c9a96e]/70 hover:shadow-[0_10px_24px_-16px_rgba(0,0,0,0.4)]'
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

              <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#efebe4,#e4dfd6)] px-4 py-5 sm:px-8">
                <div className="mx-auto max-w-[520px]">
                  <OfferSheetImage offerId={card.id} style={style} />
                </div>
              </div>
            </div>

            <div className="border-t border-black/10 px-5 py-4">
              {error ? <p className="mb-3 text-[12px] text-red-600">{error}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="sm:mr-auto">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a857c]">Pobierz do druku</p>
                  <p className="mt-0.5 text-[12px] text-[#5d5950]">A4 w wysokiej rozdzielczości — gotowe do druku i wysyłki</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:w-[340px]">
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void run('jpeg')}
                    aria-busy={busy === 'jpeg'}
                    className="eos-sheet-btn eos-sheet-btn--ghost"
                  >
                    <FileImage size={15} className="eos-sheet-btn__icon" />
                    {busy === 'jpeg' ? BUSY_LABEL.jpeg : 'Zdjęcie'}
                  </button>
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void run('pdf')}
                    aria-busy={busy === 'pdf'}
                    className="eos-sheet-btn eos-sheet-btn--primary"
                  >
                    <FileText size={15} className="eos-sheet-btn__icon" />
                    {busy === 'pdf' ? BUSY_LABEL.pdf : 'PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
