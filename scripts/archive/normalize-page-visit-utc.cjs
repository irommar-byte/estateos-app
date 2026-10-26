#!/usr/bin/env node
/**
 * Jednorazowo: PageVisitLog.createdAt zapisywany przez NOW() traktujemy jako czas warszawski
 * i zapisujemy w bazie jako UTC (zgodne z UTC_TIMESTAMP w /api/track).
 */
const { PrismaClient } = require("@prisma/client");

const WARSAW = "Europe/Warsaw";

function instantFromWarsawWall(year, month, day, hour, minute, second) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: WARSAW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  let t = target - 2 * 3_600_000;
  for (let i = 0; i < 5; i++) {
    const parts = fmt.formatToParts(new Date(t));
    const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
    const actual = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    const delta = target - actual;
    if (delta === 0) break;
    t += delta;
  }
  return new Date(t);
}

function parseWall(value) {
  const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return instantFromWarsawWall(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') AS wall
      FROM PageVisitLog
      ORDER BY id ASC
    `);

    let updated = 0;
    for (const row of rows) {
      const utc = parseWall(row.wall);
      if (!utc) continue;
      const wall = utc.toISOString().slice(0, 19).replace("T", " ");
      await prisma.$executeRawUnsafe(
        `UPDATE PageVisitLog SET createdAt = ? WHERE id = ?`,
        wall,
        row.id,
      );
      updated++;
    }
    console.log(`[normalize-page-visit-utc] Zaktualizowano ${updated} / ${rows.length} wierszy.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
