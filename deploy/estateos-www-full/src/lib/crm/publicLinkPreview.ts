const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isPrivateHostname(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(h)) return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^127\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  return false;
}

function attr(html: string, property: string) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  );
  return html.match(re)?.[1] || html.match(alt)?.[1] || null;
}

function decode(value: string | null) {
  if (!value) return null;
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function absoluteUrl(base: string, maybe: string | null) {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

export type PublicLinkPreview = {
  url: string;
  host: string;
  siteName: string;
  title: string;
  description: string | null;
  image: string | null;
};

const PORTAL_NAMES: Record<string, string> = {
  'otodom.pl': 'Otodom',
  'www.otodom.pl': 'Otodom',
  'olx.pl': 'OLX',
  'www.olx.pl': 'OLX',
  'nieruchomosci-online.pl': 'Nieruchomości Online',
  'www.nieruchomosci-online.pl': 'Nieruchomości Online',
  'gratka.pl': 'Gratka',
  'www.gratka.pl': 'Gratka',
  'morizon.pl': 'Morizon',
  'www.morizon.pl': 'Morizon',
  'domiporta.pl': 'Domiporta',
  'www.domiporta.pl': 'Domiporta',
};

export async function fetchPublicLinkPreview(raw: string): Promise<PublicLinkPreview> {
  const input = String(raw || '').trim();
  let parsed: URL;
  try {
    parsed = new URL(input.startsWith('http') ? input : `https://${input}`);
  } catch {
    throw new Error('Wklej pełny link (https://…).');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Dozwolone są tylko linki http/https.');
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error('Ten adres nie może być podglądany.');
  }

  const url = parsed.toString();
  const host = parsed.hostname.replace(/^www\./, '');
  const fallbackName = PORTAL_NAMES[parsed.hostname] || PORTAL_NAMES[host] || host;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'EstateOS-LinkPreview/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const html = (await res.text()).slice(0, 350_000);
    const title =
      decode(attr(html, 'og:title')) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      fallbackName;
    return {
      url,
      host,
      siteName: decode(attr(html, 'og:site_name')) || fallbackName,
      title: title.slice(0, 180),
      description: (decode(attr(html, 'og:description')) || decode(attr(html, 'description')))?.slice(0, 280) || null,
      image: absoluteUrl(url, decode(attr(html, 'og:image'))),
    };
  } catch (error) {
    if (error instanceof Error && /Wklej|Dozwolone|podglądany/.test(error.message)) throw error;
    return {
      url,
      host,
      siteName: fallbackName,
      title: fallbackName,
      description: 'Ogłoszenie na portalu zewnętrznym — otwórz podgląd, żeby zobaczyć kartę.',
      image: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
