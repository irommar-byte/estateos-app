export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import {
  createOpenHouseEvent,
  listHostOpenHouseEvents,
  mapOpenHouseError,
} from '@/lib/openHouse';
import { requireInvestorProWeb } from '@/lib/requireInvestorProWeb';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') || 'host';
  if (scope !== 'host') {
    return NextResponse.json({ success: false, message: 'Unsupported scope' }, { status: 400 });
  }

  try {
    const events = await listHostOpenHouseEvents(userId);
    return NextResponse.json({ success: true, events });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  const gate = await requireInvestorProWeb(req);
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const event = await createOpenHouseEvent(gate.userId, {
      offerId: Number(body.offerId),
      title: body.title ?? null,
      description: body.description ?? null,
      visitMode: body.visitMode ?? 'FLEX',
      slots: Array.isArray(body.slots) ? body.slots : [],
      publish: body.publish !== false,
    });
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
