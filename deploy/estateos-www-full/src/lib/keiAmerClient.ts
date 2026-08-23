const KEI_BASE = 'https://amer.kei.pl/newAmer';
const KEI_ORIGIN = 'https://amer.kei.pl';

export type KeiPropertyKind = 'apartment' | 'house';
export type KeiTransactionKind = 'sale' | 'rent';

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
  telefon?: string;
  dzielnica?: string;
  dzielnica_?: string;
  ulica?: string;
  cena_m?: string;
  typ_?: string;
  bez_posrednikow?: string | number | boolean;
};

/** KEI query `rodzaj`: 1 = sprzedaż, 2 = wynajem */
export function keiRodzajForTransactionKind(kind: KeiTransactionKind): string {
  return kind === 'rent' ? '2' : '1';
}

/** KEI query `typ`: 1 = mieszkanie, 2 = dom */
export function keiTypForPropertyKind(kind: KeiPropertyKind): string {
  return kind === 'house' ? '2' : '1';
}

/** KEI `rodzaj` w wierszu: 1 = sprzedaż, 2 = wynajem (czasem tekst). */
export function keiTransactionKindFromRow(row: Pick<KeiListingRow, 'rodzaj'>): KeiTransactionKind {
  const hay = String(row.rodzaj || '').trim().toLowerCase();
  if (!hay) return 'sale';
  if (hay === '2' || hay.includes('wynaj') || hay.includes('najem')) return 'rent';
  if (hay === '1' || hay.includes('sprzed')) return 'sale';
  return 'sale';
}

/** KEI `typ` w wierszu: 1 = mieszkanie, 2 = dom (czasem tekst). */
export function keiPropertyKindFromRow(row: Pick<KeiListingRow, 'typ'>): KeiPropertyKind {
  const hay = String(row.typ || '').trim().toLowerCase();
  if (hay === '2' || hay.includes('dom')) return 'house';
  if (hay === '1' || hay.includes('miesz')) return 'apartment';
  return 'apartment';
}

export function rowMatchesKeiFilters(
  row: Pick<KeiListingRow, 'rodzaj' | 'typ'>,
  propertyKind: KeiPropertyKind,
  transactionKind: KeiTransactionKind,
): boolean {
  return (
    keiPropertyKindFromRow(row) === propertyKind &&
    keiTransactionKindFromRow(row) === transactionKind
  );
}

export function keiPropertyKindLabel(kind: KeiPropertyKind): string {
  return kind === 'house' ? 'dom' : 'mieszkanie';
}

export function keiTransactionKindLabel(kind: KeiTransactionKind): string {
  return kind === 'rent' ? 'wynajem' : 'sprzedaż';
}

