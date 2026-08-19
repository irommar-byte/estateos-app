#!/usr/bin/env npx tsx
import { recomputeWarsawAreaStats } from '../src/lib/market/aggregates';
import { resolveRcnAsOfDate, formatPlDate } from '../src/lib/market/asOf';
import { ensureMarketTables } from '../src/lib/market/ensureMarketTables';
import { WARSAW_CITY } from '../src/lib/market/constants';
import { prisma } from '../src/lib/prisma';

async function main() {
  await ensureMarketTables();
  const asOf = await resolveRcnAsOfDate(WARSAW_CITY);
  console.log(JSON.stringify({ asOf: asOf.toISOString(), asOfLabel: formatPlDate(asOf) }));
  await recomputeWarsawAreaStats();
  const city90 = await prisma.marketAreaStat.findFirst({
    where: { city: WARSAW_CITY, district: '', periodDays: 90 },
    select: { txnCount: true, medianPpsm: true },
  });
  console.log(JSON.stringify({ city90, done: true }));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
