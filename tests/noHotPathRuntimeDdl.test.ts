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
