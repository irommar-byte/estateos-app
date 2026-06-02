import { isInvestorProIdentity } from './partnerIdentity';

const DEFAULT_PRO_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

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
  periodMs = DEFAULT_PRO_PERIOD_MS
): ProMembershipCountdown | null {
  const expiresAtMs = parseProExpiryMs(proExpiresAt);
  if (!expiresAtMs || expiresAtMs <= Date.now()) return null;

  const remainingMs = expiresAtMs - Date.now();
  const daysLeft = Math.max(0, Math.ceil(remainingMs / 86400000));
  const hoursLeft = Math.max(0, Math.ceil(remainingMs / 3600000));
  const progress = Math.min(1, Math.max(0, remainingMs / periodMs));

  let labelKey: ProMembershipCountdown['labelKey'] = 'active';
  if (daysLeft <= 1) labelKey = 'lastDay';
  else if (daysLeft <= 7) labelKey = 'endingSoon';

  return { expiresAtMs, daysLeft, hoursLeft, progress, labelKey };
}

export function userAfterInvestorProPurchase(
  user: Record<string, unknown> | null | undefined,
  opts: { isPro?: boolean; proExpiresAt?: string | null; backendRegistered?: boolean },
): Record<string, unknown> | null {
  if (!user) return null;
  if (opts.isPro === true || opts.proExpiresAt) {
    return {
      ...user,
      isPro: true,
      planType: 'PRO',
      ...(opts.proExpiresAt ? { proExpiresAt: opts.proExpiresAt } : {}),
    };
  }
  if (opts.backendRegistered) {
    const optimistic = new Date(Date.now() + DEFAULT_PRO_PERIOD_MS).toISOString();
    return { ...user, isPro: true, planType: 'PRO', proExpiresAt: optimistic };
  }
  return user;
}
