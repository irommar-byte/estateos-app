export const DEAL_REVIEW_PREFIX = '[[DEAL_REVIEW]]';

export type DealReviewPayload = {
  dealId: number;
  targetId: number;
  rating: number;
  review?: string;
  senderId?: number | null;
};

function parsePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseDealReviewPayload(content?: string): DealReviewPayload | null {
  const raw = String(content || '').trim();
  if (!raw.startsWith(DEAL_REVIEW_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(DEAL_REVIEW_PREFIX.length)) as Record<string, unknown>;
    const dealId = parsePositiveInt(parsed?.dealId);
    const targetId = parsePositiveInt(parsed?.targetId);
    if (!dealId || !targetId) return null;
    const rating = Number(parsed?.rating || 0);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
    const review = String(parsed?.review || '').trim();
    const senderId = parsePositiveInt(parsed?.senderId);
    return {
      dealId,
      targetId,
      rating: Math.round(rating),
      ...(review ? { review } : {}),
      ...(senderId != null ? { senderId } : {}),
    };
  } catch {
    return null;
  }
}

export function buildDealReviewPayload(params: {
  dealId: number;
  targetId: number;
  rating: number;
  review?: string;
  senderId?: number;
}): DealReviewPayload | null {
  const dealId = parsePositiveInt(params.dealId);
  const targetId = parsePositiveInt(params.targetId);
  if (!dealId || !targetId) return null;
  const rating = Number(params.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
  const review = String(params.review || '').trim().slice(0, 1000);
  return {
    dealId,
    targetId,
    rating: Math.round(rating),
    ...(review ? { review } : {}),
    senderId: parsePositiveInt(params.senderId) ?? null,
  };
}

export function encodeDealReviewMessage(payload: DealReviewPayload): string {
  return `${DEAL_REVIEW_PREFIX}${JSON.stringify(payload)}`;
}

/** Tekst widoczny w czacie — ukrywa techniczne wpisy opinii. */
export function formatDealChatMessage(content: string): string | null {
  const raw = String(content || '').trim();
  if (!raw) return null;
  if (raw.startsWith(DEAL_REVIEW_PREFIX)) return null;
  if (raw.startsWith('[[DEAL_EVENT]]')) return null;
  if (raw.startsWith('[SYSTEM_BID:')) return null;
  if (raw.startsWith('[SYSTEM_FINALIZED]')) {
    return raw.replace('[SYSTEM_FINALIZED]', '').trim();
  }
  return raw;
}

export function isDealReviewMessage(content: string): boolean {
  return String(content || '').trim().startsWith(DEAL_REVIEW_PREFIX);
}
