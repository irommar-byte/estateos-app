import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { listAdminAgencies } from '@/lib/adminAgencyDetail';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const agencies = await listAdminAgencies();
    return NextResponse.json({ success: true, agencies });
  } catch (e) {
    console.error('[ADMIN AGENCIES GET]', e);
    return NextResponse.json({ success: false, error: 'Błąd bazy' }, { status: 500 });
  }
}
