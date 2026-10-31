import {
  clientFeedbackHasContent,
  hasUnreadAgentReply,
  parseClientOfferFeedback,
  type ClientOfferSentiment,
} from '@/lib/crm/clientPortalFeedback';
import { PORTAL_TR_PL, type PortalTr } from '@/i18n/portal/translate';

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

export type PortalTimelineKind =
  | 'offer_sent'
  | 'reaction'
  | 'checkback'
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

function checkbackOptionLabel(optionId: string | null | undefined, tr: PortalTr): string | null {
  if (!optionId) return null;
  const label = CHECKBACK_OPTION_LABELS[optionId];
  return label ? tr.t(label) : optionId.replace(/_/g, ' ');
}

function reactionTitle(sentiment: ClientOfferSentiment | null, offerTitle: string, tr: PortalTr): string {
  const label =
    sentiment === 'like' ? 'Chcesz oglądać' : sentiment === 'maybe' ? 'Do przemyślenia' : sentiment === 'dislike' ? 'Nie pasuje' : 'Reakcja';
  return `${tr.t(label)}: ${offerTitle}`;
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
  tr: PortalTr = PORTAL_TR_PL,
): PortalTimelineItem[] {
  const { t } = tr;
  const items: PortalTimelineItem[] = [];

  for (const match of matches) {
    if (match.notifiedAt) {
      items.push({
        id: `sent-${match.id}`,
        at: match.notifiedAt,
        kind: 'offer_sent',
        title: `${t('Nowa propozycja')}: ${match.offer.title}`,
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
        title: reactionTitle(feedback.sentiment, match.offer.title, tr),
        body: [feedback.phrases.slice(0, 3).join(' · '), feedback.note].filter(Boolean).join(' — ') || null,
        matchId: match.id,
        offerId: match.offer.id,
        tone: reactionTone(feedback.sentiment),
      });
    }
  }

  for (const activity of activities) {
    const meta = activity.metadata && typeof activity.metadata === 'object' ? activity.metadata : {};

    if (activity.kind === 'INTELLIGENCE_OFFER' || activity.kind === 'CLIENT_NOTIFIED' || activity.kind === 'OFFER_SHARED') {
      continue;
    }
    if (activity.kind === 'CLIENT_FEEDBACK') {
      continue;
    }

    if (activity.kind === 'INTELLIGENCE_CHECKBACK') {
      const status = String(meta.status || '');
      const option = checkbackOptionLabel(typeof meta.optionId === 'string' ? meta.optionId : null, tr);
      const pending = status === 'pending' || !status;
      items.push({
        id: `act-${activity.id}`,
        at: typeof meta.respondedAt === 'string' ? meta.respondedAt : activity.createdAt,
        kind: 'checkback',
        title: pending ? t('Asystent zapytał o preferencje') : option ? `${t('Odpowiedź')}: ${option}` : t('Potwierdziłeś preferencję'),
        body: activity.body,
        tone: pending ? 'warn' : status === 'rejected' ? 'danger' : 'ok',
      });
      continue;
    }
  }

  return items.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

export function formatPortalWhen(iso: string | null | undefined, dateLocale = 'pl-PL'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(dateLocale, {
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

export function resolveAssistantPulse(
  input: {
    intelligenceEnabled: boolean;
    pendingNewCount: number;
    unscoredCount: number;
    pendingCheckback: boolean;
  },
  tr: PortalTr = PORTAL_TR_PL,
): AssistantPulse | null {
  const { t, p } = tr;
  const pending = Math.max(0, input.pendingNewCount);
  const queued = Math.max(0, input.unscoredCount);

  if (input.pendingCheckback && input.intelligenceEnabled) {
    return {
      mode: 'waiting_checkback',
      badge: t('Pytanie otwarte'),
      title: t('Asystent czeka na Twoją odpowiedź powyżej'),
      body: t('Wybierz jedną opcję — dopiero wtedy przyjdzie kolejna oferta.'),
      activity: null,
      cta: null,
      busy: false,
    };
  }

  if (pending > 0) {
    const pendingLabel = `${pending} ${p(pending, 'nową ofertę|nowe oferty|nowych ofert')}`;
    return {
      mode: 'waiting_reaction',
      badge: input.intelligenceEnabled ? t('Czeka na Ciebie') : t('Od agenta'),
      title: input.intelligenceEnabled
        ? t('Najpierw oceń to, co już dostałeś')
        : pending === 1
          ? t('Agent wysłał ofertę')
          : t('Agent wysłał oferty'),
      body: t('Masz {offers} do decyzji. Agent zobaczy Twoją ocenę od razu.', { offers: pendingLabel }),
      activity: null,
      cta: t('Przejdź do ofert'),
      busy: false,
    };
  }

  if (queued > 0 && input.intelligenceEnabled) {
    return {
      mode: 'preparing',
      badge: t('Dobiera ofertę'),
      title: t('Szykujemy następną propozycję'),
      body: t('W tle jest {n} {matches}. Pokażemy tę, która naprawdę pasuje.', {
        n: queued,
        matches: p(queued, 'dopasowanie|dopasowania|dopasowań'),
      }),
      activity: null,
      cta: null,
      busy: true,
    };
  }

  if (input.intelligenceEnabled) {
    return {
      mode: 'watching',
      badge: t('Czuwa'),
      title: t('Rynek jest pod obserwacją'),
      body: t('Gdy pojawi się coś pewnego względem Twoich kryteriów, zobaczysz to tutaj.'),
      activity: null,
      cta: null,
      busy: false,
    };
  }

  return null;
}
