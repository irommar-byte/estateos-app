/**
 * Upgrade third-party listing CDN URLs to the highest available resolution
 * before download / re-host (Otomoto, OLX, Otodom, etc.).
 */

const APOLLO_SIZE_RE = /;s=\d+x\d+/i;
/** Prefer a large apollo/olxcdn frame — Otomoto serves up to ~2000px on `;s=`. */
const APOLLO_TARGET = ";s=2000x1500";

function upgradeApolloOlxCdn(url: string): string {
  if (!/apollo\.olxcdn\.com|olxcdn\.com/i.test(url)) return url;
  if (APOLLO_SIZE_RE.test(url)) {
    return url.replace(APOLLO_SIZE_RE, APOLLO_TARGET);
  }
  // Bare `/image` — append size hint if missing
  if (/\/image\/?$/i.test(url) || /\/image;/i.test(url)) {
    if (!/;s=/i.test(url)) return `${url.replace(/\/?$/, "")}${APOLLO_TARGET}`;
  }
  return url;
}

function upgradeOtodomCdn(url: string): string {
  if (!/otodom|img\.otodom|cdn\.otodom/i.test(url)) return url;
  // Common Otodom patterns: replace smaller size tokens with largest
  return url
    .replace(/\/s=[^/]+/gi, "/s=1280x1024")
    .replace(/([_-])(?:small|thumb|medium)([._])/gi, "$1large$2")
    .replace(/\b(?:w|width)=\d+/gi, "w=1600")
    .replace(/\b(?:h|height)=\d+/gi, "h=1200");
}

function upgradeGenericQuerySize(url: string): string {
  try {
    const u = new URL(url);
    const keys = ["w", "width", "h", "height", "q", "quality", "size"];
    let touched = false;
    for (const key of keys) {
      if (!u.searchParams.has(key)) continue;
      touched = true;
      if (key === "q" || key === "quality") u.searchParams.set(key, "90");
      else if (key === "w" || key === "width") u.searchParams.set(key, "2000");
      else if (key === "h" || key === "height") u.searchParams.set(key, "1500");
      else if (key === "size") u.searchParams.set(key, "2000");
    }
    return touched ? u.toString() : url;
  } catch {
    return url;
  }
}

/** Return the best-effort high-res variant of a remote listing image URL. */
export function upgradeListingImageUrl(raw: string): string {
  const url = String(raw || "").trim();
  if (!url.startsWith("http")) return url;
  let next = upgradeApolloOlxCdn(url);
  next = upgradeOtodomCdn(next);
  next = upgradeGenericQuerySize(next);
  return next;
}

export function upgradeListingImageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const upgraded = upgradeListingImageUrl(raw);
    if (!upgraded || seen.has(upgraded)) continue;
    seen.add(upgraded);
    out.push(upgraded);
  }
  return out;
}
