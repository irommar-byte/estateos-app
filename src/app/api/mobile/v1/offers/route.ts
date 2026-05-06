export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOffer, updateOffer } from '@/lib/services/offer.service';
import { verifyMobileToken } from '@/lib/jwtMobile';

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
type PendingCreate = { createdAt: number; promise: Promise<any> };
const globalAny = global as any;
if (!globalAny.mobileOfferCreateMap) {
  globalAny.mobileOfferCreateMap = new Map<string, PendingCreate>();
}

function cleanupIdempotencyMap() {
  const now = Date.now();
  const map: Map<string, PendingCreate> = globalAny.mobileOfferCreateMap;
  for (const [key, value] of map.entries()) {
    if (now - value.createdAt > IDEMPOTENCY_TTL_MS) {
      map.delete(key);
    }
  }
}

function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as any;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

// =======================
// GET 🔥 FIX
// =======================
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeAll = searchParams.get('includeAll') === 'true';
  const userId = searchParams.get('userId');

  let where: any = {};

  // owner view: pełna lista własnych ogłoszeń (bez ograniczania do ACTIVE)
  if (userId) {
    where = { userId: Number(userId) };
  } else if (!includeAll) {
    // public view: tylko aktywne i z koordynatami
    where = {
      status: 'ACTIVE',
      lat: { not: null },
      lng: { not: null }
    };
  }

  try {
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

    const offers = await prisma.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            planType: true,
            isPro: true,
          },
        },
      },
    });

    const offerIds = offers.map((o) => Number(o.id)).filter((id) => Number.isFinite(id));
    if (!offerIds.length) {
      return NextResponse.json({ success: true, offers });
    }

    const viewsRows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT offerId, COUNT(*) AS total
        FROM OfferViewLog
        WHERE offerId IN (${offerIds.join(',')})
        GROUP BY offerId
      `
    );
    const viewsMap = new Map<number, number>(
      viewsRows.map((row: any) => [Number(row.offerId), Number(row.total || 0)])
    );

    const normalizedOffers = offers.map((offer: any) => {
      const viewsCount = viewsMap.get(Number(offer.id)) || 0;
      return { ...offer, views: viewsCount, viewsCount };
    });

    return NextResponse.json({ success: true, offers: normalizedOffers });

  } catch (error: any) {
    console.error("🔥 MOBILE API ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// =======================
// POST
// =======================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const authUserId = parseUserIdFromBearer(req);
    if (!authUserId) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji.' }, { status: 401 });
    }
    const bodyUserId = Number(body?.userId);
    if (!Number.isFinite(bodyUserId) || bodyUserId <= 0 || bodyUserId !== authUserId) {
      return NextResponse.json({ success: false, message: 'Błędny użytkownik w żądaniu.' }, { status: 403 });
    }
    cleanupIdempotencyMap();

    const reqId = String(body?.clientRequestId || '').trim();
    const userId = Number(body?.userId);
    const safeUserId = Number.isFinite(userId) && userId > 0 ? userId : 'anon';
    const dedupeKey = reqId ? `${safeUserId}:${reqId}` : '';

    if (dedupeKey) {
      const map: Map<string, PendingCreate> = globalAny.mobileOfferCreateMap;
      const existing = map.get(dedupeKey);
      if (existing) {
        const existingOffer = await existing.promise;
        return NextResponse.json({ success: true, offer: existingOffer, deduplicated: true });
      }

      const promise = createOffer(body);
      map.set(dedupeKey, { createdAt: Date.now(), promise });
      try {
        const offer = await promise;
        return NextResponse.json({ success: true, offer });
      } catch (e) {
        map.delete(dedupeKey);
        throw e;
      }
    }

    const offer = await createOffer(body);


    return NextResponse.json({ success: true, offer });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message });
  }
}

// =======================
// PUT
// =======================
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const offer = await updateOffer(body);
    return NextResponse.json({ success: true, offer });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message });
  }
}
