import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/observability';
import { notificationService } from '@/lib/services/notification.service';
import { incMetric, observeLatencyMs, tokenRef } from '@/lib/pushTelemetry';

type DispatchParams = {
  offerId: number;
  oldPrice: number;
  newPrice: number;
  changedByUserId: number | null;
  source: string;
  changedAt?: Date;
};

export async function dispatchFavoritesPriceChangePush(params: DispatchParams): Promise<void> {
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

  const favoriteRows = await prisma.favoriteOffer.findMany({
    where: { offerId },
    select: { userId: true },
  });

  const favoriteUsers = Array.from(new Set(favoriteRows.map((r) => r.userId)));
  const favoriteUsersTotal = favoriteUsers.length;

  let excludedDisabledFavorites = 0;
  let excludedDisabledPriceChange = 0;
  let excludedNoDeviceToken = 0;
  let excludedInvalidToken = 0;

  const eligibleUsers: Array<{ userId: number; includeAmounts: boolean; tokenRef: string }> = [];

  for (const userId of favoriteUsers) {
    const pref = await prisma.devicePushPreference.findUnique({ where: { userId } });
    const favoritesEnabled = pref?.favoritesEnabled ?? true;
    const notifyPriceChange = pref?.notifyPriceChange ?? true;
    const includeAmounts = pref?.notifyIncludeAmounts ?? true;

    if (!favoritesEnabled) {
      excludedDisabledFavorites += 1;
      continue;
    }
    if (!notifyPriceChange) {
      excludedDisabledPriceChange += 1;
      continue;
    }

    const devices = await prisma.device.findMany({
      where: { userId, isActive: true },
      select: { expoPushToken: true },
    });

    if (devices.length === 0) {
      excludedNoDeviceToken += 1;
      continue;
    }

    const validTokens = devices
      .map((d) => String(d.expoPushToken || '').trim())
      .filter((t) => t.startsWith('ExponentPushToken['));
    const hasAnyValid = validTokens.length > 0;
    if (!hasAnyValid) {
      excludedInvalidToken += 1;
      continue;
    }

    eligibleUsers.push({ userId, includeAmounts, tokenRef: tokenRef(validTokens[0]) });
  }

  incMetric('favorites_price_push_candidates_total', eligibleUsers.length);

  logEvent('info', 'favorites_price_push_candidates', 'favorites_price_push', {
    traceId,
    offerId,
    favoriteUsersTotal,
    eligibleUsers: eligibleUsers.length,
    excludedDisabledFavorites,
    excludedDisabledPriceChange,
    excludedNoDeviceToken,
    excludedInvalidToken,
  });

  for (const candidate of eligibleUsers) {
    const title = 'Zmiana ceny obserwowanej oferty';
    const body = candidate.includeAmounts
      ? `Cena zmieniła się z ${oldPrice.toLocaleString('pl-PL')} PLN na ${newPrice.toLocaleString('pl-PL')} PLN.`
      : 'Cena jednej z obserwowanych ofert została zaktualizowana.';
    const payloadVariant = candidate.includeAmounts ? 'WITH_AMOUNT' : 'WITHOUT_AMOUNT';

    logEvent('info', 'favorites_price_push_dispatch_attempt', 'favorites_price_push', {
      traceId,
      userId: candidate.userId,
      offerId,
        tokenRef: candidate.tokenRef,
      includeAmounts: candidate.includeAmounts,
      payloadVariant,
      title,
      bodyPreview: body.slice(0, 120),
      notificationType: 'favorites_price_change',
    });

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
      {
        traceId,
        offerId,
        provider: 'expo',
        retryCount: 0,
      }
    );
    observeLatencyMs(Date.now() - dispatchStartedAt);
  }
}
