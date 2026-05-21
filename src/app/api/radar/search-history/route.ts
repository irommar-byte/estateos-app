import { NextResponse } from 'next/server';
import { PropertyType, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canonicalizeCity, canonicalizeDistrict, getDistrictsForCity, isStrictCity } from '@/lib/location/locationCatalog';
import { requireMobileAdmin, parseUserIdFromMobileJwt, extractBearerToken } from '@/lib/mobileAdminAuth';
import { shapeRadarSearchHistoryRow } from '@/lib/radarSearchHistoryShape';

const TRANSACTION_TYPES = new Set<string>(Object.values(TransactionType));
const PROPERTY_TYPES = new Set<string>(Object.values(PropertyType));

function parseEnumValue<T extends string>(
  raw: unknown,
  allowed: Set<string>
): T | null {
  const value = String(raw || '').trim().toUpperCase();
  if (!value || value === 'ALL' || value === 'ANY') return null;
  return allowed.has(value) ? (value as T) : null;
}

function parseSearchedAt(raw: unknown): Date {
  if (!raw) return new Date();
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function authorizeRadarUserWrite(req: Request, targetUserId: number) {
  const adminGate = await requireMobileAdmin(req);
  if (adminGate.ok) return { ok: true as const };

  const token = extractBearerToken(req);
  const callerId = token ? parseUserIdFromMobileJwt(token) : null;
  if (!callerId) {
    return { ok: false as const, response: NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 }) };
  }
  if (callerId !== targetUserId) {
    return { ok: false as const, response: NextResponse.json({ success: false, message: 'Brak uprawnień' }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const targetUserId = Number(body?.userId ?? body?.user?.id);

    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ success: false, message: 'Brak lub nieprawidłowy userId' }, { status: 400 });
    }

    const auth = await authorizeRadarUserWrite(req, targetUserId);
    if (!auth.ok) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje' }, { status: 404 });
    }

    const cityRaw = body?.city ?? body?.location?.city;
    const normalizedCity = cityRaw ? canonicalizeCity(String(cityRaw)) : null;
    const strictCity = isStrictCity(normalizedCity);
    const districtsInput = body?.selectedDistricts ?? body?.districts ?? body?.location?.districts;
    const normalizedDistricts = Array.isArray(districtsInput)
      ? districtsInput
          .map((district: unknown) =>
            canonicalizeDistrict(normalizedCity || '', String(district))
          )
          .filter((district: string) => {
            if (!district) return false;
            if (!strictCity) return true;
            const allowed = getDistrictsForCity(normalizedCity || '');
            return allowed.some((entry) => entry.toLowerCase() === district.toLowerCase());
          })
      : [];

    const matchCountRaw = body?.matchCount ?? body?.resultsCount ?? body?.count;
    const matchCount =
      matchCountRaw === undefined || matchCountRaw === null
        ? null
        : Math.max(0, Math.trunc(Number(matchCountRaw)));

    const row = await prisma.radarSearchHistory.create({
      data: {
        userId: targetUserId,
        eventType: String(body?.eventType || 'RADAR_SEARCH').trim().slice(0, 64) || 'RADAR_SEARCH',
        transactionType: parseEnumValue<TransactionType>(body?.transactionType, TRANSACTION_TYPES),
        propertyType: parseEnumValue<PropertyType>(body?.propertyType, PROPERTY_TYPES),
        city: normalizedCity,
        districts: normalizedDistricts,
        maxPrice: body?.maxPrice != null && body.maxPrice !== '' ? Number(body.maxPrice) : null,
        minArea: body?.minArea != null && body.minArea !== '' ? Number(body.minArea) : null,
        minYear: body?.minYear != null && body.minYear !== '' ? Math.trunc(Number(body.minYear)) : null,
        requireBalcony: !!body?.requireBalcony,
        requireGarden: !!body?.requireGarden,
        requireElevator: !!body?.requireElevator,
        requireParking: !!body?.requireParking,
        requireFurnished: !!body?.requireFurnished,
        matchCount: Number.isFinite(matchCount as number) ? matchCount : null,
        lat: body?.lat != null && body.lat !== '' ? Number(body.lat) : null,
        lng: body?.lng != null && body.lng !== '' ? Number(body.lng) : null,
        radius: body?.radius != null && body.radius !== '' ? Number(body.radius) : null,
        queryText:
          typeof body?.query === 'string'
            ? body.query.trim().slice(0, 512)
            : typeof body?.queryText === 'string'
              ? body.queryText.trim().slice(0, 512)
              : null,
        source: String(body?.source || 'mobile').trim().slice(0, 32) || 'mobile',
        searchedAt: parseSearchedAt(body?.searchedAt ?? body?.at ?? body?.timestamp),
      },
    });

    const entry = shapeRadarSearchHistoryRow(row);

    return NextResponse.json({
      success: true,
      entry,
      radarSearchHistoryEntry: entry,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[radar/search-history POST]', e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
