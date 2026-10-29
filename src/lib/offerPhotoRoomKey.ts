/** Klucz zdjęcia niezależny od domeny i parametrów: „/uploads/offers/12/abc.webp” (do łączenia zdjęć z pomieszczeniami). */
export function photoRoomKey(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw, 'https://estateos.pl');
    return decodeURIComponent(u.pathname).slice(0, 500);
  } catch {
    return raw.split('?')[0].slice(0, 500);
  }
}

export type OfferPhotoRoom = { url: string; room: string };

export function sameRoomName(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => String(v || '').trim().toLocaleLowerCase('pl');
  return Boolean(norm(a)) && norm(a) === norm(b);
}
