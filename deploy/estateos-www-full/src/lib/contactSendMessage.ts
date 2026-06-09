import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';
import { contactPeerId } from '@/lib/contactThreadPair';
import { buildContactMessagePushPayload } from '@/lib/contactPushPayload';
import {
  ContactAttachmentMeta,
  encodeContactAttachmentMessage,
  parseContactAttachmentMeta,
} from '@/lib/contactAttachmentShared';

const MESSAGE_DEDUP_WINDOW_MS = 10_000;

export async function sendContactThreadMessage(params: {
  threadId: number;
  userId: number;
  content?: string;
  attachment?: ContactAttachmentMeta | null;
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

  return { ok: true as const, message: newMessage };
}
