const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'h2',
  'h3',
  'a',
  'span',
]);

const IMPORT_MARKER_RE = /<!--\s*estateos-(?:otodom|olx|nieruchomosci-online):\d+\s*-->/gi;
const IMPORT_FOOTER_RE = /<p>\s*<small>\s*Import OtoDom[\s\S]*?<\/small>\s*<\/p>/gi;

export function stripInternalOfferDescriptionMarkers(html: string): string {
  return String(html || '')
    .replace(IMPORT_MARKER_RE, '')
    .replace(IMPORT_FOOTER_RE, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

export function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function shouldRenderOfferDescriptionAsHtml(value: string): boolean {
  const trimmed = stripInternalOfferDescriptionMarkers(value).trim();
  if (!trimmed) return false;
  return /<\s*\/?[a-z][a-z0-9]*\b/i.test(trimmed);
}

export function descriptionForEditForm(raw: unknown): string {
  return stripHtmlToPlain(stripInternalOfferDescriptionMarkers(String(raw ?? '')));
}

/** Czysty tekst oferty do kart CRM / radaru — bez znaczników importu i HTML. */
export function plainOfferDescription(raw: unknown): string {
  return stripHtmlToPlain(stripInternalOfferDescriptionMarkers(String(raw ?? '')))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function descriptionForStorageFromEdit(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (shouldRenderOfferDescriptionAsHtml(value)) return sanitizeOfferDescriptionHtml(value);
  return value;
}

/** Prosta sanityzacja HTML opisu oferty przed renderem na stronie. */
export function sanitizeOfferDescriptionHtml(raw: string): string {
  let html = stripInternalOfferDescriptionMarkers(raw);

  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');

  html = html.replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (full, slash, tagName, attrs) => {
    const tag = String(tagName || '').toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return slash ? '' : '';
    }
    if (tag === 'a') {
      const hrefMatch = String(attrs || '').match(/\shref\s*=\s*("([^"]*)"|'([^']*)')/i);
      const href = hrefMatch?.[2] || hrefMatch?.[3] || '';
      if (!/^https?:\/\//i.test(href)) return '';
      return `<a href="${href.replace(/"/g, '&quot;')}" rel="nofollow noopener noreferrer" target="_blank">`;
    }
    return `<${slash ? '/' : ''}${tag}>`;
  });

  return html.trim();
}
