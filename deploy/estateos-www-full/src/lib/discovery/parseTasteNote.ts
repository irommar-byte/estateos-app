/**
 * Free-text taste notes from clients — Polish (and common EN/RU) → Discovery reason + correction.
 * Used by mobile, www, and persistDiscoveryEvent so a sentence without a chip still trains the model.
 */

export const TASTE_DISLIKE_REASONS = [
  'PRICE_TOO_HIGH',
  'LOCATION_MISMATCH',
  'LAYOUT_MISMATCH',
  'QUALITY_LOW',
] as const;

export type TasteDislikeReason = (typeof TASTE_DISLIKE_REASONS)[number];

export type ParsedTasteNote = {
  reasonCode: TasteDislikeReason | null;
  /** Engine correction: `district:Wola` / `city:Warszawa`. */
  correctionTarget: string | null;
  tags: string[];
  summary: string;
};

const PRICE_RE =
  /za\s*drogo|zbyt\s*drog|nie\s+sta[cć]|poza\s+bud[zż]et|za\s+wysok[aeą]|cena\s+(jest\s+)?(za|zbyt)|too\s+expensive|overpriced|дорого|дороговат/i;
const LOCATION_RE =
  /nie\s+ta\s+dzielnic|z[łl]a\s+lokaliz|za\s+daleko|nie\s+ten\s+rejon|inna\s+dzielnic|nie\s+chc[eę]\s+(tu|tam|tej)|wrong\s+(area|location|district)|не\s+та\s+(район|локац)/i;
const LAYOUT_RE =
  /brak\s+balkon|bez\s+balkon|za\s+ma[łl]a\s+kuchni|uk[łl]ad\s+nie|za\s+ma[łl]y\s+metra[zż]|za\s+ma[łl]o\s+pokoi|ciasn|brak\s+windy|no\s+balcony|layout|планировк|без\s+балкон/i;
const QUALITY_RE =
  /ha[łl]as|ciemne|zaniedban|s[łl]aby\s+stan|jako[sś][cć]|grzyb|wilgo[cć]|do\s+remontu|noisy|rundown|haos|шум|сыро/i;

const DISTRICT_ALIASES: Array<{ key: string; pattern: RegExp }> = [
  { key: 'Wola', pattern: /\bwol[iaę]\b/i },
  { key: 'Mokotów', pattern: /\bmokot/i },
  { key: 'Śródmieście', pattern: /\b[sś]r[oó]dmie[sś]c/i },
  { key: 'Ochota', pattern: /\bochot/i },
  { key: 'Żoliborz', pattern: /\b[zż]oliborz/i },
  { key: 'Ursynów', pattern: /\bursyn/i },
  { key: 'Bemowo', pattern: /\bbemow/i },
  { key: 'Bielany', pattern: /\bbielan/i },
  { key: 'Praga', pattern: /\bprag[aei]\b/i },
  { key: 'Wilanów', pattern: /\bwilan/i },
  { key: 'Targówek', pattern: /\btarg[oó]w/i },
];

function pickDistrict(text: string): string | null {
  for (const row of DISTRICT_ALIASES) {
    if (row.pattern.test(text)) return row.key;
  }
  return null;
}

function rejectedPlace(text: string): boolean {
  return /nie\s+(ta|ten|chc|na|w)\b|nie\s+pasuje|z[łl]a\s+|wrong\s+|не\s+та/i.test(text);
}

/**
 * Parse a free-text dislike / correction note into a structured Discovery signal.
 */
export function parseTasteNote(raw: unknown): ParsedTasteNote {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return { reasonCode: null, correctionTarget: null, tags: [], summary: '' };
  }

  const scores: Array<{ code: TasteDislikeReason; n: number; tag: string }> = [];
  if (PRICE_RE.test(text)) scores.push({ code: 'PRICE_TOO_HIGH', n: 3, tag: 'price' });
  if (LOCATION_RE.test(text)) scores.push({ code: 'LOCATION_MISMATCH', n: 3, tag: 'location' });
  if (LAYOUT_RE.test(text)) scores.push({ code: 'LAYOUT_MISMATCH', n: 3, tag: 'layout' });
  if (QUALITY_RE.test(text)) scores.push({ code: 'QUALITY_LOW', n: 3, tag: 'quality' });

  const district = pickDistrict(text);
  if (district && rejectedPlace(text)) {
    scores.push({ code: 'LOCATION_MISMATCH', n: 4, tag: 'district' });
  } else if (district && LOCATION_RE.test(text)) {
    scores.push({ code: 'LOCATION_MISMATCH', n: 2, tag: 'district' });
  }

  scores.sort((a, b) => b.n - a.n);
  const reasonCode = scores[0]?.code ?? null;
  const tags = [...new Set(scores.map((row) => row.tag))];

  let correctionTarget: string | null = null;
  if (district && (rejectedPlace(text) || LOCATION_RE.test(text))) {
    correctionTarget = `district:${district}`;
  }

  const summary = text.length > 140 ? `${text.slice(0, 137)}…` : text;
  return { reasonCode, correctionTarget, tags, summary };
}

export function noteCorrectionTarget(note: string): string {
  const trimmed = String(note || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return `note:${trimmed.slice(0, 120)}`;
}
