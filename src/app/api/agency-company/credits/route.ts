import { NextResponse } from 'next/server';
import { requireActiveAgencyAdmin, transferCompanyCredits } from '@/lib/agencyCompany';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function POST(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }
  const admin = await requireActiveAgencyAdmin(userId);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień.' }, { status: 403 });
  }

  const body = await req.json();
  const toUserId = Number(body.toUserId);
  const amount = Number(body.amount);
  const note = typeof body.note === 'string' ? body.note : undefined;

  if (!Number.isFinite(toUserId) || !Number.isFinite(amount)) {
    return NextResponse.json({ success: false, message: 'Podaj pracownika i liczbę kredytów.' }, { status: 400 });
  }

  try {
    await transferCompanyCredits({
      companyId: admin.companyId,
      adminUserId: userId,
      toUserId,
      amount: Math.floor(amount),
      note,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Transfer nie powiódł się.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
