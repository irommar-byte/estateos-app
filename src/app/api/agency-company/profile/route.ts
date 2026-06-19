import { NextResponse } from 'next/server';
import { requireActiveAgencyAdmin, shapeCompanyPublic, updateCompanyContact } from '@/lib/agencyCompany';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function PATCH(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }

  const admin = await requireActiveAgencyAdmin(userId);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień administratora biura.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe dane.' }, { status: 400 });
  }

  const hasField =
    body.website !== undefined || body.officePhone !== undefined || body.officeEmail !== undefined;
  if (!hasField) {
    return NextResponse.json({ success: false, message: 'Podaj dane do zapisania.' }, { status: 400 });
  }

  try {
    const company = await updateCompanyContact({
      companyId: admin.companyId,
      adminUserId: userId,
      website: body.website !== undefined ? (body.website as string | null) : undefined,
      officePhone: body.officePhone !== undefined ? (body.officePhone as string | null) : undefined,
      officeEmail: body.officeEmail !== undefined ? (body.officeEmail as string | null) : undefined,
    });

    return NextResponse.json({
      success: true,
      company: shapeCompanyPublic(company),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Nie udało się zapisać danych biura.';
    const status = message.includes('uprawnień') ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
