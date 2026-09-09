import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';
import { contactThreadPair } from '@/lib/contactThreadPair';
import { sendContactThreadMessage } from '@/lib/contactSendMessage';
import {
  cleanAttachmentOnlyMessage,
  contactAttachmentPreviewLabel,
  formatContactAttachmentName,
  parseContactMessageParts,
} from '@/lib/contactAttachmentShared';
import {
  CONTACT_UPLOAD_BASE_FS,
  CONTACT_UPLOAD_PUBLIC_PREFIX,
} from '@/lib/upload/contactAttachmentUpload';
import {
  isAllowedContactAttachment,
  MAX_CONTACT_FILE_BYTES,
} from '@/lib/contactAttachment';
import {
  JOURNEY_ACTIVITY,
  parseAttachments,
  parsePortalMessages,
  type PortalAttachment,
  type PortalChatMessage,
} from '@/lib/crm/clientJourney';
import { crmAgentPushData, crmClientChatThreadId } from '@/lib/crm/agentPush';
import { sendClientPortalWebPush } from '@/lib/crm/clientPortalWebPush';
import { portalChatNotifyTarget } from '@/lib/crm/portalChatNotify';
import { parsePortalChatAudience, presentPortalChatFields } from '@/lib/crm/portalChatCopy';
import { touchPortalLinkedPresence } from '@/lib/crm/portalPresence';

const SAFE_NAME_RE = /[^a-zA-Z0-9._-]+/g;

async function ensureAgencyClientThread(agencyUserId: number, linkedUserId: number) {
  const pair = contactThreadPair(agencyUserId, linkedUserId);
  return prisma.contactThread.upsert({
    where: { userLowId_userHighId: pair },
    update: {},
    create: pair,
    select: { id: true },
  });
}

function activityMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function normalizedMessageText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function parsePortalChatCursor(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  if (!Number.isFinite(timestamp)) return null;
  if (timestamp > Date.now() + 60_000) return null;
  if (timestamp < Date.now() - 30 * 24 * 60 * 60_000) return null;
  return parsed;
}

export async function listPortalChat(
  clientId: number,
  viewer: 'client' | 'agent',
  options?: { updatedSince?: Date | null; limit?: number },
): Promise<PortalChatMessage[]> {
  const limit = Math.min(120, Math.max(20, options?.limit || 80));
  const updatedSince = options?.updatedSince || null;
  const [client, activities] = await Promise.all([
    prisma.agencyClient.findUnique({
      where: { id: clientId },
      select: { agencyUserId: true, linkedUserId: true },
    }),
    prisma.agencyClientActivity.findMany({
      where: {
        clientId,
        kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE,
        ...(updatedSince ? { createdAt: { gte: updatedSince } } : {}),
      },
      orderBy: { createdAt: updatedSince ? 'asc' : 'desc' },
      take: limit,
      select: { id: true, kind: true, title: true, body: true, createdAt: true, metadata: true },
    }),
  ]);
  const orderedActivities = updatedSince ? activities : [...activities].reverse();
  const portalMessages = parsePortalMessages(orderedActivities, viewer);
  if (!client?.linkedUserId) return portalMessages;

  const pair = contactThreadPair(client.agencyUserId, client.linkedUserId);
  const thread = await prisma.contactThread.findUnique({
    where: { userLowId_userHighId: pair },
    select: { id: true },
  });
  if (!thread) return portalMessages;
  const contactRows = await prisma.contactMessage.findMany({
    where: {
      threadId: thread.id,
      ...(updatedSince ? { createdAt: { gte: updatedSince } } : {}),
    },
    orderBy: { createdAt: updatedSince ? 'asc' : 'desc' },
    take: limit,
    select: {
      id: true,
      senderId: true,
      content: true,
      attachment: true,
      createdAt: true,
    },
  });
  const contactMessages = updatedSince ? contactRows : [...contactRows].reverse();

  const representedContactIds = new Set(
    activities
      .map((row) => Number(activityMeta(row.metadata).contactMessageId || 0))
      .filter((id) => Number.isFinite(id) && id > 0),
  );
  const merged = [...portalMessages];

  for (const contact of contactMessages) {
    if (representedContactIds.has(contact.id)) continue;
    const parts = parseContactMessageParts(contact);
    const fromAgent = contact.senderId === client.agencyUserId;
    const attachmentUrl = parts.attachment?.url || '';
    const attachments = parts.attachment ? [parts.attachment] : [];
    const presented = presentPortalChatFields({
      content: cleanAttachmentOnlyMessage(parts.text, attachments),
      fromAgent,
      viewer,
    });
    const representedByLegacyActivity = portalMessages.some((message) => {
      if (message.fromAgent !== fromAgent) return false;
      if (Math.abs(new Date(message.createdAt).getTime() - contact.createdAt.getTime()) > 15_000) return false;
      if (normalizedMessageText(message.content) !== normalizedMessageText(presented.content)) return false;
      const portalAttachmentUrl = message.attachments[0]?.url || '';
      return portalAttachmentUrl === attachmentUrl;
    });
    if (representedByLegacyActivity) continue;
    if (!presented.visible) continue;
    merged.push({
      id: -contact.id,
      content: presented.content,
      createdAt: contact.createdAt.toISOString(),
      fromAgent,
      fromMe: viewer === 'agent' ? fromAgent : !fromAgent,
      attachments,
      kind: presented.kind,
      audience: presented.audience,
      offerTitle: presented.offerTitle,
    });
  }

  return merged
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-Math.max(limit, 120));
}

