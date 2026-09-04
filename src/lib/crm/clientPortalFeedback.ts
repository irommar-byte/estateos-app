export type ClientOfferSentiment = 'like' | 'maybe' | 'dislike';

export type ClientOfferFeedback = {
  sentiment: ClientOfferSentiment | null;
  liked: string;
  disliked: string;
  phrases: string[];
  note: string;
  agentReply?: string | null;
  agentReplyAt?: string | null;
  agentReplyReadAt?: string | null;
};

export const LIKE_PHRASES = [
  'Świetna lokalizacja',
  'Podoba mi się układ',
  'Ładna okolica',
  'Dobry metraż',
  'Pasuje do budżetu',
  'Jasne mieszkanie',
] as const;

export const DISLIKE_PHRASES = [
  'Za mała kuchnia',
  'Brak balkonu',
  'Brak parkingu',
  'Brak windy',
  'Brak ogrodu',
  'Za drogo',
  'Za stare',
  'Za mało pokoi',
  'Za mały metraż',
  'Za duży metraż',
  'Hałas / ruchliwa ulica',
  'Nie ta dzielnica',
  'Słabe doświetlenie',
  'Za wysoko albo za nisko',
] as const;

const SENTIMENTS = new Set<ClientOfferSentiment>(['like', 'maybe', 'dislike']);

export function emptyClientOfferFeedback(): ClientOfferFeedback {
  return { sentiment: null, liked: '', disliked: '', phrases: [], note: '' };
}

const LIKE_PHRASE_SET = new Set<string>(LIKE_PHRASES);
const DISLIKE_PHRASE_SET = new Set<string>(DISLIKE_PHRASES);

export function splitFeedbackPhrases(phrases: string[]): { likedPhrases: string[]; dislikedPhrases: string[] } {
  const likedPhrases: string[] = [];
  const dislikedPhrases: string[] = [];
  for (const phrase of phrases) {
    if (LIKE_PHRASE_SET.has(phrase)) likedPhrases.push(phrase);
    else if (DISLIKE_PHRASE_SET.has(phrase)) dislikedPhrases.push(phrase);
  }
  return { likedPhrases, dislikedPhrases };
}

export function mergeFeedbackPhrases(likedPhrases: string[], dislikedPhrases: string[]): string[] {
  return [...likedPhrases, ...dislikedPhrases];
}

export function parseClientOfferFeedback(raw: unknown): ClientOfferFeedback {
  if (!raw) return emptyClientOfferFeedback();
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return emptyClientOfferFeedback();
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed.sentiment ||
          parsed.note ||
          parsed.liked ||
          parsed.disliked ||
          parsed.agentReply ||
          parsed.feedback ||
          parsed.phrases)
      ) {
        return normalizeFeedbackObject(parsed);
      }
    } catch {
      /* plain note from older portal */
    }
    return { ...emptyClientOfferFeedback(), note: trimmed };
  }
  if (typeof raw === 'object') return normalizeFeedbackObject(raw as Record<string, unknown>);
  return emptyClientOfferFeedback();
}

function normalizeFeedbackObject(raw: Record<string, unknown>): ClientOfferFeedback {
  const sentimentRaw = String(raw.sentiment || '').toLowerCase();
  const phrases = Array.isArray(raw.phrases)
    ? raw.phrases.map((item) => String(item).trim()).filter(Boolean)
    : [];
  return {
    sentiment: SENTIMENTS.has(sentimentRaw as ClientOfferSentiment)
      ? (sentimentRaw as ClientOfferSentiment)
      : null,
    liked: String(raw.liked || '').trim(),
    disliked: String(raw.disliked || '').trim(),
    phrases,
    note: String(raw.note || raw.feedback || '').trim(),
    agentReply: raw.agentReply ? String(raw.agentReply) : null,
    agentReplyAt: raw.agentReplyAt ? String(raw.agentReplyAt) : null,
    agentReplyReadAt: raw.agentReplyReadAt ? String(raw.agentReplyReadAt) : null,
  };
}

export function serializeClientOfferFeedback(input: Partial<ClientOfferFeedback> & { note?: string }): string {
  const next: ClientOfferFeedback = {
    ...emptyClientOfferFeedback(),
    ...input,
    liked: String(input.liked || '').trim(),
    disliked: String(input.disliked || '').trim(),
    phrases: Array.isArray(input.phrases) ? input.phrases.map((item) => String(item).trim()).filter(Boolean) : [],
    note: String(input.note || '').trim(),
    sentiment: input.sentiment && SENTIMENTS.has(input.sentiment) ? input.sentiment : null,
    agentReply: input.agentReply ? String(input.agentReply) : null,
    agentReplyAt: input.agentReplyAt ? String(input.agentReplyAt) : null,
    agentReplyReadAt: input.agentReplyReadAt ? String(input.agentReplyReadAt) : null,
  };
  return JSON.stringify(next);
}

export function hasUnreadAgentReply(feedback: ClientOfferFeedback): boolean {
  return Boolean(feedback.agentReply && !feedback.agentReplyReadAt);
}

export type AgentOfferReplyCard = {
  matchId: number;
  offerId: number;
  offerTitle: string;
  imageUrl: string | null;
  clientNote: string;
  agentReply: string;
  agentReplyAt: string | null;
  unread: boolean;
};

export function collectAgentOfferReplies(
  matches: Array<{
    id: number;
    clientFeedback: unknown;
    offer: { id: number; title: string; imageUrl?: string | null };
  }>,
): AgentOfferReplyCard[] {
  const rows: AgentOfferReplyCard[] = [];
  for (const match of matches) {
    const feedback = parseClientOfferFeedback(match.clientFeedback);
    if (!feedback.agentReply) continue;
    rows.push({
      matchId: match.id,
      offerId: match.offer.id,
      offerTitle: match.offer.title,
      imageUrl: match.offer.imageUrl || null,
      clientNote: feedback.note,
      agentReply: feedback.agentReply,
      agentReplyAt: feedback.agentReplyAt || null,
      unread: hasUnreadAgentReply(feedback),
    });
  }
  return rows.sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return String(b.agentReplyAt || '').localeCompare(String(a.agentReplyAt || ''));
  });
}

export function clientFeedbackHasContent(feedback: ClientOfferFeedback): boolean {
  return Boolean(
    feedback.sentiment || feedback.liked || feedback.disliked || feedback.phrases.length || feedback.note,
  );
}

export function sentimentLabel(sentiment: ClientOfferSentiment | null): string {
  if (sentiment === 'like') return 'Podoba się';
  if (sentiment === 'maybe') return 'Może być';
  if (sentiment === 'dislike') return 'Nie pasuje';
  return 'Bez oceny';
}

export function formatClientFeedbackForAgent(raw: unknown): string {
  const feedback = parseClientOfferFeedback(raw);
  if (!clientFeedbackHasContent(feedback)) return '';
  const parts: string[] = [];
  if (feedback.sentiment) parts.push(sentimentLabel(feedback.sentiment));
  if (feedback.liked) parts.push(`Plusy: ${feedback.liked}`);
  if (feedback.disliked) parts.push(`Minusy: ${feedback.disliked}`);
  if (feedback.phrases.length) parts.push(feedback.phrases.join(' · '));
  if (feedback.note) parts.push(feedback.note);
  return parts.join(' — ');
}

/** Treść bąbelka klienta = sama notatka. Tytuł oferty idzie do metadanych / chipa, nie do tekstu. */
export function clientFeedbackChatMessage(raw: unknown, _offerTitle?: string): string | null {
  const feedback = parseClientOfferFeedback(raw);
  if (!feedback.note) return null;
  return feedback.note;
}
