import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import {
  getPortalChatState,
  isPortalPeerTyping,
  markPortalChatRead,
  markPortalTyping,
  parsePortalChatCursor,
  sendPortalChat,
} from '@/lib/crm/portalChat';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const clientId = Number(id);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');
  const client = await prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, status: 'ACTIVE' },
    select: { id: true, linkedUserId: true, firstName: true, lastName: true },
  });
  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  }

  if (action === 'list') {
    const state = await getPortalChatState(client.id, 'agent', {
      updatedSince: parsePortalChatCursor(body.updatedSince),
    });
    return NextResponse.json({
      success: true,
      ...state,
      peerTyping: isPortalPeerTyping(client.id, 'agent'),
    });
  }
  if (action === 'read') {
    await markPortalChatRead(client.id, 'agent');
    return NextResponse.json({ success: true, unreadCount: 0 });
  }
  if (action === 'typing') {
    markPortalTyping(client.id, 'agent');
    return NextResponse.json({ success: true });
  }
  if (action === 'send') {
    const result = await sendPortalChat({
      clientId: client.id,
      agencyUserId,
      linkedUserId: client.linkedUserId,
      from: 'agent',
      content: String(body.content || ''),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      clientName: `${client.firstName} ${client.lastName}`.trim(),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, message: result.message });
  }
  return NextResponse.json({ error: 'Nieznana akcja czatu.' }, { status: 400 });
}
