const KEI_BASE = 'https://amer.kei.pl/newAmer';
const KEI_ORIGIN = 'https://amer.kei.pl';

export type KeiPropertyKind = 'apartment' | 'house';

export type KeiListingRow = {
  id: string;
  data: string;
  www: string;
  adres: string;
  cena: string;
  pow: string;
  rodzaj: string;
  typ: string;
  zrodlo: string;
  tekst?: string;
};

export function keiRodzajForPropertyKind(kind: KeiPropertyKind): string {
  return kind === 'house' ? '2' : '1';
}

export function keiPropertyKindLabel(kind: KeiPropertyKind): string {
  return kind === 'house' ? 'dom' : 'mieszkanie';
}

type KeiListingsResponse = {
  total: number;
  ogl: KeiListingRow[] | '' | null;
};

let cachedCookieHeader: string | null = null;
let lastLoginAt = 0;
const LOGIN_TTL_MS = 20 * 60 * 1000;

function getKeiCredentials() {
  const login = process.env.KEI_AMER_LOGIN?.trim() || '';
  const password = process.env.KEI_AMER_PASSWORD?.trim() || '';
  return { login, password };
}

function mergeSetCookie(existing: string | null, setCookieHeaders: string[]): string {
  const jar = new Map<string, string>();
  const ingest = (header: string) => {
    const part = String(header || '').split(';')[0]?.trim();
    if (!part || !part.includes('=')) return;
    const eq = part.indexOf('=');
    jar.set(part.slice(0, eq), part.slice(eq + 1));
  };
  if (existing) {
    for (const chunk of existing.split(';')) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
  }
  for (const header of setCookieHeaders) ingest(header);
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function collectSetCookies(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

export function parseKeiJsonPayload(raw: string): unknown {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    if (text.startsWith('(') && text.endsWith(')')) {
      return JSON.parse(text.slice(1, -1));
    }
    const jsonp = text.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/);
    if (jsonp?.[1]) return JSON.parse(jsonp[1]);
    return JSON.parse(text);
  } catch {
    const successMatch = text.match(/success\s*:\s*(true|false)/i);
    const msgMatch = text.match(/msg\s*:\s*'([^']*)'/i);
    if (successMatch) {
      return {
        success: successMatch[1].toLowerCase() === 'true',
        msg: msgMatch?.[1] || '',
      };
    }
    throw new Error('KEI_JSON_PARSE_FAILED');
  }
}

export function isSupportedKeiPortalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    return (
      host === 'otodom.pl' ||
      host.endsWith('.otodom.pl') ||
      host === 'olx.pl' ||
      host.endsWith('.olx.pl') ||
      host === 'nieruchomosci-online.pl' ||
      host.endsWith('.nieruchomosci-online.pl')
    );
  } catch {
    return false;
  }
}

export function isWarsawListing(row: KeiListingRow): boolean {
  const hay = `${row.adres || ''} ${row.tekst || ''}`.toLowerCase();
  return hay.includes('warszawa') || hay.includes('wawa');
}

