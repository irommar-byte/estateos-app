export const DESCRIPTION_LENGTH_PRESETS = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000] as const;
export const DEFAULT_DESCRIPTION_LENGTH = 1500;
/** Miękki cel — wolimy kompletne zdanie niż twarde ucięcie. */
export const DESCRIPTION_LENGTH_TOLERANCE = 150;
export const DESCRIPTION_MAX_CHARS = 4000;

export type DescriptionLengthPreset = (typeof DESCRIPTION_LENGTH_PRESETS)[number];

export function resolveTargetLength(raw: unknown): DescriptionLengthPreset {
  const n = Number(raw);
  const fallback = DEFAULT_DESCRIPTION_LENGTH;
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(DESCRIPTION_MAX_CHARS, Math.max(500, Math.round(n)));
  const snapped = Math.round(clamped / 500) * 500;
  const bounded = Math.min(DESCRIPTION_MAX_CHARS, Math.max(500, snapped));
  return bounded as DescriptionLengthPreset;
}

export function resolveUseEmojis(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === 'true' || raw === '1';
}

export function resolveGenerateTitle(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === 'true' || raw === '1';
}

/** Większy budżet tokenów — polski opis ~2–2.5 znaków/token; unikamy urwania w połowie. */
export function maxTokensForLength(targetLength: number): number {
  return Math.min(2200, Math.ceil(targetLength / 1.6) + 120);
}

export function stripEmojiCharacters(text: string): string {
  return String(text || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Dopasuj długość miękko: nie urywaj w środku zdania / punktu listy.
 * Lepiej nieco poza cel (±tolerance, max DESCRIPTION_MAX_CHARS) niż „którzy pragną”.
 */
export function fitDescriptionToTarget(text: string, targetLength: number): string {
  const min = Math.max(200, targetLength - DESCRIPTION_LENGTH_TOLERANCE);
  const softMax = Math.min(DESCRIPTION_MAX_CHARS, targetLength + DESCRIPTION_LENGTH_TOLERANCE);
  const hardMax = DESCRIPTION_MAX_CHARS;
  let next = String(text || '').trim();
  if (!next) return next;
  if (next.length > hardMax) {
    next = trimToCompleteBoundary(next, Math.max(min, hardMax - 400), hardMax);
  }
  if (next.length <= softMax) return next;
  return trimToCompleteBoundary(next, min, softMax);
}

export function needsDescriptionExpand(text: string, targetLength: number): boolean {
  return String(text || '').trim().length < targetLength - DESCRIPTION_LENGTH_TOLERANCE;
}

/** Utnij do ostatniego kompletnego zdania / akapitu / punktu listy w oknie [min, max]. */
export function trimToCompleteBoundary(text: string, min: number, max: number): string {
  const source = String(text || '');
  if (source.length <= max) return source.trim();
  const window = source.slice(0, max);

  const sentenceEnds = [...window.matchAll(/(?:\n\n)|[.!?…](?:["”’)\]»]?)(?:\s+|$)/g)];
  let cut = -1;
  for (const match of sentenceEnds) {
    const end = (match.index ?? 0) + match[0].length;
    if (end >= min && end <= max) cut = end;
  }
  if (cut >= min) return window.slice(0, cut).trim();

  // Punkt listy / nagłówek — obetnij przed niepełną linią
  const lastBreak = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n• '), window.lastIndexOf('\n✓ '));
  if (lastBreak >= min * 0.5) {
    return window.slice(0, lastBreak).trim();
  }

  const last = sentenceEnds[sentenceEnds.length - 1];
  if (last) {
    const end = (last.index ?? 0) + last[0].length;
    if (end > 80) return window.slice(0, end).trim();
  }

  // Ostateczność: nie tnij w środku słowa
  const space = window.lastIndexOf(' ');
  if (space > 80) return window.slice(0, space).trim();
  return window.trim();
}
