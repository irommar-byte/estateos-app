'use client';

import { Check, ImageIcon } from 'lucide-react';

export type PortalImportFloorPlanSelection = {
  enabled: boolean;
  imageIndex: number;
};

type PortalImportImagePickerProps = {
  imageUrls: string[];
  selectedIndices: Set<number>;
  suggestedFloorPlanIndex: number | null;
  floorPlan: PortalImportFloorPlanSelection;
  onToggleImage: (index: number) => void;
  onSelectFloorPlan: (index: number) => void;
  onToggleFloorPlan: (enabled: boolean) => void;
};

export default function PortalImportImagePicker({
  imageUrls,
  selectedIndices,
  suggestedFloorPlanIndex,
  floorPlan,
  onToggleImage,
  onSelectFloorPlan,
  onToggleFloorPlan,
}: PortalImportImagePickerProps) {
  const selectedCount = selectedIndices.size;

  return (
    <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-subtle)]">
        Zdjęcia do importu
      </p>
      <p className="mt-1 text-xs text-[var(--eos-muted)]">
        {imageUrls.length
          ? `Zaznacz zdjęcia, które chcesz zaimportować (${selectedCount}/${imageUrls.length}). Żółta ramka = sugerowany rzut.`
          : 'Brak zdjęć w podglądzie portalu.'}
      </p>

      {imageUrls.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
          {imageUrls.map((url, imageIndex) => {
            const selected = selectedIndices.has(imageIndex);
            const isFloorPlan = floorPlan.enabled && floorPlan.imageIndex === imageIndex;
            const suggested = suggestedFloorPlanIndex === imageIndex;

            return (
              <div
                key={`${url}-${imageIndex}`}
                className={`relative shrink-0 snap-start w-[88px] rounded-xl border-2 transition-all ${
                  isFloorPlan
                    ? 'border-amber-400 ring-2 ring-amber-400/30'
                    : selected
                      ? 'border-emerald-500/60'
                      : 'border-[var(--eos-border)] opacity-55'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleImage(imageIndex)}
                  className="block h-[88px] w-full overflow-hidden rounded-[10px]"
                  aria-pressed={selected}
                  aria-label={`Zdjęcie ${imageIndex + 1}${selected ? ', zaznaczone' : ', pominięte'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>

                <button
                  type="button"
                  onClick={() => onToggleImage(imageIndex)}
                  className={`absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-md border ${
                    selected
                      ? 'border-emerald-500 bg-emerald-500 text-black'
                      : 'border-white/70 bg-black/45 text-transparent'
                  }`}
                  aria-label={selected ? 'Odznacz zdjęcie' : 'Zaznacz zdjęcie'}
                >
                  <Check size={12} strokeWidth={3} />
                </button>

                {selected ? (
                  <button
                    type="button"
                    onClick={() => onSelectFloorPlan(imageIndex)}
                    className={`absolute bottom-1 left-1 right-1 rounded-md px-1 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                      isFloorPlan ? 'bg-amber-400 text-black' : 'bg-black/55 text-white/85'
                    }`}
                  >
                    {isFloorPlan ? 'Plan' : 'Ustaw plan'}
                  </button>
                ) : null}

                <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/55 px-1 text-[9px] font-black text-white">
                  {imageIndex + 1}
                </span>
                {suggested ? (
                  <span className="pointer-events-none absolute right-1.5 top-7 rounded bg-amber-500 px-1 text-[8px] font-black text-black">
                    ?
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 flex h-[88px] items-center justify-center rounded-xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-bg-elevated)]">
          <ImageIcon size={20} className="text-[var(--eos-subtle)]" />
        </div>
      )}

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--eos-text)]">Zapisz wybrane zdjęcie jako rzut (plan)</p>
          <p className="text-[11px] text-[var(--eos-muted)]">
            {floorPlan.enabled
              ? `Zdjęcie #${floorPlan.imageIndex + 1} trafi do sekcji planu lokalu`
              : 'Tylko galeria — bez planu'}
          </p>
        </div>
        <input
          type="checkbox"
          checked={floorPlan.enabled}
          onChange={(e) => onToggleFloorPlan(e.target.checked)}
          className="size-5 accent-emerald-500"
        />
      </label>
    </div>
  );
}
