import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '@/lib/prisma';

const expo = new Expo();
const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

type DeviceRow = {
  userId: number;
  expoPushToken: string;
  platform: string;
  isActive: boolean;
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
  async sendPushToUser(userId: number, payload: any) {
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
      const sent = await sendExpoPushChunk(chunk);
      const chunkData = Array.isArray(sent?.data) ? sent.data : [];
      for (let i = 0; i < chunkData.length; i += 1) {
        const item = chunkData[i];
        const msg = chunk[i];
        const token = String(msg?.to || '');
        if (!token) continue;
        if (item?.status === 'ok' && item?.id) {
          ticketTokenPairs.push({ token, ticketId: item.id });
          continue;
        }
        const immediateError = item?.details?.error || item?.status || 'UNKNOWN';
        if (immediateError === 'DeviceNotRegistered') {
          await prisma.device.updateMany({
            where: { userId, expoPushToken: token },
            data: { isActive: false, lastSyncedAt: new Date() },
          });
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
        if (receiptError === 'DeviceNotRegistered') {
          await prisma.device.updateMany({
            where: { userId, expoPushToken: pair.token },
            data: { isActive: false, lastSyncedAt: new Date() },
          });
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
