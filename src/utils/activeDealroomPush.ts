/**
 * Gdy użytkownik jest w czacie danej transakcji, wyciszamy alerty push dotyczące
 * tego samego deala/oferty — treść i tak widzi na ekranie.
 */
import type * as Notifications from 'expo-notifications';
import { extractIdFromDeeplink } from './deeplinkParse';

let activeDealId: number | null = null;
let activeOfferId: number | null = null;

export function setActiveDealroomContext(params: { dealId?: number | null; offerId?: number | null }) {
  const d = params.dealId != null ? Number(params.dealId) : NaN;
  const o = params.offerId != null ? Number(params.offerId) : NaN;
  activeDealId = Number.isFinite(d) && d > 0 ? d : null;
  activeOfferId = Number.isFinite(o) && o > 0 ? o : null;
}

const parseMaybeJson = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const firstDefined = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && v !== '');

function normalizePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mergePushPayload(notification: Notifications.Notification): Record<string, any> {
  const req = notification.request;
  const baseData = parseMaybeJson(req.content?.data);
  const triggerPayload = parseMaybeJson((req as any)?.trigger?.payload);
  const triggerBody = parseMaybeJson(triggerPayload?.body);
  const triggerData = parseMaybeJson(triggerPayload?.data);
  const triggerCustom = parseMaybeJson(triggerPayload?.custom);
  const nestedData = {
    ...parseMaybeJson(baseData.payload),
    ...parseMaybeJson(baseData.data),
    ...parseMaybeJson(baseData.meta),
    ...parseMaybeJson(baseData.custom),
    ...triggerBody,
    ...triggerData,
    ...triggerCustom,
  };
  return { ...triggerPayload, ...baseData, ...nestedData };
}

function extractDealAndOfferIds(notification: Notifications.Notification): {
  dealId: number | null;
  offerId: number | null;
} {
  const data = mergePushPayload(notification);
  const deeplink = String(firstDefined(data.deeplink, data.deepLink, data.link, data.url, data.dealroomLink) || '');
  const deeplinkOfferId = extractIdFromDeeplink(deeplink, 'offer');
  const deeplinkDealId = extractIdFromDeeplink(deeplink, 'deal');

  const targetTypeNorm = String(firstDefined(data.targetType, data.entity, data.notificationType) || '')
    .trim()
    .toUpperCase();
  const targetTypeLooksDeal =
    targetTypeNorm.includes('DEAL') ||
    targetTypeNorm.includes('CHAT') ||
    targetTypeNorm.includes('THREAD') ||
    targetTypeNorm.includes('CONVERSATION');

  const dealId = normalizePositiveInt(
    firstDefined(
      data.dealId,
      data.deal_id,
      targetTypeLooksDeal ? data.targetId : null,
      data.chatId,
      data.threadId,
      data.conversationId,
      data.roomId,
      data.room_id,
      data?.deal?.id,
      deeplinkDealId
    )
  );

  const targetTypeLooksOffer =
    targetTypeNorm.includes('OFFER') ||
    targetTypeNorm.includes('LISTING') ||
    targetTypeNorm.includes('PROPERTY');
  const offerId = normalizePositiveInt(
    firstDefined(
      data.offerId,
      data.offer_id,
      targetTypeLooksOffer ? data.targetId : null,
      data.listingId,
      data.propertyId,
      data.property_id,
      data.realEstateId,
      data.real_estate_id,
      data?.offer?.id,
      deeplinkOfferId
    )
  );

  return { dealId, offerId };
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
