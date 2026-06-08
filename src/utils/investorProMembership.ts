import { isInvestorProIdentity } from './partnerIdentity';

export const INVESTOR_PRO_BILLING_PERIOD_DAYS = 30;

const DEFAULT_PRO_PERIOD_MS = INVESTOR_PRO_BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export function inferInvestorProBillingPeriodDays(
  daysLeft: number,
  billingPeriodDays = INVESTOR_PRO_BILLING_PERIOD_DAYS,
): number {
  return Math.max(billingPeriodDays, daysLeft);
}

export function hasActiveInvestorProMembership(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  const u = user as Record<string, unknown>;
  if (!isInvestorProIdentity(user)) return false;

  const exp = parseProExpiryMs(u.proExpiresAt);
  const role = String(u.role || '').toUpperCase();

  if (u.isPro === true || role === 'ADMIN') {
    if (!exp) return true;
    return exp > Date.now();
  }

  if (exp && exp > Date.now()) return true;

  const plan = String(u.planType || '').trim().toUpperCase();
  if (plan === 'PRO' && !exp) return true;

  return false;
}

export function parseProExpiryMs(value: unknown): number | null {
  if (!value) return null;
  const ts = new Date(String(value)).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export type ProMembershipCountdown = {
  expiresAtMs: number;
  daysLeft: number;
  hoursLeft: number;
  progress: number;
  labelKey: 'active' | 'endingSoon' | 'lastDay';
};

export function buildProMembershipCountdown(
  proExpiresAt: unknown,
  billingPeriodDays = INVESTOR_PRO_BILLING_PERIOD_DAYS,
): ProMembershipCountdown | null {
  const expiresAtMs = parseProExpiryMs(proExpiresAt);
  if (!expiresAtMs || expiresAtMs <= Date.now()) return null;

  const remainingMs = expiresAtMs - Date.now();
  const daysLeft = Math.max(0, Math.ceil(remainingMs / 86400000));
  const hoursLeft = Math.max(0, Math.ceil(remainingMs / 3600000));
  const periodDays = inferInvestorProBillingPeriodDays(daysLeft, billingPeriodDays);
  const periodMs = periodDays * 86400000;
  const periodStartMs = expiresAtMs - periodMs;
  const elapsedMs = Math.max(0, Date.now() - periodStartMs);
  const progress = Math.min(1, Math.max(0, elapsedMs / periodMs));

  let labelKey: ProMembershipCountdown['labelKey'] = 'active';
  if (daysLeft <= 1) labelKey = 'lastDay';
  else if (daysLeft <= 7) labelKey = 'endingSoon';

  return { expiresAtMs, daysLeft, hoursLeft, progress, labelKey };
}

export function userAfterInvestorProPurchase(
  user: Record<string, unknown> | null | undefined,
  opts: {
    isPro?: boolean;
    proExpiresAt?: string | null;
    backendRegistered?: boolean;
    extraListings?: number;
    plusExpiresAt?: string | null;
    syncedExistingSubscription?: boolean;
    subscriptionTransferred?: boolean;
  },
): Record<string, unknown> | null {
  if (!user) return null;

  const shouldActivatePro =
    opts.isPro === true ||
    Boolean(opts.proExpiresAt) ||
    Boolean(opts.backendRegistered) ||
    Boolean(opts.syncedExistingSubscription) ||
    Boolean(opts.subscriptionTransferred);

  if (!shouldActivatePro) return user;

  const proExpiresAt =
    opts.proExpiresAt ||
    new Date(Date.now() + DEFAULT_PRO_PERIOD_MS).toISOString();

  return {
    ...user,
    isPro: true,
    planType: 'PRO',
    proExpiresAt,
    ...(opts.extraListings != null ? { extraListings: opts.extraListings } : {}),
    ...(opts.plusExpiresAt ? { plusExpiresAt: opts.plusExpiresAt } : {}),
  };
}
