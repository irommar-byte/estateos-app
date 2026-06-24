#!/usr/bin/env npx tsx
/**
 * Codzienny nurture Partner — e-maile + powiadomienia dla administratorów biur.
 * PM2: cron_restart "0 8 * * *"
 */
import { prisma } from '../src/lib/prisma';
import { resolveCompanyPartnerPlanStatus } from '../src/lib/partnerPlanStatus';
import {
  computePartnerGrowthInsight,
  growthEmailBuckets,
  growthTouchKey,
} from '../src/lib/partnerGrowth';
import { deliverPartnerGrowthTouch } from '../src/lib/partnerGrowthNotify';

function log(level: string, message: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, job: 'partner-growth-nurture', message, ...details }));
}

async function touchAlreadySent(idempotencyKey: string): Promise<boolean> {
  const row = await prisma.notification.findFirst({
    where: { idempotencyKey },
    select: { id: true },
  });
  return Boolean(row);
}

async function main() {
  const companies = await prisma.agencyCompany.findMany({
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      extraListings: true,
      plusExpiresAt: true,
      owner: { select: { id: true, email: true, name: true } },
    },
  });

  let touches = 0;
  let emails = 0;
  let skipped = 0;

  for (const company of companies) {
    const owner = company.owner;
    if (!owner?.email) continue;

    const activeAgents = await prisma.agencyCompanyMember.count({
      where: { companyId: company.id, status: 'ACTIVE' },
    });

    const partnerPlan = await resolveCompanyPartnerPlanStatus({
      ownerUserId: company.ownerUserId,
      extraListings: company.extraListings,
      plusExpiresAt: company.plusExpiresAt,
      activeAgents,
    });

    const insight = computePartnerGrowthInsight({
      partnerPlan,
      companyName: company.name,
    });
    if (!insight) continue;

    const buckets = growthEmailBuckets(insight, partnerPlan.daysRemaining);
    if (buckets.length === 0) continue;

    for (const bucket of buckets) {
      const key = growthTouchKey({
        kind: insight.kind,
        companyId: company.id,
        userId: owner.id,
        bucket,
      });
      if (await touchAlreadySent(key)) {
        skipped += 1;
        continue;
      }

      const result = await deliverPartnerGrowthTouch({
        userId: owner.id,
        userEmail: owner.email,
        userName: owner.name,
        companyId: company.id,
        companyName: company.name,
        insight,
        daysRemaining: partnerPlan.daysRemaining,
        sendEmail: true,
        emailBucket: bucket,
      });

      if (result.notified) touches += 1;
      if (result.emailed) emails += 1;
    }
  }

  log('info', 'completed', { companies: companies.length, touches, emails, skipped });
}

main()
  .catch((e) => {
    log('error', 'failed', { error: String(e) });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
