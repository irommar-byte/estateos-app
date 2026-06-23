import { PlanType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ensureAgencyCompanyForAgentUser, getUserAgencyMembership } from '@/lib/agencyCompany';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';
import {
  PARTNER_PLANS,
  type PartnerPlanConfig,
  type PartnerPlanId,
} from '@/lib/partnerPricing';
import { stripeTransactionId } from '@/lib/stripePublication';

const PARTNER_PERIOD_DAYS = 30;
const PARTNER_PRO_TRIAL_PRODUCT = 'pl.estateos.partner.pro_trial';
const PARTNER_PRO_PAID_PRODUCT = 'pl.estateos.partner.pro_monthly';

const STRIPE_PLAN_TO_PARTNER_ID: Record<string, PartnerPlanId> = {
  partner_start: 'start',
  partner_pro: 'pro',
  partner_enterprise: 'enterprise',
  /** Legacy checkout code — map to Enterprise (1499 PLN tier). */
  agency: 'enterprise',
};

export function isStripePartnerPlan(raw: unknown): boolean {
  const key = String(raw || '')
    .trim()
    .toLowerCase();
  return key in STRIPE_PLAN_TO_PARTNER_ID;
}

export function getPartnerPlanByStripePlan(raw: unknown): PartnerPlanConfig | null {
  const id = STRIPE_PLAN_TO_PARTNER_ID[String(raw || '').trim().toLowerCase()];
  if (!id) return null;
  return PARTNER_PLANS.find((p) => p.id === id) ?? null;
}

function partnerProductId(plan: PartnerPlanConfig): string {
  return `pl.estateos.partner.${plan.id}_monthly`;
}

function partnerPendingPurchaseId(checkoutSessionId: string): string {
  return `stripe_partner_${checkoutSessionId}`;
}

export async function grantPartnerPlanFromStripeCheckout(params: {
  userId: number;
  checkoutSessionId: string;
  stripePlanType: string;
}): Promise<{
  granted: boolean;
  alreadyGranted: boolean;
  companyId: number | null;
  creditsAdded: number;
  partnerPlanId: PartnerPlanId;
}> {
  const plan = getPartnerPlanByStripePlan(params.stripePlanType);
  if (!plan) {
    throw new Error(`UNKNOWN_PARTNER_PLAN:${params.stripePlanType}`);
  }

  await ensureMobileIapTables();
  const txId = stripeTransactionId(params.checkoutSessionId);
  const pendingId = partnerPendingPurchaseId(params.checkoutSessionId);

  const existing = (await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
    `SELECT id FROM MobileIapPurchase WHERE pendingPurchaseId = ? OR transactionId = ? LIMIT 1`,
    pendingId,
    txId,
  )) as Array<{ id: bigint }>;

  if (existing.length > 0) {
    const membership = await getUserAgencyMembership(params.userId);
    return {
      granted: false,
      alreadyGranted: true,
      companyId: membership?.companyId ?? null,
      creditsAdded: 0,
      partnerPlanId: plan.id,
    };
  }

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      isPro: false,
      planType: PlanType.AGENCY,
      proExpiresAt: null,
    },
  });

  const membership = await ensureAgencyCompanyForAgentUser(params.userId);
  if (!membership || membership.role !== 'ADMIN') {
    throw new Error('PARTNER_REQUIRES_COMPANY_ADMIN');
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + PARTNER_PERIOD_DAYS);

  const company = await prisma.agencyCompany.findUnique({
    where: { id: membership.companyId },
    select: { id: true, plusExpiresAt: true },
  });
  if (!company) throw new Error('PARTNER_COMPANY_NOT_FOUND');

  const currentExpiryMs = company.plusExpiresAt ? new Date(company.plusExpiresAt).getTime() : 0;
  const mergedExpiry = new Date(Math.max(currentExpiryMs, periodEnd.getTime()));

  const updatedCompany = await prisma.$transaction(async (tx) => {
    const row = await tx.agencyCompany.update({
      where: { id: company.id },
      data: {
        extraListings: { increment: plan.creditsPerMonth },
        plusExpiresAt: mergedExpiry,
      },
      select: { id: true, extraListings: true, plusExpiresAt: true },
    });

    await tx.$executeRawUnsafe(
      `
        INSERT INTO MobileIapPurchase
          (userId, pendingPurchaseId, platform, productId, transactionId, status, verifyStatus, entitlementGrantedAt)
        VALUES (?, ?, 'web', ?, ?, 'VERIFIED', 'VERIFIED', NOW(3))
      `,
      params.userId,
      pendingId,
      partnerProductId(plan),
      txId,
    );

    return row;
  });

  return {
    granted: true,
    alreadyGranted: false,
    companyId: updatedCompany.id,
    creditsAdded: plan.creditsPerMonth,
    partnerPlanId: plan.id,
  };
}

