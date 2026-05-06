import { extractIdFromDeeplink } from '../utils/deeplinkParse';

export const DEAL_EVENT_PREFIX = '[[DEAL_EVENT]]';
export const DEAL_REVIEW_PREFIX = '[[DEAL_REVIEW]]';

export const DEAL_EVENT_ENTITIES = ['BID', 'APPOINTMENT'] as const;
export const DEAL_EVENT_ACTIONS = ['PROPOSED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'DECLINED'] as const;
export const DEAL_EVENT_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'DECLINED'] as const;

export type DealEventEntity = (typeof DEAL_EVENT_ENTITIES)[number];
export type DealEventAction = (typeof DEAL_EVENT_ACTIONS)[number];
export type DealEventStatus = (typeof DEAL_EVENT_STATUSES)[number];
export type SharedDealEventPayload = {
  entity: DealEventEntity;
  action: DealEventAction;
  status: DealEventStatus;
  amount?: number;
  proposedDate?: string | null;
  bidId?: number | null;
  appointmentId?: number | null;
  note?: string | null;
};
export type SharedDealReviewPayload = {
  dealId: number;
  targetId: number;
  rating: number;
  review?: string;
  senderId?: number | null;
};

type AnyObj = Record<string, any>;

export const firstDefined = (...values: unknown[]) =>
  values.find((v) => v !== undefined && v !== null && v !== '');

export const parseMaybeJson = (value: unknown): AnyObj => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as AnyObj;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as AnyObj) : {};
  } catch {
    return {};
  }
};

