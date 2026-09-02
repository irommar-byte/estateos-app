function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export function positiveClientId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Counterpart already stored on the slot — no DB lookup. */
export function counterpartIdFromMeta(
  actorClientId: number,
  actorType: string,
  metadata: unknown,
): number | null {
  const meta = asMeta(metadata);
  const buyer = positiveClientId(meta.buyerClientId);
  const seller = positiveClientId(meta.sellerClientId);
  const type = String(actorType || '').toUpperCase();
  if (type === 'BUYER' && seller && seller !== actorClientId) return seller;
  if (type === 'SELLER' && buyer && buyer !== actorClientId) return buyer;
  if (buyer && buyer !== actorClientId) return buyer;
  if (seller && seller !== actorClientId) return seller;
  return null;
}
