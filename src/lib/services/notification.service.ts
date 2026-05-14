import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/observability';
import { incMetric, tokenRef } from '@/lib/pushTelemetry';

const expo = new Expo();
const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

type DeviceRow = {
  userId: number;
  expoPushToken: string;
  platform: string;
  isActive: boolean;
};

type DispatchMeta = {
  traceId?: string;
  offerId?: number;
  provider?: 'expo';
  retryCount?: number;
};

async function sendExpoPushChunk(chunk: ExpoPushMessage[]) {
  const res = await fetch(EXPO_PUSH_SEND_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chunk),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`EXPO_PUSH_SEND_FAILED_${res.status}: ${txt}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ status?: string; id?: string; details?: { error?: string } }>;
    errors?: unknown[];
  };
  return data;
}

async function fetchExpoReceipts(ids: string[]) {
  if (!ids.length) return null;
  const res = await fetch(EXPO_PUSH_RECEIPTS_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`EXPO_PUSH_RECEIPTS_FAILED_${res.status}: ${txt}`);
  }
  const data = (await res.json()) as {
    data?: Record<string, { status?: string; message?: string; details?: { error?: string } }>;
  };
  return data?.data || {};
}

export const notificationService = {
  async sendPushToUser(userId: number, payload: any, meta: DispatchMeta = {}) {
    const isFavoritesPriceFlow = Boolean(meta.traceId) && Number.isFinite(Number(meta.offerId));
    const devices = (await prisma.device.findMany({
      where: { userId, isActive: true },
      select: {
        userId: true,
        expoPushToken: true,
        platform: true,
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    })) as DeviceRow[];

    if (!devices.length) {
      throw new Error('NO_ACTIVE_DEVICES');
    }

    const validDevices = devices.filter((d) => Expo.isExpoPushToken(d.expoPushToken));
    const invalidDevices = devices.filter((d) => !Expo.isExpoPushToken(d.expoPushToken));

    if (invalidDevices.length) {
      await prisma.device.updateMany({
        where: {
          userId,
          expoPushToken: { in: invalidDevices.map((d) => d.expoPushToken) },
        },
        data: {
          isActive: false,
          lastSyncedAt: new Date(),
        },
      });
      if (isFavoritesPriceFlow) {
        for (const d of invalidDevices) {
          logEvent('warn', 'device_token_deactivated', 'notification_service', {
            reason: 'invalid_expo_token_format',
            userId,
            tokenRef: tokenRef(d.expoPushToken),
            traceId: meta.traceId,
            offerId: meta.offerId,
          });
        }
      }
    }

    if (!validDevices.length) {
      throw new Error('NO_VALID_EXPO_TOKENS');
    }

    const baseData = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    const messages: ExpoPushMessage[] = validDevices.map((d) => ({
      to: d.expoPushToken,
      title: String(payload?.title || 'Powiadomienie'),
      body: String(payload?.body || ''),
      sound: payload?.sound || 'default',
      priority: payload?.priority || 'high',
      data: baseData,
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const ticketTokenPairs: Array<{ token: string; ticketId: string }> = [];

    for (const chunk of chunks) {
      let sent: Awaited<ReturnType<typeof sendExpoPushChunk>>;
      try {
        sent = await sendExpoPushChunk(chunk);
      } catch (err: any) {
        const msg = String(err?.message || 'EXPO_SEND_ERROR');
        const httpStatusMatch = msg.match(/EXPO_PUSH_SEND_FAILED_(\d+)/);
        const httpStatus = httpStatusMatch ? Number(httpStatusMatch[1]) : null;
        for (const msgItem of chunk) {
          const token = String(msgItem?.to || '');
          if (!token) continue;
          if (isFavoritesPriceFlow) {
            logEvent('error', 'favorites_price_push_dispatch_result', 'notification_service', {
              traceId: meta.traceId,
              userId,
              offerId: meta.offerId,
              provider: meta.provider || 'expo',
              providerTicketId: null,
              status: 'error',
              errorCode: 'EXPO_SEND_FAILED',
              httpStatus,
              retryScheduled: false,
              retryCount: meta.retryCount ?? 0,
              tokenRef: tokenRef(token),
            });
            incMetric('favorites_price_push_failed_total', 1);
          }
        }
        continue;
      }
      const chunkData = Array.isArray(sent?.data) ? sent.data : [];
      for (let i = 0; i < chunkData.length; i += 1) {
        const item = chunkData[i];
        const msg = chunk[i];
        const token = String(msg?.to || '');
        if (!token) continue;
        if (item?.status === 'ok' && item?.id) {
          ticketTokenPairs.push({ token, ticketId: item.id });
          if (isFavoritesPriceFlow) {
            logEvent('info', 'favorites_price_push_dispatch_result', 'notification_service', {
              traceId: meta.traceId,
              userId,
              offerId: meta.offerId,
              provider: meta.provider || 'expo',
              providerTicketId: item.id,
              status: 'ok',
              errorCode: null,
              httpStatus: 200,
              retryScheduled: false,
              retryCount: meta.retryCount ?? 0,
              tokenRef: tokenRef(token),
            });
            incMetric('favorites_price_push_sent_total', 1);
          }
          continue;
        }
        const immediateError = item?.details?.error || item?.status || 'UNKNOWN';
        if (isFavoritesPriceFlow) {
          logEvent('warn', 'favorites_price_push_dispatch_result', 'notification_service', {
            traceId: meta.traceId,
            userId,
            offerId: meta.offerId,
            provider: meta.provider || 'expo',
            providerTicketId: null,
            status: 'error',
            errorCode: immediateError,
            httpStatus: 200,
            retryScheduled: false,
            retryCount: meta.retryCount ?? 0,
            tokenRef: tokenRef(token),
          });
          incMetric('favorites_price_push_failed_total', 1);
        }
        if (immediateError === 'DeviceNotRegistered') {
          await prisma.device.updateMany({
            where: { userId, expoPushToken: token },
            data: { isActive: false, lastSyncedAt: new Date() },
          });
          if (isFavoritesPriceFlow) {
            logEvent('warn', 'device_token_deactivated', 'notification_service', {
              reason: 'DeviceNotRegistered',
              userId,
              tokenRef: tokenRef(token),
              traceId: meta.traceId,
              offerId: meta.offerId,
            });
          }
        }
      }
    }

    // Receipts zwykle są gotowe po chwili; krótki delay i odczyt.
    if (ticketTokenPairs.length) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const ids = ticketTokenPairs.map((t) => t.ticketId);
      const receiptMap = await fetchExpoReceipts(ids);
      for (const pair of ticketTokenPairs) {
        const receipt = receiptMap?.[pair.ticketId];
        if (!receipt) continue;
        if (receipt.status === 'ok') {
          continue;
        }
        const receiptError = receipt?.details?.error || receipt?.message || 'UNKNOWN_RECEIPT_ERROR';
        if (isFavoritesPriceFlow) {
          logEvent('warn', 'favorites_price_push_dispatch_result', 'notification_service', {
            traceId: meta.traceId,
            userId,
            offerId: meta.offerId,
            provider: meta.provider || 'expo',
            providerTicketId: pair.ticketId,
            status: 'error',
            errorCode: receiptError,
            httpStatus: 200,
            retryScheduled: false,
            retryCount: meta.retryCount ?? 0,
            tokenRef: tokenRef(pair.token),
          });
          incMetric('favorites_price_push_failed_total', 1);
        }
        if (receiptError === 'DeviceNotRegistered') {
          await prisma.device.updateMany({
            where: { userId, expoPushToken: pair.token },
            data: { isActive: false, lastSyncedAt: new Date() },
          });
          if (isFavoritesPriceFlow) {
            logEvent('warn', 'device_token_deactivated', 'notification_service', {
              reason: 'DeviceNotRegistered',
              userId,
              tokenRef: tokenRef(pair.token),
              traceId: meta.traceId,
              offerId: meta.offerId,
            });
          }
        }
      }
    }

    await prisma.device.updateMany({
      where: {
        userId,
        expoPushToken: { in: validDevices.map((d) => d.expoPushToken) },
        isActive: true,
      },
      data: { lastSyncedAt: new Date() },
    });
  },
};
