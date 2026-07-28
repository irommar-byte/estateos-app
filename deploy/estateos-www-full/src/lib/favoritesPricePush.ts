import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/observability';
import { notificationService } from '@/lib/services/notification.service';
import { incMetric, observeLatencyMs, tokenRef } from '@/lib/pushTelemetry';

type PrefGate = 'notifyPriceChange' | 'notifyDealProposals' | 'notifyStatusChange' | 'notifyNewSimilar';

async function collectFavoriteRecipients(params: {
  offerId: number;
  gate: PrefGate;
  excludeUserIds?: number[];
}): Promise<Array<{ userId: number; includeAmounts: boolean; tokenRef: string }>> {
  const exclude = new Set((params.excludeUserIds || []).filter((id) => Number.isFinite(id) && id > 0));
  const favoriteRows = await prisma.favoriteOffer.findMany({
    where: { offerId: params.offerId },
    select: { userId: true },
  });
  const favoriteUsers = Array.from(new Set(favoriteRows.map((r) => r.userId))).filter((id) => !exclude.has(id));
  const eligible: Array<{ userId: number; includeAmounts: boolean; tokenRef: string }> = [];

  for (const userId of favoriteUsers) {
    const pref = await prisma.devicePushPreference.findUnique({ where: { userId } });
    const favoritesEnabled = pref?.favoritesEnabled ?? true;
    const gateOn = pref?.[params.gate] ?? true;
    if (!favoritesEnabled || !gateOn) continue;

    const devices = await prisma.device.findMany({
      where: { userId, isActive: true },
      select: { expoPushToken: true },
    });
    const validTokens = devices
      .map((d) => String(d.expoPushToken || '').trim())
      .filter((t) => t.startsWith('ExponentPushToken['));
    if (validTokens.length === 0) continue;

    eligible.push({
      userId,
      includeAmounts: pref?.notifyIncludeAmounts ?? true,
      tokenRef: tokenRef(validTokens[0]),
    });
  }
  return eligible;
}

type PriceParams = {
  offerId: number;
  oldPrice: number;
  newPrice: number;
  changedByUserId: number | null;
  source: string;
  changedAt?: Date;
};

/** Existing API — price change on a favorited home listing. */
export async function dispatchFavoritesPriceChangePush(params: PriceParams): Promise<void> {
  const { offerId, oldPrice, newPrice, changedByUserId, source } = params;
  if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || oldPrice === newPrice) return;

  const changedAt = params.changedAt || new Date();
  const traceId = crypto.randomUUID();
  incMetric('favorites_price_change_events_total', 1);

  logEvent('info', 'offer_price_changed', 'favorites_price_push', {
    traceId,
    offerId,
    oldPrice,
    newPrice,
    changedByUserId,
    source,
    changedAt: changedAt.toISOString(),
  });

  const eligibleUsers = await collectFavoriteRecipients({
    offerId,
    gate: 'notifyPriceChange',
    excludeUserIds: changedByUserId ? [changedByUserId] : [],
  });
  incMetric('favorites_price_push_candidates_total', eligibleUsers.length);

  for (const candidate of eligibleUsers) {
    const title = 'Zmiana ceny obserwowanej oferty';
    const body = candidate.includeAmounts
      ? `Cena zmieniła się z ${oldPrice.toLocaleString('pl-PL')} PLN na ${newPrice.toLocaleString('pl-PL')} PLN.`
      : 'Cena jednej z obserwowanych ofert została zaktualizowana.';

    const dispatchStartedAt = Date.now();
    await notificationService.sendPushToUser(
      candidate.userId,
      {
        title,
        body,
        sound: 'default',
        priority: 'high',
        data: {
          target: 'offer',
          targetType: 'OFFER',
          offerId,
          notificationType: 'favorites_price_change',
        },
      },
      { traceId, offerId, provider: 'expo', retryCount: 0 },
    );
    observeLatencyMs(Date.now() - dispatchStartedAt);
  }
}

type StatusParams = {
  offerId: number;
  oldStatus: string;
  newStatus: string;
  changedByUserId?: number | null;
  source: string;
};

export async function dispatchFavoritesStatusChangePush(params: StatusParams): Promise<void> {
  const oldStatus = String(params.oldStatus || '').toUpperCase();
  const newStatus = String(params.newStatus || '').toUpperCase();
  if (!oldStatus || !newStatus || oldStatus === newStatus) return;

  const meaningful =
    newStatus === 'ARCHIVED' ||
    newStatus === 'SOLD' ||
    newStatus === 'RENTED' ||
    newStatus === 'WITHDRAWN' ||
    newStatus === 'INACTIVE' ||
    (oldStatus === 'ACTIVE' && newStatus !== 'ACTIVE');
  if (!meaningful) return;

  const traceId = crypto.randomUUID();
  const eligibleUsers = await collectFavoriteRecipients({
    offerId: params.offerId,
    gate: 'notifyStatusChange',
    excludeUserIds: params.changedByUserId ? [params.changedByUserId] : [],
  });

  logEvent('info', 'favorites_status_push_candidates', 'favorites_status_push', {
    traceId,
    offerId: params.offerId,
    oldStatus,
    newStatus,
    source: params.source,
    eligibleUsers: eligibleUsers.length,
  });

  const statusLabel =
    newStatus === 'SOLD'
      ? 'sprzedana'
      : newStatus === 'RENTED'
        ? 'wynajęta'
        : newStatus === 'ARCHIVED' || newStatus === 'WITHDRAWN'
          ? 'wycofana'
          : 'zmieniła status';

  for (const candidate of eligibleUsers) {
    await notificationService.sendPushToUser(
      candidate.userId,
      {
        title: 'Zmiana statusu ulubionej oferty',
        body: `Oferta, którą obserwujesz, została ${statusLabel}.`,
        sound: 'default',
        priority: 'high',
        data: {
          target: 'offer',
          targetType: 'OFFER',
          offerId: params.offerId,
          notificationType: 'favorites_status_change',
          oldStatus,
          newStatus,
        },
      },
      { traceId, offerId: params.offerId, provider: 'expo', retryCount: 0 },
    );
  }
}

