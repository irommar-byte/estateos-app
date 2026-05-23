#!/usr/bin/env node
/**
 * Oferty powiązane z sfinalizowanymi / uzgodnionymi dealami, które nadal są ACTIVE → SOLD.
 *
 *   node scripts/migrate-finalized-deals-archive-offers.cjs
 *   node scripts/migrate-finalized-deals-archive-offers.cjs --dry-run
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const deals = await prisma.deal.findMany({
    where: {
      acceptedBidId: { not: null },
      status: { in: ['FINALIZED', 'AGREED'] },
    },
    select: {
      id: true,
      status: true,
      offerId: true,
      offer: { select: { id: true, status: true, title: true } },
    },
  });

  const stale = deals.filter((d) => d.offer && d.offer.status === 'ACTIVE');
  console.log(`Deale FINALIZED/AGREED z aktywną ofertą: ${stale.length}`);

  for (const row of stale) {
    console.log(
      `  deal #${row.id} (${row.status}) → offer #${row.offerId} "${row.offer?.title || ''}" [ACTIVE]`
    );
    if (!dryRun) {
      await prisma.offer.update({
        where: { id: row.offerId },
        data: {
          status: 'SOLD',
          expiresAt: new Date(),
        },
      });
    }
  }

  if (dryRun) {
    console.log('Dry-run — brak zmian w bazie.');
  } else if (stale.length > 0) {
    console.log(`Zaktualizowano ${stale.length} ofert(y) na SOLD.`);
  } else {
    console.log('Brak ofert do migracji.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
