import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getIntelligenceSmartAddEnabled, setIntelligenceSmartAddEnabled } from '@/lib/intelligenceSmartAdd';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export const dynamic = 'force-dynamic';

async function resolveImporterUserId(req: Request): Promise<number | null> {
  const agency = await requireAgencyUserId(req);
  if (agency) return agency;
  const admin = await requireAdmin();
  if (admin?.id) return admin.id;
  return resolveWebUserId(req);
}

export async function GET(req: Request) {
  const userId = await resolveImporterUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 });
  }
  const enabled = await getIntelligenceSmartAddEnabled(userId);
  return NextResponse.json({ ok: true, enabled });
}

export async function PATCH(req: Request) {
  const userId = await resolveImporterUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Podaj enabled (boolean).' }, { status: 400 });
  }
  const enabled = await setIntelligenceSmartAddEnabled(userId, body.enabled);
  return NextResponse.json({ ok: true, enabled });
}
