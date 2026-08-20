export type ClientOfferSentiment = 'like' | 'maybe' | 'dislike';

export type ClientOfferFeedback = {
  sentiment: ClientOfferSentiment | null;
  liked: string;
  disliked: string;
  phrases: string[];
  note: string;
};

const SENTIMENTS = new Set<ClientOfferSentiment>(['like', 'maybe', 'dislike']);

export function emptyClientOfferFeedback(): ClientOfferFeedback {
  return { sentiment: null, liked: '', disliked: '', phrases: [], note: '' };
}

export function parseClientOfferFeedback(raw: unknown): ClientOfferFeedback {
  if (!raw) return emptyClientOfferFeedback();
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return emptyClientOfferFeedback();
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && (parsed.sentiment || parsed.note || parsed.phrases)) {
        return normalizeFeedbackObject(parsed);
      }
    } catch {
      /* plain note */
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
  };
}

export function sentimentLabel(sentiment: ClientOfferSentiment | null): string {
  if (sentiment === 'like') return 'Podoba się';
  if (sentiment === 'maybe') return 'Może być';
  if (sentiment === 'dislike') return 'Nie pasuje';
  return 'Bez oceny';
}

export function formatClientFeedbackForAgent(raw: unknown): string {
  const feedback = parseClientOfferFeedback(raw);
  const parts: string[] = [];
  if (feedback.sentiment) parts.push(sentimentLabel(feedback.sentiment));
  if (feedback.liked) parts.push(`Plusy: ${feedback.liked}`);
  if (feedback.disliked) parts.push(`Minusy: ${feedback.disliked}`);
  if (feedback.phrases.length) parts.push(feedback.phrases.join(' · '));
  if (feedback.note) parts.push(feedback.note);
  return parts.join(' — ');
}
