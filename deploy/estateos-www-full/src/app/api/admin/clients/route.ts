import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { listAdminAgencyClients } from '@/lib/adminAgencyClients';

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Brak dostępu.' }, { status: 403 });

  const url = new URL(req.url);
  const statusRaw = String(url.searchParams.get('status') || 'ALL').toUpperCase();
  const status =
    statusRaw === 'ACTIVE' || statusRaw === 'ARCHIVED' || statusRaw === 'ALL'
      ? (statusRaw as 'ACTIVE' | 'ARCHIVED' | 'ALL')
      : 'ALL';
  const q = url.searchParams.get('q') || '';
  const clients = await listAdminAgencyClients({ status, q });
  return NextResponse.json({ success: true, clients });
}
