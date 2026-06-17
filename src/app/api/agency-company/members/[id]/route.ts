import { NextResponse } from 'next/server';
import { requireActiveAgencyAdmin, setMemberStatus, updateMemberProfile } from '@/lib/agencyCompany';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import type { AgencyAgentTitle, AgencyMemberStatus } from '@prisma/client';
import { AGENCY_AGENT_TITLES } from '@/lib/agentProfile';

const ALLOWED_STATUS: AgencyMemberStatus[] = ['ACTIVE', 'REJECTED', 'SUSPENDED'];

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

  try {
    if (body.agentTitle) {
      const title = String(body.agentTitle).toUpperCase() as AgencyAgentTitle;
      if (!AGENCY_AGENT_TITLES.includes(title)) {
        return NextResponse.json({ success: false, message: 'Nieprawidłowe stanowisko.' }, { status: 400 });
      }
      const updated = await updateMemberProfile({
        companyId: admin.companyId,
        adminUserId: userId,
        memberId,
        agentTitle: title,
      });
      return NextResponse.json({
        success: true,
        member: { id: updated.id, agentTitle: updated.agentTitle },
      });
    }

    const status = String(body.status || '').toUpperCase() as AgencyMemberStatus;
    if (!ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy status.' }, { status: 400 });
    }

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
