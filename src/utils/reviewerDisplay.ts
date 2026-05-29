/** Imię i nazwisko (lub nazwa z API) osoby wystawiającej opinię. */
export function resolveReviewerLabel(
  review: {
    reviewerName?: string | null;
    reviewerId?: number | null;
    reviewer?: { id?: number; name?: string | null; email?: string | null } | null;
  } | null | undefined,
  fallback: (id: number | string) => string,
): string {
  const fromApi = String(review?.reviewerName ?? '').trim();
  if (fromApi) return fromApi;
  const fromNested = String(review?.reviewer?.name ?? '').trim();
  if (fromNested) return fromNested;
  const email = String(review?.reviewer?.email ?? '').trim();
  if (email) return email.split('@')[0];
  const id = Number(review?.reviewerId ?? review?.reviewer?.id ?? 0);
  return id > 0 ? fallback(id) : fallback('-');
}
