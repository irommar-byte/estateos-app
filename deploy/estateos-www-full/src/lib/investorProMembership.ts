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
  /** 0 = koniec okresu, 1 = pełny okres przed nami (zgodne z „pozostało X dni”). */
  progressRemaining: number;
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
  const progressRemaining = Math.min(1, Math.max(0, daysLeft / periodDays));

  let labelKey: InvestorProPeriodStatus['labelKey'] = 'active';
  if (daysLeft <= 1) labelKey = 'lastDay';
  else if (daysLeft <= 7) labelKey = 'endingSoon';

  return {
    expiresAtMs,
    daysLeft,
    hoursLeft,
    progressRemaining,
    periodDays,
    labelKey,
  };
}

/** Płynna paleta: zielony (pełny okres) → żółty → czerwony (koniec). */
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
  const tone = `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`;
  const toneSoft = `hsl(${hue.toFixed(1)} ${Math.max(55, sat - 12).toFixed(0)}% ${Math.max(38, light - 10).toFixed(0)}%)`;
  const glow = `hsla(${hue.toFixed(1)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%, 0.45)`;

  return { tone, toneSoft, glow, hue };
}
