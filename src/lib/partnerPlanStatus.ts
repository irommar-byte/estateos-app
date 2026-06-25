import { prisma } from '@/lib/prisma';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';
import {
  PARTNER_FREE_SIGNUP_PRODUCT,
  PARTNER_FREE_PERIOD_DAYS,
  PARTNER_PAID_PERIOD_DAYS,
  PARTNER_PLANS,
  type PartnerPlanConfig,
  type PartnerPlanId,
  getPartnerPlanById,
} from '@/lib/partnerPricing';

const PARTNER_PRO_TRIAL_PRODUCT = 'pl.estateos.partner.pro_trial';

export type CompanyPartnerPlanSnapshot = {
  currentPlanId: PartnerPlanId | null;
  currentPlan: PartnerPlanConfig | null;
  /** Plan pokazywany w UI — preferuje Partner Free, gdy aktywny okres 90 dni. */
  displayPlanId: PartnerPlanId | null;
  lastPurchaseAt: string | null;
  isSubscriptionActive: boolean;
  plusExpiresAt: string | null;
  poolCredits: number;
  activeAgents: number;
  agentsLimit: number | null;
  daysRemaining: number | null;
  /** Dni okresu zgodne z wyświetlanym planem (90 = Free, 30 = płatny / trial Pro). */
  periodDays: number | null;
  hasFreeSignup: boolean;
  proTrialEligible: boolean;
  /** Aktywny 30-dniowy trial Partner Pro (osobny od 90 dni Free). */
  isTrialing: boolean;
};

function parsePartnerPlanIdFromProductId(productId: string): PartnerPlanId | null {
  if (productId === PARTNER_FREE_SIGNUP_PRODUCT) return 'free';
  if (productId === PARTNER_PRO_TRIAL_PRODUCT) return 'pro';
  const m = String(productId || '').match(/pl\.estateos\.partner\.(\w+)_(monthly|trial)/i);
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
     ORDER BY createdAt DESC`,
    params.ownerUserId,
  )) as Array<{ productId: string; createdAt: Date }>;

  const proRows = (await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
    `SELECT id FROM MobileIapPurchase
     WHERE userId = ? AND productId IN ('pl.estateos.partner.pro_monthly', ?)
     LIMIT 1`,
    params.ownerUserId,
    PARTNER_PRO_TRIAL_PRODUCT,
  )) as Array<{ id: bigint }>;

  const hasFreeSignup = rows.some((r) => r.productId === PARTNER_FREE_SIGNUP_PRODUCT);
  const latestNonFree = rows.find((r) => r.productId !== PARTNER_FREE_SIGNUP_PRODUCT);
  const latest = rows[0];
  const currentPlanId = latest ? parsePartnerPlanIdFromProductId(latest.productId) : null;
  const currentPlan = currentPlanId ? getPartnerPlanById(currentPlanId) ?? null : null;
  const isTrialing = latestNonFree?.productId === PARTNER_PRO_TRIAL_PRODUCT;
  const isPaidMonthly = Boolean(latestNonFree?.productId?.endsWith('_monthly'));

  const expiryMs = params.plusExpiresAt ? new Date(params.plusExpiresAt).getTime() : 0;
  const isSubscriptionActive = expiryMs > Date.now();
  const daysRemaining =
    isSubscriptionActive && expiryMs
      ? Math.max(0, Math.ceil((expiryMs - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  let displayPlanId: PartnerPlanId | null = currentPlanId;
  let periodDays: number | null = null;

  if (isSubscriptionActive) {
    if (hasFreeSignup && !isPaidMonthly) {
      displayPlanId = 'free';
      periodDays = PARTNER_FREE_PERIOD_DAYS;
    } else if (isTrialing) {
      displayPlanId = 'pro';
      periodDays = PARTNER_PAID_PERIOD_DAYS;
    } else if (currentPlanId) {
      displayPlanId = currentPlanId;
      periodDays =
        currentPlanId === 'free' ? PARTNER_FREE_PERIOD_DAYS : PARTNER_PAID_PERIOD_DAYS;
    }
  }

  const displayPlan = displayPlanId ? getPartnerPlanById(displayPlanId) ?? null : null;

  return {
    currentPlanId,
    currentPlan,
    displayPlanId,
    lastPurchaseAt: latest?.createdAt ? new Date(latest.createdAt).toISOString() : null,
    isSubscriptionActive,
    plusExpiresAt: params.plusExpiresAt ? new Date(params.plusExpiresAt).toISOString() : null,
    poolCredits: Number(params.extraListings ?? 0),
    activeAgents: params.activeAgents,
    agentsLimit: displayPlan?.maxAgents ?? currentPlan?.maxAgents ?? null,
    daysRemaining,
    periodDays,
    hasFreeSignup,
    proTrialEligible: proRows.length === 0 && !isTrialing,
    isTrialing,
  };
}

export { describePartnerPlanChange } from '@/lib/partnerPricing';
