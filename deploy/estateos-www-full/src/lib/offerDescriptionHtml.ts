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

const OTODOM_MARKER_RE = /<!--\s*estateos-otodom:\d+\s*-->/gi;
const IMPORT_FOOTER_RE = /<p>\s*<small>\s*Import OtoDom[\s\S]*?<\/small>\s*<\/p>/gi;

export function stripInternalOfferDescriptionMarkers(html: string): string {
  return String(html || '')
    .replace(OTODOM_MARKER_RE, '')
    .replace(IMPORT_FOOTER_RE, '')
    .trim();
}

export function looksLikeOfferDescriptionHtml(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  return /<\s*(p|ul|ol|li|br|h2|h3|div)\b/i.test(trimmed);
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
