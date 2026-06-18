import { NextResponse } from 'next/server';
import { getCompanyDashboard, requireActiveAgencyAdmin } from '@/lib/agencyCompany';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }
  const admin = await requireActiveAgencyAdmin(userId);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Tylko administrator firmy ma dostęp.' }, { status: 403 });
  }
  const dashboard = await getCompanyDashboard(admin.companyId);
  if (!dashboard) {
    return NextResponse.json({ success: false, message: 'Nie znaleziono firmy.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, ...dashboard });
}