export async function ensureKeiAmerSession(force = false): Promise<{ ok: boolean; message: string }> {
  const { login, password } = getKeiCredentials();
  if (!login || !password) {
    return { ok: false, message: 'Brak KEI_AMER_LOGIN / KEI_AMER_PASSWORD w ENV serwera.' };
  }

  const freshEnough = cachedCookieHeader && Date.now() - lastLoginAt < LOGIN_TTL_MS;
  if (!force && freshEnough) {
    return { ok: true, message: 'Sesja KEI AMER aktywna.' };
  }

  const body = new URLSearchParams({
    login,
    haslo: password,
    token: '123qaz',
    cookie: 'on',
    browser: 'chrome',
  });

  const res = await fetch(`${KEI_BASE}/Cgi/loguj.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '*/*',
    },
    body,
    redirect: 'manual',
  });

  const text = await res.text();
  let parsed: { success?: boolean; msg?: string } | null = null;
  try {
    parsed = parseKeiJsonPayload(text) as { success?: boolean; msg?: string };
  } catch {
    parsed = null;
  }

  if (!parsed?.success) {
    cachedCookieHeader = null;
    lastLoginAt = 0;
    return {
      ok: false,
      message: parsed?.msg || `Logowanie KEI nie powiodło się (${res.status}).`,
    };
  }

  cachedCookieHeader = mergeSetCookie(null, collectSetCookies(res));
  lastLoginAt = Date.now();
  return { ok: true, message: 'Zalogowano do KEI AMER.' };
}

export function getKeiCookieHeader(): string | null {
  return cachedCookieHeader;
}

export async function keiAmerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await ensureKeiAmerSession();
  if (!cachedCookieHeader) {
    throw new Error('KEI_SESSION_MISSING');
  }

  const normalized = path.startsWith('http')
    ? path
    : `${KEI_BASE}/${path.replace(/^\/+/, '')}`;

  const headers = new Headers(init.headers || {});
  headers.set('Cookie', cachedCookieHeader);
  if (!headers.has('User-Agent')) {
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    );
  }

  const res = await fetch(normalized, { ...init, headers, redirect: 'manual' });
  cachedCookieHeader = mergeSetCookie(cachedCookieHeader, collectSetCookies(res));
  return res;
}

function normalizeListingRows(payload: KeiListingsResponse): KeiListingRow[] {
  if (!payload?.ogl) return [];
  if (Array.isArray(payload.ogl)) return payload.ogl;
  return [];
}

export async function fetchKeiListingsPage(params: {
  start?: number;
  limit?: number;
  sort?: string;
  dir?: 'ASC' | 'DESC';
  propertyKind?: KeiPropertyKind;
}): Promise<{ total: number; rows: KeiListingRow[] }> {
  const qs = new URLSearchParams({
    rodzaj: keiRodzajForPropertyKind(params.propertyKind ?? 'apartment'),
    typ: '1',
    okres: '1',
    wystapienia: '1',
    miasto: '1',
    start: String(params.start ?? 0),
    limit: String(params.limit ?? 50),
    sort: params.sort ?? 'data',
    dir: params.dir ?? 'DESC',
    page: String(Math.floor((params.start ?? 0) / (params.limit ?? 50)) + 1),
  });

  const res = await keiAmerFetch(`Cgi/getOgl.php?${qs.toString()}`, { method: 'GET' });
  const text = await res.text();
  const payload = parseKeiJsonPayload(text) as KeiListingsResponse;
  return {
    total: Number(payload?.total ?? 0),
    rows: normalizeListingRows(payload),
  };
}

export async function findWarsawPortalListings(options?: {
  propertyKind?: KeiPropertyKind;
  maxResults?: number;
  maxPages?: number;
}): Promise<KeiListingRow[]> {
  const propertyKind = options?.propertyKind ?? 'apartment';
  const maxResults = Math.max(1, options?.maxResults ?? 1);
  const maxPages = options?.maxPages ?? 8;
  const limit = 50;
  const results: KeiListingRow[] = [];

  for (let page = 0; page < maxPages && results.length < maxResults; page += 1) {
    const { rows } = await fetchKeiListingsPage({
      start: page * limit,
      limit,
      sort: 'data',
      dir: 'DESC',
      propertyKind,
    });
    for (const row of rows) {
      if (!isWarsawListing(row)) continue;
      if (!isSupportedKeiPortalUrl(row.www || '')) continue;
      results.push(row);
      if (results.length >= maxResults) break;
    }
    if (rows.length < limit) break;
  }

  return results;
}

export async function findWarsawPortalListingsPaged(options?: {
  propertyKind?: KeiPropertyKind;
  page?: number;
  pageSize?: number;
}): Promise<{
  rows: KeiListingRow[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}> {
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const pageSize = Math.max(1, Math.min(Math.floor(options?.pageSize ?? 12), 30));
  const skip = (page - 1) * pageSize;
  const need = skip + pageSize + 1;

  const collected = await findWarsawPortalListings({
    propertyKind: options?.propertyKind,
    maxResults: need,
    maxPages: Math.min(Math.ceil(need / 6) + 4, 24),
  });

  return {
    rows: collected.slice(skip, skip + pageSize),
    page,
    pageSize,
    hasNextPage: collected.length > skip + pageSize,
  };
}

export async function findLatestWarsawPortalListing(
  propertyKind: KeiPropertyKind = 'apartment',
  maxPages = 8,
): Promise<KeiListingRow | null> {
  const rows = await findWarsawPortalListings({ propertyKind, maxResults: 1, maxPages });
  return rows[0] ?? null;
}

export function rewriteKeiProxyHtml(html: string, proxyPrefix: string): string {
  const prefix = proxyPrefix.replace(/\/$/, '');
  return html
    .replaceAll('https://amer.kei.pl/newAmer/', `${prefix}/`)
    .replaceAll('https://amer.kei.pl/', `${KEI_ORIGIN}/`)
    .replaceAll('"/newAmer/', `"${prefix}/`)
    .replaceAll("'/newAmer/", `'${prefix}/`)
    .replaceAll('="/', `="${prefix}/`)
    .replaceAll("='/", `='${prefix}/`)
    .replaceAll('url(/newAmer/', `url(${prefix}/`)
    .replaceAll('url("/newAmer/', `url("${prefix}/`)
    .replaceAll("url('/newAmer/", `url('${prefix}/`);
}

export function rewriteKeiProxyLocation(location: string, proxyPrefix: string): string {
  const prefix = proxyPrefix.replace(/\/$/, '');
  if (location.startsWith(`${KEI_BASE}/`)) {
    return `${prefix}/${location.slice(`${KEI_BASE}/`.length)}`;
  }
  if (location.startsWith('/newAmer/')) {
    return `${prefix}/${location.slice('/newAmer/'.length)}`;
  }
  if (location.startsWith('/')) {
    return `${prefix}${location}`;
  }
  return location;
}
