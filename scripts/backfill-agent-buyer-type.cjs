#!/usr/bin/env node
/** Ustaw buyerType=agency dla kont z role=AGENT (rejestracja agenta). */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.user.updateMany({
      where: { role: "AGENT", OR: [{ buyerType: null }, { buyerType: "" }] },
      data: { buyerType: "agency" },
    });
    console.log("[backfill-agent-buyer-type] updated:", result.count);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
