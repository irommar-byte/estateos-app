/**
 * Gdy użytkownik jest w czacie danej transakcji, wyciszamy alerty push dotyczące
 * tego samego deala/oferty — treść i tak widzi na ekranie.
 */
import type * as Notifications from 'expo-notifications';
import { extractPushDealAndOfferIds, mergePushPayload as mergeCanonicalPushPayload } from '../contracts/parityContracts';

let activeDealId: number | null = null;
let activeOfferId: number | null = null;

export function setActiveDealroomContext(params: { dealId?: number | null; offerId?: number | null }) {
  const d = params.dealId != null ? Number(params.dealId) : NaN;
  const o = params.offerId != null ? Number(params.offerId) : NaN;
  activeDealId = Number.isFinite(d) && d > 0 ? d : null;
  activeOfferId = Number.isFinite(o) && o > 0 ? o : null;
}

function mergePushPayload(notification: Notifications.Notification): Record<string, any> {
  return mergeCanonicalPushPayload({
    baseData: notification.request.content?.data,
    triggerPayload: (notification.request as any)?.trigger?.payload,
  });
}

function extractDealAndOfferIds(notification: Notifications.Notification): {
  dealId: number | null;
  offerId: number | null;
} {
  return extractPushDealAndOfferIds(mergePushPayload(notification));
}

/** Wyłącz baner / listę / dźwięk (handler foreground), gdy push dotyczy tego samego wątku co otwarty czat. */
export function shouldSuppressDealPushForActiveChat(notification: Notifications.Notification): boolean {
  const kind = String((notification.request?.content?.data as Record<string, unknown> | undefined)?.kind ?? '');
  /** Lokalne przypomnienie 2 h przed prezentacją — zawsze pokazuj, także gdy czat deala jest otwarty. */
  if (kind === 'presentation-2h') return false;

  if (activeDealId == null && activeOfferId == null) return false;

  const { dealId: pushDealId, offerId: pushOfferId } = extractDealAndOfferIds(notification);

  if (activeDealId != null && pushDealId != null && pushDealId === activeDealId) {
    if (__DEV__) {
      console.log('[push] suppressed (same dealId as active chat)', activeDealId);
    }
    return true;
  }

  if (activeOfferId != null && pushOfferId != null && pushOfferId === activeOfferId) {
    const title = `${notification.request.content.title || ''}`;
    const body = `${notification.request.content.body || ''}`;
    const blob = `${title} ${body} ${JSON.stringify(notification.request.content.data || {})}`.toLowerCase();
    const looksDealroom =
      /deal|dealroom|czat|wiadomo|transak|termin|prezentac|negocj|message|chat|thread/i.test(blob);
    if (looksDealroom) {
      if (__DEV__) {
        console.log('[push] suppressed (same offerId, dealroom-related)', activeOfferId);
      }
      return true;
    }
  }

  return false;
}
