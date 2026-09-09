import { NextResponse } from 'next/server';
import {
  getPortalChatState,
  isPortalPeerTyping,
  markPortalChatRead,
  markPortalTyping,
  parsePortalChatCursor,
} from '@/lib/crm/portalChat';
import { touchPortalLinkedPresence } from '@/lib/crm/portalPresence';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteCtx = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: { id: true, linkedUserId: true },
  });
  if (!client) {
    return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
  }

  if (action === 'list') {
    await touchPortalLinkedPresence(client.linkedUserId);
    const state = await getPortalChatState(client.id, 'client', {
      updatedSince: parsePortalChatCursor(body.updatedSince),
    });
    return NextResponse.json({
      success: true,
      ...state,
      peerTyping: isPortalPeerTyping(client.id, 'client'),
    });
  }
  if (action === 'read') {
    await markPortalChatRead(client.id, 'client');
    return NextResponse.json({ success: true, unreadCount: 0 });
  }
  if (action === 'typing') {
    markPortalTyping(client.id, 'client');
    await touchPortalLinkedPresence(client.linkedUserId, { force: true });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Nieznana akcja czatu.' }, { status: 400 });
}
