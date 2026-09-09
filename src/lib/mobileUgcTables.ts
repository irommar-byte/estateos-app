import { prisma } from '@/lib/prisma';

export async function ensureMobileUgcTables() {
  // Schema is applied by prisma/manual/sql/2026-09-09_legacy_runtime_tables.sql
  return;
}

export async function ensureAdminReportColumns() {
  // Schema is applied by prisma/manual/sql/2026-09-09_legacy_runtime_tables.sql
  return;
}
