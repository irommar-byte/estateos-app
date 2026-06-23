import { prisma } from '@/lib/prisma';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';
import {
  PARTNER_PLANS,
  type PartnerPlanConfig,
  type PartnerPlanId,
  getPartnerPlanById,
} from '@/lib/partnerPricing';

export type CompanyPartnerPlanSnapshot = {
  currentPlanId: PartnerPlanId | null;
  currentPlan: PartnerPlanConfig | null;
  lastPurchaseAt: string | null;
  isSubscriptionActive: boolean;
  plusExpiresAt: string | null;
  poolCredits: number;
  activeAgents: number;
  agentsLimit: number | null;
  daysRemaining: number | null;
  proTrialEligible: boolean;
};

function parsePartnerPlanIdFromProductId(productId: string): PartnerPlanId | null {
  const m = String(productId || '').match(/pl\.estateos\.partner\.(\w+)_monthly/i);
  if (!m) return null;
  const id = m[1] as PartnerPlanId;
  return PARTNER_PLANS.some((p) => p.id === id) ? id : null;
}

export async function resolveCompanyPartnerPlanStatus(params: {
  ownerUserId: number;
  extraListings: number;
  plusExpiresAt: Date | string | null;
  activeAgents: number;
}): Promise<CompanyPartnerPlanSnapshot> {
  await ensureMobileIapTables();

  const rows = (await prisma.$queryRawUnsafe<
    Array<{ productId: string; createdAt: Date }>
  >(
    `SELECT productId, createdAt FROM MobileIapPurchase
     WHERE userId = ? AND productId LIKE 'pl.estateos.partner.%'
     ORDER BY createdAt DESC LIMIT 1`,
    params.ownerUserId,
  )) as Array<{ productId: string; createdAt: Date }>;

  const proRows = (await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
    `SELECT id FROM MobileIapPurchase
     WHERE userId = ? AND productId IN ('pl.estateos.partner.pro_monthly', 'pl.estateos.partner.pro_trial')
     LIMIT 1`,
    params.ownerUserId,
  )) as Array<{ id: bigint }>;

  const last = rows[0];
  const currentPlanId = last ? parsePartnerPlanIdFromProductId(last.productId) : null;
  const currentPlan = currentPlanId ? getPartnerPlanById(currentPlanId) ?? null : null;

  const expiryMs = params.plusExpiresAt ? new Date(params.plusExpiresAt).getTime() : 0;
  const isSubscriptionActive = expiryMs > Date.now();
  const daysRemaining =
    isSubscriptionActive && expiryMs
      ? Math.max(0, Math.ceil((expiryMs - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  return {
    currentPlanId,
    currentPlan,
    lastPurchaseAt: last?.createdAt ? new Date(last.createdAt).toISOString() : null,
    isSubscriptionActive,
    plusExpiresAt: params.plusExpiresAt ? new Date(params.plusExpiresAt).toISOString() : null,
    poolCredits: Number(params.extraListings ?? 0),
    activeAgents: params.activeAgents,
    agentsLimit: currentPlan?.maxAgents ?? null,
    daysRemaining,
    proTrialEligible: proRows.length === 0,
  };
}

export { describePartnerPlanChange } from '@/lib/partnerPricing';
