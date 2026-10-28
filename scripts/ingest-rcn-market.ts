#!/usr/bin/env npx tsx
import { ingestWarsawRcn } from '../src/lib/market/ingestRcn';
import { prisma } from '../src/lib/prisma';

async function main() {
  const result = await ingestWarsawRcn({ source: 'cli' });
  console.log(JSON.stringify(result, null, 2));
  // Ile wiarygodnych aktów mamy dla mieszkań, domów i działek.
  const byKind = await prisma.marketTransaction.groupBy({ by: ['kind', 'qualityOk'], _count: { _all: true } });
  console.log(JSON.stringify(byKind.map((row) => ({ kind: row.kind, qualityOk: row.qualityOk, count: row._count._all })), null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