export function resolveKeiTransactionKind(raw?: unknown): KeiTransactionKind {
  return raw === 'rent' ? 'rent' : 'sale';
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

/** Parse KEI price/area strings like "1 250 000 zł" / "62,5 m2". */
export function parseKeiNumeric(raw: unknown): number | null {
  const text = String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/zł|pln|m²|m2|metr.*/gi, '')
    .trim();
  if (!text) return null;
  const normalized = text.includes(',') && !text.includes('.')
    ? text.replace(/\s+/g, '').replace(',', '.')
    : text.replace(/\s+/g, '').replace(/,(?=\d{3}\b)/g, '');
  const n = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseKeiListingDate(raw: unknown): Date | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const pl = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (pl) {
    const d = new Date(Number(pl[3]), Number(pl[2]) - 1, Number(pl[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type KeiListingSearchFilters = {
  propertyKind?: KeiPropertyKind;
  transactionKind?: KeiTransactionKind;
  /** Fragment dzielnicy / ulicy w adresie (np. "żoliborz"). */
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  /** YYYY-MM-DD — data wystawienia od */
  dateFrom?: string;
  /** YYYY-MM-DD — data wystawienia do */
  dateTo?: string;
  /**
   * KEI `okres`: 1 = domyślne świeże, 0 = szersze archiwum (wyszukiwanie starszych).
   */
  okres?: string;
};

export function rowMatchesKeiSearchFilters(
  row: KeiListingRow,
  filters: KeiListingSearchFilters,
): boolean {
  const propertyKind = filters.propertyKind ?? 'apartment';
  const transactionKind = filters.transactionKind ?? 'sale';
  if (!rowMatchesKeiFilters(row, propertyKind, transactionKind)) return false;

  const district = String(filters.district || '').trim().toLowerCase();
  if (district) {
    const hay = `${row.adres || ''} ${row.tekst || ''}`.toLowerCase();
    if (!hay.includes(district)) return false;
  }

  const price = parseKeiNumeric(row.cena);
  if (filters.minPrice != null && Number.isFinite(filters.minPrice)) {
    if (price == null || price < filters.minPrice) return false;
  }
  if (filters.maxPrice != null && Number.isFinite(filters.maxPrice)) {
    if (price == null || price > filters.maxPrice) return false;
  }

  const area = parseKeiNumeric(row.pow);
  if (filters.minArea != null && Number.isFinite(filters.minArea)) {
    if (area == null || area < filters.minArea) return false;
  }
  if (filters.maxArea != null && Number.isFinite(filters.maxArea)) {
    if (area == null || area > filters.maxArea) return false;
  }

  const listingDate = parseKeiListingDate(row.data);
  if (filters.dateFrom) {
    const from = parseKeiListingDate(filters.dateFrom);
    if (from && (!listingDate || listingDate < from)) return false;
  }
  if (filters.dateTo) {
    const to = parseKeiListingDate(filters.dateTo);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (!listingDate || listingDate > end) return false;
    }
  }

  return true;
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
  transactionKind?: KeiTransactionKind;
  /** KEI period window — "1" fresh feed, "0" broader archive for older search. */
  okres?: string;
}): Promise<{ total: number; rows: KeiListingRow[] }> {
  const qs = new URLSearchParams({
    rodzaj: keiRodzajForTransactionKind(params.transactionKind ?? 'sale'),
    typ: keiTypForPropertyKind(params.propertyKind ?? 'apartment'),
    okres: params.okres ?? '1',
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
  transactionKind?: KeiTransactionKind;
  maxResults?: number;
  maxPages?: number;
  search?: KeiListingSearchFilters;
}): Promise<KeiListingRow[]> {
  const propertyKind = options?.propertyKind ?? options?.search?.propertyKind ?? 'apartment';
  const transactionKind = options?.transactionKind ?? options?.search?.transactionKind ?? 'sale';
  const maxResults = Math.max(1, options?.maxResults ?? 1);
  const maxPages = options?.maxPages ?? 8;
  const limit = 50;
  const results: KeiListingRow[] = [];
  const search = options?.search;
  const hasExtendedSearch = Boolean(
    search &&
      (search.district ||
        search.minPrice != null ||
        search.maxPrice != null ||
        search.minArea != null ||
        search.maxArea != null ||
        search.dateFrom ||
        search.dateTo),
  );
  const okres = search?.okres ?? (hasExtendedSearch ? '0' : '1');

  for (let page = 0; page < maxPages && results.length < maxResults; page += 1) {
    const { rows } = await fetchKeiListingsPage({
      start: page * limit,
      limit,
      sort: 'data',
      dir: 'DESC',
      propertyKind,
      transactionKind,
      okres,
    });
    for (const row of rows) {
      if (!isWarsawListing(row)) continue;
      if (!isSupportedKeiPortalUrl(row.www || '')) continue;
      if (search) {
        if (!rowMatchesKeiSearchFilters(row, { ...search, propertyKind, transactionKind })) continue;
      } else if (!rowMatchesKeiFilters(row, propertyKind, transactionKind)) {
        continue;
      }
      results.push(row);
      if (results.length >= maxResults) break;
    }
    if (rows.length < limit) break;
  }

  return results;
}

export async function findWarsawPortalListingsPaged(options?: {
  propertyKind?: KeiPropertyKind;
  transactionKind?: KeiTransactionKind;
  page?: number;
  pageSize?: number;
  search?: KeiListingSearchFilters;
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
  const hasExtendedSearch = Boolean(
    options?.search &&
      (options.search.district ||
        options.search.minPrice != null ||
        options.search.maxPrice != null ||
        options.search.minArea != null ||
        options.search.maxArea != null ||
        options.search.dateFrom ||
        options.search.dateTo),
  );

  const collected = await findWarsawPortalListings({
    propertyKind: options?.propertyKind,
    transactionKind: options?.transactionKind,
    maxResults: need,
    maxPages: hasExtendedSearch
      ? Math.min(Math.ceil(need / 4) + 10, 40)
      : Math.min(Math.ceil(need / 6) + 4, 24),
    search: options?.search,
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
  transactionKind: KeiTransactionKind = 'sale',
  maxPages = 8,
): Promise<KeiListingRow | null> {
  const rows = await findWarsawPortalListings({ propertyKind, transactionKind, maxResults: 1, maxPages });
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