export function partnerCheckoutCopy(plan: PartnerPlanConfig): { name: string; description: string } {
  const agents =
    plan.maxAgents == null ? 'bez limitu agentów' : `do ${plan.maxAgents} agentów`;

  return {
    name: `EstateOS™ Partner ${plan.id === 'start' ? 'Start' : plan.id === 'pro' ? 'Pro' : 'Enterprise'}`,
    description: `Abonament 30 dni: ${plan.creditsPerMonth} kredytów publikacji na pulę firmy, ${agents}, CRM, Concierge i zespół w jednym panelu.`,
  };
}

export async function assertPartnerCheckoutAllowed(userId: number): Promise<void> {
  let membership = await getUserAgencyMembership(userId);

  if (!membership) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planType: true, role: true, companyName: true },
    });
    const isAgencyLike =
      user?.planType === 'AGENCY' || user?.role === 'AGENT' || Boolean(user?.companyName?.trim());
    if (!isAgencyLike) {
      throw new Error('PARTNER_REQUIRES_AGENCY_ACCOUNT');
    }
    membership = await ensureAgencyCompanyForAgentUser(userId);
  }

  if (!membership || membership.role !== 'ADMIN') {
    throw new Error('PARTNER_REQUIRES_COMPANY_ADMIN');
  }
}

export async function grantPartnerProTrial(userId: number): Promise<{
  granted: boolean;
  alreadyUsed: boolean;
  companyId: number | null;
  creditsAdded: number;
}> {
  await assertPartnerCheckoutAllowed(userId);
  await ensureMobileIapTables();

  const prior = (await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
    `SELECT id FROM MobileIapPurchase
     WHERE userId = ? AND productId IN (?, ?)
     LIMIT 1`,
    userId,
    PARTNER_PRO_TRIAL_PRODUCT,
    PARTNER_PRO_PAID_PRODUCT,
  )) as Array<{ id: bigint }>;

  if (prior.length > 0) {
    const membership = await getUserAgencyMembership(userId);
    return { granted: false, alreadyUsed: true, companyId: membership?.companyId ?? null, creditsAdded: 0 };
  }

  const plan = PARTNER_PLANS.find((p) => p.id === 'pro');
  if (!plan) throw new Error('PARTNER_PRO_PLAN_MISSING');

  await prisma.user.update({
    where: { id: userId },
    data: { isPro: false, planType: PlanType.AGENCY, proExpiresAt: null },
  });

  const membership = await ensureAgencyCompanyForAgentUser(userId);
  if (!membership || membership.role !== 'ADMIN') {
    throw new Error('PARTNER_REQUIRES_COMPANY_ADMIN');
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + PARTNER_PERIOD_DAYS);

  const company = await prisma.agencyCompany.findUnique({
    where: { id: membership.companyId },
    select: { id: true, plusExpiresAt: true },
  });
  if (!company) throw new Error('PARTNER_COMPANY_NOT_FOUND');

  const currentExpiryMs = company.plusExpiresAt ? new Date(company.plusExpiresAt).getTime() : 0;
  const mergedExpiry = new Date(Math.max(currentExpiryMs, periodEnd.getTime()));
  const pendingId = `partner_pro_trial_${userId}_${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    await tx.agencyCompany.update({
      where: { id: company.id },
      data: {
        extraListings: { increment: plan.creditsPerMonth },
        plusExpiresAt: mergedExpiry,
      },
    });

    await tx.$executeRawUnsafe(
      `
        INSERT INTO MobileIapPurchase
          (userId, pendingPurchaseId, platform, productId, transactionId, status, verifyStatus, entitlementGrantedAt)
        VALUES (?, ?, 'web', ?, ?, 'VERIFIED', 'VERIFIED', NOW(3))
      `,
      userId,
      pendingId,
      PARTNER_PRO_TRIAL_PRODUCT,
      `trial_${pendingId}`,
    );
  });

  return {
    granted: true,
    alreadyUsed: false,
    companyId: company.id,
    creditsAdded: plan.creditsPerMonth,
  };
}
