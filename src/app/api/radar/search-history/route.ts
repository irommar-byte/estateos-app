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

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  try {
    const adminGate = await requireMobileAdmin(req);
    const token = extractBearerToken(req);
    const callerId = token ? parseUserIdFromMobileJwt(token) : null;
    if (!adminGate.ok && !callerId) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
    }

    const body = await readJsonBody(req);
    const nested = body?.filters as Record<string, unknown> | undefined;
    const flat = nested && typeof nested === 'object' ? nested : {};
    const pick = (key: string) => body?.[key] ?? flat?.[key];

    const targetUserId = Number(body?.userId ?? (body?.user as { id?: number })?.id ?? flat?.userId);

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

    const location = body?.location as { city?: unknown; districts?: unknown } | undefined;
    const cityRaw = pick('city') ?? location?.city;
    const normalizedCity = cityRaw ? canonicalizeCity(String(cityRaw)) : null;
    const strictCity = isStrictCity(normalizedCity);
    const districtsInput = pick('selectedDistricts') ?? pick('districts') ?? location?.districts;
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
        transactionType: parseEnumValue<TransactionType>(pick('transactionType'), TRANSACTION_TYPES),
        propertyType: parseEnumValue<PropertyType>(pick('propertyType'), PROPERTY_TYPES),
        city: normalizedCity,
        districts: normalizedDistricts,
        maxPrice: pick('maxPrice') != null && pick('maxPrice') !== '' ? Number(pick('maxPrice')) : null,
        minArea: pick('minArea') != null && pick('minArea') !== '' ? Number(pick('minArea')) : null,
        minYear: pick('minYear') != null && pick('minYear') !== '' ? Math.trunc(Number(pick('minYear'))) : null,
        requireBalcony: !!pick('requireBalcony'),
        requireGarden: !!pick('requireGarden'),
        requireElevator: !!pick('requireElevator'),
        requireParking: !!pick('requireParking'),
        requireFurnished: !!pick('requireFurnished'),
        matchCount: Number.isFinite(matchCount as number) ? matchCount : null,
        lat: pick('lat') != null && pick('lat') !== '' ? Number(pick('lat')) : null,
        lng: pick('lng') != null && pick('lng') !== '' ? Number(pick('lng')) : null,
        radius: pick('radius') != null && pick('radius') !== '' ? Number(pick('radius')) : null,
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
