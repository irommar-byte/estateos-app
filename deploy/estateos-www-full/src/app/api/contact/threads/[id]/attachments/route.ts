import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import { resolveContactUserId } from '@/lib/contactRequestAuth';
import { saveContactThreadAttachment } from '@/lib/upload/contactAttachmentUpload';
import {
  MAX_CONTACT_FILE_BYTES,
  MAX_CONTACT_THREAD_BYTES,
  listContactThreadAttachments,
} from '@/lib/contactAttachment';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function assertThreadAccess(threadId: number, userId: number) {
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

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const threadId = parseInt(id, 10);
    if (!Number.isFinite(threadId)) {
      return NextResponse.json({ error: 'Nieprawidłowy wątek.' }, { status: 400 });
    }

    const userId = await resolveContactUserId(_req);
    if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const access = await assertThreadAccess(threadId, userId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    const { usageBytes, attachments } = await listContactThreadAttachments(threadId);

    return NextResponse.json({
      usageBytes,
      limitBytes: MAX_CONTACT_THREAD_BYTES,
      perFileLimitBytes: MAX_CONTACT_FILE_BYTES,
      attachments,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CONTACT ATTACHMENTS GET]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const threadId = parseInt(id, 10);
    if (!Number.isFinite(threadId)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy wątek.' }, { status: 400 });
    }

    const userId = await resolveContactUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });

    const access = await assertThreadAccess(threadId, userId);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    let formData: FormData;
    try {
      formData = await getWebFormData(req);
    } catch {
      return NextResponse.json({ success: false, error: 'Błąd formularza.' }, { status: 400 });
    }

    const file = (formData.get('file') ||
      formData.get('attachment') ||
      formData.get('document')) as File | null;

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ success: false, error: 'Brak pliku.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await saveContactThreadAttachment({
      threadId,
      userId,
      buffer,
      mimeType: String(file.type || ''),
      originalFilename: String((file as File & { name?: string }).name || 'zalacznik'),
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      attachment: {
        url: result.url,
        name: result.name,
        mimeType: result.mimeType,
        size: result.size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CONTACT ATTACHMENTS POST]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
