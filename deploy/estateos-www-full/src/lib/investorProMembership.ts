/** Bieżący okres rozliczeniowy subskrypcji Investor Pro (miesięczny). */
export const INVESTOR_PRO_BILLING_PERIOD_DAYS = 30;

export function parseProExpiryMs(value: unknown): number | null {
  if (!value) return null;
  const ts = new Date(String(value)).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export type InvestorProPeriodStatus = {
  expiresAtMs: number;
  daysLeft: number;
  hoursLeft: number;
  /** 0 = początek okresu, 1 = koniec okresu (tuż przed odnowieniem). */
  progressElapsed: number;
  periodDays: number;
  labelKey: 'active' | 'endingSoon' | 'lastDay';
};

export function inferInvestorProBillingPeriodDays(
  daysLeft: number,
  billingPeriodDays = INVESTOR_PRO_BILLING_PERIOD_DAYS,
): number {
  return Math.max(billingPeriodDays, daysLeft);
}

export function buildInvestorProPeriodStatus(
  proExpiresAt: unknown,
  now = new Date(),
  billingPeriodDays = INVESTOR_PRO_BILLING_PERIOD_DAYS,
): InvestorProPeriodStatus | null {
  const expiresAtMs = parseProExpiryMs(proExpiresAt);
  if (!expiresAtMs || expiresAtMs <= now.getTime()) return null;

  const remainingMs = expiresAtMs - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(remainingMs / 86_400_000));
  const hoursLeft = Math.max(0, Math.ceil(remainingMs / 3_600_000));
  const periodDays = inferInvestorProBillingPeriodDays(daysLeft, billingPeriodDays);
  const periodMs = periodDays * 86_400_000;
  const periodStartMs = expiresAtMs - periodMs;
  const elapsedMs = Math.max(0, now.getTime() - periodStartMs);
  const progressElapsed = Math.min(1, Math.max(0, elapsedMs / periodMs));

  let labelKey: InvestorProPeriodStatus['labelKey'] = 'active';
  if (daysLeft <= 1) labelKey = 'lastDay';
  else if (daysLeft <= 7) labelKey = 'endingSoon';

  return {
    expiresAtMs,
    daysLeft,
    hoursLeft,
    progressElapsed,
    periodDays,
    labelKey,
  };
}
