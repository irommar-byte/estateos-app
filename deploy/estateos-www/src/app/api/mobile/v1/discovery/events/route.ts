import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';

const EVENT_TYPES = new Set([
  'DISCOVERY_LIKE',
  'DISCOVERY_DISLIKE',
  'DISCOVERY_FAST_TRACK',
  'DISCOVERY_OPEN',
  'DISCOVERY_DISLIKE_REASON',
] as const);

const REASON_CODES = new Set([
  'PRICE_TOO_HIGH',
  'LOCATION_MISMATCH',
  'LAYOUT_MISMATCH',
  'QUALITY_LOW',
] as const);

const PLATFORMS = new Set(['ios', 'android', 'web'] as const);

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken;
  if (!token) return null;

  const verified = verifyMobileToken(token) as any;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) return verifiedId;

  const decoded = jwt.decode(token) as any;
  const decodedId = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  return Number.isFinite(decodedId) && decodedId > 0 ? decodedId : null;
}

function incStat(stats: Record<string, number>, key: string, delta: number) {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return stats;
  const current = Number(stats[cleanKey] || 0);
  stats[cleanKey] = current + delta;
  return stats;
}

export async function POST(req: Request) {
  try {
    const userId = parseUserIdFromAuthHeader(
      req.headers.get('authorization') || req.headers.get('Authorization')
    );
    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const eventType = String(body?.eventType || '').toUpperCase();
    const offerId = Number(body?.offerId);
    const photoIndex = body?.photoIndex == null ? null : Number(body.photoIndex);
    const score = body?.score == null ? null : Number(body.score);
    const reasonCode = body?.reasonCode == null ? null : String(body.reasonCode).toUpperCase();
    const source = String(body?.source || 'mobile_discovery').trim();
    const platform = String(body?.platform || '').toLowerCase();
    const atRaw = body?.at ? new Date(body.at) : new Date();

    if (!EVENT_TYPES.has(eventType as any)) {
      return NextResponse.json({ error: 'Niepoprawne eventType' }, { status: 400 });
    }
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ error: 'offerId musi być > 0' }, { status: 400 });
    }
    if (!PLATFORMS.has(platform as any)) {
      return NextResponse.json({ error: 'Niepoprawna platform' }, { status: 400 });
    }
    if (reasonCode && !REASON_CODES.has(reasonCode as any)) {
      return NextResponse.json({ error: 'Niepoprawne reasonCode' }, { status: 400 });
    }
    if (eventType === 'DISCOVERY_DISLIKE_REASON' && !reasonCode) {
      return NextResponse.json({ error: 'reasonCode jest wymagane dla DISCOVERY_DISLIKE_REASON' }, { status: 400 });
    }
    if (score != null && (!Number.isFinite(score) || score < 0 || score > 100)) {
      return NextResponse.json({ error: 'score musi być w zakresie 0..100' }, { status: 400 });
    }
    if (photoIndex != null && (!Number.isFinite(photoIndex) || photoIndex < 0)) {
      return NextResponse.json({ error: 'photoIndex musi być >= 0' }, { status: 400 });
    }
    if (Number.isNaN(atRaw.getTime())) {
      return NextResponse.json({ error: 'Niepoprawne at (ISO datetime)' }, { status: 400 });
    }

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, city: true, district: true, propertyType: true },
    });
    if (!offer) {
      return NextResponse.json({ error: 'Oferta nie istnieje' }, { status: 404 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const evt = await tx.discoveryEvent.create({
        data: {
          userId,
          eventType,
          offerId,
          photoIndex,
          score,
          reasonCode,
          source: source || 'mobile_discovery',
          platform,
          at: atRaw,
        },
      });

      const existingProfile = await tx.discoveryProfile.findUnique({ where: { userId } });
      const reasonStats = (existingProfile?.reasonStats as Record<string, number> | null) || {};
      const cityStats = (existingProfile?.cityStats as Record<string, number> | null) || {};
      const districtStats = (existingProfile?.districtStats as Record<string, number> | null) || {};
      const propertyStats = (existingProfile?.propertyStats as Record<string, number> | null) || {};

      const delta = eventType === 'DISCOVERY_LIKE' || eventType === 'DISCOVERY_FAST_TRACK'
        ? 1
        : eventType === 'DISCOVERY_DISLIKE' || eventType === 'DISCOVERY_DISLIKE_REASON'
          ? -1
          : 0;

      if (delta !== 0) {
        incStat(cityStats, offer.city, delta);
        incStat(districtStats, offer.district, delta);
        incStat(propertyStats, String(offer.propertyType), delta);
      }
      if (reasonCode) {
        incStat(reasonStats, reasonCode, 1);
      }

      await tx.discoveryProfile.upsert({
        where: { userId },
        create: {
          userId,
          likesCount: eventType === 'DISCOVERY_LIKE' ? 1 : 0,
          dislikesCount: eventType === 'DISCOVERY_DISLIKE' || eventType === 'DISCOVERY_DISLIKE_REASON' ? 1 : 0,
          fastTrackCount: eventType === 'DISCOVERY_FAST_TRACK' ? 1 : 0,
          opensCount: eventType === 'DISCOVERY_OPEN' ? 1 : 0,
          reasonStats,
          cityStats,
          districtStats,
          propertyStats,
        },
        update: {
          likesCount: { increment: eventType === 'DISCOVERY_LIKE' ? 1 : 0 },
          dislikesCount: { increment: eventType === 'DISCOVERY_DISLIKE' || eventType === 'DISCOVERY_DISLIKE_REASON' ? 1 : 0 },
          fastTrackCount: { increment: eventType === 'DISCOVERY_FAST_TRACK' ? 1 : 0 },
          opensCount: { increment: eventType === 'DISCOVERY_OPEN' ? 1 : 0 },
          reasonStats,
          cityStats,
          districtStats,
          propertyStats,
        },
      });

      return evt;
    });

    return NextResponse.json({ success: true, id: String(created.id) });
  } catch (error) {
    console.error('[DISCOVERY EVENTS ERROR]', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