export function parsePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function mergePushPayload(raw: {
  baseData?: unknown;
  triggerPayload?: unknown;
}): AnyObj {
  const baseData = parseMaybeJson(raw.baseData);
  const triggerPayload = parseMaybeJson(raw.triggerPayload);
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

export function extractPushDealAndOfferIds(data: AnyObj): {
  dealId: number | null;
  offerId: number | null;
} {
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
  const targetTypeLooksOffer =
    targetTypeNorm.includes('OFFER') ||
    targetTypeNorm.includes('LISTING') ||
    targetTypeNorm.includes('PROPERTY') ||
    targetTypeNorm.includes('RADAR');

  const dealId = parsePositiveInt(
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

  const offerId = parsePositiveInt(
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

export function shouldPrioritizeDealroom(data: AnyObj, dealId: number | null): boolean {
  const target = String(firstDefined(data.target) || '')
    .trim()
    .toLowerCase();
  const targetType = String(firstDefined(data.targetType) || '')
    .trim()
    .toUpperCase();
  return target === 'dealroom' || targetType === 'DEAL' || !!dealId;
}

export function isFinalizedOwnerAcceptanceMessage(content: string): boolean {
  return /Decyzja właściciela: oferta została wycofana z publikacji|transakcja sfinalizowana|rezerwacja uzgodnionej ceny/i.test(
    String(content || '')
  );
}

/**
 * ZAMROŻONY shared kontrakt DEAL_REVIEW:
 * - prefix: [[DEAL_REVIEW]]
 * - rating: 1..5 (required)
 * - review: string (optional, max 1000 chars)
 * - senderId: number dodatni albo null
 */
export function validateSharedDealReviewPayload(raw: AnyObj): SharedDealReviewPayload | null {
  const dealId = parsePositiveInt(raw?.dealId);
  const targetId = parsePositiveInt(raw?.targetId);
  if (!dealId || !targetId) return null;
  const rating = Number(raw?.rating || 0);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
  const review = String(raw?.review || '').trim();
  if (review.length > 1000) return null;
  const sid = parsePositiveInt(raw?.senderId);
  return {
    dealId,
    targetId,
    rating: Math.round(rating),
    ...(review ? { review } : {}),
    ...(sid != null ? { senderId: sid } : {}),
  };
}

export function buildSharedDealReviewPayload(params: {
  dealId: unknown;
  targetId: unknown;
  rating: unknown;
  review?: unknown;
  senderId?: unknown;
}): SharedDealReviewPayload | null {
  return validateSharedDealReviewPayload({
    dealId: params.dealId,
    targetId: params.targetId,
    rating: params.rating,
    review: params.review,
    senderId: params.senderId,
  });
}

export function canFinalizeTransition(params: {
  dealStatus: unknown;
  acceptedBidId: unknown;
}): boolean {
  const status = String(params.dealStatus || '')
    .trim()
    .toUpperCase();
  const acceptedBidId = parsePositiveInt(params.acceptedBidId);
  return status === 'AGREED' && acceptedBidId != null;
}

function includesLiteral<T extends readonly string[]>(arr: T, value: string): value is T[number] {
  return (arr as readonly string[]).includes(value);
}

/**
 * ZAMROŻONY shared kontrakt DEAL_EVENT:
 * - entity: BID | APPOINTMENT
 * - action/status: dozwolone wartości wyżej
 * - BID wymaga amount > 0
 * - APPOINTMENT wymaga proposedDate (parsowalna data)
 */
export function validateSharedDealEventPayload(raw: AnyObj): SharedDealEventPayload | null {
  const entity = String(raw?.entity || '')
    .trim()
    .toUpperCase();
  const action = String(raw?.action || '')
    .trim()
    .toUpperCase();
  const status = String(raw?.status || '')
    .trim()
    .toUpperCase();

  if (!includesLiteral(DEAL_EVENT_ENTITIES, entity)) return null;
  if (!includesLiteral(DEAL_EVENT_ACTIONS, action)) return null;
  if (!includesLiteral(DEAL_EVENT_STATUSES, status)) return null;

  const amount = raw?.amount != null ? Number(raw.amount) : undefined;
  const proposedDate = raw?.proposedDate != null ? String(raw.proposedDate) : undefined;

  if (entity === 'BID') {
    if (!Number.isFinite(amount) || Number(amount) <= 0) return null;
  }
  if (entity === 'APPOINTMENT') {
    if (!proposedDate) return null;
    const dt = new Date(proposedDate);
    if (Number.isNaN(dt.getTime())) return null;
  }

  return {
    ...raw,
    entity,
    action,
    status,
    amount: Number.isFinite(amount) ? Number(amount) : undefined,
    proposedDate: proposedDate ?? null,
    bidId: parsePositiveInt(raw?.bidId),
    appointmentId: parsePositiveInt(raw?.appointmentId),
    note: raw?.note != null ? String(raw.note) : null,
  };
}

export type CanonicalRadarPreferencesDto = {
  userId: number;
  transactionType?: string;
  propertyType?: string | null;
  city?: string;
  selectedDistricts?: string[];
  maxPrice?: number | null;
  minArea?: number | null;
  minYear?: number | null;
  requireBalcony?: boolean;
  requireGarden?: boolean;
  requireElevator?: boolean;
  requireParking?: boolean;
  requireFurnished?: boolean;
  pushNotifications: boolean;
  minMatchThreshold?: number;
  lat?: number | null;
  lng?: number | null;
  radius?: number | null;
};

export function buildCanonicalRadarPreferencesDto(params: {
  userId: number;
  filters: AnyObj;
  mapContext?: { lat?: unknown; lng?: unknown; radius?: unknown };
}): CanonicalRadarPreferencesDto {
  const { userId, filters, mapContext } = params;
  const lat = Number(mapContext?.lat);
  const lng = Number(mapContext?.lng);
  const radius = Number(mapContext?.radius);
  return {
    userId,
    transactionType: filters.transactionType,
    propertyType: filters.propertyType === 'ALL' ? null : filters.propertyType,
    city: filters.city,
    selectedDistricts: filters.selectedDistricts || [],
    maxPrice: filters.maxPrice ?? null,
    minArea: filters.minArea ?? null,
    minYear: filters.minYear ?? null,
    requireBalcony: !!filters.requireBalcony,
    requireGarden: !!filters.requireGarden,
    requireElevator: !!filters.requireElevator,
    requireParking: !!filters.requireParking,
    requireFurnished: !!filters.requireFurnished,
    pushNotifications: filters.pushNotifications !== false,
    minMatchThreshold: filters.matchThreshold,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    radius: Number.isFinite(radius) ? radius : null,
  };
}
