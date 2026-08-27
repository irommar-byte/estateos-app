export const INTELLIGENCE_AMENITY_FIELDS = [
  'hasBalcony',
  'hasStorage',
  'hasGarden',
  'hasParking',
  'hasElevator',
  'isFurnished',
  'isDuplex',
] as const;

export type IntelligenceAmenityField = (typeof INTELLIGENCE_AMENITY_FIELDS)[number];

export type IntelligenceAmenitySuggestion = {
  field: IntelligenceAmenityField;
  label: string;
  question: string;
  quotes: string[];
};

export type IntelligenceAmenityPatch = {
  field: IntelligenceAmenityField;
  label: string;
  status: 'applied' | 'undone';
  quote: string;
  quotes: string[];
  source: 'import' | 'scoring';
  appliedAt: string;
  undoneAt?: string;
};

export type IntelligenceAmenityPatchMap = Partial<Record<IntelligenceAmenityField, IntelligenceAmenityPatch>>;

const AMENITY_META: Record<
  IntelligenceAmenityField,
  {
    label: string;
    portalNeedles: string[];
    positive: RegExp;
    negative: RegExp;
  }
> = {
  hasBalcony: {
    label: 'Balkon / loggia',
    portalNeedles: ['balkon', 'loggi', 'taras'],
    // No trailing \b: JS word-boundary is ASCII and fails after ą/ż (loggią, garaż).
    positive: /\b(balkon\w*|loggi[a-ząćęłńóśźż]*|taras\w*)/i,
    negative: /bez\s+(balkonu|loggii|tarasu)|brak\s+(balkonu|loggii|tarasu)|nie\s+ma\s+(balkonu|loggii|tarasu)/i,
  },
  hasStorage: {
    label: 'Komórka / piwnica',
    portalNeedles: ['piwnica', 'komórka', 'komorka', 'schowek'],
    positive: /\b(komórk[a-ząćęłńóśźż]*|komork\w*|piwnic[a-ząćęłńóśźż]*|schowek)/i,
    negative: /bez\s+(komórki|komorki|piwnicy|schowka)|brak\s+(komórki|komorki|piwnicy|schowka)/i,
  },
  hasGarden: {
    label: 'Ogród / ogródek',
    portalNeedles: ['ogród', 'ogrod', 'ogródek', 'ogrodek'],
    positive: /\b(ogród|ogrod|ogródek|ogrodek|ogródkiem|ogrodkiem)/i,
    negative: /bez\s+(ogrodu|ogródka|ogrodka)|brak\s+(ogrodu|ogródka|ogrodka)/i,
  },
  hasParking: {
    label: 'Garaż / parking',
    portalNeedles: ['garaż', 'garaz', 'parking', 'miejsce parking', 'miejsce postoj'],
    positive: /\b(gara[żz]\w*|garaz\w*|parking\w*|miejsc\w+\s+postoj\w*|miejsc\w+\s+parking\w*)/i,
    negative: /bez\s+(garażu|garazu|parkingu)|brak\s+(garażu|garazu|parkingu|miejsca\s+postoj)/i,
  },
  hasElevator: {
    label: 'Winda',
    portalNeedles: ['winda'],
    positive: /\b(winda|windą|windy)/i,
    negative: /bez\s+windy|brak\s+windy|nie\s+ma\s+windy/i,
  },
  isFurnished: {
    label: 'Umeblowanie',
    portalNeedles: ['meble', 'umeblow'],
    positive: /\b(umeblowan\w*|w\s+pełni\s+umeblowan\w*|z\s+meblami)/i,
    negative: /nieumeblowan\w*|bez\s+mebli|brak\s+mebli|do\s+umeblo/i,
  },
  isDuplex: {
    label: 'Dwupoziomowe',
    portalNeedles: ['dwupoziom', 'duplex', 'antresol', 'split level', 'split-level'],
    positive: /\b(dwupoziom\w*|dwa\s+poziom\w*|duplex\w*|antresol\w*|mezzanin\w*|split[\s-]?level\w*)/i,
    negative: /nie\s+jest\s+dwupoziom|bez\s+antresol|brak\s+antresol|jednopoziom/i,
  },
};

export function intelligenceAmenityLabel(field: IntelligenceAmenityField): string {
  return AMENITY_META[field].label;
}

function normalizeHay(value: string): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  return normalizeHay(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim().replace(/^["„«]+|["”»]+$/g, ''))
    .filter((part) => part.length >= 8 && part.length <= 280);
}

export function portalFeaturesIncludeAmenity(features: string[] | null | undefined, field: IntelligenceAmenityField): boolean {
  const hay = (features || []).map((item) => String(item || '').toLowerCase());
  return AMENITY_META[field].portalNeedles.some((needle) => hay.some((item) => item.includes(needle)));
}

