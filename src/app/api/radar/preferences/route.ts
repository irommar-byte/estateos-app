import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canonicalizeCity, canonicalizeDistrict, getDistrictsForCity, isStrictCity } from '@/lib/location/locationCatalog';
import { requireMobileAdmin, parseUserIdFromMobileJwt, extractBearerToken } from '@/lib/mobileAdminAuth';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { shapeRadarPreference } from '@/lib/radarPreferenceShape';
import { syncUserLegacySearchFromRadarPreference } from '@/lib/radarPreferenceSync';

async function assertCanAccessUserRadar(req: Request, targetUserId: number) {
  const adminGate = await requireMobileAdmin(req);
  if (adminGate.ok) return { ok: true as const };

  const sessionUserId = await resolveWebUserId(req);
  if (sessionUserId && sessionUserId === targetUserId) return { ok: true as const };

  const token = extractBearerToken(req);
  const callerId = token ? parseUserIdFromMobileJwt(token) : null;
  if (callerId && callerId === targetUserId) return { ok: true as const };

  return { ok: false as const, response: adminGate.response };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get('userId');
    const targetUserId = Number(userIdParam);

    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ success: false, message: 'Brak lub nieprawidłowy userId' }, { status: 400 });
    }

    const access = await assertCanAccessUserRadar(req, targetUserId);
    if (!access.ok) return access.response;

    const pref = await prisma.radarPreference.findUnique({
      where: { userId: targetUserId },
    });

    const radarPreference = shapeRadarPreference(pref);

    return NextResponse.json({
      success: true,
      radarPreference,
      pref: radarPreference,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      userId,
      transactionType,
      propertyType,
      city,
      selectedDistricts,
      maxPrice,
      minArea,
      minYear,
      requireBalcony,
      requireGarden,
      requireElevator,
      requireParking,
      requireFurnished,
      pushNotifications,
      lat,
      lng,
      radius
    } = body;

    const targetUserId = Number(userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ success: false, message: 'Brak userId' }, { status: 400 });
    }

    const access = await assertCanAccessUserRadar(req, targetUserId);
    if (!access.ok) return access.response;

    const normalizedCity = city ? canonicalizeCity(String(city)) : null;
    const strictCity = isStrictCity(normalizedCity);
    const normalizedDistricts = Array.isArray(selectedDistricts)
      ? selectedDistricts
          .map((district) => canonicalizeDistrict(normalizedCity || "", String(district)))
          .filter((district) => {
            if (!district) return false;
            if (!strictCity) return true;
            const allowed = getDistrictsForCity(normalizedCity || "");
            return allowed.some((entry) => entry.toLowerCase() === district.toLowerCase());
          })
      : [];

    const hasMap =
      lat != null &&
      lng != null &&
      radius != null &&
      Number(lat) !== 0 &&
      Number(lng) !== 0 &&
      Number(radius) > 0;
    const mapLat = hasMap ? Number(lat) : null;
    const mapLng = hasMap ? Number(lng) : null;
    const mapRadius = hasMap ? Number(radius) : null;

    const pref = await prisma.radarPreference.upsert({
      where: { userId: targetUserId },
      update: {
        transactionType,
        propertyType,
        city: normalizedCity,
        districts: normalizedDistricts,
        maxPrice: maxPrice ? Number(maxPrice) : null,
        minArea: minArea ? Number(minArea) : null,
        minYear: minYear ? Number(minYear) : null,
        requireBalcony: !!requireBalcony,
        requireGarden: !!requireGarden,
        requireElevator: !!requireElevator,
        requireParking: !!requireParking,
        requireFurnished: !!requireFurnished,
        pushNotifications: pushNotifications !== false,
        minMatchThreshold: body.minMatchThreshold ?? 70,
        lat: mapLat,
        lng: mapLng,
        radius: mapRadius,
      },
      create: {
        userId: targetUserId,
        transactionType,
        propertyType,
        city: normalizedCity,
        districts: normalizedDistricts,
        maxPrice: maxPrice ? Number(maxPrice) : null,
        minArea: minArea ? Number(minArea) : null,
        minYear: minYear ? Number(minYear) : null,
        requireBalcony: !!requireBalcony,
        requireGarden: !!requireGarden,
        requireElevator: !!requireElevator,
        requireParking: !!requireParking,
        requireFurnished: !!requireFurnished,
        pushNotifications: pushNotifications !== false,
        minMatchThreshold: body.minMatchThreshold ?? 70,
        lat: mapLat,
        lng: mapLng,
        radius: mapRadius,
      }
    });

    const canonicalPayload = {
      userId: targetUserId,
      transactionType,
      propertyType,
      city: normalizedCity,
      selectedDistricts: normalizedDistricts,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      minArea: minArea ? Number(minArea) : null,
      minYear: minYear ? Number(minYear) : null,
      requireBalcony: !!requireBalcony,
      requireGarden: !!requireGarden,
      requireElevator: !!requireElevator,
      requireParking: !!requireParking,
      requireFurnished: !!requireFurnished,
      requireTwoLevel: !!body.requireTwoLevel,
      pushNotifications: pushNotifications !== false,
      minMatchThreshold: body.minMatchThreshold ?? 70,
      lat: mapLat,
      lng: mapLng,
      radius: mapRadius,
    };
    try {
      await syncUserLegacySearchFromRadarPreference(targetUserId, canonicalPayload);
    } catch (syncErr) {
      console.error('radar legacy User.search sync failed', syncErr);
    }

    const radarPreference = shapeRadarPreference(pref);

    return NextResponse.json({
      success: true,
      pref,
      radarPreference,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
