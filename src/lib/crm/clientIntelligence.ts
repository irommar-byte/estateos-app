import {
  formatClientFeedbackForAgent,
  parseClientOfferFeedback,
  sentimentLabel,
  type ClientOfferFeedback,
} from '@/lib/crm/clientPortalFeedback';
import { extractFeedbackSignals } from '@/lib/crm/feedbackSignals';
import { descriptionImpliesAmenity, offerHasAmenityFromBrain } from '@/lib/intelligenceAmenityBrain';
import { plainOfferDescription } from '@/lib/offerDescriptionHtml';

export type IntelligenceLockKey =
  | 'districts'
  | 'maxPrice'
  | 'minArea'
  | 'maxArea'
  | 'minYear'
  | 'minRooms'
  | 'requireBalcony'
  | 'requireGarden'
  | 'requireElevator'
  | 'requireParking'
  | 'requireFurnished';

export type IntelligenceLocks = Record<IntelligenceLockKey, boolean>;

export const INTELLIGENCE_LOCK_KEYS: IntelligenceLockKey[] = [
  'districts',
  'maxPrice',
  'minArea',
  'maxArea',
  'minYear',
  'minRooms',
  'requireBalcony',
  'requireGarden',
  'requireElevator',
  'requireParking',
  'requireFurnished',
];

export type IntelligenceChoice = { value: number; label: string };

export const INTELLIGENCE_INTERVAL_OPTIONS: IntelligenceChoice[] = [
  { value: 6, label: 'Co 6 godz.' },
  { value: 12, label: 'Co 12 godz.' },
  { value: 24, label: 'Raz na dobę' },
  { value: 48, label: 'Co 2 dni' },
  { value: 72, label: 'Co 3 dni' },
  { value: 168, label: 'Raz w tygodniu' },
];

export const INTELLIGENCE_DAILY_LIMIT_OPTIONS: IntelligenceChoice[] = [
  { value: 1, label: '1 oferta' },
  { value: 2, label: '2 oferty' },
  { value: 3, label: '3 oferty' },
];

export const INTELLIGENCE_MIN_LEARNS_OPTIONS: IntelligenceChoice[] = [
  { value: 1, label: 'Po 1 reakcji' },
  { value: 2, label: 'Po 2 reakcjach' },
  { value: 3, label: 'Po 3 reakcjach' },
  { value: 5, label: 'Po 5 reakcjach' },
];

export const INTELLIGENCE_MIN_SCORE_OPTIONS: IntelligenceChoice[] = [
  { value: 75, label: '75% · więcej propozycji' },
  { value: 80, label: '80% · zrównoważone' },
  { value: 85, label: '85% · pewniej' },
  { value: 92, label: '92% · tylko pewne' },
  { value: 95, label: '95% · bardzo ostrożnie' },
];

export type IntelligenceSettings = {
  enabled: boolean;
  intervalHours: number;
  dailyLimit: number;
  minLearns: number;
  minScore: number;
  lastSentAt: string | null;
  lockedFields: IntelligenceLocks;
};

export const DEFAULT_INTELLIGENCE_LOCKS: IntelligenceLocks = {
  districts: false,
  maxPrice: false,
  minArea: false,
  maxArea: false,
  minYear: false,
  minRooms: false,
  requireBalcony: false,
  requireGarden: false,
  requireElevator: false,
  requireParking: false,
  requireFurnished: false,
};

export const DEFAULT_INTELLIGENCE_SETTINGS: IntelligenceSettings = {
  enabled: false,
  intervalHours: 24,
  dailyLimit: 1,
  minLearns: 3,
  minScore: 92,
  lastSentAt: null,
  lockedFields: { ...DEFAULT_INTELLIGENCE_LOCKS },
};

type OfferLike = {
  id: number;
  title?: string | null;
  description?: string | null;
  city?: string | null;
  district?: string | null;
  street?: string | null;
  price?: number | null;
  area?: number | null;
  rooms?: number | null;
  yearBuilt?: number | null;
  hasBalcony?: boolean | null;
  hasGarden?: boolean | null;
  hasElevator?: boolean | null;
  hasParking?: boolean | null;
  isFurnished?: boolean | null;
  floor?: number | string | null;
};

export type LearnedTaste = {
  learnCount: number;
  likes: number;
  maybes: number;
  dislikes: number;
  phrases: string[];
  recentPhrases: string[];
  likedText: string[];
  dislikedText: string[];
  notes: string[];
  rejectedOfferIds: number[];
  likedDistricts: string[];
  rejectedDistricts: string[];
  likedRooms: number[];
  likedPrices: number[];
  likedAreas: number[];
  maybeRooms: number[];
  maybePrices: number[];
  expensivePrices: number[];
  minYearHint: number | null;
  minRoomsHint: number | null;
  maxAreaHint: number | null;
  minAreaHint: number | null;
};