export function descriptionImpliesAmenity(text: string, field: IntelligenceAmenityField): boolean {
  const hay = normalizeHay(text).toLowerCase();
  if (!hay) return false;
  const meta = AMENITY_META[field];
  if (meta.negative.test(hay)) return false;
  return meta.positive.test(hay);
}

export function quotesForAmenity(text: string, field: IntelligenceAmenityField): string[] {
  const meta = AMENITY_META[field];
  const quotes = splitSentences(text).filter((sentence) => {
    const lower = sentence.toLowerCase();
    if (meta.negative.test(lower)) return false;
    return meta.positive.test(lower);
  });
  return [...new Set(quotes)].slice(0, 2);
}

export function inferAmenitySuggestions(input: {
  features?: string[] | null;
  title?: string | null;
  description?: string | null;
  alreadyOn?: Partial<Record<IntelligenceAmenityField, boolean | null>>;
}): IntelligenceAmenitySuggestion[] {
  const description = [input.title, input.description].filter(Boolean).join('\n');
  const out: IntelligenceAmenitySuggestion[] = [];
  for (const field of INTELLIGENCE_AMENITY_FIELDS) {
    if (input.alreadyOn?.[field] === true) continue;
    if (portalFeaturesIncludeAmenity(input.features, field)) continue;
    if (!descriptionImpliesAmenity(description, field)) continue;
    const quotes = quotesForAmenity(description, field);
    const label = AMENITY_META[field].label;
    out.push({
      field,
      label,
      question: quotes.length
        ? `Zaznaczyć ${label.toLowerCase()} na podstawie opisu?`
        : `W opisie wygląda na to, że jest ${label.toLowerCase()}. Zaznaczyć?`,
      quotes,
    });
  }
  return out;
}

export function parseSmartAddDecisions(raw: unknown): Partial<Record<IntelligenceAmenityField, boolean>> {
  if (!raw || typeof raw !== 'object') return {};
  const body = raw as Record<string, unknown>;
  const out: Partial<Record<IntelligenceAmenityField, boolean>> = {};
  for (const field of INTELLIGENCE_AMENITY_FIELDS) {
    if (typeof body[field] === 'boolean') out[field] = body[field];
  }
  return out;
}

export function parseAmenityPatchMap(raw: unknown): IntelligenceAmenityPatchMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const body = raw as Record<string, unknown>;
  const out: IntelligenceAmenityPatchMap = {};
  for (const field of INTELLIGENCE_AMENITY_FIELDS) {
    const row = body[field];
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const status = item.status === 'undone' ? 'undone' : 'applied';
    const quotes = Array.isArray(item.quotes)
      ? item.quotes.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 3)
      : [];
    const quote = String(item.quote || quotes[0] || '').trim();
    out[field] = {
      field,
      label: String(item.label || AMENITY_META[field].label),
      status,
      quote,
      quotes: quotes.length ? quotes : quote ? [quote] : [],
      source: item.source === 'scoring' ? 'scoring' : 'import',
      appliedAt: String(item.appliedAt || new Date().toISOString()),
      undoneAt: item.undoneAt ? String(item.undoneAt) : undefined,
    };
  }
  return out;
}

export function appliedIntelligenceAmenityFields(map: IntelligenceAmenityPatchMap): IntelligenceAmenityField[] {
  return INTELLIGENCE_AMENITY_FIELDS.filter((field) => map[field]?.status === 'applied');
}

export function buildAppliedPatch(
  suggestion: IntelligenceAmenitySuggestion,
  source: IntelligenceAmenityPatch['source'],
): IntelligenceAmenityPatch {
  return {
    field: suggestion.field,
    label: suggestion.label,
    status: 'applied',
    quote: suggestion.quotes[0] || '',
    quotes: suggestion.quotes,
    source,
    appliedAt: new Date().toISOString(),
  };
}

export function undoAmenityPatch(map: IntelligenceAmenityPatchMap, field: IntelligenceAmenityField): IntelligenceAmenityPatchMap {
  const current = map[field];
  if (!current) return map;
  return {
    ...map,
    [field]: {
      ...current,
      status: 'undone',
      undoneAt: new Date().toISOString(),
    },
  };
}

export function reapplyAmenityPatch(map: IntelligenceAmenityPatchMap, field: IntelligenceAmenityField): IntelligenceAmenityPatchMap {
  const current = map[field];
  if (!current) return map;
  return {
    ...map,
    [field]: {
      ...current,
      status: 'applied',
      undoneAt: undefined,
      appliedAt: new Date().toISOString(),
    },
  };
}

/** Scoring / radar: checkbox albo mózg z opisu (nawet zanim zapisze parametr). */
export function offerHasAmenityFromBrain(
  offer: {
    description?: string | null;
    title?: string | null;
  } & Partial<Record<IntelligenceAmenityField, boolean | null>>,
  field: IntelligenceAmenityField,
): boolean {
  if (offer[field] === true) return true;
  return descriptionImpliesAmenity([offer.title, offer.description].filter(Boolean).join('\n'), field);
}
