import { prisma } from '@/lib/prisma';
import { PlanType } from '@prisma/client';
import { getUserAgencyMembership } from '@/lib/agencyCompany';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';

async function hasPartnerStripePurchase(userId: number): Promise<boolean> {
  await ensureMobileIapTables();
  const rows = (await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
    `SELECT id FROM MobileIapPurchase WHERE userId = ? AND productId LIKE 'pl.estateos.partner.%' LIMIT 1`,
    userId,
  )) as Array<{ id: bigint }>;
  return rows.length > 0;
}

function isCompanyPoolActive(company: {
  extraListings: number | null;
  plusExpiresAt: Date | null;
} | null): boolean {
  if (!company) return false;
  const credits = Number(company.extraListings ?? 0);
  if (credits <= 0) return false;
  if (!company.plusExpiresAt) return false;
  return new Date(company.plusExpiresAt).getTime() > Date.now();
}

/**
 * Usuwa darmowy `planType: AGENCY` z kont utworzonych przed płatnym Partnerem.
 * Płatny Partner zostaje (zakup Stripe lub aktywna pula firmy).
 */
export async function reconcileFreeAgencyPlanTypeIfNeeded(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planType: true },
  });
  if (String(user?.planType || '').toUpperCase() !== 'AGENCY') return false;

  if (await hasPartnerStripePurchase(userId)) return false;

  const membership = await getUserAgencyMembership(userId);
  if (membership) {
    const company = await prisma.agencyCompany.findUnique({
      where: { id: membership.companyId },
      select: { extraListings: true, plusExpiresAt: true, ownerUserId: true },
    });

    if (company?.ownerUserId && (await hasPartnerStripePurchase(company.ownerUserId))) {
      return false;
    }

    if (isCompanyPoolActive(company)) {
      return false;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { planType: PlanType.NONE },
  });
  return true;
}
