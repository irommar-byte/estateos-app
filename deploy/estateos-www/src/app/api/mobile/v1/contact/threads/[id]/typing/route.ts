import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseMobileUserIdFromAuthHeader } from '@/lib/mobileAuthUserId';

export const dynamic = 'force-dynamic';

const globalAny = global as typeof globalThis & { contactTypingStore?: Record<number, Record<number, number>> };
if (!globalAny.contactTypingStore) globalAny.contactTypingStore = {};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const threadId = parseInt(id, 10);
    const userId = parseMobileUserIdFromAuthHeader(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

    const thread = await prisma.contactThread.findUnique({
      where: { id: threadId },
      select: { id: true, userLowId: true, userHighId: true },
    });
    if (!thread) return NextResponse.json({ ok: false }, { status: 404 });
    if (thread.userLowId !== userId && thread.userHighId !== userId) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    if (!globalAny.contactTypingStore![threadId]) globalAny.contactTypingStore![threadId] = {};
    globalAny.contactTypingStore![threadId][userId] = Date.now();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
