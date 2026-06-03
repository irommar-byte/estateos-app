export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import {
  getOpenHouseEventById,
  mapOpenHouseError,
  updateOpenHouseEvent,
} from '@/lib/openHouse';

function parseUserId(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as Record<string, unknown>;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const userId = parseUserId(req);
  const { id } = await context.params;
  const eventId = Number(id);

  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });
  }

  try {
    const event = await getOpenHouseEventById(eventId, userId);
    if (!event) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }
    if (event.status !== 'PUBLISHED' && !event.isHost) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const userId = parseUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const event = await updateOpenHouseEvent(userId, eventId, {
      title: body.title,
      description: body.description,
      status: body.status,
      replaceSlots: Array.isArray(body.slots) ? body.slots : undefined,
    });
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
