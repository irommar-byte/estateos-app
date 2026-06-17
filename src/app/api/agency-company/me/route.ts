import { NextResponse } from 'next/server';
import { getUserAgencyMembership } from '@/lib/agencyCompany';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak sesji.' }, { status: 401 });
  }
  const membership = await getUserAgencyMembership(userId);
  if (!membership) {
    return NextResponse.json({ success: true, membership: null });
  }
  return NextResponse.json({
    success: true,
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      approvedAt: membership.approvedAt?.toISOString() ?? null,
      company: {
        id: membership.company.id,
        name: membership.company.name,
        slug: membership.company.slug,
        address: membership.company.address,
        website: membership.company.website,
        logoUrl: membership.company.logoUrl,
        officePhone: membership.company.officePhone,
        officeEmail: membership.company.officeEmail,
        extraListings: membership.company.extraListings,
        plusExpiresAt: membership.company.plusExpiresAt?.toISOString() ?? null,
        ownerUserId: membership.company.ownerUserId,
      },
    },
  });
}
