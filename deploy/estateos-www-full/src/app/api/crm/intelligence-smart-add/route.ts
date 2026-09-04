import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { SMART_ADD_ALWAYS_ON } from '@/lib/intelligenceSmartAdd';
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
  const enabled = SMART_ADD_ALWAYS_ON;
  return NextResponse.json({ ok: true, enabled });
}

export async function PATCH(req: Request) {
  const userId = await resolveImporterUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, enabled: SMART_ADD_ALWAYS_ON });
}