const PHRASE_NEEDLES: Record<string, string[]> = {
  'Za mała kuchnia': ['mała kuchnia', 'aneks kuchenny', 'kuchnia 4', 'kuchnia 5', 'kuchnia 6 m', 'ciasna kuchnia'],
  'Brak balkonu': ['bez balkonu', 'brak balkonu'],
  'Brak parkingu': ['bez parkingu', 'brak parkingu', 'brak miejsca postojowego'],
  'Brak windy': ['bez windy', 'brak windy'],
  'Brak ogrodu': ['bez ogrodu', 'brak ogrodu'],
  'Za drogo': [],
  'Za stare': ['rocznik', 'przedwojen', 'kamienic', 'stare budownictwo'],
  'Za mało pokoi': ['kawalerka', 'jednopokoj', '1-pokoj', '1 pokoj'],
  'Za mały metraż': ['ciasne', 'małe mieszkanie', 'mały metraż'],
  'Za duży metraż': ['zbyt duże', 'za duży metraż'],
  'Hałas / ruchliwa ulica': ['hałas', 'ruchliw', 'arteria', 'przy al.', 'przy ul. ', 'duży ruch'],
  'Nie ta dzielnica': [],
  'Słabe doświetlenie': ['północ', 'ciemne', 'słabe doświetl', 'zacienion'],
  'Za wysoko albo za nisko': ['parter', 'ostatnie piętro'],
  'Świetna lokalizacja': ['spokojn', 'zielon', 'metro', 'park', 'centrum'],
  'Podoba mi się układ': ['przestronn', 'funkcjonal', 'rozkład'],
  'Ładna okolica': ['spokojn', 'osiedl', 'park', 'zieleń'],
  'Dobry metraż': [],
  'Pasuje do budżetu': [],
  'Jasne mieszkanie': ['jasne', 'nasłoneczn', 'południe', 'duże okna'],
};

function haystack(offer: OfferLike): string {
  return [
    offer.title,
    plainOfferDescription(offer.description),
    offer.city,
    offer.district,
    offer.street,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => needle && text.includes(needle.toLowerCase()));
}

export function snapToAllowed(value: number, allowed: number[]): number | null {
  if (!allowed.length || !Number.isFinite(value)) return null;
  return allowed.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best));
}

export function descriptionImpliesBalcony(text: string): boolean {
  return descriptionImpliesAmenity(text, 'hasBalcony');
}

export function shouldPersistBalcony(offer: OfferLike): boolean {
  return offer.hasBalcony !== true && descriptionImpliesBalcony(haystack(offer));
}

const FEEDBACK_STOPWORDS = new Set([
  'mieszkania',
  'mieszkanie',
  'mieszkaniu',
  'oferty',
  'oferta',
  'lokalizacja',
  'lokalizacji',
  'które',
  'który',
  'która',
  'bardzo',
  'klient',
  'klientka',
  'metra',
  'metro',
  'ulicy',
  'budowy',
]);

function emptyTaste(): LearnedTaste {
  return {
    learnCount: 0,
    likes: 0,
    maybes: 0,
    dislikes: 0,
    phrases: [],
    recentPhrases: [],
    likedText: [],
    dislikedText: [],
    notes: [],
    rejectedOfferIds: [],
    likedDistricts: [],
    rejectedDistricts: [],
    likedRooms: [],
    likedPrices: [],
    likedAreas: [],
    maybeRooms: [],
    maybePrices: [],
    expensivePrices: [],
    minYearHint: null,
    minRoomsHint: null,
    maxAreaHint: null,
    minAreaHint: null,
  };
}

