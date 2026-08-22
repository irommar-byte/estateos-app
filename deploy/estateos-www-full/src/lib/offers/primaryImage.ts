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

function collectFromImagesField(rawImages: unknown): string[] {
  if (Array.isArray(rawImages)) {
    return rawImages.map(normalizeUrl).filter(Boolean);
  }

  if (typeof rawImages === "string") {
    const trimmed = rawImages.trim();
    if (!trimmed) return [];
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return [trimmed];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(normalizeUrl).filter(Boolean);
      const one = normalizeUrl(parsed);
      return one ? [one] : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function resolveOfferImageUrls(offer: OfferLike | null | undefined): string[] {
  if (!offer) return [];
  const urls: string[] = [];
  const push = (value: string) => {
    if (value && !urls.includes(value)) urls.push(value);
  };
  push(normalizeUrl(offer.imageUrl));
  for (const url of collectFromImagesField(offer.images)) push(url);
  return urls;
}

export function resolveOfferPrimaryImage(offer: OfferLike | null | undefined): string {
  if (!offer) return "";
  const direct = normalizeUrl(offer.imageUrl);
  if (direct) return direct;
  return firstFromArray(collectFromImagesField(offer.images));
}
