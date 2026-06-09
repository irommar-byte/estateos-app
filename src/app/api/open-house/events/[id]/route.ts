export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getOpenHouseEventById, mapOpenHouseError, updateOpenHouseEvent } from '@/lib/openHouse';
import { requireInvestorProWeb } from '@/lib/requireInvestorProWeb';
import { resolveWebUserId } from '@/lib/webSessionAuth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const eventId = Number(rawId);

  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid eventId' }, { status: 400 });
  }

  try {
    const userId = await resolveWebUserId(req);
    const event = await getOpenHouseEventById(eventId, userId);
    if (!event) {
      return NextResponse.json({ success: false, message: 'Wydarzenie niedostępne' }, { status: 404 });
    }
    if (event.status !== 'PUBLISHED' && !event.isHost) {
      return NextResponse.json({ success: false, message: 'Wydarzenie niedostępne' }, { status: 404 });
    }
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const gate = await requireInvestorProWeb(req);
  if (!gate.ok) return gate.response;

  const { id: rawId } = await context.params;
  const eventId = Number(rawId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid eventId' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const event = await updateOpenHouseEvent(gate.userId, eventId, {
      title: body.title,
      description: body.description,
      status: body.status,
      replaceSlots: body.replaceSlots,
    });
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
