const OTODOM_MARKER_RE = /<!--\s*estateos-otodom:\d+\s*-->/gi;
const VERIFY_COMMENT_RE = /<!--\s*ESTATEOS_VERIFY:[\s\S]*?-->/gi;
const IMPORT_FOOTER_RE = /<p>\s*<small>\s*Import OtoDom[\s\S]*?<\/small>\s*<\/p>/gi;
const HTML_TAG_RE = /<\s*\/?[a-z][a-z0-9]*\b/i;

function stripHtmlToPlain(html: string): string {
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

/** Opis oferty do wyświetlenia w aplikacji mobilnej (bez surowego HTML). */
export function formatOfferDescriptionForDisplay(input: unknown): string {
  let raw = String(input ?? '').trim();
  if (!raw) return '';

  raw = raw
    .replace(OTODOM_MARKER_RE, '')
    .replace(VERIFY_COMMENT_RE, '')
    .replace(/\bESTATEOS_VERIFY:[A-Za-z0-9._=-]+\b/gi, '')
    .replace(IMPORT_FOOTER_RE, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  if (HTML_TAG_RE.test(raw)) {
    return stripHtmlToPlain(raw).replace(/\n{3,}/g, '\n\n').trim();
  }

  return raw.replace(/\n{3,}/g, '\n\n').trim();
}