export async function getPortalChatState(
  clientId: number,
  viewer: 'client' | 'agent',
  options?: { updatedSince?: Date | null },
) {
  const [client, messages] = await Promise.all([
    prisma.clientPortalChatState.findUnique({
      where: { clientId },
      select: { clientLastReadAt: true, agentLastReadAt: true },
    }),
    listPortalChat(clientId, viewer, { updatedSince: options?.updatedSince }),
  ]);
  const lastReadAt =
    viewer === 'client' ? client?.clientLastReadAt || null : client?.agentLastReadAt || null;
  const unreadCount = messages.filter((message) => {
    const fromPeer = viewer === 'client' ? message.fromAgent : !message.fromAgent;
    return fromPeer && (!lastReadAt || new Date(message.createdAt) > lastReadAt);
  }).length;
  const newestAt = messages.reduce(
    (latest, message) => Math.max(latest, new Date(message.createdAt).getTime()),
    options?.updatedSince?.getTime() || 0,
  );
  return {
    messages,
    unreadCount,
    nextCursor: newestAt > 0 ? new Date(newestAt).toISOString() : new Date().toISOString(),
    incremental: Boolean(options?.updatedSince),
  };
}

export async function markPortalChatRead(clientId: number, viewer: 'client' | 'agent') {
  const [client, state, latestActivityRows] = await Promise.all([
    prisma.agencyClient.findUnique({
      where: { id: clientId },
      select: { agencyUserId: true, linkedUserId: true },
    }),
    prisma.clientPortalChatState.findUnique({
      where: { clientId },
      select: { clientLastReadAt: true, agentLastReadAt: true },
    }),
    prisma.$queryRawUnsafe<Array<{ createdAt: Date }>>(
      `SELECT createdAt
       FROM AgencyClientActivity
       WHERE clientId = ?
         AND kind = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.from')) = ?
       ORDER BY createdAt DESC
       LIMIT 1`,
      clientId,
      JOURNEY_ACTIVITY.PORTAL_MESSAGE,
      viewer === 'client' ? 'agent' : 'client',
    ),
  ]);
  if (!client) return;

  let threadId: number | null = null;
  let latestContactAt: Date | null = null;
  if (client.linkedUserId) {
    const pair = contactThreadPair(client.agencyUserId, client.linkedUserId);
    const thread = await prisma.contactThread.findUnique({
      where: { userLowId_userHighId: pair },
      select: { id: true },
    });
    threadId = thread?.id || null;
    if (threadId) {
      const latestContact = await prisma.contactMessage.findFirst({
        where: {
          threadId,
          senderId: viewer === 'client' ? client.agencyUserId : client.linkedUserId,
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      latestContactAt = latestContact?.createdAt || null;
    }
  }
  const latestActivityAt = latestActivityRows[0]?.createdAt || null;
  const targetMs = Math.max(latestActivityAt?.getTime() || 0, latestContactAt?.getTime() || 0);
  const lastReadAt = viewer === 'client' ? state?.clientLastReadAt : state?.agentLastReadAt;
  if (targetMs > 0 && (!lastReadAt || lastReadAt.getTime() < targetMs)) {
    const target = new Date(targetMs);
    await prisma.clientPortalChatState.upsert({
      where: { clientId },
      create:
        viewer === 'client'
          ? { clientId, clientLastReadAt: target }
          : { clientId, agentLastReadAt: target },
      update: viewer === 'client' ? { clientLastReadAt: target } : { agentLastReadAt: target },
    });
  }

  if (threadId && client.linkedUserId) {
    const peerSenderId = viewer === 'client' ? client.agencyUserId : client.linkedUserId;
    await prisma.contactMessage.updateMany({
      where: { threadId, senderId: peerSenderId, isRead: false },
      data: { isRead: true },
    });
  }
}

export async function savePortalAttachment(params: {
  clientId: number;
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
}): Promise<{ ok: true; attachment: PortalAttachment } | { ok: false; status: number; error: string }> {
  if (params.buffer.length === 0) {
    return { ok: false, status: 400, error: 'Pusty plik.' };
  }
  if (params.buffer.length > MAX_CONTACT_FILE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Plik przekracza limit ${MAX_CONTACT_FILE_BYTES / (1024 * 1024)} MB.`,
    };
  }

  const originalName = formatContactAttachmentName(params.originalFilename, 'zalacznik');
  if (!isAllowedContactAttachment(params.mimeType, originalName)) {
    return { ok: false, status: 415, error: 'Niedozwolony typ pliku.' };
  }

  const root = path.join(CONTACT_UPLOAD_BASE_FS, `portal-${params.clientId}`);
  await fs.mkdir(root, { recursive: true });

  const base = path.basename(originalName).replace(SAFE_NAME_RE, '_');
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
  const stem = ext ? base.slice(0, base.lastIndexOf('.')) : base;
  const safeStem = stem.slice(0, 80) || 'attachment';
  const safeExt = ext.length <= 10 ? ext : '';
  const finalName = `${safeStem}-${Date.now()}-${Math.round(Math.random() * 1e4)}${safeExt}`;
  await fs.writeFile(path.join(root, finalName), params.buffer);

  const mimeType =
    String(params.mimeType || '').trim() ||
    (safeExt.toLowerCase() === '.pdf' ? 'application/pdf' : 'application/octet-stream');

  return {
    ok: true,
    attachment: {
      url: `${CONTACT_UPLOAD_PUBLIC_PREFIX}/portal-${params.clientId}/${finalName}`,
      name: originalName,
      mimeType,
      size: params.buffer.length,
    },
  };
}

export async function sendPortalChat(params: {
  clientId: number;
  agencyUserId: number;
  linkedUserId?: number | null;
  from: 'agent' | 'client';
  content?: string;
  attachments?: PortalAttachment[];
  clientName?: string;
  checkbackQuickReplies?: {
    activityId: number;
    options: Array<{ id: string; label: string }>;
  };
  activityOnly?: boolean;
  activityMetadata?: Record<string, unknown>;
}) {
  const attachments = parseAttachments(params.attachments);
  const content = String(params.content || '').trim();
  if (!content && attachments.length === 0) {
    return { ok: false as const, status: 400, error: 'Wpisz treść wiadomości albo dodaj załącznik.' };
  }

  const audience = parsePortalChatAudience(params.activityMetadata?.audience);
  const agentOnly = audience === 'agent';
  const activityOnly = Boolean(params.activityOnly || agentOnly);
  const body = content || attachments.map((item) => contactAttachmentPreviewLabel(item)).join(', ');
  const metadata = {
    ...params.activityMetadata,
    audience,
    from: params.from,
    content,
    attachments,
    ...(params.checkbackQuickReplies ? { checkbackQuickReplies: params.checkbackQuickReplies } : {}),
  };
  const activity = await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE,
      title: agentOnly
        ? 'Notatka dla agenta'
        : params.from === 'client'
          ? 'Wiadomość od klienta'
          : 'Wiadomość do klienta',
      body: body.slice(0, 280),
      metadata,
    },
    select: { id: true, kind: true, title: true, body: true, createdAt: true, metadata: true },
  });

  let contactMirrored = false;
  if (!activityOnly && params.linkedUserId) {
    try {
      const thread = await ensureAgencyClientThread(params.agencyUserId, params.linkedUserId);
      const senderId = params.from === 'agent' ? params.agencyUserId : params.linkedUserId;
      const contactResult = await sendContactThreadMessage({
        threadId: thread.id,
        userId: senderId,
        content: content || (attachments[0] ? contactAttachmentPreviewLabel(attachments[0]) : ''),
        attachment: attachments[0] || null,
        mirrorToClientPortal: false,
        skipReceiverNotify: params.from === 'client',
      });
      if (contactResult.ok) {
        contactMirrored = true;
        await prisma.agencyClientActivity.update({
          where: { id: activity.id },
          data: {
            metadata: {
              ...metadata,
              contactThreadId: thread.id,
              contactMessageId: contactResult.message.id,
            },
          },
        });
      }
    } catch {
      /* portal activity remains the source of truth */
    }
  }

  const notifyTarget = portalChatNotifyTarget({
    from: params.from,
    activityOnly,
    contactMirrored,
    audience,
  });
  if (params.from === 'client') {
    await touchPortalLinkedPresence(params.linkedUserId, { force: true });
  }
  if (notifyTarget === 'agent') {
    const thread = crmClientChatThreadId(params.clientId);
    await sendNotification({
      userId: params.agencyUserId,
      type: 'CHAT_MESSAGE',
      title: 'Wiadomość od klienta',
      body: `${params.clientName || 'Klient'}: ${body.slice(0, 120)}`,
      data: {
        ...crmAgentPushData(params.clientId, { notificationType: 'crm_client_message' }),
        threadIdentifier: thread,
        iosThreadId: thread,
      },
    }).catch(() => {});
  } else if (notifyTarget === 'client') {
    await sendClientPortalWebPush(params.clientId, {
      title: 'Nowa wiadomość od Twojego agenta',
      body: body.slice(0, 160),
      tag: `estateos-client-chat-${params.clientId}`,
      native: !contactMirrored,
      openChat: true,
    }).catch(() => {});
  }

  const [message] = parsePortalMessages([activity], params.from === 'agent' ? 'agent' : 'client');
  return { ok: true as const, message };
}

const typingUntil = new Map<string, number>();

export function markPortalTyping(clientId: number, who: 'agent' | 'client') {
  typingUntil.set(`${clientId}:${who}`, Date.now() + 4000);
}

export function isPortalPeerTyping(clientId: number, viewer: 'agent' | 'client') {
  const peer = viewer === 'agent' ? 'client' : 'agent';
  return (typingUntil.get(`${clientId}:${peer}`) || 0) > Date.now();
}
