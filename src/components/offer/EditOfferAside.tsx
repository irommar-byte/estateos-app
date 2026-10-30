'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ExternalLink, Loader2, Save } from 'lucide-react';

type Props = {
  offerId: string | null;
  data: Record<string, any>;
  images: string[];
  floorPlanUrl: string | null;
  scannedRooms: string[];
  has3d: boolean;
  dirty: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
  onSave: () => void;
};

const plainLength = (html: string) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
const digits = (v: unknown) => Number(String(v ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
const money = (n: number, cur: string) =>
  `${Math.round(n).toLocaleString('pl-PL')} ${cur === 'EUR' ? '€' : 'zł'}`;

/** Prawy panel edycji: podgląd ogłoszenia na żywo, kompletność z listą braków i zapis. */
export default function EditOfferAside({ offerId, data, images, floorPlanUrl, scannedRooms, has3d, dirty, isSubmitting, isSuccess, onSave }: Props) {
  const price = digits(String(data.price || '').replace(/\s/g, ''));
  const area = digits(data.area);
  const cur = String(data.priceCurrency || 'PLN').toUpperCase();
  const ppsm = price > 0 && area > 0 ? price / area : 0;
  const title = String(data.title || '').trim();
  const descLen = plainLength(String(data.description || ''));
  const cover = images[0];
  const chips = [
    area > 0 ? `${String(data.area).replace('.', ',')} m²` : null,
    data.rooms ? `${data.rooms} pok.` : null,
    data.floor !== undefined && data.floor !== '' && data.floor !== null
      ? `piętro ${String(data.floor) === '0' ? 'parter' : data.floor}${data.totalFloors ? `/${data.totalFloors}` : ''}`
      : null,
    data.year ? `${data.year} r.` : null,
  ].filter(Boolean) as string[];
  const place = [data.district, data.city].filter(Boolean).join(', ');

  const checks = [
    { ok: title.length >= 25 && title.length <= 90, label: 'Tytuł 25–90 znaków', hint: `${title.length} znaków`, href: '#edit-key' },
    { ok: price > 0 && area > 0, label: 'Cena i metraż', hint: ppsm ? `${Math.round(ppsm).toLocaleString('pl-PL')} zł/m²` : 'uzupełnij', href: '#edit-key' },
    { ok: descLen >= 600, label: 'Opis min. 600 znaków', hint: `${descLen} znaków`, href: '#edit-desc' },
    { ok: images.length >= 8, label: 'Min. 8 zdjęć', hint: `${images.length} zdjęć`, href: '#edit-gallery' },
    { ok: Boolean(floorPlanUrl), label: 'Rzut lokalu', hint: floorPlanUrl ? 'dodany' : 'brak', href: '#edit-plan' },
    { ok: scannedRooms.length > 0 || has3d, label: 'Skan LiDAR / 3D', hint: scannedRooms.length ? `${scannedRooms.length} pomieszczeń` : has3d ? 'model 3D' : 'z aplikacji', href: '#edit-plan' },
    { ok: Boolean(String(data.videoUrl || '').trim()), label: 'Film lub spacer', hint: data.videoUrl ? 'dodany' : 'opcjonalnie', href: '#edit-gallery' },
    { ok: data.isExactLocation !== false && Boolean(data.lat), label: 'Dokładna lokalizacja', hint: place || '—', href: '#edit-location' },
    { ok: Boolean(String(data.landRegistryNumber || '').trim()), label: 'Numer księgi wieczystej', hint: data.landRegistryNumber ? 'podany' : 'buduje zaufanie', href: '#edit-key' },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const ring = 2 * Math.PI * 26;
  const scoreColor = score >= 85 ? '#10b981' : score >= 60 ? '#d4af37' : '#f97316';

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-28 space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]"
        >
          <div className="relative aspect-[4/3] bg-[var(--eos-input)]">
            {cover ? <img src={cover} alt="" className="absolute inset-0 size-full object-cover" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
              Podgląd na żywo
            </span>
            <div className="absolute inset-x-4 bottom-3">
              <p className="text-[22px] font-bold leading-tight tracking-tight text-white">{price > 0 ? money(price, cur) : 'Cena —'}</p>
              {ppsm ? <p className="text-xs font-medium text-white/75">{Math.round(ppsm).toLocaleString('pl-PL')} zł/m²</p> : null}
            </div>
          </div>
          <div className="space-y-2.5 p-4">
            <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--eos-text)]">{title || 'Tytuł ogłoszenia'}</p>
            {place ? <p className="text-xs text-[var(--eos-muted)]">{place}</p> : null}
            {chips.length ? (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c} className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] px-2.5 py-1 text-[11px] font-medium text-[var(--eos-text)]">
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
            {offerId ? (
              <a
                href={`/oferta/${offerId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Zobacz opublikowaną ofertę <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5"
        >
          <div className="flex items-center gap-4">
            <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--eos-input)" strokeWidth="7" />
              <motion.circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke={scoreColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={ring}
                initial={{ strokeDashoffset: ring }}
                animate={{ strokeDashoffset: ring * (1 - score / 100) }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
            <div>
              <p className="text-[26px] font-bold leading-none tracking-tight text-[var(--eos-text)]">{score}%</p>
              <p className="mt-1 text-xs text-[var(--eos-muted)]">
                {score >= 85 ? 'Ogłoszenie kompletne' : score >= 60 ? 'Dobre — można jeszcze dopracować' : 'Uzupełnij kluczowe elementy'}
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-0.5">
            {checks.map((c) => (
              <li key={c.label}>
                <a href={c.href} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-[var(--eos-input)]">
                  {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-emerald-500" /> : <Circle className="size-4 shrink-0 text-[var(--eos-subtle)]" />}
                  <span className={`flex-1 text-[12.5px] ${c.ok ? 'text-[var(--eos-text)]' : 'text-[var(--eos-muted)]'}`}>{c.label}</span>
                  <span className="text-[11px] text-[var(--eos-subtle)]">{c.hint}</span>
                </a>
              </li>
            ))}
          </ul>
        </motion.div>

        <button
          type="button"
          onClick={onSave}
          disabled={isSubmitting || isSuccess}
          className={`flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-semibold transition-all ${
            isSuccess
              ? 'bg-emerald-500 text-black'
              : dirty
                ? 'bg-emerald-500 text-black shadow-[0_14px_34px_-14px_rgba(16,185,129,0.8)] hover:bg-emerald-400 active:scale-[0.98]'
                : 'border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-text)] hover:border-emerald-500/40'
          }`}
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : isSuccess ? <CheckCircle2 className="size-4" /> : <Save className="size-4" />}
          {isSubmitting ? 'Zapisywanie…' : isSuccess ? 'Zapisano' : 'Zapisz zmiany'}
        </button>
        <p className="text-center text-[11px] text-[var(--eos-subtle)]">
          {dirty && !isSuccess ? '● Masz niezapisane zmiany · ⌘S / Ctrl+S' : 'Wszystkie zmiany zapisane · ⌘S / Ctrl+S'}
        </p>
      </div>
    </aside>
  );
}
