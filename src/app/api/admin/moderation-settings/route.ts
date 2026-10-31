import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getModerationSettings, setModerationSettings } from '@/lib/platformSettings';

export const dynamic = 'force-dynamic';

/** Centrala: publikacja bez moderacji — osobno dla biur i dla ogłoszeń prywatnych. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ success: true, settings: await getModerationSettings() });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const current = await getModerationSettings();
  const settings = await setModerationSettings(
    {
      officeAutoPublish: typeof body.officeAutoPublish === 'boolean' ? body.officeAutoPublish : current.officeAutoPublish,
      privateAutoPublish: typeof body.privateAutoPublish === 'boolean' ? body.privateAutoPublish : current.privateAutoPublish,
    },
    admin.id,
  );
  return NextResponse.json({ success: true, settings });
}
