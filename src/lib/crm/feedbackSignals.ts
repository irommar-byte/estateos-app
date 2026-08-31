import type { ClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { DISLIKE_PHRASES } from '@/lib/crm/clientPortalFeedback';

export type FeedbackSignalKind =
  | 'minYear'
  | 'minRooms'
  | 'maxArea'
  | 'minArea'
  | 'requireBalcony'
  | 'requireParking'
  | 'requireElevator'
  | 'requireGarden'
  | 'rejectDistrict'
  | 'avoidExpensive'
  | 'softText';

export type FeedbackSignal = {
  kind: FeedbackSignalKind;
  phrase?: string;
  value?: number;
  text?: string;
  source: 'phrase' | 'disliked' | 'note';
};

const YEAR_FROM_RE = /\b(?:od|od\s+r\.?|min\.?|nie\s+starsz\w*|tylko)\s*(19\d{2}|20\d{2})\b/i;
const YEAR_BARE_RE = /\b(19[89]\d|20[0-2]\d)\b/;
const ROOMS_MIN_RE =
  /\b(?:co\s+najmniej|conajmniej|min\.?|minimum|przynajmniej)\s*(\d)\s*(?:pok(?:oj(?:e|ow\w*|owy)?)?|p\.?\b)/i;
const ROOMS_MIN_ALT_RE = /\b(\d)\s*[-–]?\s*pok(?:oj(?:e|ow\w*|owy)?)?\b/i;
const AREA_MAX_RE = /\b(?:max\.?|do|maks\.?)\s*(\d{2,3})\s*m/i;
const AREA_MIN_RE = /\b(?:min\.?|co\s+najmniej|od)\s*(\d{2,3})\s*m/i;

const STALE_WORDS = /\b(?:za\s+star\w*|stare\s+budownictwo|stary\s+budynek)\b/i;
const FEW_ROOMS_WORDS = /\b(?:za\s+ma[łl]o\s+pokoj\w*|kawalerk\w*\s+nie|same\s+kawalerk\w*)\b/i;

export function feedbackBlob(feedback: ClientOfferFeedback): string {
  return [feedback.disliked, feedback.note, feedback.liked, ...feedback.phrases].filter(Boolean).join(' ');
}

export function parseMinYearFromText(text: string): number | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const from = normalized.match(YEAR_FROM_RE);
  if (from) {
    const year = Number(from[1]);
    return Number.isFinite(year) && year >= 1950 && year <= 2035 ? year : null;
  }
  if (STALE_WORDS.test(normalized)) {
    const bare = normalized.match(YEAR_BARE_RE);
    if (bare) {
      const year = Number(bare[1]);
      return Number.isFinite(year) ? year : null;
    }
    return 2000;
  }
  return null;
}

export function parseMinRoomsFromText(text: string): number | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const direct = normalized.match(ROOMS_MIN_RE);
  if (direct) {
    const rooms = Number(direct[1]);
    return Number.isFinite(rooms) && rooms >= 1 && rooms <= 8 ? rooms : null;
  }
  if (FEW_ROOMS_WORDS.test(normalized)) {
    const alt = normalized.match(ROOMS_MIN_ALT_RE);
    if (alt) {
      const rooms = Number(alt[1]);
      return Number.isFinite(rooms) && rooms >= 2 ? rooms : 2;
    }
    return 2;
  }
  const altOnly = normalized.match(ROOMS_MIN_ALT_RE);
  if (altOnly && /pok/i.test(normalized)) {
    const rooms = Number(altOnly[1]);
    return Number.isFinite(rooms) && rooms >= 1 && rooms <= 8 ? rooms : null;
  }
  return null;
}

export function parseMaxAreaFromText(text: string): number | null {
  const match = text.match(AREA_MAX_RE);
  if (!match) return null;
  const area = Number(match[1]);
  return Number.isFinite(area) && area >= 15 ? area : null;
}

export function parseMinAreaFromText(text: string): number | null {
  const match = text.match(AREA_MIN_RE);
  if (!match) return null;
  const area = Number(match[1]);
  return Number.isFinite(area) && area >= 15 ? area : null;
}

const PHRASE_TO_SIGNAL: Record<string, FeedbackSignalKind> = {
  'Za stare': 'minYear',
  'Za mało pokoi': 'minRooms',
  'Brak parkingu': 'requireParking',
  'Brak windy': 'requireElevator',
  'Brak ogrodu': 'requireGarden',
  'Brak balkonu': 'requireBalcony',
  'Za mały metraż': 'minArea',
  'Za duży metraż': 'maxArea',
  'Za drogo': 'avoidExpensive',
  'Nie ta dzielnica': 'rejectDistrict',
};

export function extractFeedbackSignals(feedback: ClientOfferFeedback): FeedbackSignal[] {
  const out: FeedbackSignal[] = [];
  const blob = feedbackBlob(feedback);

  for (const phrase of feedback.phrases) {
    const kind = PHRASE_TO_SIGNAL[phrase];
    if (!kind) continue;
    const signal: FeedbackSignal = { kind, phrase, source: 'phrase' };
    if (kind === 'minYear') signal.value = parseMinYearFromText(blob) ?? 2000;
    if (kind === 'minRooms') signal.value = parseMinRoomsFromText(blob) ?? 2;
    out.push(signal);
  }

  for (const field of ['disliked', 'note'] as const) {
    const text = feedback[field].trim();
    if (!text) continue;
    const minYear = parseMinYearFromText(text);
    if (minYear != null && !out.some((s) => s.kind === 'minYear')) {
      out.push({ kind: 'minYear', value: minYear, text, source: field });
    }
    const minRooms = parseMinRoomsFromText(text);
    if (minRooms != null && !out.some((s) => s.kind === 'minRooms')) {
      out.push({ kind: 'minRooms', value: minRooms, text, source: field });
    }
    const maxArea = parseMaxAreaFromText(text);
    if (maxArea != null && !out.some((s) => s.kind === 'maxArea')) {
      out.push({ kind: 'maxArea', value: maxArea, text, source: field });
    }
    const minArea = parseMinAreaFromText(text);
    if (minArea != null && !out.some((s) => s.kind === 'minArea')) {
      out.push({ kind: 'minArea', value: minArea, text, source: field });
    }
  }

  return out;
}

export function phraseToCheckbackType(phrase: string): string {
  return `confirm_${phrase.replace(/\s+/g, '_').toLowerCase()}`;
}

export function isStructuralDislikePhrase(phrase: string): boolean {
  return (DISLIKE_PHRASES as readonly string[]).includes(phrase) && Boolean(PHRASE_TO_SIGNAL[phrase]);
}
