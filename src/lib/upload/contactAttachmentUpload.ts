import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  MAX_CONTACT_FILE_BYTES,
  MAX_CONTACT_THREAD_BYTES,
  isAllowedContactAttachment,
  getContactThreadUsageBytes,
} from '@/lib/contactAttachment';

export const CONTACT_UPLOAD_BASE_FS =
  process.env.CONTACT_UPLOAD_ROOT || '/home/rommar/uploads/contact';

export const CONTACT_UPLOAD_PUBLIC_PREFIX = '/uploads/contact';

const SAFE_NAME_RE = /[^a-zA-Z0-9._-]+/g;

async function assertContactThreadParticipant(threadId: number, userId: number) {
  const thread = await prisma.contactThread.findUnique({
    where: { id: threadId },
    select: { id: true, userLowId: true, userHighId: true },
  });
  if (!thread) return { ok: false as const, status: 404, error: 'Wątek nie istnieje.' };
  if (thread.userLowId !== userId && thread.userHighId !== userId) {
    return { ok: false as const, status: 403, error: 'Brak dostępu do wątku.' };
  }
  return { ok: true as const, thread };
}

export async function saveContactThreadAttachment(params: {
  threadId: number;
  userId: number;
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
}): Promise<
  | { ok: true; url: string; name: string; mimeType: string; size: number }
  | { ok: false; status: number; error: string }
> {
  const access = await assertContactThreadParticipant(params.threadId, params.userId);
  if (!access.ok) return access;

  if (params.buffer.length === 0) {
    return { ok: false, status: 400, error: 'Pusty plik.' };
  }
  if (params.buffer.length > MAX_CONTACT_FILE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Plik przekracza limit ${MAX_CONTACT_FILE_BYTES / (1024 * 1024)} MB na załącznik.`,
    };
  }

  const originalName = String(params.originalFilename || 'zalacznik').trim() || 'zalacznik';
  if (!isAllowedContactAttachment(params.mimeType, originalName)) {
    return { ok: false, status: 415, error: 'Niedozwolony typ pliku.' };
  }

  const currentUsage = await getContactThreadUsageBytes(params.threadId);
  if (currentUsage + params.buffer.length > MAX_CONTACT_THREAD_BYTES) {
    return {
      ok: false,
      status: 400,
      error: 'Przekroczono łączny limit 100 MB załączników w tej rozmowie.',
    };
  }

  const threadRoot = path.join(CONTACT_UPLOAD_BASE_FS, String(params.threadId));
  try {
    await fs.access(threadRoot);
  } catch {
    await fs.mkdir(threadRoot, { recursive: true });
  }

  const base = path.basename(originalName).replace(SAFE_NAME_RE, '_');
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
  const stem = ext ? base.slice(0, base.lastIndexOf('.')) : base;
  const safeStem = stem.slice(0, 80) || 'attachment';
  const safeExt = ext.length <= 10 ? ext : '';
  const finalName = `${safeStem}-${Date.now()}-${Math.round(Math.random() * 1e4)}${safeExt}`;
  const filePath = path.join(threadRoot, finalName);

  await fs.writeFile(filePath, params.buffer);

  const publicUrl = `${CONTACT_UPLOAD_PUBLIC_PREFIX}/${params.threadId}/${finalName}`;
  const mimeType =
    String(params.mimeType || '').trim() ||
    (safeExt.toLowerCase() === '.pdf' ? 'application/pdf' : 'application/octet-stream');

  return {
    ok: true,
    url: publicUrl,
    name: originalName,
    mimeType,
    size: params.buffer.length,
  };
}
