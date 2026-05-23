import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { decryptSession } from '@/lib/sessionUtils';
import { verifyMobileToken } from '@/lib/jwtMobile';

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  return req.headers.get('x-real-ip') || '0.0.0.0';
}

function hashVisitor(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

async function ensureOfferViewTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS OfferViewLog (
      id BIGINT NOT NULL AUTO_INCREMENT,
      offerId INT NOT NULL,
      visitorKey VARCHAR(128) NOT NULL,
      source VARCHAR(16) NOT NULL DEFAULT 'web',
      ip VARCHAR(64) NULL,
      userAgent VARCHAR(255) NULL,
      hits INT NOT NULL DEFAULT 1,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      lastSeenAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY OfferViewLog_offerId_visitorKey_key (offerId, visitorKey),
      KEY OfferViewLog_offerId_lastSeenAt_idx (offerId, lastSeenAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function resolveVisitorKey(req: Request): Promise<string> {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyMobileToken(token) as any;
    const userId = Number(payload?.id || payload?.userId || 0);
    if (userId > 0) {
      return `user:${userId}`;
    }
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('estateos_session');
  if (sessionCookie?.value) {
    const sessionData = decryptSession(sessionCookie.value);
    const email = String(sessionData?.email || '').trim().toLowerCase();
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (user?.id) {
        return `user:${user.id}`;
      }
    }
  }

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || 'unknown-ua';
  const deviceId = req.headers.get('x-device-id') || '';
  const anonHash = hashVisitor(`${ip}|${ua}|${deviceId}`);
  return `anon:${anonHash}`;
}

export async function POST(req: Request, context: any) {
  try {
    const resolvedParams = await context.params;
    const offerId = Number.parseInt(resolvedParams.id, 10);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
    }

    await ensureOfferViewTable();

    const visitorKey = await resolveVisitorKey(req);
    const source = (req.headers.get('x-client-source') || 'web').slice(0, 16);
    const ip = getClientIp(req).slice(0, 64);
    const userAgent = (req.headers.get('user-agent') || '').slice(0, 255);

    const existingRows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT id, lastSeenAt
        FROM OfferViewLog
        WHERE offerId = ? AND visitorKey = ?
        LIMIT 1
      `,
      offerId,
      visitorKey
    );

    const shouldIncrement = !existingRows.length;
    if (!existingRows.length) {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO OfferViewLog (offerId, visitorKey, source, ip, userAgent, hits, createdAt, lastSeenAt)
          VALUES (?, ?, ?, ?, ?, 1, NOW(3), NOW(3))
        `,
        offerId,
        visitorKey,
        source,
        ip,
        userAgent
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
          UPDATE OfferViewLog
          SET hits = hits + 1, lastSeenAt = NOW(3), source = ?, ip = ?, userAgent = ?
          WHERE id = ?
        `,
        source,
        ip,
        userAgent,
        existingRows[0].id
      );
    }

    const totalViewsRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total FROM OfferViewLog WHERE offerId = ?`,
      offerId
    );
    const views = Number(totalViewsRows?.[0]?.total || 0);

    return NextResponse.json({ success: true, counted: shouldIncrement, views });
  } catch (error) {
    console.error('[OFFER VIEW ERROR]', error);
    return NextResponse.json({ error: 'Błąd licznika' }, { status: 500 });
  }
}
