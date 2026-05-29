#!/usr/bin/env node
/**
 * Jednorazowa normalizacja PageVisitLog.createdAt → UTC (po przejściu na UTC_TIMESTAMP).
 * Uruchom na produkcji: node scripts/normalize-page-visit-utc.cjs
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$executeRawUnsafe(`
      UPDATE PageVisitLog
      SET createdAt = CONVERT_TZ(createdAt, 'Europe/Warsaw', 'UTC')
      WHERE createdAt IS NOT NULL
    `);
    console.log("[normalize-page-visit-utc] OK, rows affected:", result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
