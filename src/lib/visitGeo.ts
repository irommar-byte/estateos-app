const COUNTRY_NAMES: Record<string, string> = {
  PL: 'Polska',
  US: 'Stany Zjednoczone',
  GB: 'Wielka Brytania',
  DE: 'Niemcy',
  FR: 'Francja',
  NL: 'Holandia',
  ES: 'Hiszpania',
  IT: 'Włochy',
  UA: 'Ukraina',
  CZ: 'Czechy',
  SK: 'Słowacja',
  SE: 'Szwecja',
  NO: 'Norwegia',
  CH: 'Szwajcaria',
  AT: 'Austria',
  BE: 'Belgia',
  IE: 'Irlandia',
  CA: 'Kanada',
  AU: 'Australia',
  IL: 'Izrael',
  TR: 'Turcja',
  RO: 'Rumunia',
  LT: 'Litwa',
  LV: 'Łotwa',
  EE: 'Estonia',
  UN: 'Nieznany',
  LO: 'Lokalnie / VPN',
};

export type VisitGeoSource = 'cloudflare' | 'vercel' | 'ipapi' | 'unknown';

export type VisitGeo = {
  countryCode: string;
  countryName: string;
  city: string | null;
  regionName: string | null;
  isp: string | null;
  geoSource: VisitGeoSource;
  isRelay: boolean;
};

export function countryDisplayName(code: string): string {
  const cc = String(code || '').trim().toUpperCase().slice(0, 8);
  return COUNTRY_NAMES[cc] || cc || 'Nieznany';
}

export function flagEmojiFromCountryCode(countryCode: string): string {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!code || code === 'UNKNOWN' || code === 'UN' || code === 'LO' || code.length !== 2) {
    return '🌍';
  }
  return code.replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

function isPrivateOrLocalIp(ip: string): boolean {
  const value = String(ip || '').trim();
  if (!value || value === '0.0.0.0') return true;
  if (value === '::1' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) {
    return true;
  }
  if (!value.includes('.')) return false;
  const parts = value.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function readEdgeCountry(req: Request): { code: string; source: VisitGeoSource } | null {
  const cf = req.headers.get('cf-ipcountry')?.trim().toUpperCase();
  if (cf && cf !== 'XX' && cf !== 'T1') {
    return { code: cf.slice(0, 8), source: 'cloudflare' };
  }
  const vercel = req.headers.get('x-vercel-ip-country')?.trim().toUpperCase();
  if (vercel && vercel !== 'XX') {
    return { code: vercel.slice(0, 8), source: 'vercel' };
  }
  const cityCountry = req.headers.get('x-vercel-ip-country-region')?.trim();
  if (cityCountry && cityCountry.includes(',')) {
    const maybe = cityCountry.split(',').pop()?.trim().toUpperCase();
    if (maybe && maybe.length === 2) {
      return { code: maybe, source: 'vercel' };
    }
  }
  return null;
}

async function lookupIpApi(ip: string): Promise<VisitGeo | null> {
  if (isPrivateOrLocalIp(ip)) {
    return {
      countryCode: 'LO',
      countryName: countryDisplayName('LO'),
      city: null,
      regionName: null,
      isp: null,
      geoSource: 'unknown',
      isRelay: true,
    };
  }

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,isp,proxy,hosting`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2800), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      countryCode?: string;
      regionName?: string;
      city?: string;
      isp?: string;
      proxy?: boolean;
      hosting?: boolean;
    };
    if (data.status !== 'success' || !data.countryCode) return null;
    const countryCode = String(data.countryCode).toUpperCase().slice(0, 8);
    return {
      countryCode,
      countryName: String(data.country || countryDisplayName(countryCode)),
      city: data.city ? String(data.city).slice(0, 64) : null,
      regionName: data.regionName ? String(data.regionName).slice(0, 64) : null,
      isp: data.isp ? String(data.isp).slice(0, 128) : null,
      geoSource: 'ipapi',
      isRelay: Boolean(data.proxy || data.hosting),
    };
  } catch {
    return null;
  }
}

/** Kraj z nagłówków CDN lub lookup IP (bez domyślnego „wszyscy z Polski”). */
export async function resolveVisitGeo(req: Request, ip: string): Promise<VisitGeo> {
  const edge = readEdgeCountry(req);
  if (edge) {
    return {
      countryCode: edge.code,
      countryName: countryDisplayName(edge.code),
      city: req.headers.get('cf-ipcity')?.trim().slice(0, 64) || null,
      regionName: req.headers.get('cf-region')?.trim().slice(0, 64) || null,
      isp: null,
      geoSource: edge.source,
      isRelay: false,
    };
  }

  const lookedUp = await lookupIpApi(ip);
  if (lookedUp) return lookedUp;

  return {
    countryCode: 'UN',
    countryName: countryDisplayName('UN'),
    city: null,
    regionName: null,
    isp: null,
    geoSource: 'unknown',
    isRelay: isPrivateOrLocalIp(ip),
  };
}

export function parseDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown' {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return 'unknown';
  if (/bot|crawl|spider|slurp|facebookexternalhit|preview/i.test(ua)) return 'bot';
  if (/ipad|tablet|kindle|playbook/i.test(ua)) return 'tablet';
  if (/mobile|iphone|android.*mobile|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function geoSourceLabel(source: VisitGeoSource | string): string {
  switch (String(source || '').toLowerCase()) {
    case 'cloudflare':
      return 'CDN Cloudflare';
    case 'vercel':
      return 'Vercel Edge';
    case 'ipapi':
      return 'Lookup IP';
    default:
      return 'Niepewne';
  }
}
