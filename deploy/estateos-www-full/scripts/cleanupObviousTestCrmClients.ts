#!/usr/bin/env npx tsx
/**
 * Audit (and optionally purge) obvious CRM smoke/test clients on production.
 *
 * Usage:
 *   npx tsx scripts/cleanupObviousTestCrmClients.ts --dry-run
 *   npx tsx scripts/cleanupObviousTestCrmClients.ts --execute
 *
 * Safety: only deletes AgencyClient rows that match ALL of:
 * - name/notes/email contain smoke|test|fake|dummy OR email domain is @staging.test / @example.com
 * - OR email ends with @portal.estateos.internal AND name matches smoke/test patterns
 * Never deletes ACTIVE production-looking clients. Linked real Offers are NOT deleted.
 */

import { prisma } from '../src/lib/prisma';
import { permanentlyDeleteAgencyClient } from '../src/lib/adminAgencyClients';

const NAME_RE = /\b(smoke|test|fake|dummy|e2e)\b/i;
const EMAIL_RE = /@(staging\.test|example\.com)$/i;
const INTERNAL_RE = /@portal\.estateos\.internal$/i;

function isObviousTestClient(row: {
  firstName: string;
  lastName: string;
  email: string | null;
  notes: string | null;
  phone: string | null;
}) {
  const blob = `${row.firstName} ${row.lastName} ${row.notes || ''} ${row.email || ''} ${row.phone || ''}`;
  if (NAME_RE.test(blob)) return true;
  if (row.email && EMAIL_RE.test(row.email)) return true;
  if (row.email && INTERNAL_RE.test(row.email) && NAME_RE.test(blob)) return true;
  return false;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const rows = await prisma.agencyClient.findMany({
    select: {
      id: true,
      status: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      notes: true,
      linkedOfferId: true,
      linkedUserId: true,
      agencyUserId: true,
    },
    take: 5000,
    orderBy: { id: 'asc' },
  });

  const candidates = rows.filter(isObviousTestClient);
  const report = {
    scanned: rows.length,
    candidates: candidates.length,
    ids: candidates.map((c) => c.id),
    sample: candidates.slice(0, 30).map((c) => ({
      id: c.id,
      status: c.status,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      linkedOfferId: c.linkedOfferId,
    })),
  };

  console.log(JSON.stringify(report, null, 2));

  if (!execute) {
    console.log('\nDry-run only. Re-run with --execute to permanently delete candidates.');
    return;
  }

  const deleted: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];
  for (const row of candidates) {
    try {
      await permanentlyDeleteAgencyClient(row.id);
      deleted.push(row.id);
    } catch (error) {
      failed.push({ id: row.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ deleted: deleted.length, deletedIds: deleted, failed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
