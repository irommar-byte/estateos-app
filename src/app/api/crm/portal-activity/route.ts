import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { listPortalActivity } from '@/lib/crm/portalEvents';

export const dynamic = 'force-dynamic';

/** „Dziś → U klientów”: co klienci zrobili w swoich panelach (ulubione, oceny, terminy, dokumenty, polecenia). */
export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) return NextResponse.json({ error: 'Dostęp tylko dla agentów.' }, { status: 403 });
  const items = await listPortalActivity(agencyUserId, 40);
  return NextResponse.json({ success: true, items });
}
