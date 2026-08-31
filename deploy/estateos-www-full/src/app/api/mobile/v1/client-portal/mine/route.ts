import { NextResponse } from 'next/server';
import { bearerUserIdFromRequest, listAndLinkPortalsForUser } from '@/lib/crm/portalAccountLink';

export async function GET(req: Request) {
  const userId = bearerUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
  }
  const portals = await listAndLinkPortalsForUser(userId);
  return NextResponse.json({ success: true, portals });
}
