import { NextResponse } from 'next/server';
import { requireActiveAgencyAdmin, setMemberStatus } from '@/lib/agencyCompany';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import type { AgencyMemberStatus } from '@prisma/client';

const ALLOWED: AgencyMemberStatus[] = ['ACTIVE', 'REJECTED', 'SUSPENDED'];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }
  const admin = await requireActiveAgencyAdmin(userId);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isFinite(memberId)) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy identyfikator.' }, { status: 400 });
  }

  const body = await req.json();
  const status = String(body.status || '').toUpperCase() as AgencyMemberStatus;
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy status.' }, { status: 400 });
  }

  try {
    const updated = await setMemberStatus({
      companyId: admin.companyId,
      adminUserId: userId,
      memberId,
      status,
    });
    return NextResponse.json({
      success: true,
      member: {
        id: updated.id,
        status: updated.status,
        approvedAt: updated.approvedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Operacja nie powiodła się.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
