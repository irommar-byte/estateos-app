import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { backfillAgencyOfficesForLegacyAgents } from '@/lib/agencyCompany';

export async function POST() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const report = await backfillAgencyOfficesForLegacyAgents();
    return NextResponse.json({ success: true, report });
  } catch (e) {
    console.error('[ADMIN AGENCIES BACKFILL]', e);
    return NextResponse.json({ success: false, error: 'Migracja nie powiodła się.' }, { status: 500 });
  }
}
