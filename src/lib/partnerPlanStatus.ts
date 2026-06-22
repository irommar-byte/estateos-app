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
  };
}

export function describePartnerPlanChange(params: {
  from: PartnerPlanConfig | null;
  to: PartnerPlanConfig;
}): string[] {
  const { from, to } = params;
  const lines: string[] = [];

  lines.push(`+${to.creditsPerMonth} kredytów trafi na pulę firmy (okres 30 dni).`);

  const fromAgents = from?.maxAgents ?? null;
  const toAgents = to.maxAgents;
  if (fromAgents !== toAgents) {
    const fmt = (n: number | null) => (n == null ? 'bez limitu' : `do ${n}`);
    lines.push(`Limit agentów: ${fmt(fromAgents)} → ${fmt(toAgents)}.`);
  }

  if (!from || from.pricePln !== to.pricePln) {
    lines.push(`Abonament: ${to.pricePln} zł / 30 dni (${Math.round(to.pricePln / to.creditsPerMonth)} zł za kredyt).`);
  }

  if (from && from.id === to.id) {
    return [`Odnowienie tego samego pakietu — kolejna porcja ${to.creditsPerMonth} kredytów i przedłużenie ważności puli.`];
  }

  if (from && to.pricePln > from.pricePln) {
    lines.push('Wyższy pakiet — więcej kredytów i szerszy zespół w jednym panelu.');
  } else if (from && to.pricePln < from.pricePln) {
    lines.push('Niższy pakiet — sprawdź limit agentów przed zmianą.');
  } else if (!from) {
    lines.push('Aktywacja Partner — CRM, zespół, pula kredytów i Concierge w jednym miejscu.');
  }

  return lines;
}
