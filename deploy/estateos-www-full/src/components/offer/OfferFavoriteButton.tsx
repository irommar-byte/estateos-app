'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';

type Props = {
  offerId: number | string;
  className?: string;
  size?: number;
  variant?: 'icon' | 'pill';
  labelAdd?: string;
  labelRemove?: string;
  ariaLabelAdd?: string;
  ariaLabelRemove?: string;
  /** Gdy false — tylko wizualizacja (np. gość bez logowania). */
  interactive?: boolean;
  onRequireAuth?: () => void;
};

export default function OfferFavoriteButton({
  offerId,
  className = '',
  size = 20,
  variant = 'icon',
  labelAdd = 'Ulubione',
  labelRemove = 'W ulubionych',
  ariaLabelAdd,
  ariaLabelRemove,
  interactive = true,
  onRequireAuth,
}: Props) {
  const { isFavorite, toggleFavorite, hydrated } = useFavorites();
  const [busy, setBusy] = useState(false);
  const id = Number(offerId);
  const active = hydrated && isFavorite(id);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!interactive) {
      onRequireAuth?.();
      return;
    }
    if (!Number.isFinite(id) || id <= 0 || busy) return;
    setBusy(true);
    try {
      const ok = await toggleFavorite(id);
      if (!ok) onRequireAuth?.();
    } finally {
      setBusy(false);
    }
  };

  const label = active ? labelRemove : labelAdd;

  return (
    <button
      type="button"
      aria-label={active ? (ariaLabelRemove ?? labelRemove) : (ariaLabelAdd ?? labelAdd)}
      aria-pressed={active}
      disabled={busy}
      onClick={handleClick}
      className={`group/heart inline-flex items-center gap-2 rounded-full border backdrop-blur-md transition-all duration-300 hover:scale-[1.03] disabled:opacity-60 ${
        variant === 'pill'
          ? `px-4 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] ${
              active
                ? 'border-emerald-400/60 bg-emerald-500/20'
                : 'border-white/20 bg-black/55 hover:border-emerald-400/40 hover:bg-black/70'
            }`
          : 'border-white/10 bg-black/40 p-2.5 hover:scale-110'
      } ${className}`}
    >
      <Heart
        size={size}
        className={`shrink-0 transition-all duration-500 ${
          active
            ? 'scale-110 fill-emerald-500 text-emerald-500 drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]'
            : 'text-white/70 group-hover/heart:text-emerald-400'
        }`}
      />
      {variant === 'pill' ? (
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
          {label}
        </span>
      ) : null}
    </button>
  );
}
