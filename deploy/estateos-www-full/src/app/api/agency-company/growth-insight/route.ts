import { NextResponse } from 'next/server';
import { getUserAgencyMembership, requireActiveAgencyAdmin } from '@/lib/agencyCompany';
import { prisma } from '@/lib/prisma';
import { resolveCompanyPartnerPlanStatus } from '@/lib/partnerPlanStatus';
import { computePartnerGrowthInsight } from '@/lib/partnerGrowth';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }

  const admin = await requireActiveAgencyAdmin(userId);
  if (!admin) {
    const membership = await getUserAgencyMembership(userId);
    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ success: true, growthInsight: null });
    }
    return NextResponse.json({ success: true, growthInsight: null });
  }

  const company = await prisma.agencyCompany.findUnique({
    where: { id: admin.companyId },
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      extraListings: true,
      plusExpiresAt: true,
    },
  });
  if (!company) {
    return NextResponse.json({ success: false, message: 'Nie znaleziono firmy.' }, { status: 404 });
  }

  const activeAgents = await prisma.agencyCompanyMember.count({
    where: { companyId: company.id, status: 'ACTIVE' },
  });

  const partnerPlan = await resolveCompanyPartnerPlanStatus({
    ownerUserId: company.ownerUserId,
    extraListings: company.extraListings,
    plusExpiresAt: company.plusExpiresAt,
    activeAgents,
  });

  const growthInsight = computePartnerGrowthInsight({
    partnerPlan,
    companyName: company.name,
  });

  return NextResponse.json({ success: true, growthInsight });
}
