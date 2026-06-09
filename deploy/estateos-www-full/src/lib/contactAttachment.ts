import { prisma } from '@/lib/prisma';
import {
  CONTACT_ATTACHMENT_PREFIX,
  MAX_CONTACT_FILE_BYTES,
  MAX_CONTACT_THREAD_BYTES,
  type ContactThreadAttachmentRow,
  parseContactMessageParts,
} from '@/lib/contactAttachmentShared';

export * from '@/lib/contactAttachmentShared';

export async function listContactThreadAttachments(threadId: number): Promise<{
  usageBytes: number;
  attachments: ContactThreadAttachmentRow[];
}> {
  const messages = await prisma.contactMessage.findMany({
    where: {
      threadId,
      OR: [{ attachment: { not: null } }, { content: { contains: CONTACT_ATTACHMENT_PREFIX } }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, senderId: true, content: true, attachment: true, createdAt: true },
  });

  const attachments: ContactThreadAttachmentRow[] = [];
  let usageBytes = 0;

  for (const msg of messages) {
    const { attachment } = parseContactMessageParts(msg);
    if (!attachment) continue;
    usageBytes += attachment.size;
    attachments.push({
      ...attachment,
      messageId: msg.id,
      senderId: msg.senderId,
      createdAt: msg.createdAt.toISOString(),
    });
  }

  return { usageBytes, attachments };
}

export async function getContactThreadUsageBytes(threadId: number): Promise<number> {
  const { usageBytes } = await listContactThreadAttachments(threadId);
  return usageBytes;
}

export { MAX_CONTACT_FILE_BYTES, MAX_CONTACT_THREAD_BYTES };
