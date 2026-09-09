import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const HOT_PATH_MODULES = [
  'src/lib/prisma.ts',
  'src/lib/keiAmerImportJobs.ts',
  'src/lib/keiAutoImport.ts',
  'src/lib/keiImportLease.ts',
  'src/lib/crm/clientIntelligenceRun.ts',
  'src/lib/intelligenceAmenityPatches.ts',
  'src/lib/offerPriceHistory.ts',
  'src/lib/services/offer.service.ts',
  'src/lib/desk/ensureSchema.ts',
  'src/lib/market/ensureMarketTables.ts',
  'src/lib/keiAmerListingState.ts',
  'src/lib/walletLedger.ts',
  'src/lib/mobileIapTables.ts',
  'src/lib/carsStorage.ts',
  'src/lib/offerPublication.ts',
  'src/lib/offerPendingPublication.ts',
  'src/app/api/cars/route.ts',
  'src/app/api/offers/[id]/view/route.ts',
];

test('request and worker hot paths do not execute schema DDL', () => {
  for (const relativePath of HOT_PATH_MODULES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.doesNotMatch(
      source,
      /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX)\b/i,
      `${relativePath} still contains runtime DDL`,
    );
  }
});

test('legacy runtime SQL is executable SQL, not leftover TypeScript', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'prisma/manual/sql/2026-09-09_legacy_runtime_tables.sql'),
    'utf8',
  );
  assert.doesNotMatch(source, /\$executeRaw|\.then\(|lockTableReady|`\);/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS/);
  assert.match(source, /ContactMessage_threadId_createdAt_idx/);
});
