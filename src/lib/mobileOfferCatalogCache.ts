import { createHash } from 'crypto';

type CatalogCacheEntry = {
  etag: string;
  body: string;
  at: number;
};

const SOFT_TTL_MS = 90_000;
const HARD_TTL_MS = 15 * 60_000;
const globalAny = global as typeof globalThis & {
  __mobileCatalogCache?: CatalogCacheEntry;
};

export function normalizeEtag(etag: string | null | undefined): string | null {
  if (!etag) return null;
  const trimmed = etag.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('W/')) return trimmed.slice(2);
  return trimmed;
}

export function etagMatches(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeEtag(left);
  const b = normalizeEtag(right);
  return Boolean(a && b && a === b);
}

export function buildCatalogEtag(offers: unknown[]): string {
  const digest = createHash('sha1');
  for (const offer of offers) {
    if (!offer || typeof offer !== 'object') continue;
    const row = offer as Record<string, unknown>;
    digest.update(String(row.id ?? ''));
    digest.update('|');
    digest.update(String(row.updatedAt ?? row.createdAt ?? ''));
    digest.update('|');
    digest.update(String(row.status ?? ''));
    digest.update(';');
  }
  return `"${digest.digest('hex')}"`;
}

export function readMobileCatalogCache(): { etag: string; body: string; at: number } | null {
  const hit = globalAny.__mobileCatalogCache;
  if (!hit) return null;
  if (Date.now() - hit.at > HARD_TTL_MS) {
    globalAny.__mobileCatalogCache = undefined;
    return null;
  }
  return hit;
}

export function isCatalogCacheFresh(hit: { at: number }, softTtlMs = SOFT_TTL_MS): boolean {
  return Date.now() - hit.at <= softTtlMs;
}

export function writeMobileCatalogCache(etag: string, body: string) {
  globalAny.__mobileCatalogCache = { etag, body, at: Date.now() };
}

export function catalogNotModifiedResponse(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: {
      'X-Catalog-ETag': etag,
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=180',
      Vary: 'Accept-Encoding',
    },
  });
}

export function catalogJsonResponse(body: string, etag: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Catalog-ETag': etag,
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=180',
      Vary: 'Accept-Encoding',
    },
  });
}
