type OfferLike = {
  imageUrl?: unknown;
  images?: unknown;
};

function normalizeUrl(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const nested =
      rec.url ?? rec.src ?? rec.path ?? rec.uri ?? rec.href ?? rec.imageUrl;
    if (typeof nested === "string") return nested.trim();
  }
  return "";
}

function firstFromArray(rawImages: unknown[]): string {
  for (const entry of rawImages) {
    const url = normalizeUrl(entry);
    if (url) return url;
  }
  return "";
}

export function resolveOfferPrimaryImage(offer: OfferLike | null | undefined): string {
  if (!offer) return "";

  const direct = normalizeUrl(offer.imageUrl);
  if (direct) return direct;

  const rawImages = offer.images;
  if (Array.isArray(rawImages)) {
    return firstFromArray(rawImages);
  }

  if (typeof rawImages === "string") {
    const trimmed = rawImages.trim();
    if (!trimmed) return "";
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return firstFromArray(parsed);
      return normalizeUrl(parsed);
    } catch {
      return "";
    }
  }

  return "";
}
