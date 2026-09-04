import {
  LIKE_PHRASES,
  clientFeedbackHasContent,
  hasUnreadAgentReply,
  parseClientOfferFeedback,
  type ClientOfferSentiment,
} from '@/lib/crm/clientPortalFeedback';

export type PortalBoardMatch = {
  id: number;
  notifiedAt: string | null;
  clientFeedback: string | null;
  clientFeedbackAt: string | null;
  intelligenceSent?: boolean;
  offer: {
    id: number;
    title: string;
    city?: string | null;
    district?: string | null;
  };
};

export type PortalBoardActivity = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  createdAt: string;
  offerId?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type PortalSearchCriteria = {
  location: string;
  areaLabel: string;
  minArea: string;
  maxBudget: string;
  propertyType: string;
  transactionType: string;
  threshold: string;
  districts: string[];
  amenities: string[];
  calibrationMode?: 'MAP' | 'CITY';
  minYear?: number | null;
  minRooms?: number | null;
  maxArea?: number | null;
} | null;

export type OfferStackId = 'new' | 'like' | 'maybe' | 'dislike';

export const OFFER_STACKS: Array<{
  id: OfferStackId;
  title: string;
  hint: string;
  empty: string;
  defaultOpen: boolean;
}> = [
  {
    id: 'new',
    title: 'Nowe do oceny',
    hint: 'Najpierw te — agent i asystent czekają na Twoją decyzję.',
    empty: 'Nie masz teraz nowych propozycji.',
    defaultOpen: true,
  },
  {
    id: 'like',
    title: 'Chcę oglądać',
    hint: 'Miejsca, które chcesz zobaczyć na żywo.',
    empty: 'Tu pojawią się oferty, które oznaczysz jako „Chcę oglądać”.',
    defaultOpen: true,
  },
  {
    id: 'maybe',
    title: 'Do przemyślenia',
    hint: 'Wracasz do nich, gdy porównasz z nowymi.',
    empty: 'Nic nie odłożyłeś do porównania.',
    defaultOpen: false,
  },
  {
    id: 'dislike',
    title: 'Nie pasuje',
    hint: 'Świadomie odłożone — asystent nie proponuje ich ponownie.',
    empty: 'Nie odrzuciłeś jeszcze żadnej oferty.',
    defaultOpen: false,
  },
];

export type PortalOfferStats = {
  sent: number;
  pending: number;
  like: number;
  maybe: number;
  dislike: number;
  reacted: number;
  responsePct: number;
  lastSentAt: string | null;
  lastReactionAt: string | null;
};

export type SearchDirectionChip = { key: string; label: string; value: string };

export type PhraseBar = { phrase: string; count: number; tone: 'like' | 'dislike' };

export type SearchDirection = {
  headline: string;
  summary: string;
  chips: SearchDirectionChip[];
  phraseBars: PhraseBar[];
};

export type PortalTimelineKind =
  | 'offer_sent'
  | 'reaction'
  | 'checkback'
  | 'planned'
  | 'handoff'
  | 'reminder'
  | 'note';

export type PortalTimelineTone = 'new' | 'ok' | 'warn' | 'danger' | 'info';

export type PortalTimelineItem = {
  id: string;
  at: string;
  kind: PortalTimelineKind;
  title: string;
  body: string | null;
  matchId?: number;
  offerId?: number;
  tone: PortalTimelineTone;
};

const CHECKBACK_OPTION_LABELS: Record<string, string> = {
  yes: 'Tak',
  no: 'Nie',
  stay_budget: 'Zostaję przy budżecie',
  raise_budget: 'Podnoszę budżet',
  allow_without_balcony: 'Mogę bez balkonu',
  keep_balcony: 'Balkon obowiązkowy',
};

export function matchSentiment(match: Pick<PortalBoardMatch, 'clientFeedback'>): ClientOfferSentiment | null {
  const feedback = parseClientOfferFeedback(match.clientFeedback);
  if (!clientFeedbackHasContent(feedback)) return null;
  return feedback.sentiment;
}

export function stackIdFromSentiment(sentiment: ClientOfferSentiment | null): OfferStackId {
  if (sentiment === 'like') return 'like';
  if (sentiment === 'maybe') return 'maybe';
  if (sentiment === 'dislike') return 'dislike';
  return 'new';
}

export function matchStackId(match: Pick<PortalBoardMatch, 'clientFeedback'>): OfferStackId {
  return stackIdFromSentiment(matchSentiment(match));
}

