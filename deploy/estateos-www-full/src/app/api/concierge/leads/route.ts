import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { listEnrichedLeadTransfersForUser } from '@/lib/leadTransfer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji.' }, { status: 401 });
  }

  const leads = await listEnrichedLeadTransfersForUser(userId);
  return NextResponse.json({ success: true, leads });
}
