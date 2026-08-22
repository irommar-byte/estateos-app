import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';
import { contactThreadPair } from '@/lib/contactThreadPair';
import { sendContactThreadMessage } from '@/lib/contactSendMessage';
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

export async function listPortalChat(clientId: number, viewer: 'client' | 'agent'): Promise<PortalChatMessage[]> {
  const activities = await prisma.agencyClientActivity.findMany({
    where: { clientId, kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, kind: true, title: true, body: true, createdAt: true, metadata: true },
  });
  return parsePortalMessages(activities, viewer);
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

  const originalName = String(params.originalFilename || 'zalacznik').trim() || 'zalacznik';
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
}) {
  const attachments = parseAttachments(params.attachments);
  const content = String(params.content || '').trim();
  if (!content && attachments.length === 0) {
    return { ok: false as const, status: 400, error: 'Wpisz treść wiadomości albo dodaj załącznik.' };
  }

  const body = content || attachments.map((item) => item.name).join(', ');
  const activity = await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE,
      title: params.from === 'client' ? 'Wiadomość od klienta' : 'Wiadomość do klienta',
      body: body.slice(0, 280),
      metadata: {
        from: params.from,
        content,
        attachments,
      },
    },
    select: { id: true, kind: true, title: true, body: true, createdAt: true, metadata: true },
  });

  if (params.linkedUserId) {
    try {
      const thread = await ensureAgencyClientThread(params.agencyUserId, params.linkedUserId);
      const senderId = params.from === 'agent' ? params.agencyUserId : params.linkedUserId;
      await sendContactThreadMessage({
        threadId: thread.id,
        userId: senderId,
        content: content || (attachments[0] ? `📎 ${attachments[0].name}` : ''),
        attachment: attachments[0] || null,
      });
    } catch {
      /* portal activity remains the source of truth */
    }
  }

  if (params.from === 'client') {
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
