import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getAdminAgencyDetail, updateAdminAgencyCompany } from '@/lib/adminAgencyDetail';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const companyId = Number((await ctx.params).id);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
  }

  try {
    const agency = await getAdminAgencyDetail(companyId);
    if (!agency) {
      return NextResponse.json({ success: false, error: 'Nie znaleziono biura' }, { status: 404 });
    }
    return NextResponse.json({ success: true, agency });
  } catch (e) {
    console.error('[ADMIN AGENCY GET]', e);
    return NextResponse.json({ success: false, error: 'Błąd bazy' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const companyId = Number((await ctx.params).id);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    await updateAdminAgencyCompany(companyId, {
      name: body.name as string | undefined,
      address: body.address as string | null | undefined,
      website: body.website as string | null | undefined,
      officePhone: body.officePhone as string | null | undefined,
      officeEmail: body.officeEmail as string | null | undefined,
      extraListings: body.extraListings as number | undefined,
    });
    const agency = await getAdminAgencyDetail(companyId);
    return NextResponse.json({ success: true, agency });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Nie udało się zapisać.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
