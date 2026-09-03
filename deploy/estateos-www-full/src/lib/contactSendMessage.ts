import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';
import { contactPeerId } from '@/lib/contactThreadPair';
import { buildContactMessagePushPayload } from '@/lib/contactPushPayload';
import {
  ContactAttachmentMeta,
  encodeContactAttachmentMessage,
  parseContactAttachmentMeta,
  parseContactMessageParts,
} from '@/lib/contactAttachmentShared';
import { JOURNEY_ACTIVITY } from '@/lib/crm/clientJourney';
import { sendClientPortalWebPush } from '@/lib/crm/clientPortalWebPush';

const MESSAGE_DEDUP_WINDOW_MS = 10_000;

export async function sendContactThreadMessage(params: {
  threadId: number;
  userId: number;
  content?: string;
  attachment?: ContactAttachmentMeta | null;
  mirrorToClientPortal?: boolean;
  skipReceiverNotify?: boolean;
}) {
  const thread = await prisma.contactThread.findUnique({
    where: { id: params.threadId },
    select: { id: true, userLowId: true, userHighId: true },
  });
  if (!thread) {
    return { ok: false as const, status: 404, error: 'Wątek nie istnieje.' };
  }
  if (thread.userLowId !== params.userId && thread.userHighId !== params.userId) {
    return { ok: false as const, status: 403, error: 'Brak dostępu do wątku.' };
  }

  let content = String(params.content ?? '').trim();
  let attachmentUrl: string | null = null;
  const attachmentMeta =
    params.attachment && typeof params.attachment === 'object'
      ? parseContactAttachmentMeta(params.attachment)
      : null;

  if (attachmentMeta) {
    const encoded = encodeContactAttachmentMessage(content, attachmentMeta);
    content = encoded.content;
    attachmentUrl = encoded.attachment;
  }

  if (!content) {
    return { ok: false as const, status: 400, error: 'Brak treści wiadomości.' };
  }

  const dedupSince = new Date(Date.now() - MESSAGE_DEDUP_WINDOW_MS);
  const recentSame = await prisma.contactMessage.findFirst({
    where: {
      threadId: params.threadId,
      senderId: params.userId,
      content,
      attachment: attachmentUrl,
      createdAt: { gte: dedupSince },
    },
    orderBy: { createdAt: 'desc' },
  });

  const createdFresh = !recentSame;
  const newMessage =
    recentSame ||
    (await prisma.contactMessage.create({
      data: {
        threadId: params.threadId,
        senderId: params.userId,
        content,
        attachment: attachmentUrl,
        isRead: false,
      },
    }));

  await prisma.contactThread.update({
    where: { id: params.threadId },
    data: { updatedAt: new Date() },
  });

  const receiverId = contactPeerId(thread, params.userId);
  const sender = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { name: true, email: true },
  });
  const senderName =
    sender?.name?.trim() ||
    (sender?.email ? String(sender.email).split('@')[0] : null) ||
    `Użytkownik #${params.userId}`;

  const shortPreview = attachmentMeta
    ? attachmentMeta.name || '📎 Załącznik'
    : content.replace(/\[\[CONTACT_ATTACHMENT\]\][\s\S]*/, '').slice(0, 120) || '📎 Załącznik';

  if (!params.skipReceiverNotify) {
    try {
      await prisma.notification.create({
        data: {
          userId: receiverId,
          idempotencyKey: `contact_msg:thread:${params.threadId}:msg:${newMessage.id}`,
          title: 'EstateOS™ Contact',
          body: `${senderName}: ${shortPreview}`,
          type: 'MESSAGE',
          targetType: 'CHAT',
          targetId: String(params.threadId),
        },
      });
    } catch {
      /* idempotency duplicate */
    }

    try {
      await notificationService.sendPushToUser(
        receiverId,
        buildContactMessagePushPayload({
          senderName,
          preview: shortPreview,
          threadId: params.threadId,
          senderUserId: params.userId,
        }),
      );
    } catch (pushErr) {
      console.error('[CONTACT MSG PUSH]', pushErr);
    }
  }

  if (createdFresh && params.mirrorToClientPortal !== false) {
    try {
      const clients = await prisma.agencyClient.findMany({
        where: {
          status: 'ACTIVE',
          portalToken: { not: null },
          OR: [
            { agencyUserId: params.userId, linkedUserId: receiverId },
            { agencyUserId: receiverId, linkedUserId: params.userId },
          ],
        },
        select: { id: true, agencyUserId: true },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      });
      const parts = parseContactMessageParts(newMessage);
      for (const client of clients) {
        const from = client.agencyUserId === params.userId ? 'agent' : 'client';
        const attachments = parts.attachment ? [parts.attachment] : [];
        const body = parts.text || parts.attachment?.name || 'Załącznik';
        await prisma.agencyClientActivity.create({
          data: {
            clientId: client.id,
            agencyUserId: client.agencyUserId,
            kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE,
            title: from === 'client' ? 'Wiadomość od klienta' : 'Wiadomość do klienta',
            body: body.slice(0, 280),
            metadata: {
              from,
              content: parts.text,
              attachments,
              contactThreadId: params.threadId,
              contactMessageId: newMessage.id,
            },
          },
        });
        if (from === 'agent') {
          await sendClientPortalWebPush(client.id, {
            title: 'Nowa wiadomość od Twojego agenta',
            body: body.slice(0, 160),
            tag: `estateos-client-chat-${client.id}`,
            native: false,
          }).catch(() => {});
        }
      }
    } catch (portalMirrorError) {
      console.error(
        '[CONTACT MSG → CLIENT PORTAL]',
        portalMirrorError instanceof Error ? portalMirrorError.message : String(portalMirrorError),
      );
    }
  }

  return { ok: true as const, message: newMessage };
}
