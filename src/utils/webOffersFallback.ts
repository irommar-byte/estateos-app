import { API_URL } from '../config/network';

/** Publiczna lista ofert — działa na produkcji nawet gdy `/api/mobile/v1/offers` zwraca 500. */
export async function fetchWebOffersArray(): Promise<any[]> {
  try {
    const res = await fetch(`${API_URL}/api/offers`);
    if (!res.ok) return [];
    const j = await res.json().catch(() => null);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export async function findWebOfferById(id: number): Promise<any | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  const list = await fetchWebOffersArray();
  return list.find((o) => Number(o?.id || 0) === id) || null;
}
