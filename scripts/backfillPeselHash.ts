#!/usr/bin/env npx tsx
/** Backfill AgencyClient.peselHash from existing pesel values. */
import { prisma } from '../src/lib/prisma';
import { hashPesel } from '../src/lib/crm/peselHash';

async function main() {
  const rows = await prisma.agencyClient.findMany({
    where: { pesel: { not: null }, OR: [{ peselHash: null }, { peselHash: '' }] },
    select: { id: true, pesel: true },
    take: 5000,
  });
  let updated = 0;
  for (const row of rows) {
    const peselHash = hashPesel(row.pesel);
    if (!peselHash) continue;
    await prisma.agencyClient.update({ where: { id: row.id }, data: { peselHash } });
    updated += 1;
  }
  console.log(JSON.stringify({ scanned: rows.length, updated }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
