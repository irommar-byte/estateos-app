import { Expo } from 'expo-server-sdk';
import { prisma } from '@/lib/prisma';

const expo = new Expo();

export const notificationService = {
  async sendPushToUser(userId: number, payload: any) {
    console.log(`[PUSH] UserID: ${userId}`);

    const devices = await prisma.device.findMany({
      where: { userId, isActive: true }
    });

    if (!devices.length) {
      console.log(`[PUSH] Brak urządzeń`);
      return;
    }

    const messages = devices
      .filter(d => Expo.isExpoPushToken(d.expoPushToken))
      .map(d => ({
        to: d.expoPushToken,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
      }));

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
        console.log(`[PUSH] OK chunk`);
      } catch (e: any) {
        console.error(`[PUSH] ERROR`, e?.message || e);
      }
    }
  }
};
