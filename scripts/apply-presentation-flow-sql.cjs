#!/usr/bin/env node
/**
 * Idempotent-ish apply for presentation flow schema (prod/staging).
 * Usage: node scripts/apply-presentation-flow-sql.cjs
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const sqlPath = path.join(
  __dirname,
  "../docs/reconciliation/sql/add_appointment_outcomes_and_review_appointment.sql",
);

async function main() {
  const prisma = new PrismaClient();
  const raw = fs.readFileSync(sqlPath, "utf8");
  const chunks = raw
    .split(/;\s*\n/)
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);

  for (const statement of chunks) {
    try {
      await prisma.$executeRawUnsafe(statement);
      console.log("[ok]", statement.slice(0, 72).replace(/\s+/g, " "));
    } catch (err) {
      const msg = err?.message || String(err);
      if (/Duplicate|already exists|check that column/i.test(msg)) {
        console.log("[skip]", msg.slice(0, 100));
      } else {
        console.error("[fail]", msg);
      }
    }
  }

  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