export function sortMatchesNewest<T extends Pick<PortalBoardMatch, 'notifiedAt' | 'id'>>(matches: T[]): T[] {
  return [...matches].sort((a, b) => {
    const byDate = String(b.notifiedAt || '').localeCompare(String(a.notifiedAt || ''));
    if (byDate) return byDate;
    return b.id - a.id;
  });
}

export function groupPortalOfferStacks<T extends PortalBoardMatch>(matches: T[]): Record<OfferStackId, T[]> {
  const grouped: Record<OfferStackId, T[]> = { new: [], like: [], maybe: [], dislike: [] };
  for (const match of sortMatchesNewest(matches)) {
    grouped[matchStackId(match)].push(match);
  }
  return grouped;
}

export function computePortalOfferStats(matches: PortalBoardMatch[]): PortalOfferStats {
  const stacks = groupPortalOfferStacks(matches);
  const sent = matches.length;
  const pending = stacks.new.length;
  const like = stacks.like.length;
  const maybe = stacks.maybe.length;
  const dislike = stacks.dislike.length;
  const reacted = like + maybe + dislike;
  const lastSentAt = sortMatchesNewest(matches)[0]?.notifiedAt || null;
  const lastReactionAt =
    matches
      .map((match) => match.clientFeedbackAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => b.localeCompare(a))[0] || null;
  return {
    sent,
    pending,
    like,
    maybe,
    dislike,
    reacted,
    responsePct: sent ? Math.round((reacted / sent) * 100) : 0,
    lastSentAt,
    lastReactionAt,
  };
}

export function phraseBarsFromMatches(matches: PortalBoardMatch[], limit = 5): PhraseBar[] {
  const counts = new Map<string, PhraseBar>();
  for (const match of matches) {
    const feedback = parseClientOfferFeedback(match.clientFeedback);
    if (!clientFeedbackHasContent(feedback)) continue;
    for (const phrase of feedback.phrases) {
      const tone: PhraseBar['tone'] = (LIKE_PHRASES as readonly string[]).includes(phrase) ? 'like' : 'dislike';
      const current = counts.get(phrase);
      if (current) current.count += 1;
      else counts.set(phrase, { phrase, count: 1, tone });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase, 'pl')).slice(0, limit);
}

export function defaultOpenStacks(stats: PortalOfferStats): OfferStackId[] {
  const open: OfferStackId[] = [];
  if (stats.pending > 0) open.push('new');
  if (stats.like > 0) open.push('like');
  if (stats.pending === 0 && stats.like === 0 && stats.maybe > 0) open.push('maybe');
  if (stats.sent > 0 && stats.pending === 0 && stats.like === 0 && stats.maybe === 0 && stats.dislike > 0) {
    open.push('dislike');
  }
  if (!open.length && stats.sent > 0) open.push('new');
  return open;
}

export function buildSearchDirection(
  criteria: PortalSearchCriteria,
  matches: PortalBoardMatch[],
): SearchDirection {
  const chips: SearchDirectionChip[] = [];
  if (criteria) {
    if (criteria.location) chips.push({ key: 'location', label: 'Lokalizacja', value: criteria.location });
    if (criteria.maxBudget && criteria.maxBudget !== 'Bez limitu') {
      chips.push({ key: 'budget', label: 'Budżet', value: criteria.maxBudget });
    }
    if (criteria.minRooms && criteria.minRooms > 0) {
      chips.push({
        key: 'rooms',
        label: 'Pokoje',
        value: `min. ${criteria.minRooms}`,
      });
    }
    if (criteria.minYear && criteria.minYear > 1900) {
      chips.push({ key: 'year', label: 'Rok budowy', value: `od ${criteria.minYear}` });
    }
    const area = criteria.areaLabel || criteria.minArea;
    if (area && area !== 'Dowolny metraż') {
      chips.push({ key: 'area', label: 'Metraż', value: area });
    }
    if (criteria.propertyType && criteria.propertyType !== 'Wszystkie') {
      const tx = criteria.transactionType && criteria.transactionType !== '—' ? `${criteria.transactionType} · ` : '';
      chips.push({ key: 'type', label: 'Typ', value: `${tx}${criteria.propertyType}` });
    }
    for (const amenity of criteria.amenities || []) {
      chips.push({ key: `amenity-${amenity}`, label: 'Musi być', value: amenity });
    }
  }

  const phraseBars = phraseBarsFromMatches(matches);
  const summary = chips.map((chip) => chip.value).join(' · ');

  return {
    headline: 'Asystent szuka teraz',
    summary:
      summary ||
      'Oceń kilka ofert — tu pojawi się, czego szukamy coraz precyzyjniej.',
    chips,
    phraseBars,
  };
}

