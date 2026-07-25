"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";

type Props = {
  offerId: number | string;
  className?: string;
  size?: number;
  variant?: "icon" | "pill";
  labelAdd?: string;
  labelRemove?: string;
  interactive?: boolean;
  onRequireAuth?: () => void;
};

export default function OfferFavoriteButton({
  offerId,
  className = "",
  size = 20,
  variant = "icon",
  labelAdd = "Ulubione",
  labelRemove = "W ulubionych",
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
      aria-label={active ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
      aria-pressed={active}
      disabled={busy}
      onClick={handleClick}
      className={`eos-fav-btn ${variant === "pill" ? "eos-fav-btn--pill" : "eos-fav-btn--icon"} ${
        active ? "is-active" : ""
      } ${className}`}
    >
      <Heart
        size={size}
        className={`eos-fav-btn__icon shrink-0 ${active ? "is-active" : ""}`}
        aria-hidden
      />
      {variant === "pill" ? <span className="eos-fav-btn__label">{label}</span> : null}
    </button>
  );
}
