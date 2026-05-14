/**
 * Odrzuca nietypowe schematy (np. javascript:) przy renderowaniu src z bazy.
 * Akceptuje ścieżki względne, http(s) oraz data:image.
 */
export function safeOfferImageUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith('/')) return s;
  if (s.startsWith('https://') || s.startsWith('http://')) return s;
  if (s.startsWith('data:image/')) return s;
  if (s.startsWith('blob:')) return s;
  return null;
}
