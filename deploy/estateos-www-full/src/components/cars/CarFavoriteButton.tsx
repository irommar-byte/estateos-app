"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { getCarsDictionary } from "@/i18n/carsDictionary";
import {
  isCarFavoriteId,
  loadCarFavoriteIds,
  toggleCarFavoriteId,
} from "@/lib/carFavoritesStorage";

type CarFavoriteButtonProps = {
  carId: number;
  className?: string;
  onChange?: (ids: number[]) => void;
};

export default function CarFavoriteButton({ carId, className = "", onChange }: CarFavoriteButtonProps) {
  const { locale } = useLocale();
  const d = getCarsDictionary(locale);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  useEffect(() => {
    setFavoriteIds(loadCarFavoriteIds());
  }, []);

  const active = isCarFavoriteId(carId, favoriteIds);

  return (
    <button
      type="button"
      aria-label={active ? d.favoriteAriaRemove : d.favoriteAriaAdd}
      className={`inline-flex items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)]/95 p-2 text-sky-300 transition hover:border-sky-400/50 hover:text-sky-200 ${className}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const { ids } = toggleCarFavoriteId(carId, favoriteIds);
        setFavoriteIds(ids);
        onChange?.(ids);
      }}
    >
      <Heart size={16} className={active ? "fill-current text-red-400" : ""} />
    </button>
  );
}
