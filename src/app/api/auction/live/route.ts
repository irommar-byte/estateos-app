export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { listLiveAuctionEvents, mapAuctionError } from '@/lib/auction';
import { resolveWebUserId } from '@/lib/webSessionAuth';

/** Publiczna lista aktywnych licytacji (opcjonalnie z kontekstem zalogowanego użytkownika). */
export async function GET(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    const events = await listLiveAuctionEvents(userId ?? null);
    return NextResponse.json({ success: true, events });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
