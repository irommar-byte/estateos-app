import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseMobileUserIdFromAuthHeader } from '@/lib/mobileAuthUserId';

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

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const threadId = parseInt(id, 10);
    if (!Number.isFinite(threadId)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy wątek.' }, { status: 400 });
    }

    const userId = parseMobileUserIdFromAuthHeader(_req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });

    const access = await assertThreadAccess(threadId, userId);
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

    await prisma.contactThread.delete({ where: { id: threadId } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CONTACT THREAD DELETE]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
