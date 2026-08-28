import { createHash } from 'crypto';

type CatalogCacheEntry = {
  etag: string;
  body: string;
  at: number;
};

const TTL_MS = 90_000;
const globalAny = global as typeof globalThis & {
  __mobileCatalogCache?: CatalogCacheEntry;
};

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

export function readMobileCatalogCache(etag?: string | null): { etag: string; body: string } | null {
  const hit = globalAny.__mobileCatalogCache;
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    globalAny.__mobileCatalogCache = undefined;
    return null;
  }
  if (etag && etag === hit.etag) return hit;
  if (!etag) return hit;
  return null;
}

export function writeMobileCatalogCache(etag: string, body: string) {
  globalAny.__mobileCatalogCache = { etag, body, at: Date.now() };
}

export function catalogNotModifiedResponse(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: {
      ETag: etag,
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
      ETag: etag,
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=180',
      Vary: 'Accept-Encoding',
    },
  });
}
