import { isDealReviewMessage } from '@/lib/dealroomReviewMessage';

const DEAL_EVENT_PREFIX = '[[DEAL_EVENT]]';

/** Wiadomości techniczne w wątku — nie wysyłamy push „Nowa wiadomość”. */
export function shouldSkipDealroomMessagePush(content: string): boolean {
  const raw = String(content || '').trim();
  if (!raw) return false;
  if (isDealReviewMessage(raw)) return true;
  if (raw.startsWith(DEAL_EVENT_PREFIX)) return true;
  if (raw.startsWith('[SYSTEM_BID:')) return true;
  if (raw.startsWith('[SYSTEM_FINALIZED]')) return true;
  return false;
}
