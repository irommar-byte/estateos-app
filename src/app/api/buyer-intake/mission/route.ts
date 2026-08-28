import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  BUYER_MISSION_COOKIE,
  BUYER_MISSION_MAX_AGE_SEC,
  BUYER_PROPERTY_OPTIONS,
  decodeBuyerMissionCookie,
  encodeBuyerMissionCookie,
  mergeBuyerMission,
  resolveBuyerIntakeAgent,
  type BuyerPropertyType,
} from '@/lib/buyerIntake.server';
import {
  isBuyerStep2Complete,
  normalizeBuyerAreaRange,
  normalizeBuyerDistricts,
  normalizeBuyerPurchaseTimeline,
  normalizeBuyerTransactionType,
  normalizeBuyerRooms,
  validateBuyerStep2Location,
} from '@/lib/buyerIntakeShared';

export const dynamic = 'force-dynamic';

function showRoomsBody(propertyType: BuyerPropertyType | null, rooms: unknown): number[] {
  if (propertyType !== 'apartment' && propertyType !== 'house') return [];
  return normalizeBuyerRooms(rooms);
}

function missionPayload(record: ReturnType<typeof decodeBuyerMissionCookie>) {
  if (!record) return null;
  return {
    step: record.step,
    propertyType: record.propertyType,
    agentUserId: record.agentUserId,
    city: record.city,
    districts: record.districts,
    budgetMax: record.budgetMax,
    minArea: record.minArea,
    maxArea: record.maxArea,
    rooms: record.rooms,
    requireBalcony: record.requireBalcony,
    requireGarden: record.requireGarden,
    requireElevator: record.requireElevator,
    requireParking: record.requireParking,
    requireFurnished: record.requireFurnished,
    requireTwoLevel: record.requireTwoLevel,
    marketType: record.marketType,
    transactionType: record.transactionType,
    purchaseTimeline: record.purchaseTimeline,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    phone: record.phone,
    clientId: record.clientId,
    consentContact: record.consentContact,
  };
}

function setMissionCookie(res: NextResponse, encoded: string) {
  res.cookies.set(BUYER_MISSION_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: BUYER_MISSION_MAX_AGE_SEC,
  });
}

export async function GET() {
  const cookieStore = await cookies();
  const mission = decodeBuyerMissionCookie(cookieStore.get(BUYER_MISSION_COOKIE)?.value);
  return NextResponse.json({ success: true, mission: missionPayload(mission) });
}

export async function POST(req: Request) {
  try {
    const agent = await resolveBuyerIntakeAgent();
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Kanał wyszukiwania jest tymczasowo niedostępny.' },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const step = Number(body?.step) || 1;
    const cookieStore = await cookies();
    const existing = decodeBuyerMissionCookie(cookieStore.get(BUYER_MISSION_COOKIE)?.value);

    if (step === 1) {
      const propertyType = String(body?.propertyType || '').trim() as BuyerPropertyType;
      const allowed = BUYER_PROPERTY_OPTIONS.some((item) => item.id === propertyType);
      if (!allowed) {
        return NextResponse.json({ success: false, error: 'Wybierz typ nieruchomości.' }, { status: 422 });
      }

      const nextMission = mergeBuyerMission(existing, agent.userId, {
        propertyType,
        transactionType: normalizeBuyerTransactionType(body?.transactionType) ?? 'SELL',
        step: 2,
      });
      const encoded = encodeBuyerMissionCookie(nextMission);
      const res = NextResponse.json({ success: true, mission: missionPayload(nextMission) });
      setMissionCookie(res, encoded);
      return res;
    }

    if (step === 2) {
      const base = mergeBuyerMission(existing, agent.userId, {});
      if (!base.propertyType) {
        return NextResponse.json({ success: false, error: 'Najpierw wybierz typ nieruchomości.' }, { status: 422 });
      }

      const cityRaw = String(body?.city || '').trim().slice(0, 128);
      if (!cityRaw) {
        return NextResponse.json({ success: false, error: 'Podaj miasto.' }, { status: 422 });
      }

      const budgetMax = Number(body?.budgetMax);
      if (!Number.isFinite(budgetMax) || budgetMax <= 0) {
        return NextResponse.json({ success: false, error: 'Wybierz budżet.' }, { status: 422 });
      }

      const minAreaRaw = body?.minArea == null ? null : Number(body.minArea);
      const maxAreaRaw = body?.maxArea == null ? null : Number(body.maxArea);
      const areaRange = normalizeBuyerAreaRange({ minArea: minAreaRaw, maxArea: maxAreaRaw });
      if (areaRange.error) {
        return NextResponse.json({ success: false, error: areaRange.error }, { status: 422 });
      }
      const rooms = showRoomsBody(base.propertyType, body?.rooms);
      const districtsRaw = normalizeBuyerDistricts(body?.districts);

      const location = validateBuyerStep2Location({
        city: cityRaw,
        districts: districtsRaw,
      });
      if (!location.ok) {
        return NextResponse.json({ success: false, error: location.error }, { status: 422 });
      }

      const nextMission = mergeBuyerMission(existing, agent.userId, {
        propertyType: base.propertyType,
        city: location.city,
        districts: location.districts,
        budgetMax: Math.round(budgetMax),
        minArea: areaRange.minArea,
        maxArea: areaRange.maxArea,
        rooms,
        step: 3,
      });

      const encoded = encodeBuyerMissionCookie(nextMission);
      const res = NextResponse.json({ success: true, mission: missionPayload(nextMission) });
      setMissionCookie(res, encoded);
      return res;
    }

    if (step === 3) {
      const base = mergeBuyerMission(existing, agent.userId, {});
      if (!base.propertyType || !isBuyerStep2Complete(base)) {
        return NextResponse.json({ success: false, error: 'Najpierw uzupełnij lokalizację i budżet.' }, { status: 422 });
      }

      const nextMission = mergeBuyerMission(existing, agent.userId, {
        propertyType: base.propertyType,
        requireBalcony: Boolean(body?.requireBalcony),
        requireGarden: Boolean(body?.requireGarden),
        requireElevator: Boolean(body?.requireElevator),
        requireParking: Boolean(body?.requireParking),
        requireFurnished: Boolean(body?.requireFurnished),
        requireTwoLevel: Boolean(body?.requireTwoLevel),
        marketType: null,
        purchaseTimeline: normalizeBuyerPurchaseTimeline(body?.purchaseTimeline),
        step: 4,
      });

      const encoded = encodeBuyerMissionCookie(nextMission);
      const res = NextResponse.json({ success: true, mission: missionPayload(nextMission) });
      setMissionCookie(res, encoded);
      return res;
    }

    return NextResponse.json({ success: false, error: 'Nieobsługiwany krok.' }, { status: 422 });
  } catch (error) {
    console.error('[BUYER INTAKE MISSION]', error);
    return NextResponse.json({ success: false, error: 'Nie udało się zapisać wyboru.' }, { status: 500 });
  }
}
