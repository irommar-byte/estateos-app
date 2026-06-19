'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchFavoritesSnapshot,
  toggleFavoriteOnServer,
} from '@/lib/favoritesClient';

type FavoritesContextValue = {
  favoriteIds: number[];
  favoriteOffers: Record<string, unknown>[];
  loading: boolean;
  hydrated: boolean;
  isFavorite: (offerId: unknown) => boolean;
  toggleFavorite: (offerId: unknown) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteOffers, setFavoriteOffers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await fetchFavoritesSnapshot();
      if (snapshot) {
        setFavoriteIds(snapshot.offerIds);
        setFavoriteOffers(snapshot.offers);
      } else {
        setFavoriteIds([]);
        setFavoriteOffers([]);
      }
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isFavorite = useCallback(
    (offerId: unknown) => {
      const id = Number(offerId);
      return Number.isFinite(id) && id > 0 && favoriteIds.includes(id);
    },
    [favoriteIds],
  );

  const toggleFavorite = useCallback(
    async (offerId: unknown) => {
      const id = Number(offerId);
      if (!Number.isFinite(id) || id <= 0) return false;

      const wasFavorite = favoriteIds.includes(id);
      setFavoriteIds((prev) =>
        wasFavorite ? prev.filter((x) => x !== id) : [...prev, id],
      );
      if (wasFavorite) {
        setFavoriteOffers((prev) => prev.filter((o) => Number(o.id) !== id));
      }

      const ok = await toggleFavoriteOnServer(id, wasFavorite);
      if (!ok) {
        await refresh();
        return false;
      }
      await refresh();
      return true;
    },
    [favoriteIds, refresh],
  );

  const value = useMemo(
    () => ({
      favoriteIds,
      favoriteOffers,
      loading,
      hydrated,
      isFavorite,
      toggleFavorite,
      refresh,
    }),
    [favoriteIds, favoriteOffers, loading, hydrated, isFavorite, toggleFavorite, refresh],
  );

  return (
    <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return ctx;
}