function checkbackOptionLabel(optionId: string | null | undefined): string | null {
  if (!optionId) return null;
  return CHECKBACK_OPTION_LABELS[optionId] || optionId.replace(/_/g, ' ');
}

function reactionTitle(sentiment: ClientOfferSentiment | null, offerTitle: string): string {
  if (sentiment === 'like') return `Chcesz oglądać: ${offerTitle}`;
  if (sentiment === 'maybe') return `Do przemyślenia: ${offerTitle}`;
  if (sentiment === 'dislike') return `Nie pasuje: ${offerTitle}`;
  return `Reakcja: ${offerTitle}`;
}

function reactionTone(sentiment: ClientOfferSentiment | null): PortalTimelineTone {
  if (sentiment === 'like') return 'ok';
  if (sentiment === 'maybe') return 'warn';
  if (sentiment === 'dislike') return 'danger';
  return 'info';
}

export function buildPortalTimeline(
  matches: PortalBoardMatch[],
  activities: PortalBoardActivity[],
): PortalTimelineItem[] {
  const items: PortalTimelineItem[] = [];
  const matchByOfferId = new Map(matches.map((match) => [match.offer.id, match]));

  for (const match of matches) {
    if (match.notifiedAt) {
      items.push({
        id: `sent-${match.id}`,
        at: match.notifiedAt,
        kind: 'offer_sent',
        title: match.intelligenceSent ? `Asystent wysłał: ${match.offer.title}` : `Agent wysłał: ${match.offer.title}`,
        body: [match.offer.city, match.offer.district].filter(Boolean).join(' · ') || null,
        matchId: match.id,
        offerId: match.offer.id,
        tone: 'new',
      });
    }
    const feedback = parseClientOfferFeedback(match.clientFeedback);
    if (match.clientFeedbackAt && clientFeedbackHasContent(feedback)) {
      items.push({
        id: `react-${match.id}`,
        at: match.clientFeedbackAt,
        kind: 'reaction',
        title: reactionTitle(feedback.sentiment, match.offer.title),
        body: [feedback.phrases.slice(0, 3).join(' · '), feedback.note].filter(Boolean).join(' — ') || null,
        matchId: match.id,
        offerId: match.offer.id,
        tone: reactionTone(feedback.sentiment),
      });
    }
  }

  for (const activity of activities) {
    const meta = activity.metadata && typeof activity.metadata === 'object' ? activity.metadata : {};
    const offerId = Number(activity.offerId || 0) || undefined;
    const match = offerId ? matchByOfferId.get(offerId) : undefined;

    if (activity.kind === 'INTELLIGENCE_OFFER' || activity.kind === 'CLIENT_NOTIFIED' || activity.kind === 'OFFER_SHARED') {
      continue;
    }
    if (activity.kind === 'CLIENT_FEEDBACK') {
      continue;
    }

    if (activity.kind === 'INTELLIGENCE_CHECKBACK') {
      const status = String(meta.status || '');
      const option = checkbackOptionLabel(typeof meta.optionId === 'string' ? meta.optionId : null);
      const pending = status === 'pending' || !status;
      items.push({
        id: `act-${activity.id}`,
        at: typeof meta.respondedAt === 'string' ? meta.respondedAt : activity.createdAt,
        kind: 'checkback',
        title: pending ? 'Asystent zapytał o preferencje' : option ? `Odpowiedź: ${option}` : 'Potwierdziłeś preferencję',
        body: activity.body,
        tone: pending ? 'warn' : status === 'rejected' ? 'danger' : 'ok',
      });
      continue;
    }

    if (activity.kind === 'INTELLIGENCE_PLANNED') {
      items.push({
        id: `act-${activity.id}`,
        at: activity.createdAt,
        kind: 'planned',
        title: activity.title || 'Asystent planuje kolejną propozycję',
        body: activity.body,
        tone: 'info',
      });
      continue;
    }

    if (activity.kind === 'INTELLIGENCE_HANDOFF') {
      items.push({
        id: `act-${activity.id}`,
        at: activity.createdAt,
        kind: 'handoff',
        title: activity.title || 'Agent przejmuje temat',
        body: activity.body,
        tone: 'warn',
      });
      continue;
    }

    if (activity.kind === 'FEEDBACK_REMINDER') {
      items.push({
        id: `act-${activity.id}`,
        at: activity.createdAt,
        kind: 'reminder',
        title: activity.title || 'Przypomnienie o ocenie oferty',
        body: activity.body,
        matchId: match?.id,
        offerId,
        tone: 'info',
      });
    }
  }

  return items.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

export function formatPortalWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function initialOpenMatchIds(params: {
  matches: PortalBoardMatch[];
  storedIds: number[];
  focusMatchId?: number;
  focusOfferId?: number;
}): number[] {
  const known = new Set(params.matches.map((match) => match.id));
  const next = new Set(params.storedIds.filter((id) => known.has(id)));
  const focused = params.matches.find(
    (match) => match.id === params.focusMatchId || match.offer.id === params.focusOfferId,
  );
  if (focused) next.add(focused.id);
  else if (!params.storedIds.length) {
    const pending = sortMatchesNewest(params.matches.filter((match) => matchStackId(match) === 'new'))[0];
    if (pending) next.add(pending.id);
  }
  for (const match of params.matches) {
    if (hasUnreadAgentReply(parseClientOfferFeedback(match.clientFeedback))) next.add(match.id);
  }
  return [...next];
}

export type AssistantPulseMode = 'waiting_checkback' | 'waiting_reaction' | 'preparing' | 'watching';

export type AssistantPulse = {
  mode: AssistantPulseMode;
  badge: string;
  title: string;
  body: string;
  activity: string | null;
  cta: string | null;
  busy: boolean;
};

export function polishPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (abs === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function resolveAssistantPulse(input: {
  intelligenceEnabled: boolean;
  pendingNewCount: number;
  unscoredCount: number;
  pendingCheckback: boolean;
}): AssistantPulse | null {
  const pending = Math.max(0, input.pendingNewCount);
  const queued = Math.max(0, input.unscoredCount);

  if (input.pendingCheckback) {
    return {
      mode: 'waiting_checkback',
      badge: 'Pytanie otwarte',
      title: 'Asystent czeka na Twoją odpowiedź powyżej',
      body: 'Dopóki nie wybierzesz, kolejna oferta nie pójdzie — asystent nie zgaduje za Ciebie.',
      activity: 'Panel na żywo · nic nie umknie',
      cta: null,
      busy: false,
    };
  }

  if (pending > 0) {
    const pendingLabel = `${pending} ${polishPlural(pending, 'nową ofertę', 'nowe oferty', 'nowych ofert')}`;
    const queuedLine =
      queued > 0
        ? ` W tle trzymamy jeszcze ${queued} ${polishPlural(queued, 'dopasowanie', 'dopasowania', 'dopasowań')} — nie pokażemy ich, zanim nie ocenisz tego, co już dostałeś.`
        : ' Kolejną kartę wyśle, gdy będzie miał na czym oprzeć wybór.';
    return {
      mode: 'waiting_reaction',
      badge: 'Czeka na Ciebie',
      title: 'Najpierw oceń to, co już dostałeś',
      body: `Masz ${pendingLabel} do decyzji. Asystent jest włączony i uczy się z Twoich reakcji.${queuedLine}`,
      activity: 'Czuwa · nie szuka na ślepo kolejnej karty',
      cta: 'Przejdź do nowych ofert',
      busy: false,
    };
  }

  if (queued > 0) {
    return {
      mode: 'preparing',
      badge: 'Dobiera ofertę',
      title: 'Szykujemy następną propozycję',
      body: `W tle jest ${queued} ${polishPlural(queued, 'dopasowanie', 'dopasowania', 'dopasowań')}. Karta pojawi się tutaj, gdy asystent wybierze jedną pewną — nie losową.`,
      activity: null,
      cta: null,
      busy: true,
    };
  }

  if (input.intelligenceEnabled) {
    return {
      mode: 'watching',
      badge: 'Czuwa',
      title: 'Rynek jest pod obserwacją',
      body: 'Nie ma teraz nowej karty w kolejce. Asystent wróci, gdy pojawi się coś pewnego względem Twoich kryteriów.',
      activity: 'Czuwa nad rynkiem · panel na żywo',
      cta: null,
      busy: false,
    };
  }

  return null;
}
