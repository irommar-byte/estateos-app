import { prisma } from '@/lib/prisma';
import { writeOfficeLedger } from '@/lib/crm/officeCredits';
import { ensureMobileIapTables } from '@/lib/mobileIapTables';
import { resolveCompanyPartnerPlanStatus } from '@/lib/partnerPlanStatus';
import { PARTNER_PAID_PLANS, type PartnerPlanId } from '@/lib/partnerPricing';
import { setAgencyPlanTypeKeepInvestorPro, unfreezeMemberCredits } from '@/lib/partnerStripeGrant';

/**
 * Centrala: pakiet Partner biura i pula kredytów biurowych — ręcznie, przez administratora.
 * Każda zmiana puli trafia do historii puli (kierownik widzi ją jako „Korekta EstateOS™”).
 */
export type AdminOfficePlan = {
  planId: PartnerPlanId | null;
  active: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  credits: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAdminOfficePlan(companyId: number): Promise<AdminOfficePlan> {
  const company = await prisma.agencyCompany.findUnique({
    where: { id: companyId },
    select: { ownerUserId: true, extraListings: true, plusExpiresAt: true },
  });
  if (!company) throw new Error('Nie znaleziono biura.');
  const activeAgents = await prisma.agencyCompanyMember.count({ where: { companyId, status: 'ACTIVE' } });
  const plan = await resolveCompanyPartnerPlanStatus({
    ownerUserId: company.ownerUserId,
    extraListings: company.extraListings,
    plusExpiresAt: company.plusExpiresAt,
    activeAgents,
  });
  return {
    planId: plan.displayPlanId,
    active: plan.isSubscriptionActive,
    expiresAt: plan.plusExpiresAt,
    daysRemaining: plan.daysRemaining,
    credits: company.extraListings,
  };
}

/** Aktywuje (albo przedłuża) pakiet Partner na wskazaną liczbę dni; opcjonalnie dolicza kredyty pakietu. */
export async function adminActivateOfficePlan(params: {
  companyId: number;
  adminUserId: number;
  planId: string;
  days: number;
  withCredits: boolean;
}): Promise<void> {
  const plan = PARTNER_PAID_PLANS.find((p) => p.id === params.planId);
  if (!plan) throw new Error('Wybierz pakiet: Start, Pro albo Enterprise.');
  const days = Math.floor(Number(params.days));
  if (!Number.isFinite(days) || days < 1 || days > 366) throw new Error('Okres pakietu: od 1 do 366 dni.');

  const company = await prisma.agencyCompany.findUnique({
    where: { id: params.companyId },
    select: { id: true, ownerUserId: true, plusExpiresAt: true },
  });
  if (!company) throw new Error('Nie znaleziono biura.');

  await ensureMobileIapTables();
  await setAgencyPlanTypeKeepInvestorPro(company.ownerUserId);

  // Aktywny pakiet przedłużamy od jego końca, wygasły — od dziś.
  const base = Math.max(Date.now(), company.plusExpiresAt ? new Date(company.plusExpiresAt).getTime() : 0);
  const expiry = new Date(base + days * DAY_MS);
  const ref = `admin:${params.adminUserId}:${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    await tx.agencyCompany.update({
      where: { id: company.id },
      data: {
        plusExpiresAt: expiry,
        ...(params.withCredits ? { extraListings: { increment: plan.creditsPerMonth } } : {}),
      },
    });
    await unfreezeMemberCredits(tx, company.id, expiry);
    if (params.withCredits) {
      await writeOfficeLedger(tx, {
        companyId: company.id,
        delta: plan.creditsPerMonth,
        kind: 'PARTNER',
        userId: params.adminUserId,
        refType: 'admin_plan',
        refId: ref,
        note: `Pakiet Partner ${plan.id} od EstateOS™ · +${plan.creditsPerMonth} kredytów`,
      });
    }
    // Wpis zakupu decyduje o tym, który pakiet (Start / Pro / Enterprise) widzi biuro.
    await tx.$executeRawUnsafe(
      `INSERT INTO MobileIapPurchase
         (userId, pendingPurchaseId, platform, productId, transactionId, status, verifyStatus, entitlementGrantedAt)
       VALUES (?, ?, 'admin', ?, ?, 'VERIFIED', 'VERIFIED', NOW(3))`,
      company.ownerUserId,
      ref,
      `pl.estateos.partner.${plan.id}_monthly`,
      ref,
    );
  });
}

/** Cofa pakiet: wygasa od razu, kredyty biura i agentów zostają zamrożone (wracają po przedłużeniu). */
export async function adminRevokeOfficePlan(companyId: number): Promise<void> {
  const res = await prisma.agencyCompany.updateMany({
    where: { id: companyId, plusExpiresAt: { gt: new Date() } },
    data: { plusExpiresAt: new Date() },
  });
  if (res.count === 0) throw new Error('Biuro nie ma aktywnego pakietu.');
}

/** Dodaje albo zabiera kredyty biurowe z puli (nie schodzi poniżej zera). */
export async function adminAdjustOfficeCredits(params: {
  companyId: number;
  adminUserId: number;
  delta: number;
  reason: string;
}): Promise<{ applied: number; balance: number }> {
  const delta = Math.trunc(Number(params.delta));
  if (!Number.isFinite(delta) || delta === 0) throw new Error('Podaj liczbę kredytów różną od zera.');
  if (Math.abs(delta) > 1000) throw new Error('Jednorazowa zmiana max ±1000 kredytów.');
  const reason = String(params.reason || '').trim().slice(0, 200) || 'Korekta administratora';

  return prisma.$transaction(async (tx) => {
    const rows = (await tx.$queryRawUnsafe(
      `SELECT extraListings FROM AgencyCompany WHERE id = ? FOR UPDATE`,
      params.companyId,
    )) as Array<{ extraListings: number }>;
    if (!rows[0]) throw new Error('Nie znaleziono biura.');
    const current = Math.max(0, Number(rows[0].extraListings));
    const next = Math.max(0, current + delta);
    const applied = next - current;
    if (applied === 0) throw new Error('Pula biura jest pusta — nie ma czego zabrać.');
    await tx.agencyCompany.update({ where: { id: params.companyId }, data: { extraListings: next } });
    await writeOfficeLedger(tx, {
      companyId: params.companyId,
      delta: applied,
      kind: 'ADMIN',
      userId: params.adminUserId,
      refType: 'admin',
      refId: `admin:${params.adminUserId}:${Date.now()}`,
      note: reason,
    });
    return { applied, balance: next };
  });
}