function feedbackTimeMs(raw?: Date | string | null): number {
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function learnFromFeedback(
  rows: Array<{
    offerId: number;
    clientFeedback: string | null;
    offer?: OfferLike | null;
    clientFeedbackAt?: Date | string | null;
  }>,
): LearnedTaste {
  const taste = emptyTaste();
  const dated: Array<{ at: number; phrases: string[] }> = [];

  for (const row of rows) {
    const feedback = parseClientOfferFeedback(row.clientFeedback);
    if (!feedback.sentiment && !feedback.disliked && !feedback.liked && !feedback.phrases.length && !feedback.note) {
      continue;
    }
    taste.learnCount += 1;
    if (feedback.sentiment === 'like') {
      taste.likes += 1;
      if (row.offer?.district) taste.likedDistricts.push(String(row.offer.district));
      if (row.offer?.rooms) taste.likedRooms.push(Number(row.offer.rooms));
      if (row.offer?.price) taste.likedPrices.push(Number(row.offer.price));
      if (row.offer?.area) taste.likedAreas.push(Number(row.offer.area));
    }
    if (feedback.sentiment === 'maybe') {
      taste.maybes += 1;
      if (row.offer?.rooms) taste.maybeRooms.push(Number(row.offer.rooms));
      if (row.offer?.price) taste.maybePrices.push(Number(row.offer.price));
    }
    if (feedback.sentiment === 'dislike') {
      taste.dislikes += 1;
      taste.rejectedOfferIds.push(row.offerId);
      if (row.offer?.district && feedback.phrases.includes('Nie ta dzielnica')) {
        taste.rejectedDistricts.push(String(row.offer.district));
      }
    }
    if (feedback.phrases.includes('Za drogo') && row.offer?.price) {
      taste.expensivePrices.push(Number(row.offer.price));
    }
    const signals = extractFeedbackSignals(feedback);
    for (const signal of signals) {
      if (signal.kind === 'minYear' && signal.value != null) {
        taste.minYearHint = taste.minYearHint == null ? signal.value : Math.max(taste.minYearHint, signal.value);
      }
      if (signal.kind === 'minRooms' && signal.value != null) {
        taste.minRoomsHint = taste.minRoomsHint == null ? signal.value : Math.max(taste.minRoomsHint, signal.value);
      }
      if (signal.kind === 'maxArea' && signal.value != null) {
        taste.maxAreaHint = taste.maxAreaHint == null ? signal.value : Math.min(taste.maxAreaHint, signal.value);
      }
      if (signal.kind === 'minArea' && signal.value != null) {
        taste.minAreaHint = taste.minAreaHint == null ? signal.value : Math.max(taste.minAreaHint, signal.value);
      }
    }
    taste.phrases.push(...feedback.phrases);
    if (feedback.liked) taste.likedText.push(feedback.liked);
    if (feedback.disliked) taste.dislikedText.push(feedback.disliked);
    if (feedback.note) taste.notes.push(feedback.note);
    dated.push({ at: feedbackTimeMs(row.clientFeedbackAt), phrases: feedback.phrases });
  }

  dated.sort((a, b) => b.at - a.at);
  taste.recentPhrases = dated.slice(0, 3).flatMap((item) => item.phrases);

  return taste;
}

function modeNumber(values: number[]): number | null {
  if (!values.length) return null;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function intelligenceAdjustScore(params: {
  radarScore: number;
  offer: OfferLike;
  taste: LearnedTaste;
  maxPrice?: number | null;
  acceptScarceBudget?: boolean;
  pref?: {
    minYear?: number | null;
    minRooms?: number | null;
    maxArea?: number | null;
    minArea?: number | null;
  } | null;
}): { score: number; reasons: string[] } {
  const { offer, taste, maxPrice, acceptScarceBudget, pref } = params;
  let score = params.radarScore;
  const reasons: string[] = [];
  const text = haystack(offer);

  const minYear = Math.max(
    Number(pref?.minYear || 0),
    Number(taste.minYearHint || 0),
  );
  const minRooms = Math.max(
    Number(pref?.minRooms || 0),
    Number(taste.minRoomsHint || 0),
  );
  const maxArea =
    pref?.maxArea != null && taste.maxAreaHint != null
      ? Math.min(Number(pref.maxArea), Number(taste.maxAreaHint))
      : pref?.maxArea ?? taste.maxAreaHint ?? null;
  const minArea = Math.max(
    Number(pref?.minArea || 0),
    Number(taste.minAreaHint || 0),
  );

  const yearBuilt = offer.yearBuilt != null ? Number(offer.yearBuilt) : null;
  if (minYear > 1900 && yearBuilt != null && Number.isFinite(yearBuilt) && yearBuilt < minYear) {
    score = 0;
    reasons.push(`Budynek z ${yearBuilt} r. — poniżej progu ${minYear}.`);
  }

  const rooms = offer.rooms != null ? Number(offer.rooms) : null;
  if (minRooms > 0 && rooms != null && Number.isFinite(rooms) && rooms < minRooms) {
    score = 0;
    reasons.push(`Układ ${rooms} pok. — poniżej oczekiwanego minimum ${minRooms}.`);
  }

  if (maxArea != null && offer.area != null && Number(offer.area) > Number(maxArea)) {
    score = 0;
    reasons.push(`Metraż ${offer.area} m² przekracza limit ${maxArea} m².`);
  }

  if (minArea > 0 && offer.area != null && Number(offer.area) < minArea) {
    score = Math.min(score, 40);
    reasons.push(`Metraż ${offer.area} m² jest poniżej oczekiwanego minimum ${minArea} m².`);
  }

  if (score <= 0) {
    return { score: 0, reasons: [...new Set(reasons)].slice(0, 6) };
  }
  const phraseCounts = new Map<string, number>();
  for (const phrase of taste.phrases) {
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
  }
  const recentSet = new Set(taste.recentPhrases);

  const balconyFromDescription = descriptionImpliesBalcony(text);
  const hasBalcony = offerHasAmenityFromBrain(offer, 'hasBalcony');
  if (offer.hasBalcony !== true && balconyFromDescription) {
    reasons.push('W opisie jest balkon albo loggia, choć parametr był odznaczony — scoring traktuje ofertę jak z balkonem.');
  }
  if (phraseCounts.get('Brak balkonu') && !hasBalcony) {
    score -= 18;
    reasons.push('Klientka odrzucała mieszkania bez balkonu.');
  } else if (phraseCounts.get('Brak balkonu') && hasBalcony) {
    score += 6;
    reasons.push('Ma balkon / loggię — tego wcześniej brakowało.');
  }

  const expensiveNearBudget = taste.expensivePrices.filter(
    (price) => maxPrice != null && Number.isFinite(price) && price >= maxPrice * 0.85,
  );
  if (!acceptScarceBudget && expensiveNearBudget.length && maxPrice && Number(offer.price) > maxPrice * 0.92) {
    score -= 16;
    reasons.push('Cena jest blisko lub powyżej budżetu, a klientka sygnalizowała „za drogo” przy podobnych kwotach.');
  }

  for (const [phrase, count] of phraseCounts) {
    const needles = PHRASE_NEEDLES[phrase] || [];
    if (!needles.length) continue;
    const hit = includesAny(text, needles);
    if (hit && count > 0) {
      const negative =
        phrase.startsWith('Za ') ||
        phrase.startsWith('Brak') ||
        phrase.startsWith('Nie ') ||
        phrase.startsWith('Słabe') ||
        phrase.startsWith('Hałas');
      const weight = Math.min(3, count);
      let delta = negative ? -12 * weight : 8 * weight;
      if (recentSet.has(phrase)) delta += negative ? -4 : 3;
      score += delta;
      if (delta < 0) reasons.push(`Opis zderza się z obiekcją „${phrase}”.`);
      else reasons.push(`Opis wspiera to, co zostawało: „${phrase}”.`);
    }
  }

  const dislikedBlob = [...taste.dislikedText, ...taste.notes].join(' ').toLowerCase();
  if (dislikedBlob) {
    for (const token of dislikedBlob
      .split(/[\s,.;:!?/]+/)
      .filter((item) => item.length >= 4 && !FEEDBACK_STOPWORDS.has(item))
      .slice(0, 16)) {
      if (text.includes(token)) {
        score -= 5;
        reasons.push(`W opisie wraca słowo z zastrzeżeń: „${token}”.`);
      }
    }
  }

  const likedBlob = taste.likedText.join(' ').toLowerCase();
  if (likedBlob) {
    for (const token of likedBlob
      .split(/[\s,.;:!?/]+/)
      .filter((item) => item.length >= 6 && !FEEDBACK_STOPWORDS.has(item))
      .slice(0, 8)) {
      if (text.includes(token)) {
        score += 4;
        reasons.push(`Opis pokrywa się z tym, co zostawało: „${token}”.`);
      }
    }
  }

  if (offer.district && taste.rejectedDistricts.includes(String(offer.district)) && !taste.likedDistricts.includes(String(offer.district))) {
    score -= 10;
    reasons.push(`Dzielnica ${offer.district} już odpadała.`);
  }
  if (offer.district && taste.likedDistricts.includes(String(offer.district))) {
    score += 5;
    reasons.push(`Dzielnica ${offer.district} już się podobała.`);
  }

  const likedRoomMode = modeNumber(taste.likedRooms);
  if (likedRoomMode && Number(offer.rooms) === likedRoomMode) {
    score += 6;
    reasons.push(`Układ ${likedRoomMode} pok. już zostawał.`);
  } else if (!likedRoomMode) {
    const maybeRoomMode = modeNumber(taste.maybeRooms);
    if (maybeRoomMode && Number(offer.rooms) === maybeRoomMode) {
      score += 3;
      reasons.push(`Układ ${maybeRoomMode} pok. był przy „może być”.`);
    }
  }

  if (minRooms > 0 && rooms != null && rooms >= minRooms) {
    score += 5;
    reasons.push(`Ma co najmniej ${minRooms} pokoje — zgodnie z Twoimi uwagami.`);
  }

  if (minYear > 1900 && yearBuilt != null && yearBuilt >= minYear) {
    score += 4;
    reasons.push(`Budynek z ${yearBuilt} r. — spełnia oczekiwanie co do roku budowy.`);
  }

  if (phraseCounts.get('Brak parkingu') && offerHasAmenityFromBrain(offer, 'hasParking')) {
    score += 5;
    reasons.push('Ma parking lub miejsce postojowe.');
  }
  if (phraseCounts.get('Brak windy') && offerHasAmenityFromBrain(offer, 'hasElevator')) {
    score += 4;
    reasons.push('Jest winda w budynku.');
  }
  if (phraseCounts.get('Brak ogrodu') && offerHasAmenityFromBrain(offer, 'hasGarden')) {
    score += 4;
    reasons.push('Jest ogródek lub dostęp do zieleni.');
  }

  const likedPriceMid = median(taste.likedPrices);
  if (likedPriceMid && offer.price && Math.abs(Number(offer.price) - likedPriceMid) / likedPriceMid <= 0.12) {
    score += 5;
    reasons.push('Cena jest w paśmie ogłoszeń, które już się podobały.');
  }

  if (taste.rejectedOfferIds.includes(offer.id)) {
    score = 0;
    reasons.push('Ta oferta już dostała negatywną reakcję.');
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons: [...new Set(reasons)].slice(0, 6) };
}

export function summarizeTaste(taste: LearnedTaste): string {
  if (!taste.learnCount) return 'Brak jeszcze reakcji do nauki.';
  const bits = [
    `${taste.learnCount} reakcji`,
    taste.likes ? `${taste.likes}× chcę oglądać` : null,
    taste.maybes ? `${taste.maybes}× do przemyślenia` : null,
    taste.dislikes ? `${taste.dislikes}× odłóż` : null,
  ].filter(Boolean);
  const objections = [
    ...new Set(
      taste.phrases.filter(
        (item) =>
          PHRASE_NEEDLES[item]?.length !== undefined &&
          (item.startsWith('Za') || item.startsWith('Brak') || item.startsWith('Nie') || item.startsWith('Słabe') || item.startsWith('Hałas')),
      ),
    ),
  ];
  if (objections.length) bits.push(`obiekcje: ${objections.join(', ')}`);
  if (taste.dislikedText.length) bits.push(`uwagi: ${taste.dislikedText.slice(0, 2).join('; ')}`);
  return bits.join(' · ');
}

export function phraseCount(taste: LearnedTaste, phrase: string): number {
  return taste.phrases.filter((item) => item === phrase).length;
}

export function parseDistrictList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
    } catch {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function defaultIntelligenceLocks(pref?: {
  districts?: unknown;
  maxPrice?: number | null;
  minArea?: number | null;
  maxArea?: number | null;
  minYear?: number | null;
  minRooms?: number | null;
  requireBalcony?: boolean | null;
  requireGarden?: boolean | null;
  requireElevator?: boolean | null;
  requireParking?: boolean | null;
  requireFurnished?: boolean | null;
} | null): IntelligenceLocks {
  return {
    districts: parseDistrictList(pref?.districts).length > 0,
    maxPrice: pref?.maxPrice != null && Number(pref.maxPrice) > 0,
    minArea: pref?.minArea != null && Number(pref.minArea) > 0,
    maxArea: pref?.maxArea != null && Number(pref.maxArea) > 0,
    minYear: pref?.minYear != null && Number(pref.minYear) > 1900,
    minRooms: pref?.minRooms != null && Number(pref.minRooms) > 0,
    requireBalcony: Boolean(pref?.requireBalcony),
    requireGarden: Boolean(pref?.requireGarden),
    requireElevator: Boolean(pref?.requireElevator),
    requireParking: Boolean(pref?.requireParking),
    requireFurnished: Boolean(pref?.requireFurnished),
  };
}

export function parseIntelligenceLocks(
  raw: unknown,
  pref?: Parameters<typeof defaultIntelligenceLocks>[0],
): IntelligenceLocks {
  const defaults = defaultIntelligenceLocks(pref);
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  const body = raw as Record<string, unknown>;
  const out = { ...defaults };
  for (const key of INTELLIGENCE_LOCK_KEYS) {
    if (typeof body[key] === 'boolean') out[key] = body[key];
  }
  return out;
}

export type BuyerPrefWriteback = {
  districts?: string[];
  maxPrice?: number | null;
  minArea?: number | null;
  maxArea?: number | null;
  minYear?: number | null;
  minRooms?: number | null;
  requireBalcony?: boolean;
  requireGarden?: boolean;
  requireElevator?: boolean;
  requireParking?: boolean;
  requireFurnished?: boolean;
};

export function preferenceUpdatesFromTaste(params: {
  pref: {
    districts?: unknown;
    maxPrice?: number | null;
    minArea?: number | null;
    maxArea?: number | null;
    minYear?: number | null;
    minRooms?: number | null;
    requireBalcony?: boolean | null;
    requireGarden?: boolean | null;
    requireElevator?: boolean | null;
    requireParking?: boolean | null;
    requireFurnished?: boolean | null;
  };
  taste: LearnedTaste;
  locks: IntelligenceLocks;
}): { data: BuyerPrefWriteback; notes: string[] } {
  const data: BuyerPrefWriteback = {};
  const notes: string[] = [];
  const { pref, taste, locks } = params;

  if (phraseCount(taste, 'Brak balkonu') >= 2) {
    if (locks.requireBalcony) {
      notes.push('Klient wielokrotnie odrzucał brak balkonu, ale to kryterium jest zablokowane.');
    } else if (!pref.requireBalcony) {
      data.requireBalcony = true;
      notes.push('Dopisano obowiązkowy balkon — klient dwukrotnie zaznaczał „brak balkonu”.');
    }
  }

  if (phraseCount(taste, 'Brak parkingu') >= 2) {
    if (locks.requireParking) {
      notes.push('Klient wielokrotnie odrzucał brak parkingu, ale to kryterium jest zablokowane.');
    } else if (!pref.requireParking) {
      data.requireParking = true;
      notes.push('Dopisano obowiązkowy parking — klient dwukrotnie zaznaczał „brak parkingu”.');
    }
  }

  if (phraseCount(taste, 'Brak windy') >= 2) {
    if (locks.requireElevator) {
      notes.push('Klient wielokrotnie odrzucał brak windy, ale to kryterium jest zablokowane.');
    } else if (!pref.requireElevator) {
      data.requireElevator = true;
      notes.push('Dopisano obowiązkową windę — klient dwukrotnie zaznaczał „brak windy”.');
    }
  }

  if (phraseCount(taste, 'Brak ogrodu') >= 2) {
    if (locks.requireGarden) {
      notes.push('Klient wielokrotnie odrzucał brak ogrodu, ale to kryterium jest zablokowane.');
    } else if (!pref.requireGarden) {
      data.requireGarden = true;
      notes.push('Dopisano obowiązkowy ogród — klient dwukrotnie zaznaczał „brak ogrodu”.');
    }
  }

  if ((phraseCount(taste, 'Za stare') >= 2 || (phraseCount(taste, 'Za stare') >= 1 && taste.minYearHint != null)) && taste.minYearHint != null) {
    const nextYear = Math.max(Number(pref.minYear || 1900), taste.minYearHint);
    if (locks.minYear) {
      notes.push(`Klient sygnalizował „za stare” (od ${nextYear}), ale rok budowy jest zablokowany.`);
    } else if (!pref.minYear || nextYear > Number(pref.minYear)) {
      data.minYear = nextYear;
      notes.push(`Podniesiono minimalny rok budowy do ${nextYear} — sygnał „za stare”.`);
    }
  }

  if ((phraseCount(taste, 'Za mało pokoi') >= 2 || (phraseCount(taste, 'Za mało pokoi') >= 1 && taste.minRoomsHint != null)) && taste.minRoomsHint != null) {
    const nextRooms = Math.max(Number(pref.minRooms || 0), taste.minRoomsHint);
    if (locks.minRooms) {
      notes.push(`Klient sygnalizował za mało pokoi (min. ${nextRooms}), ale liczba pokoi jest zablokowana.`);
    } else if (!pref.minRooms || nextRooms > Number(pref.minRooms)) {
      data.minRooms = nextRooms;
      notes.push(`Ustawiono minimum ${nextRooms} pokoi — sygnał „za mało pokoi”.`);
    }
  }

  if (phraseCount(taste, 'Za mały metraż') >= 2 && taste.minAreaHint != null) {
    const nextArea = Math.max(Number(pref.minArea || 0), taste.minAreaHint);
    if (locks.minArea) {
      notes.push(`Klient sygnalizował za mały metraż, ale minArea jest zablokowane.`);
    } else if (!pref.minArea || nextArea > Number(pref.minArea)) {
      data.minArea = nextArea;
      notes.push(`Podniesiono minimalny metraż do ${nextArea} m².`);
    }
  }

  if (phraseCount(taste, 'Za duży metraż') >= 2 && taste.maxAreaHint != null) {
    const nextMax = Math.min(Number(pref.maxArea || 9999), taste.maxAreaHint);
    if (locks.maxArea) {
      notes.push('Klient sygnalizował za duży metraż, ale maxArea jest zablokowane.');
    } else if (!pref.maxArea || nextMax < Number(pref.maxArea)) {
      data.maxArea = nextMax;
      notes.push(`Obniżono maksymalny metraż do ${nextMax} m².`);
    }
  }

  if (phraseCount(taste, 'Za drogo') >= 2 && pref.maxPrice) {
    notes.push(
      locks.maxPrice
        ? 'Klient sygnalizował „za drogo”, ale budżet zostaje — ustawił go agent.'
        : `Klient sygnalizował „za drogo”. Budżet ${Number(pref.maxPrice).toLocaleString('pl-PL')} zł zostaje; mózg tylko unika droższych ofert.`,
    );
  }

  if (phraseCount(taste, 'Nie ta dzielnica') >= 1) {
    const current = parseDistrictList(pref.districts);
    const drop = [...new Set(taste.rejectedDistricts.filter((item) => !taste.likedDistricts.includes(item)))];
    if (locks.districts) {
      if (drop.length) {
        notes.push(
          `Klient odrzuca dzielnic${drop.length === 1 ? 'ę' : 'e'} ${drop.join(', ')}, ale lokalizacja jest zablokowana — ankieta bez zmian.`,
        );
      }
    } else if (current.length && drop.length) {
      const next = current.filter((item) => !drop.includes(item));
      if (next.length >= 1 && next.length < current.length) {
        data.districts = next;
        notes.push(`Usunięto z ankiety dzielnice odrzucone przez klienta: ${drop.filter((item) => current.includes(item)).join(', ')}.`);
      } else if (!next.length) {
        notes.push('Nie usunięto dzielnic — zostałyby puste. Odblokuj lokalizację albo popraw ankietę ręcznie.');
      }
    }
  }

  return { data, notes };
}

export function clientFacingWhyLine(params: {
  reasons: string[];
  city?: string | null;
  district?: string | null;
  calibrating?: boolean;
  prevOffer?: OfferLike | null;
  prevFeedbackRaw?: string | null;
  nextOffer?: OfferLike | null;
  agentFirstName?: string | null;
}): string {
  if (params.prevOffer || params.prevFeedbackRaw || params.nextOffer || params.agentFirstName) {
    // Pełny dialog budowany w clientIntelligenceRun — tu fallback krótki.
  }
  if (params.calibrating) {
    const loc = [params.city, params.district].filter(Boolean).join(', ');
    return loc
      ? `Wysyłam tę nieruchomość z ${loc}, bo najlepiej pasuje do Twojej ankiety — daj znać, czy kierunek jest dobry.`
      : 'Wysyłam tę nieruchomość, bo najlepiej pasuje do Twojej ankiety — daj znać, czy kierunek jest dobry.';
  }

  const mapped = params.reasons
    .map((reason) => {
      if (/balkon/i.test(reason)) return 'Ma balkon, którego wcześniej brakowało.';
      if (/dzielnica .+ już się podobała/i.test(reason)) return reason.replace('już się podobała.', 'którą już zaznaczałeś jako trafioną.');
      if (/paśmie ogłoszeń/i.test(reason)) return 'Cena jest zbliżona do ofert, które już Ci się podobały.';
      if (/pok\./i.test(reason) && /zostawał|może być/i.test(reason)) return 'Ma układ pokoi podobny do tego, który już zostawiałeś.';
      if (/za drogo/i.test(reason)) return null;
      if (/Radar dał|Po nauce|Dotychczasowa|Spośród|parametr był/i.test(reason)) return null;
      return reason;
    })
    .find(Boolean);

  if (mapped) return String(mapped);
  const loc = [params.city, params.district].filter(Boolean).join(', ');
  return loc
    ? `Wybrałem tę nieruchomość z ${loc}, bo najlepiej pasuje do Twoich kryteriów i dotychczasowych reakcji.`
    : 'Wybrałem tę nieruchomość, bo najlepiej pasuje do Twoich kryteriów i dotychczasowych reakcji.';
}

export function parseIntelligencePatch(raw: unknown): Partial<{
  intelligenceEnabled: boolean;
  intelligenceIntervalHours: number;
  intelligenceDailyLimit: number;
  intelligenceMinLearns: number;
  intelligenceMinScore: number;
  intelligenceLockedFields: IntelligenceLocks;
}> | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const out: ReturnType<typeof parseIntelligencePatch> = {};
  if (typeof body.enabled === 'boolean') out!.intelligenceEnabled = body.enabled;
  if (body.intervalHours != null) {
    const n = Math.round(Number(body.intervalHours));
    const snapped = snapToAllowed(n, INTELLIGENCE_INTERVAL_OPTIONS.map((item) => item.value));
    if (snapped != null && n >= 6 && n <= 168) out!.intelligenceIntervalHours = snapped;
  }
  if (body.dailyLimit != null) {
    const n = Math.round(Number(body.dailyLimit));
    const snapped = snapToAllowed(n, INTELLIGENCE_DAILY_LIMIT_OPTIONS.map((item) => item.value));
    if (snapped != null && n >= 1 && n <= 3) out!.intelligenceDailyLimit = snapped;
  }
  if (body.minLearns != null) {
    const n = Math.round(Number(body.minLearns));
    const snapped = snapToAllowed(n, INTELLIGENCE_MIN_LEARNS_OPTIONS.map((item) => item.value));
    if (snapped != null && n >= 1 && n <= 12) out!.intelligenceMinLearns = snapped;
  }
  if (body.minScore != null) {
    const n = Math.round(Number(body.minScore));
    const snapped = snapToAllowed(n, INTELLIGENCE_MIN_SCORE_OPTIONS.map((item) => item.value));
    if (snapped != null && n >= 70 && n <= 100) out!.intelligenceMinScore = snapped;
  }
  if (body.lockedFields !== undefined) {
    out!.intelligenceLockedFields = parseIntelligenceLocks(body.lockedFields, null);
  }
  return Object.keys(out || {}).length ? out : {};
}

export function shapeIntelligenceSettings(
  client: {
    intelligenceEnabled?: boolean | null;
    intelligenceIntervalHours?: number | null;
    intelligenceDailyLimit?: number | null;
    intelligenceMinLearns?: number | null;
    intelligenceMinScore?: number | null;
    intelligenceLastSentAt?: Date | string | null;
    intelligenceLockedFields?: unknown;
  },
  pref?: Parameters<typeof defaultIntelligenceLocks>[0],
): IntelligenceSettings {
  return {
    enabled: Boolean(client.intelligenceEnabled),
    intervalHours:
      snapToAllowed(Number(client.intelligenceIntervalHours || DEFAULT_INTELLIGENCE_SETTINGS.intervalHours), INTELLIGENCE_INTERVAL_OPTIONS.map((item) => item.value)) ||
      DEFAULT_INTELLIGENCE_SETTINGS.intervalHours,
    dailyLimit:
      snapToAllowed(Number(client.intelligenceDailyLimit || DEFAULT_INTELLIGENCE_SETTINGS.dailyLimit), INTELLIGENCE_DAILY_LIMIT_OPTIONS.map((item) => item.value)) ||
      DEFAULT_INTELLIGENCE_SETTINGS.dailyLimit,
    minLearns:
      snapToAllowed(Number(client.intelligenceMinLearns || DEFAULT_INTELLIGENCE_SETTINGS.minLearns), INTELLIGENCE_MIN_LEARNS_OPTIONS.map((item) => item.value)) ||
      DEFAULT_INTELLIGENCE_SETTINGS.minLearns,
    minScore:
      snapToAllowed(Number(client.intelligenceMinScore || DEFAULT_INTELLIGENCE_SETTINGS.minScore), INTELLIGENCE_MIN_SCORE_OPTIONS.map((item) => item.value)) ||
      DEFAULT_INTELLIGENCE_SETTINGS.minScore,
    lastSentAt: client.intelligenceLastSentAt
      ? new Date(client.intelligenceLastSentAt).toISOString()
      : null,
    lockedFields: parseIntelligenceLocks(client.intelligenceLockedFields, pref),
  };
}

export function feedbackHasLearningSignal(feedback: ClientOfferFeedback): boolean {
  return Boolean(feedback.sentiment || feedback.disliked || feedback.liked || feedback.phrases.length || feedback.note);
}

export type IntelligenceLesson = {
  offerId: number;
  title: string;
  when: string | null;
  reaction: "like" | "maybe" | "dislike" | "none";
  reactionLabel: string;
  said: string;
  vsNext: string;
};

export function compareLessonToNext(
  prev: OfferLike,
  feedback: ClientOfferFeedback,
  next: OfferLike | null,
): string {
  if (!next) return "";
  const bits: string[] = [];
  const phrases = new Set(feedback.phrases);
  const note = `${feedback.disliked} ${feedback.note}`.toLowerCase();
  const signals = extractFeedbackSignals(feedback);

  if ((phrases.has("Brak balkonu") || note.includes("balkon")) && next.hasBalcony) {
    bits.push("Ma balkon");
  }
  if ((phrases.has("Brak parkingu") || note.includes("parking")) && next.hasParking) {
    bits.push("Ma parking");
  }
  if ((phrases.has("Brak windy") || note.includes("wind")) && next.hasElevator) {
    bits.push("Ma windę");
  }
  if ((phrases.has("Brak ogrodu") || note.includes("ogród")) && next.hasGarden) {
    bits.push("Ma ogród");
  }
  if (
    (phrases.has("Za drogo") || note.includes("drogo")) &&
    next.price &&
    prev.price &&
    Number(next.price) < Number(prev.price)
  ) {
    bits.push("Taniej");
  }
  if (
    (phrases.has("Nie ta dzielnica") || note.includes("dzielnic")) &&
    next.district &&
    prev.district &&
    String(next.district) !== String(prev.district)
  ) {
    bits.push(`Inna dzielnica (${next.district})`);
  }
  if (phrases.has("Za wysoko albo za nisko") && next.floor != null && String(next.floor) !== String(prev.floor ?? "")) {
    bits.push(`Inne piętro (${next.floor})`);
  }

  const minRoomsSignal = signals.find((s) => s.kind === "minRooms")?.value;
  const minYearSignal = signals.find((s) => s.kind === "minYear")?.value;
  const nextRooms = next.rooms != null ? Number(next.rooms) : null;
  const prevRooms = prev.rooms != null ? Number(prev.rooms) : null;

  if (minRoomsSignal && nextRooms != null && nextRooms >= minRoomsSignal) {
    bits.push(`Co najmniej ${nextRooms} pok. (minimum ${minRoomsSignal})`);
  } else if (nextRooms && prevRooms && nextRooms !== prevRooms) {
    bits.push(`${nextRooms} pok. zamiast ${prevRooms}`);
  }

  const nextYear = next.yearBuilt != null ? Number(next.yearBuilt) : null;
  const prevYear = prev.yearBuilt != null ? Number(prev.yearBuilt) : null;
  if (minYearSignal && nextYear != null && nextYear >= minYearSignal) {
    bits.push(`Budynek z ${nextYear} r. (minimum ${minYearSignal})`);
  } else if (nextYear && prevYear && nextYear !== prevYear) {
    bits.push(`Rok ${nextYear} zamiast ${prevYear}`);
  }

  if (next.area && prev.area && Number(next.area) !== Number(prev.area)) {
    if (phrases.has("Za mały metraż") && Number(next.area) > Number(prev.area)) {
      bits.push(`Większy metraż (${next.area} m²)`);
    } else if (phrases.has("Za duży metraż") && Number(next.area) < Number(prev.area)) {
      bits.push(`Mniejszy metraż (${next.area} m²)`);
    }
  }

  return bits.join(" · ");
}

export function buildIntelligenceLessons(
  rows: Array<{
    offerId: number;
    notifiedAt?: Date | string | null;
    sharedAt?: Date | string | null;
    intelligenceSent?: boolean | null;
    clientFeedback: string | null;
    clientFeedbackAt?: Date | string | null;
    offer?: OfferLike | null;
  }>,
  next: OfferLike | null,
): IntelligenceLesson[] {
  const lessons: IntelligenceLesson[] = [];
  for (const row of rows) {
    const feedback = parseClientOfferFeedback(row.clientFeedback);
    const sent = Boolean(row.notifiedAt || row.sharedAt || row.intelligenceSent);
    if (!sent && !feedbackHasLearningSignal(feedback)) continue;
    const whenRaw = row.clientFeedbackAt || row.notifiedAt || row.sharedAt;
    const whenMs = whenRaw ? new Date(whenRaw).getTime() : 0;
    lessons.push({
      offerId: row.offerId,
      title: String(row.offer?.title || `Oferta #${row.offerId}`),
      when: Number.isFinite(whenMs) && whenMs > 0 ? new Date(whenMs).toISOString() : null,
      reaction: feedback.sentiment || "none",
      reactionLabel: sentimentLabel(feedback.sentiment),
      said: formatClientFeedbackForAgent(row.clientFeedback) || (sent ? "Wysłane, bez reakcji" : "—"),
      vsNext: row.offer ? compareLessonToNext(row.offer, feedback, next) : "",
    });
  }
  lessons.sort((a, b) => {
    const aMs = a.when ? Date.parse(a.when) : 0;
    const bMs = b.when ? Date.parse(b.when) : 0;
    return bMs - aMs;
  });
  return lessons.slice(0, 8);
}
