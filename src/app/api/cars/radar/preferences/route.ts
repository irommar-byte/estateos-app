import { NextResponse } from 'next/server';
import { requireMobileAdmin, parseUserIdFromMobileJwt, extractBearerToken } from '@/lib/mobileAdminAuth';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import {
  getCarRadarPreference,
  shapeCarRadarPreference,
  upsertCarRadarPreference,
} from '@/lib/carRadarStorage';

async function assertCanAccessUserCarRadar(req: Request, targetUserId: number) {
  const adminGate = await requireMobileAdmin(req);
  if (adminGate.ok) return { ok: true as const };

  const sessionUserId = await resolveWebUserId(req);
  if (sessionUserId && sessionUserId === targetUserId) return { ok: true as const };

  const token = extractBearerToken(req);
  const callerId = token ? parseUserIdFromMobileJwt(token) : null;
  if (callerId && callerId === targetUserId) return { ok: true as const };

  return { ok: false as const, response: adminGate.response };
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUserId = Number(searchParams.get('userId'));
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ success: false, message: 'Brak lub nieprawidłowy userId' }, { status: 400 });
    }

    const access = await assertCanAccessUserCarRadar(req, targetUserId);
    if (!access.ok) return access.response;

    const pref = await getCarRadarPreference(targetUserId);
    const carRadarPreference = shapeCarRadarPreference(pref);

    return NextResponse.json({
      success: true,
      carRadarPreference,
      pref: carRadarPreference,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const targetUserId = Number(body.userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ success: false, message: 'Brak userId' }, { status: 400 });
    }

    const access = await assertCanAccessUserCarRadar(req, targetUserId);
    if (!access.ok) return access.response;

    const lat = numOrNull(body.lat);
    const lng = numOrNull(body.lng);
    const radius = numOrNull(body.radius);
    const hasMap =
      lat != null && lng != null && radius != null && Number.isFinite(lat) && Number.isFinite(lng) && radius > 0;

    const saved = await upsertCarRadarPreference({
      userId: targetUserId,
      queryText: body.queryText ?? body.query ?? '',
      vehicleType: body.vehicleType ?? '',
      make: body.make ?? '',
      model: body.model ?? '',
      generation: body.generation ?? '',
      fuelType: body.fuelType ?? '',
      bodyType: body.bodyType ?? '',
      exteriorColor: body.exteriorColor ?? '',
      transmission: body.transmission ?? '',
      city: body.city ?? '',
      minPrice: numOrNull(body.minPrice),
      maxPrice: numOrNull(body.maxPrice),
      minYear: numOrNull(body.minYear),
      maxYear: numOrNull(body.maxYear),
      minMileage: numOrNull(body.minMileage),
      maxMileage: numOrNull(body.maxMileage),
      lat: hasMap ? lat : null,
      lng: hasMap ? lng : null,
      radius: hasMap ? radius : null,
      pushNotifications: body.pushNotifications !== false,
      enabled: body.enabled !== false,
      minMatchThreshold: numOrNull(body.minMatchThreshold) ?? 70,
    });

    return NextResponse.json({
      success: true,
      carRadarPreference: shapeCarRadarPreference(saved),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
