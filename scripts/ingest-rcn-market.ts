#!/usr/bin/env npx tsx
import { execSync } from 'node:child_process';
import { ingestWarsawRcn } from '../src/lib/market/ingestRcn';
import { isScheduledRunDue, markScheduledRun } from '../src/lib/market/ingestControl';
import { prisma } from '../src/lib/prisma';

/**
 * Import RCN.
 * --scheduled: wywołanie z pm2 co godzinę — rusza tylko, gdy wypada termin z harmonogramu ustawionego w aplikacji.
 * Bez flagi (ręcznie / „Aktualizuj teraz” z panelu admina) — rusza od razu.
 */
async function main() {
  const scheduled = process.argv.includes('--scheduled');
  if (scheduled) {
    // W trakcie wdrożenia (next build) nie startujemy — za mało pamięci na oba naraz; ruszy za godzinę.
    try {
      if (execSync("pgrep -f '[n]ext build' || true").toString().trim()) {
        console.log(JSON.stringify({ job: 'rcn-ingest', message: 'deploy_in_progress' }));
        return;
      }
    } catch {
      /* brak pgrep — sprawdzamy dalej */
    }
    if (!(await isScheduledRunDue())) {
      console.log(JSON.stringify({ job: 'rcn-ingest', message: 'not_due' }));
      return;
    }
    await markScheduledRun();
  }
  const result = await ingestWarsawRcn({
    source: scheduled ? 'schedule' : process.argv.includes('--manual') ? 'admin-app' : 'cli',
    full: process.argv.includes('--full'),
  });
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
