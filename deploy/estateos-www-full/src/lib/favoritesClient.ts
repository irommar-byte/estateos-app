export type FavoritesSnapshot = {
  offerIds: number[];
  offers: Record<string, unknown>[];
};

export async function fetchFavoritesSnapshot(): Promise<FavoritesSnapshot | null> {
  try {
    const res = await fetch('/api/favorites', { cache: 'no-store', credentials: 'include' });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const data = await res.json();
    const offerIds = Array.isArray(data?.offerIds)
      ? data.offerIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
      : [];
    const offers = Array.isArray(data?.offers) ? data.offers : [];
    return { offerIds, offers };
  } catch {
    return null;
  }
}

export async function toggleFavoriteOnServer(
  offerId: number,
  isFavorite: boolean,
): Promise<boolean> {
  const method = isFavorite ? 'DELETE' : 'POST';
  try {
    const res = await fetch(`/api/offers/${offerId}/favorite`, {
      method,
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}