type DealProposalParams = {
  offerId: number;
  dealId: number;
  actorUserId?: number | null;
  kind: 'appointment' | 'bid' | 'negotiation';
  source: string;
};

export async function dispatchFavoritesDealProposalPush(params: DealProposalParams): Promise<void> {
  if (!Number.isFinite(params.offerId) || params.offerId <= 0) return;
  const traceId = crypto.randomUUID();
  const eligibleUsers = await collectFavoriteRecipients({
    offerId: params.offerId,
    gate: 'notifyDealProposals',
    excludeUserIds: params.actorUserId ? [params.actorUserId] : [],
  });

  logEvent('info', 'favorites_deal_proposal_push_candidates', 'favorites_deal_push', {
    traceId,
    offerId: params.offerId,
    dealId: params.dealId,
    kind: params.kind,
    source: params.source,
    eligibleUsers: eligibleUsers.length,
  });

  const body =
    params.kind === 'appointment'
      ? 'Pojawiła się propozycja terminu w Dealroom dla ulubionej oferty.'
      : params.kind === 'bid'
        ? 'Pojawiła się propozycja ceny w Dealroom dla ulubionej oferty.'
        : 'Nowa aktywność negocjacji przy ulubionej ofercie.';

  for (const candidate of eligibleUsers) {
    await notificationService.sendPushToUser(
      candidate.userId,
      {
        title: 'Ulubione — Dealroom',
        body,
        sound: 'default',
        priority: 'high',
        data: {
          target: 'dealroom',
          targetType: 'DEAL',
          dealId: params.dealId,
          offerId: params.offerId,
          notificationType: 'favorites_deal_proposal',
        },
      },
      { traceId, offerId: params.offerId, provider: 'expo', retryCount: 0 },
    );
  }
}

type SimilarParams = {
  offerId: number;
  city?: string | null;
  transactionType?: string | null;
  pricePln?: number | null;
  ownerUserId?: number | null;
  source: string;
};

/**
 * Notify Favor users watching similar homes when a new ACTIVE offer appears.
 * Similarity: same city + overlapping price band (±30%) among their favorites.
 */
export async function dispatchFavoritesNewSimilarPush(params: SimilarParams): Promise<void> {
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) return;
  const city = String(params.city || '').trim();
  const price = Number(params.pricePln);
  if (!city || !Number.isFinite(price) || price <= 0) return;

  const prefs = await prisma.devicePushPreference.findMany({
    where: { favoritesEnabled: true, notifyNewSimilar: true },
    select: { userId: true },
    take: 400,
  });
  if (prefs.length === 0) return;

  const traceId = crypto.randomUUID();
  let sent = 0;

  for (const row of prefs) {
    if (params.ownerUserId && row.userId === params.ownerUserId) continue;
    const favorites = await prisma.favoriteOffer.findMany({
      where: { userId: row.userId },
      select: {
        offer: {
          select: {
            id: true,
            city: true,
            pricePln: true,
            price: true,
            transactionType: true,
            status: true,
          },
        },
      },
      take: 40,
    });
    const match = favorites.some((f) => {
      const o = f.offer;
      if (!o || String(o.status || '').toUpperCase() !== 'ACTIVE') return false;
      if (String(o.city || '').trim().toLowerCase() !== city.toLowerCase()) return false;
      if (
        params.transactionType &&
        o.transactionType &&
        String(o.transactionType).toUpperCase() !== String(params.transactionType).toUpperCase()
      ) {
        return false;
      }
      const favPrice = Number(o.pricePln ?? o.price ?? 0);
      if (!Number.isFinite(favPrice) || favPrice <= 0) return false;
      const lo = favPrice * 0.7;
      const hi = favPrice * 1.3;
      return price >= lo && price <= hi;
    });
    if (!match) continue;

    const devices = await prisma.device.findMany({
      where: { userId: row.userId, isActive: true },
      select: { expoPushToken: true },
    });
    const hasToken = devices.some((d) => String(d.expoPushToken || '').startsWith('ExponentPushToken['));
    if (!hasToken) continue;

    await notificationService.sendPushToUser(
      row.userId,
      {
        title: 'Nowa podobna oferta',
        body: `W ${city} pojawiła się oferta bliska Twoim Ulubionym.`,
        sound: 'default',
        priority: 'default',
        data: {
          target: 'offer',
          targetType: 'OFFER',
          offerId,
          notificationType: 'favorites_new_similar',
        },
      },
      { traceId, offerId, provider: 'expo', retryCount: 0 },
    );
    sent += 1;
    if (sent >= 80) break;
  }

  logEvent('info', 'favorites_new_similar_push', 'favorites_similar_push', {
    traceId,
    offerId,
    city,
    source: params.source,
    sent,
  });
}
