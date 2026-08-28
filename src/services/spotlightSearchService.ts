import { API_URL } from '../config/network';

export type SpotlightResultKind = 'offer' | 'agent' | 'agency';

export type SpotlightResult = {
  id: string;
  kind: SpotlightResultKind;
  title: string;
  subtitle: string;
  detail?: string | null;
  imageUrl: string | null;
  href: string;
  score: number;
};

export type SpotlightSection = {
  kind: SpotlightResultKind;
  label: string;
  items: SpotlightResult[];
};

export type SpotlightSearchResponse = {
  success: boolean;
  results: SpotlightResult[];
  sections: SpotlightSection[];
  tookMs: number;
};

export async function fetchSpotlightSearch(
  query: string,
  token?: string | null,
  signal?: AbortSignal,
): Promise<SpotlightSearchResponse> {
  const q = String(query || '').trim();
  if (!q) {
    return { success: true, results: [], sections: [], tookMs: 0 };
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/mobile/v1/spotlight/search?q=${encodeURIComponent(q)}`, {
    headers,
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as SpotlightSearchResponse & { success?: boolean };
  return {
    success: Boolean(data?.success),
    results: Array.isArray(data?.results) ? data.results : [],
    sections: Array.isArray(data?.sections) ? data.sections : [],
    tookMs: Number(data?.tookMs || 0),
  };
}

export function parseSpotlightOfferId(href: string): number | null {
  const match = String(href || '').match(/\/oferta\/(\d+)/i);
  const id = match ? Number(match[1]) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function spotlightHrefToAbsolute(href: string): string {
  const path = String(href || '').trim();
  if (!path) return API_URL.replace(/\/$/, '');
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
