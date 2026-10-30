import { PlanType } from '@prisma/client';

export const INVESTOR_PRO_PUBLICATION_CREDITS = 5;
const DEFAULT_PRO_DAYS = 30;

/**
 * Jednolite nadanie Investor Pro — admin, Stripe webhook, force-sync.
 * Kredyty się SUMUJĄ: po końcu okresu zostają zamrożone, a przedłużenie je odmraża i dolicza 5 nowych.
 */
export function buildInvestorProGrantData(days = DEFAULT_PRO_DAYS) {
  const proExpiresAt = new Date();
  proExpiresAt.setDate(proExpiresAt.getDate() + days);
  return {
    isPro: true,
    planType: PlanType.PRO,
    proExpiresAt,
    extraListings: { increment: INVESTOR_PRO_PUBLICATION_CREDITS },
    plusExpiresAt: proExpiresAt,
  } as const;
}

/**
 * Ta sama płatność potrafi przyjść dwa razy (webhook Stripe + force-sync po powrocie).
 * Jeśli okres Pro został nadany przed chwilą (zostało > days-3 dni), nie doliczamy kredytów drugi raz.
 */
export function investorProJustGranted(proExpiresAt: Date | string | null | undefined, days = DEFAULT_PRO_DAYS): boolean {
  if (!proExpiresAt) return false;
  const left = new Date(proExpiresAt).getTime() - Date.now();
  return left > (days - 3) * 24 * 60 * 60 * 1000;
}

/** Nadanie Investor Pro po e-mailu (Stripe), z ochroną przed podwójnym doliczeniem. */
export async function grantInvestorProByEmail(
  prisma: { user: { findMany: Function; update: Function } },
  email: string,
): Promise<{ granted: number; skipped: number; proExpiresAt: Date }> {
  const grant = buildInvestorProGrantData();
  const users: Array<{ id: number; proExpiresAt: Date | null }> = await prisma.user.findMany({
    where: { email },
    select: { id: true, proExpiresAt: true },
  });
  let granted = 0;
  let skipped = 0;
  for (const u of users) {
    if (investorProJustGranted(u.proExpiresAt)) {
      skipped += 1;
      continue;
    }
    await prisma.user.update({ where: { id: u.id }, data: grant });
    granted += 1;
  }
  return { granted, skipped, proExpiresAt: grant.proExpiresAt };
}

export function buildInvestorProRevokeData() {
  return {
    isPro: false,
    planType: PlanType.INVESTOR,
    proExpiresAt: null,
    extraListings: 0,
    plusExpiresAt: null,
  } as const;
}

export function isStripeInvestorProPlan(raw: unknown): boolean {
  const p = String(raw || '')
    .trim()
    .toLowerCase();
  return p === 'investor' || p === 'pro' || p === 'investor_pro' || p === 'investor-pro';
}

/** Użytkownicy PRO sprzed migracji slotów → kredytów (jednorazowo, bez nadpisywania zużytych pul). */
export function shouldBackfillInvestorProCredits(user: {
  isPro?: boolean | null;
  proExpiresAt?: Date | string | null;
  extraListings?: number | null;
  plusExpiresAt?: Date | string | null;
}): boolean {
  if (!user?.isPro || !user.proExpiresAt) return false;
  if (new Date(user.proExpiresAt).getTime() <= Date.now()) return false;
  const credits = Number(user.extraListings ?? 0);
  if (credits > 0) return false;
  if (!user.plusExpiresAt) return true;
  return new Date(user.plusExpiresAt).getTime() <= Date.now();
}

export function buildInvestorProCreditsBackfillData(user: {
  proExpiresAt: Date | string;
}) {
  const proExpiresAt = new Date(user.proExpiresAt);
  return {
    extraListings: INVESTOR_PRO_PUBLICATION_CREDITS,
    plusExpiresAt: proExpiresAt,
  } as const;
}
