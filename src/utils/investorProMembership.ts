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
  const progress = Math.min(1, Math.max(0, daysLeft / periodDays));

  let labelKey: ProMembershipCountdown['labelKey'] = 'active';
  if (daysLeft <= 1) labelKey = 'lastDay';
  else if (daysLeft <= 7) labelKey = 'endingSoon';

  return { expiresAtMs, daysLeft, hoursLeft, progress, labelKey };
}

/** Płynna paleta: zielony → żółty → czerwony w miarę końca okresu. */
export function buildInvestorProBarPalette(progressRemaining: number) {
  const remaining = Math.min(1, Math.max(0, progressRemaining));
  const urgency = 1 - remaining;

  let hue: number;
  if (urgency <= 0.5) {
    hue = 142 + (48 - 142) * (urgency / 0.5);
  } else {
    hue = 48 + (0 - 48) * ((urgency - 0.5) / 0.5);
  }

  const sat = 72 + remaining * 18;
  const light = 46 + remaining * 8;
  return {
    tone: `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`,
    toneSoft: `hsl(${hue.toFixed(1)} ${Math.max(55, sat - 12).toFixed(0)}% ${Math.max(38, light - 10).toFixed(0)}%)`,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function buildInvestorProBarGradientHex(progressRemaining: number): [string, string] {
  const { tone, toneSoft } = buildInvestorProBarPalette(progressRemaining);
  const parse = (value: string) => {
    const m = /^hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)$/.exec(value.trim());
    if (!m) return '#10b981';
    return hslToHex(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
  };
  return [parse(toneSoft), parse(tone)];
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
