import { notificationService } from '@/lib/services/notification.service';
import { prisma } from '@/lib/prisma';
import { NotificationType as PrismaNotificationType, Prisma } from '@prisma/client';
import { ESTATEOS_NOTIFY_SOUND, CONTACT_PUSH_CHANNEL_ID } from '@/lib/contactPushPayload';

export type NotificationType =
  | 'NEW_OFFER'
  | 'RADAR_MATCH'
  | 'CRM_EVENT'
  | 'CHAT_MESSAGE'
  | 'ADMIN_ATTENTION';

interface SendNotificationParams {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  idempotencyKey?: string;
}

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
    case 'ADMIN_ATTENTION':
      return 'SYSTEM_ALERT' as PrismaNotificationType;
    default:
      return 'SYSTEM_ALERT' as PrismaNotificationType;
  }
}

export async function sendNotification(params: SendNotificationParams) {
  const { userId, type, title, body, data, idempotencyKey } = params;

  console.log(`🧠 CORE → ${type} → user ${userId}`);

  let notification;
  try {
    notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: mapTypeToDb(type),
        status: 'PENDING',
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    });
  } catch (error) {
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.notification.findFirst({
        where: { userId, idempotencyKey },
        select: { id: true, status: true },
      });
      if (existing?.status === 'FAILED') {
        notification = existing;
      } else {
        console.log(`🧠 CORE → ${type} → user ${userId} (duplicate idempotency, skip)`);
        return;
      }
    } else {
      throw error;
    }
  }

  try {
    await notificationService.sendPushToUser(userId, {
      title,
      body,
      data,
      ...(data?.threadIdentifier
        ? {
            threadIdentifier: String(data.threadIdentifier),
            mutableContent: true,
            sound: ESTATEOS_NOTIFY_SOUND,
            channelId: CONTACT_PUSH_CHANNEL_ID,
          }
        : {}),
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    console.log(`🚀 PUSH SENT: ${notification.id}`);
  } catch (e: any) {
    const msg = String(e?.message || e || 'UNKNOWN');
    if (msg.includes('NO_ACTIVE_DEVICES')) {
      console.warn(`⚠️ PUSH SKIP (no devices) notification=${notification.id} user=${userId}`);
    } else {
      console.error('❌ PUSH ERROR:', msg);
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'FAILED',
        failureReason: msg,
        failedAt: new Date(),
      },
    });
  }
}
