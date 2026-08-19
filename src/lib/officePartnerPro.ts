import { getUserAgencyMembership } from '@/lib/agencyCompany';
import { resolveCompanyPartnerPlanStatus } from '@/lib/partnerPlanStatus';
import type { PartnerPlanId } from '@/lib/partnerPricing';

const CACHE_MS = 45_000;
const cache = new Map<number, { at: number; active: boolean }>();

export function partnerPlanGrantsOfficePro(planId: PartnerPlanId | null | undefined): boolean {
  return planId === 'pro' || planId === 'enterprise';
}

/** Partner Pro / Enterprise (w tym trial Pro) — Off Market, Market, widget, 5 raportów. Bez kredytów Investor Pro. */
export async function userHasOfficePartnerPro(userId: number): Promise<boolean> {
  if (!Number.isFinite(userId) || userId <= 0) return false;
  const hit = cache.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_MS) return hit.active;

  try {
    const membership = await getUserAgencyMembership(userId);
    if (!membership || membership.status !== 'ACTIVE') {
      cache.set(userId, { at: now, active: false });
      return false;
    }
    const company = membership.company;
    const snapshot = await resolveCompanyPartnerPlanStatus({
      ownerUserId: company.ownerUserId,
      extraListings: company.extraListings,
      plusExpiresAt: company.plusExpiresAt,
      activeAgents: 0,
    });
    const active =
      snapshot.isSubscriptionActive && partnerPlanGrantsOfficePro(snapshot.displayPlanId);
    cache.set(userId, { at: now, active });
    return active;
  } catch {
    cache.set(userId, { at: now, active: false });
    return false;
  }
}

export async function userHasMarketPro(params: {
  id: number;
  role?: string | null;
  isPro?: boolean | null;
  proExpiresAt?: Date | string | null;
}): Promise<boolean> {
  const exp = params.proExpiresAt ? new Date(params.proExpiresAt) : null;
  if (String(params.role || '').toUpperCase() === 'ADMIN') return true;
  if (params.isPro && (!exp || exp.getTime() > Date.now())) return true;
  return userHasOfficePartnerPro(params.id);
}
