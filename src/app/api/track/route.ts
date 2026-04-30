import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

const PAGE_VISIT_WINDOW_MINUTES = 30;

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return req.headers.get("x-real-ip") || "0.0.0.0";
}

function normalizePath(pathRaw: unknown): string {
  const path = String(pathRaw || "/").trim();
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 190) || "/";
}

function hashVisitor(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function ensurePageVisitTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS PageVisitLog (
      id BIGINT NOT NULL AUTO_INCREMENT,
      visitorHash VARCHAR(64) NOT NULL,
      ip VARCHAR(64) NOT NULL,
      country VARCHAR(8) NOT NULL DEFAULT 'PL',
      path VARCHAR(191) NOT NULL DEFAULT '/',
      userAgent VARCHAR(255) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY PageVisitLog_path_createdAt_idx (path, createdAt),
      KEY PageVisitLog_hash_createdAt_idx (visitorHash, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = getClientIp(req).slice(0, 64);
    const country = (req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "PL").toUpperCase().slice(0, 8);
    const path = normalizePath(body?.path);
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 255);
    const visitorHash = hashVisitor(`${ip}|${userAgent}`);

    await ensurePageVisitTable();

    const recent = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT id
        FROM PageVisitLog
        WHERE visitorHash = ?
          AND path = ?
          AND createdAt >= DATE_SUB(NOW(3), INTERVAL ? MINUTE)
        LIMIT 1
      `,
      visitorHash,
      path,
      PAGE_VISIT_WINDOW_MINUTES
    );

    let counted = false;
    if (!recent.length) {
      counted = true;
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO PageVisitLog (visitorHash, ip, country, path, userAgent, createdAt)
          VALUES (?, ?, ?, ?, ?, NOW(3))
        `,
        visitorHash,
        ip,
        country,
        path,
        userAgent
      );
    }

    return NextResponse.json({ success: true, counted });
  } catch (error) {
    console.error("[TRACK ERROR]", error);
    return NextResponse.json({ success: true });
  }
}
