import { parseClientOfferFeedback, type ClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { plainOfferDescription } from '@/lib/offerDescriptionHtml';

export type IntelligenceSettings = {
  enabled: boolean;
  intervalHours: number;
  dailyLimit: number;
  minLearns: number;
  minScore: number;
  lastSentAt: string | null;
};

export const DEFAULT_INTELLIGENCE_SETTINGS: IntelligenceSettings = {
  enabled: false,
  intervalHours: 24,
  dailyLimit: 1,
  minLearns: 3,
  minScore: 92,
  lastSentAt: null,
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
  likedText: string[];
  dislikedText: string[];
  notes: string[];
  rejectedOfferIds: number[];
  likedDistricts: string[];
  rejectedDistricts: string[];
};

const PHRASE_NEEDLES: Record<string, string[]> = {
  'Za mała kuchnia': ['mała kuchnia', 'aneks kuchenny', 'kuchnia 4', 'kuchnia 5', 'kuchnia 6 m', 'ciasna kuchnia'],
  'Brak balkonu': ['bez balkonu', 'brak balkonu'],
  'Za drogo': [],
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

const NO_BALCONY = /bez balkonu|brak balkonu|bez loggii|brak loggii/;
const HAS_BALCONY = /balkon|loggi/;

export function descriptionImpliesBalcony(text: string): boolean {
  const hay = String(text || '').toLowerCase();
  if (!hay.trim()) return false;
  if (NO_BALCONY.test(hay)) return false;
  return HAS_BALCONY.test(hay);
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

export function learnFromFeedback(
  rows: Array<{ offerId: number; clientFeedback: string | null; offer?: OfferLike | null }>,
): LearnedTaste {
  const taste: LearnedTaste = {
    learnCount: 0,
    likes: 0,
    maybes: 0,
    dislikes: 0,
    phrases: [],
    likedText: [],
    dislikedText: [],
    notes: [],
    rejectedOfferIds: [],
    likedDistricts: [],
    rejectedDistricts: [],
  };

  for (const row of rows) {
    const feedback = parseClientOfferFeedback(row.clientFeedback);
    if (!feedback.sentiment && !feedback.disliked && !feedback.liked && !feedback.phrases.length && !feedback.note) {
      continue;
    }
    taste.learnCount += 1;
    if (feedback.sentiment === 'like') taste.likes += 1;
    if (feedback.sentiment === 'maybe') taste.maybes += 1;
    if (feedback.sentiment === 'dislike') {
      taste.dislikes += 1;
      taste.rejectedOfferIds.push(row.offerId);
      if (row.offer?.district) taste.rejectedDistricts.push(String(row.offer.district));
    }
    if (feedback.sentiment === 'like' && row.offer?.district) {
      taste.likedDistricts.push(String(row.offer.district));
    }
    taste.phrases.push(...feedback.phrases);
    if (feedback.liked) taste.likedText.push(feedback.liked);
    if (feedback.disliked) taste.dislikedText.push(feedback.disliked);
    if (feedback.note) taste.notes.push(feedback.note);
  }

  return taste;
}

export function intelligenceAdjustScore(params: {
  radarScore: number;
  offer: OfferLike;
  taste: LearnedTaste;
  maxPrice?: number | null;
}): { score: number; reasons: string[] } {
  const { offer, taste, maxPrice } = params;
  let score = params.radarScore;
  const reasons: string[] = [];
  const text = haystack(offer);
  const phraseCounts = new Map<string, number>();
  for (const phrase of taste.phrases) {
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
  }

  const balconyFromDescription = descriptionImpliesBalcony(text);
  const hasBalcony = offer.hasBalcony === true || balconyFromDescription;
  if (offer.hasBalcony !== true && balconyFromDescription) {
    reasons.push('W opisie jest balkon albo loggia, choć parametr był odznaczony — zaznaczam balkon w ofercie.');
  }
  if (phraseCounts.get('Brak balkonu') && !hasBalcony) {
    score -= 18;
    reasons.push('Klientka odrzucała mieszkania bez balkonu.');
  } else if (phraseCounts.get('Brak balkonu') && hasBalcony) {
    score += 6;
    reasons.push('Ma balkon / loggię — tego wcześniej brakowało.');
  }

  if (phraseCounts.get('Za drogo') && maxPrice && Number(offer.price) > maxPrice * 0.92) {
    score -= 16;
    reasons.push('Cena jest blisko lub powyżej budżetu, a klientka sygnalizowała „za drogo”.');
  }

  for (const [phrase, count] of phraseCounts) {
    const needles = PHRASE_NEEDLES[phrase] || [];
    if (!needles.length) continue;
    const hit = includesAny(text, needles);
    if (hit && count > 0) {
      const negative = phrase.startsWith('Za ') || phrase.startsWith('Brak') || phrase.startsWith('Nie ') || phrase.startsWith('Słabe') || phrase.startsWith('Hałas');
      const delta = negative ? -12 * Math.min(2, count) : 8 * Math.min(2, count);
      score += delta;
      if (delta < 0) reasons.push(`Opis zderza się z obiekcją „${phrase}”.`);
      else reasons.push(`Opis wspiera to, co zostawało: „${phrase}”.`);
    }
  }

  const dislikedBlob = [...taste.dislikedText, ...taste.notes].join(' ').toLowerCase();
  if (dislikedBlob) {
    for (const token of dislikedBlob
      .split(/[\s,.;:!?/]+/)
      .filter((item) => item.length >= 6 && !FEEDBACK_STOPWORDS.has(item))
      .slice(0, 12)) {
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
  const objections = [...new Set(taste.phrases.filter((item) => PHRASE_NEEDLES[item]?.length !== undefined && (item.startsWith('Za') || item.startsWith('Brak') || item.startsWith('Nie') || item.startsWith('Słabe') || item.startsWith('Hałas'))))];
  if (objections.length) bits.push(`obiekcje: ${objections.join(', ')}`);
  if (taste.dislikedText.length) bits.push(`uwagi: ${taste.dislikedText.slice(0, 2).join('; ')}`);
  return bits.join(' · ');
}

export function parseIntelligencePatch(raw: unknown): Partial<{
  intelligenceEnabled: boolean;
  intelligenceIntervalHours: number;
  intelligenceDailyLimit: number;
  intelligenceMinLearns: number;
  intelligenceMinScore: number;
}> | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const out: ReturnType<typeof parseIntelligencePatch> = {};
  if (typeof body.enabled === 'boolean') out!.intelligenceEnabled = body.enabled;
  if (body.intervalHours != null) {
    const n = Math.round(Number(body.intervalHours));
    if (Number.isFinite(n) && n >= 6 && n <= 168) out!.intelligenceIntervalHours = n;
  }
  if (body.dailyLimit != null) {
    const n = Math.round(Number(body.dailyLimit));
    if (Number.isFinite(n) && n >= 1 && n <= 3) out!.intelligenceDailyLimit = n;
  }
  if (body.minLearns != null) {
    const n = Math.round(Number(body.minLearns));
    if (Number.isFinite(n) && n >= 1 && n <= 12) out!.intelligenceMinLearns = n;
  }
  if (body.minScore != null) {
    const n = Math.round(Number(body.minScore));
    if (Number.isFinite(n) && n >= 70 && n <= 100) out!.intelligenceMinScore = n;
  }
  return Object.keys(out || {}).length ? out : {};
}

export function shapeIntelligenceSettings(client: {
  intelligenceEnabled?: boolean | null;
  intelligenceIntervalHours?: number | null;
  intelligenceDailyLimit?: number | null;
  intelligenceMinLearns?: number | null;
  intelligenceMinScore?: number | null;
  intelligenceLastSentAt?: Date | string | null;
}): IntelligenceSettings {
  return {
    enabled: Boolean(client.intelligenceEnabled),
    intervalHours: client.intelligenceIntervalHours || DEFAULT_INTELLIGENCE_SETTINGS.intervalHours,
    dailyLimit: client.intelligenceDailyLimit || DEFAULT_INTELLIGENCE_SETTINGS.dailyLimit,
    minLearns: client.intelligenceMinLearns || DEFAULT_INTELLIGENCE_SETTINGS.minLearns,
    minScore: client.intelligenceMinScore || DEFAULT_INTELLIGENCE_SETTINGS.minScore,
    lastSentAt: client.intelligenceLastSentAt
      ? new Date(client.intelligenceLastSentAt).toISOString()
      : null,
  };
}

export function feedbackHasLearningSignal(feedback: ClientOfferFeedback): boolean {
  return Boolean(feedback.sentiment || feedback.disliked || feedback.liked || feedback.phrases.length || feedback.note);
}
