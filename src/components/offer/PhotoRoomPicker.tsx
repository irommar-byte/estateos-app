'use client';

import { useEffect } from 'react';
import { MapPin, Plus, ScanLine, X } from 'lucide-react';

/** Typowe pomieszczenia — gdy oferta nie ma skanu, a i tak warto opisać zdjęcia. */
export const DEFAULT_PHOTO_ROOMS = [
  'Salon',
  'Kuchnia',
  'Sypialnia',
  'Pokój',
  'Pokój dziecięcy',
  'Gabinet',
  'Łazienka',
  'WC',
  'Przedpokój',
  'Garderoba',
  'Balkon',
  'Taras',
  'Ogród',
  'Garaż',
  'Budynek',
  'Widok',
];

/** Najpierw pomieszczenia ze skanu (te same nazwy co na rzucie), potem typowe. */
export function photoRoomOptions(scannedNames: Array<string | null | undefined>): { options: string[]; scanned: number } {
  const out: string[] = [];
  const seen = new Set<string>();
  let scanned = 0;
  scannedNames.forEach((name) => {
    const label = String(name || '').trim();
    const key = label.toLocaleLowerCase('pl');
    if (!label || seen.has(key)) return;
    seen.add(key);
    out.push(label);
    scanned += 1;
  });
  for (const label of DEFAULT_PHOTO_ROOMS) {
    const key = label.toLocaleLowerCase('pl');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return { options: out, scanned };
}

/** Nazwy pomieszczeń ze skanu zapisanego w ofercie (floorPlanScanMeta.roomScans). */
export function scannedRoomNames(rawMeta: unknown): string[] {
  try {
    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    const rooms = Array.isArray((meta as { roomScans?: unknown[] })?.roomScans) ? (meta as { roomScans: Array<{ name?: string }> }).roomScans : [];
    return rooms.map((room) => String(room?.name || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Plakietka na kafelku zdjęcia: nazwa pomieszczenia albo „+ Pomieszczenie”. */
export function PhotoRoomBadge({ label, onOpen, className = '' }: { label?: string | null; onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      title={label ? `Pomieszczenie: ${label}` : 'Przypisz pomieszczenie'}
      className={`eos-photo-room-badge ${label ? 'is-set' : ''} ${className}`}
    >
      {label ? <MapPin size={11} /> : <Plus size={12} />}
      <span>{label || 'Pomieszczenie'}</span>
    </button>
  );
}

/** Okno „Które to pomieszczenie?” — zdjęcie połączy się z rzutem na stronie oferty. */
export function PhotoRoomPickerDialog({
  open,
  options,
  scannedCount,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  options: string[];
  scannedCount: number;
  current?: string | null;
  onPick: (room: string | null) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const isActive = (room: string) => Boolean(current) && current!.toLocaleLowerCase('pl') === room.toLocaleLowerCase('pl');
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pomieszczenie zdjęcia"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="eos-photo-room-dialog w-full max-w-[520px] rounded-t-[28px] bg-[#f7f5f0] p-6 text-[#15171a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.6)] sm:rounded-[28px]">
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[19px] font-semibold tracking-[-0.01em]">Które to pomieszczenie?</h3>
            <p className="mt-1 text-[13px] leading-snug text-[#6b6e75]">
              Zdjęcie połączy się z rzutem — klient kliknie pokój i zobaczy jego zdjęcia.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Zamknij" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.06] transition hover:rotate-90 hover:bg-black/[0.1]">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 flex max-h-[50vh] flex-wrap gap-2 overflow-y-auto pb-1">
          {options.map((room, index) => (
            <button
              key={room}
              type="button"
              onClick={() => onPick(room)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition duration-200 active:scale-95 ${
                isActive(room)
                  ? 'border-[#15171a] bg-[#15171a] text-white'
                  : index < scannedCount
                    ? 'border-[#c9a96e]/70 bg-white text-[#15171a] hover:bg-[#fbf7ef]'
                    : 'border-transparent bg-[#ece8e1] text-[#15171a] hover:bg-[#e3ded5]'
              }`}
            >
              {index < scannedCount ? <ScanLine size={13} className={isActive(room) ? 'text-white' : 'text-[#b08a47]'} /> : null}
              {room}
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between">
          {current ? (
            <button type="button" onClick={() => onPick(null)} className="text-[13px] font-semibold text-[#6b6e75] hover:text-[#15171a]">
              Usuń przypisanie
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="rounded-full bg-[#15171a] px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-black active:scale-95">
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
}
