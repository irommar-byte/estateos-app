import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '@/lib/prisma';

const expo = new Expo();

export const notificationService = {
  async sendPushToUser(userId: number, payload: any) {
    console.log(`[PUSH] UserID: ${userId}`);

    const devices = await prisma.device.findMany({
      where: { userId, isActive: true }
    });

    console.log("[PUSH DEBUG] DEVICES:", devices);

    if (!devices.length) {
      console.log(`[PUSH] Brak aktywnych urządzeń dla użytkownika ${userId}`);
      throw new Error('NO_ACTIVE_DEVICES');
    }

    const messages: ExpoPushMessage[] = [];

    for (const d of devices) {
      if (!Expo.isExpoPushToken(d.expoPushToken)) {
        console.warn(`[PUSH] Niewłaściwy token Expo: ${d.expoPushToken}`);
        continue;
      }

      messages.push({
        to: d.expoPushToken,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
      });
    }

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
      console.log(`[PUSH] Chunk wysłany poprawnie`);
    }
  }
};
