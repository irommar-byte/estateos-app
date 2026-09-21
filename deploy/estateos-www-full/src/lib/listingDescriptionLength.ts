export const DESCRIPTION_LENGTH_PRESETS = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000] as const;
export const DEFAULT_DESCRIPTION_LENGTH = 1500;
export const DESCRIPTION_LENGTH_TOLERANCE = 50;
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

export function maxTokensForLength(targetLength: number): number {
  return Math.min(1800, Math.ceil(targetLength / 2.2) + 80);
}

export function stripEmojiCharacters(text: string): string {
  return String(text || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function fitDescriptionToTarget(text: string, targetLength: number): string {
  const min = targetLength - DESCRIPTION_LENGTH_TOLERANCE;
  const max = Math.min(DESCRIPTION_MAX_CHARS, targetLength + DESCRIPTION_LENGTH_TOLERANCE);
  let next = String(text || '').trim();
  if (next.length > DESCRIPTION_MAX_CHARS) next = next.slice(0, DESCRIPTION_MAX_CHARS).trim();
  if (next.length <= max && next.length >= min) return next;
  if (next.length > max) return trimToSentenceWindow(next, min, max);
  return next;
}

export function needsDescriptionExpand(text: string, targetLength: number): boolean {
  return String(text || '').trim().length < targetLength - DESCRIPTION_LENGTH_TOLERANCE;
}

function trimToSentenceWindow(text: string, min: number, max: number): string {
  const window = text.slice(0, max);
  const matches = [...window.matchAll(/(?:\n\n)|[.!?…](?:["”’)\]»]?)(?:\s+|$)/g)];
  let cut = -1;
  for (const match of matches) {
    const end = (match.index ?? 0) + match[0].length;
    if (end >= min && end <= max) cut = end;
  }
  if (cut >= min) return window.slice(0, cut).trim();
  const last = matches[matches.length - 1];
  if (last) {
    const end = (last.index ?? 0) + last[0].length;
    if (end > min * 0.65) return window.slice(0, end).trim();
  }
  return window.trim();
}
