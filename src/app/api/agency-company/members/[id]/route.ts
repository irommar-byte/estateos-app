import { NextResponse } from 'next/server';
import {
  requireActiveAgencyAdmin,
  requireActiveAgencyManagerOrAdmin,
  setMemberRole,
  setMemberStatus,
  updateMemberProfile,
} from '@/lib/agencyCompany';
import type { AgencyAgentTitle, AgencyMemberStatus } from '@prisma/client';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { AGENCY_AGENT_TITLES } from '@/lib/agentProfile';

const ALLOWED_STATUS: AgencyMemberStatus[] = ['ACTIVE', 'REJECTED', 'SUSPENDED'];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }
  const body = await req.json();
  const wantsCard =
    body.agentTitle != null ||
    body.name !== undefined ||
    body.phone !== undefined ||
    body.email !== undefined ||
    body.profilePhotoUrl !== undefined;

  const admin = wantsCard
    ? await requireActiveAgencyManagerOrAdmin(userId)
    : await requireActiveAgencyAdmin(userId);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const memberId = Number(id);
  if (!Number.isFinite(memberId)) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy identyfikator.' }, { status: 400 });
  }

  try {
    if (body.role) {
      const roleRaw = String(body.role || '').toUpperCase();
      if (roleRaw !== 'AGENT' && roleRaw !== 'MANAGER') {
        return NextResponse.json({ success: false, message: 'Nieprawidłowa rola.' }, { status: 400 });
      }
      const updated = await setMemberRole({
        companyId: admin.companyId,
        adminUserId: userId,
        memberId,
        role: roleRaw as 'AGENT' | 'MANAGER',
      });
      return NextResponse.json({
        success: true,
        member: { id: updated.id, role: updated.role },
      });
    }

    if (wantsCard) {
      const titleRaw = body.agentTitle != null ? String(body.agentTitle).toUpperCase() : undefined;
      if (titleRaw && !AGENCY_AGENT_TITLES.includes(titleRaw as AgencyAgentTitle)) {
        return NextResponse.json({ success: false, message: 'Nieprawidłowe stanowisko.' }, { status: 400 });
      }
      const updated = await updateMemberProfile({
        companyId: admin.companyId,
        adminUserId: userId,
        memberId,
        agentTitle: titleRaw as AgencyAgentTitle | undefined,
        profilePhotoUrl: body.profilePhotoUrl !== undefined ? body.profilePhotoUrl : undefined,
        name: body.name !== undefined ? body.name : undefined,
        phone: body.phone !== undefined ? body.phone : undefined,
        email: body.email !== undefined ? body.email : undefined,
      });
      return NextResponse.json({
        success: true,
        member: {
          id: updated.id,
          agentTitle: updated.agentTitle,
          profilePhotoUrl: updated.profilePhotoUrl,
        },
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
