'use client';

type Props = {
  className?: string;
  compact?: boolean;
};

/** Elegancki badge HDR na miniaturze — bez fałszywego „HDR” z filtrów CSS. */
export function OfferHdrBadge({ className = '', compact }: Props) {
  return (
    <span
      className={`pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center rounded-md border border-amber-200/30 bg-black/70 px-1.5 py-0.5 font-bold uppercase tracking-[0.14em] text-amber-100 backdrop-blur-sm ${compact ? 'text-[8px]' : 'text-[9px]'} ${className}`.trim()}
      title="Zdjęcie HDR — zachowany oryginalny zakres tonalny"
    >
      HDR
    </span>
  );
}
