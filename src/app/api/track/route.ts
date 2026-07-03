import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { ensurePageVisitLogTable } from "@/lib/pageVisitLogTable";
import { parseDeviceType, resolveVisitGeo } from "@/lib/visitGeo";
import { resolveWebUserId } from "@/lib/webSessionAuth";

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
  await ensurePageVisitLogTable();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = getClientIp(req).slice(0, 64);
    const geo = await resolveVisitGeo(req, ip);
    const path = normalizePath(body?.path);
    const campaignRef = String(body?.campaignRef || "").trim().slice(0, 120);
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 255);
    const deviceType = parseDeviceType(userAgent);
    const visitorHash = hashVisitor(`${ip}|${userAgent}`);
    const userId = await resolveWebUserId(req);

    await ensurePageVisitTable();

    const dedupePath = campaignRef ? `${path}|${campaignRef}` : path;
    const recent = userId
      ? await prisma.$queryRawUnsafe<any[]>(
          `
        SELECT id
        FROM PageVisitLog
        WHERE userId = ?
          AND path = ?
          AND createdAt >= DATE_SUB(NOW(3), INTERVAL ? MINUTE)
        LIMIT 1
      `,
          userId,
          dedupePath,
          PAGE_VISIT_WINDOW_MINUTES,
        )
      : await prisma.$queryRawUnsafe<any[]>(
          `
        SELECT id
        FROM PageVisitLog
        WHERE visitorHash = ?
          AND path = ?
          AND createdAt >= DATE_SUB(NOW(3), INTERVAL ? MINUTE)
        LIMIT 1
      `,
          visitorHash,
          dedupePath,
          PAGE_VISIT_WINDOW_MINUTES,
        );

    let counted = false;
    if (!recent.length) {
      counted = true;
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO PageVisitLog (visitorHash, ip, country, city, regionName, isp, geoSource, deviceType, path, userAgent, userId, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
        `,
        visitorHash,
        ip,
        geo.countryCode,
        geo.city,
        geo.regionName,
        geo.isp,
        geo.geoSource,
        deviceType,
        dedupePath,
        userAgent,
        userId,
      );
    }

    return NextResponse.json({ success: true, counted });
  } catch (error) {
    console.error("[TRACK ERROR]", error);
    return NextResponse.json({ success: true });
  }
}
