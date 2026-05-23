type OfferLike = {
  imageUrl?: unknown;
  images?: unknown;
};

function normalizeUrl(value: unknown): string {
  return String(value || "").trim();
}

export function resolveOfferPrimaryImage(offer: OfferLike | null | undefined): string {
  if (!offer) return "";

  const direct = normalizeUrl(offer.imageUrl);
  if (direct) return direct;

  const rawImages = offer.images;
  if (Array.isArray(rawImages)) {
    const first = normalizeUrl(rawImages[0]);
    return first;
  }

  if (typeof rawImages === "string") {
    const trimmed = rawImages.trim();
    if (!trimmed) return "";
    if (!trimmed.startsWith("[")) return trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeUrl(parsed[0]);
      }
    } catch {
      return "";
    }
  }

  return "";
}
