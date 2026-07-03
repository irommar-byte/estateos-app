import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';

const ROLES = new Set(['USER', 'AGENT', 'ADMIN']);
const PLAN_TYPES = new Set(['NONE', 'PRO', 'PLUS', 'AGENCY', 'INVESTOR']);
const MEMBER_ROLES = new Set(['ADMIN', 'AGENT']);
const MEMBER_STATUSES = new Set(['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED']);
const AGENT_TITLES = new Set([
  'DORADCA',
  'AGENT',
  'BROKER',
  'EXPERT',
  'LEADER',
  'KIEROWNIK_BIURO',
  'ZASTEPCA_KIEROWNIKA',
]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const userData: Record<string, unknown> = {};
    const membershipData: Record<string, unknown> = {};

    if (body.role != null) {
      const role = String(body.role).toUpperCase();
      if (!ROLES.has(role)) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowa rola' }, { status: 400 });
      }
      userData.role = role;
    }

    if (body.planType != null) {
      const planType = String(body.planType).toUpperCase();
      if (!PLAN_TYPES.has(planType)) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowy plan' }, { status: 400 });
      }
      userData.planType = planType;
    }

    if (typeof body.isPro === 'boolean') {
      userData.isPro = body.isPro;
      if (body.isPro && body.proExpiresAt) {
        userData.proExpiresAt = new Date(body.proExpiresAt);
      }
      if (!body.isPro) {
        userData.proExpiresAt = null;
      }
    }

    if (body.agencyMemberRole != null) {
      const memberRole = String(body.agencyMemberRole).toUpperCase();
      if (!MEMBER_ROLES.has(memberRole)) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowa rola w biurze' }, { status: 400 });
      }
      membershipData.role = memberRole;
    }

    if (body.agentTitle != null) {
      const agentTitle = String(body.agentTitle).toUpperCase();
      if (!AGENT_TITLES.has(agentTitle)) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowy tytuł agenta' }, { status: 400 });
      }
      membershipData.agentTitle = agentTitle;
    }

    if (body.memberStatus != null) {
      const status = String(body.memberStatus).toUpperCase();
      if (!MEMBER_STATUSES.has(status)) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowy status członkostwa' }, { status: 400 });
      }
      membershipData.status = status;
    }

    if (Object.keys(userData).length) {
      await prisma.user.update({ where: { id: userId }, data: userData });
    }

    if (Object.keys(membershipData).length) {
      const member = await prisma.agencyCompanyMember.findUnique({ where: { userId } });
      if (!member) {
        return NextResponse.json(
          { success: false, error: 'Użytkownik nie należy do żadnego biura — najpierw przypisz agencję.' },
          { status: 400 },
        );
      }
      await prisma.agencyCompanyMember.update({
        where: { userId },
        data: membershipData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN USER ACCESS PATCH]', error);
    return NextResponse.json({ success: false, error: 'Błąd zapisu' }, { status: 500 });
  }
}
