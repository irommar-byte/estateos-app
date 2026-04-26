import { notificationService } from '@/lib/services/notification.service';
import { prisma } from '@/lib/prisma';
import { NotificationType as PrismaNotificationType } from '@prisma/client';

export type NotificationType =
  | 'NEW_OFFER'
  | 'RADAR_MATCH'
  | 'CRM_EVENT'
  | 'CHAT_MESSAGE';

interface SendNotificationParams {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
}

// 🔥 MAPOWANIE CORE → PRISMA (adapter)
function mapTypeToDb(type: NotificationType): PrismaNotificationType {
  switch (type) {
    case 'RADAR_MATCH':
      return 'AI_RADAR' as PrismaNotificationType;
    case 'NEW_OFFER':
      return 'SYSTEM_ALERT' as PrismaNotificationType;
    case 'CRM_EVENT':
      return 'DEAL_UPDATE' as PrismaNotificationType;
    case 'CHAT_MESSAGE':
      return 'MESSAGE' as PrismaNotificationType;
    default:
      return 'SYSTEM_ALERT' as PrismaNotificationType;
  }
}

export async function sendNotification(params: SendNotificationParams) {
  const { userId, type, title, body, data } = params;

  console.log(`🧠 CORE → ${type} → user ${userId}`);

  // 1. zapis do DB (z mapowaniem)
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      body,
      type: mapTypeToDb(type),
      status: 'PENDING',
    },
  });

  try {
    // 2. push
    await notificationService.sendPushToUser(userId, {
      title,
      body,
      data,
    });

    // 3. update status
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    console.log(`🚀 PUSH SENT: ${notification.id}`);

  } catch (e: any) {
    console.error('❌ PUSH ERROR:', e?.message || e);

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'FAILED',
        failureReason: e?.message || 'UNKNOWN',
        failedAt: new Date(),
      },
    });
  }
}
