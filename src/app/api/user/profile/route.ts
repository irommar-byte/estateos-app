import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';
import { resolveEliteBadges } from '@/lib/eliteStatus';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';
import { shapeRadarPreference, type RadarPreferenceDto } from '@/lib/radarPreferenceShape';
import type { RadarPreference } from '@prisma/client';
import { normalizePhoneE164 } from '@/lib/phoneE164';
import { getCanonicalOfferPricePln } from '@/lib/money/offerPrice';
import { shapeMatchedOfferForCrm } from '@/lib/crmMatchedOffer';
import {
  buildRadarScoreInputFromUser,
  MATCHED_OFFER_SELECT,
  scoreOffersForRadarPreference,
} from '@/lib/radarMatchedOffers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROFILE_SELECT = {
  ...MOBILE_USER_SELECT,
  searchType: true,
  searchMaxPrice: true,
  searchAreaFrom: true,
  searchRooms: true,
  searchDistricts: true,
  searchAmenities: true,
  searchTransactionType: true,
  /** Pola JSON są na modelu `DiscoveryProfile`, nie na `User` — select na User powodował P2019 runtime. */
  discoveryProfile: {
    select: {
      cityStats: true,
      districtStats: true,
      propertyStats: true,
      reasonStats: true,
    },
  },
  radarPreference: true,
  offers: {
    orderBy: { updatedAt: 'desc' as const },
    select: {
      id: true,
      title: true,
      price: true,
      city: true,
      district: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      images: true,
      propertyType: true,
      area: true,
      rooms: true,
    },
  },
} as const;

/** Gdy pełny select (relacje JSON / radar) pada na produkcji — profil i sesja WWW nadal działają. */
const PROFILE_SELECT_SAFE = {
  ...MOBILE_USER_SELECT,
  searchType: true,
  searchMaxPrice: true,
  searchAreaFrom: true,
  searchRooms: true,
  searchDistricts: true,
  searchAmenities: true,
  searchTransactionType: true,
  offers: PROFILE_SELECT.offers,
} as const;

function serializeOfferAmenityTokens(offer: {
  hasBalcony?: boolean | null;
  hasElevator?: boolean | null;
  hasParking?: boolean | null;
  hasGarden?: boolean | null;
  isFurnished?: boolean | null;
  hasStorage?: boolean | null;
}) {
  const parts: string[] = [];
  if (offer.hasBalcony) parts.push('balkon');
  if (offer.hasElevator) parts.push('winda');
  if (offer.hasParking) parts.push('parking');
  if (offer.hasGarden) parts.push('ogród');
  if (offer.hasStorage) parts.push('komórka');
  if (offer.isFurnished) parts.push('umeblowanie');
  return parts.join(',');
}

async function fetchSessionUser(select: typeof PROFILE_SELECT | typeof PROFILE_SELECT_SAFE) {
  const cookieStore = await cookies();
  const rawSession =
    cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value || '';
  if (!rawSession) return null;

  const parsed = decryptSession(rawSession) as { id?: number | string; email?: string } | null;
  const sessionId = Number(parsed?.id);
  if (Number.isFinite(sessionId) && sessionId > 0) {
    return prisma.user.findUnique({
      where: { id: sessionId },
      select,
    });
  }

  const email = String(parsed?.email || '').trim().toLowerCase();
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email },
    select,
  });
}

async function resolveSessionUser() {
  try {
    return await fetchSessionUser(PROFILE_SELECT);
  } catch (err) {
    console.error('profile resolve: full select failed, retrying safe', err);
    return fetchSessionUser(PROFILE_SELECT_SAFE);
  }
}

function normalizeString(value: unknown, max = 120): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, max);
}

function normalizePhone(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).replace(/[^\d+]/g, '').trim();
  if (!normalized) return null;
  return normalized.slice(0, 32);
}

function normalizeForSearch(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET() {
  try {
    const user = await resolveSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Niezalogowany' }, { status: 401 });
    }

    let matchedOffers: Array<Record<string, unknown>> = [];
    let radarPreference: RadarPreferenceDto | null = shapeRadarPreference(
      'radarPreference' in user ? (user.radarPreference as RadarPreference | null) : null,
      user.searchAmenities,
    );
    if (!radarPreference) {
      try {
        const pref = await prisma.radarPreference.findUnique({ where: { userId: user.id } });
        radarPreference = shapeRadarPreference(pref, user.searchAmenities);
      } catch {
        radarPreference = null;
      }
    }

    const radarScoreInput = buildRadarScoreInputFromUser(user, radarPreference);
    if (radarScoreInput) {
      const allActiveOffers = await prisma.offer.findMany({
        where: {
          status: 'ACTIVE',
          NOT: { userId: user.id },
        },
        select: MATCHED_OFFER_SELECT,
      });

      matchedOffers = scoreOffersForRadarPreference(
        allActiveOffers as Array<Record<string, unknown>>,
        radarScoreInput,
      );
    } else if (user.searchType) {
      const allActiveOffers = await prisma.offer.findMany({
        where: {
          status: 'ACTIVE',
          NOT: { userId: user.id },
        },
        select: {
          id: true,
          title: true,
          price: true,
          pricePln: true,
          priceCurrency: true,
          area: true,
          rooms: true,
          city: true,
          district: true,
          propertyType: true,
          hasBalcony: true,
          hasElevator: true,
          hasParking: true,
          hasGarden: true,
          hasStorage: true,
          isFurnished: true,
          images: true,
          transactionType: true,
          status: true,
          userId: true,
        },
      });

      matchedOffers = allActiveOffers.filter((offer) => {
        if (user.searchType && normalizeForSearch(user.searchType) !== normalizeForSearch(offer.propertyType)) {
          return false;
        }

        const txPref = String(user.searchTransactionType || 'all').toLowerCase();
        const txOffer = String(offer.transactionType || '').toUpperCase();
        if (txPref !== 'all' && txPref !== '') {
          const wantsRent = txPref === 'rent' || txPref === 'wynajem';
          const wantsSell = txPref === 'sale' || txPref === 'sell' || txPref === 'kupno';
          if (wantsRent && txOffer !== 'RENT') return false;
          if (wantsSell && txOffer !== 'SELL') return false;
        }

        const offerPrice = getCanonicalOfferPricePln(offer);
        if (user.searchMaxPrice && offerPrice > user.searchMaxPrice) return false;

        const offerArea = parseFloat(String(offer.area).replace(',', '.')) || 0;
        if (user.searchAreaFrom && offerArea < user.searchAreaFrom) return false;

        const offerRooms = parseInt(String(offer.rooms), 10) || 0;
        if (user.searchRooms && offerRooms < user.searchRooms) return false;

        if (user.searchDistricts && user.searchDistricts.trim() !== '') {
          const district = normalizeForSearch(offer.district);
          const userDistricts = user.searchDistricts.split(',').map(normalizeForSearch);
          if (
            district !== '' &&
            !userDistricts.includes(district) &&
            !userDistricts.includes('cała warszawa') &&
            !userDistricts.includes('cala warszawa')
          ) {
            return false;
          }
        }

        if (user.searchAmenities && user.searchAmenities.trim() !== '') {
          const requiredAmenities = user.searchAmenities.split(',').map(normalizeForSearch);
          const offerAmenities = normalizeForSearch(serializeOfferAmenityTokens(offer));
          for (const req of requiredAmenities) {
            if (req !== '' && !offerAmenities.includes(req)) return false;
          }
        }

        return true;
      });

      matchedOffers = matchedOffers.map((offer) =>
        shapeMatchedOfferForCrm({ ...offer, matchScore: 100 } as Record<string, unknown>),
      );
    }

    const passkeyCount = await prisma.authenticator.count({ where: { userId: user.id } });
    const shaped = { ...shapeMobileUser(user), hasPasskey: passkeyCount > 0 };
    const elite = resolveEliteBadges(user);
    const badges = { ...elite, isPartner: elite.isProgramPartner };

    return NextResponse.json(
      {
        success: true,
        user: shaped,
        ...shaped,
        offers: user.offers,
        badges,
        radarPreference,
        matchedOffers,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await resolveSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Niezalogowany' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const updateData: Prisma.UserUpdateInput = {};

    let nextName = normalizeString(body.name, 120);
    if (nextName === undefined) {
      const firstName = normalizeString(body.firstName, 60);
      const lastName = normalizeString(body.lastName, 60);
      if (firstName !== undefined || lastName !== undefined) {
        const parts = String(user.name || '').trim().split(/\s+/);
        const currentFirst = parts[0] || '';
        const currentLast = parts.slice(1).join(' ');
        const finalFirst = firstName === undefined ? currentFirst : firstName || '';
        const finalLast = lastName === undefined ? currentLast : lastName || '';
        nextName = [finalFirst, finalLast].filter(Boolean).join(' ').trim() || null;
      }
    }

    if (nextName !== undefined) {
      if (user.role === 'AGENT' || user.role === 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Zmiana imienia i nazwiska jest zablokowana dla tej roli.' },
          { status: 403 }
        );
      }
      updateData.name = nextName;
    }

    const phone = normalizePhone(body.phone);
    if (phone !== undefined) {
      const prevPhone = normalizePhone(user.phone);
      updateData.phone = phone;
      if (phone !== prevPhone) {
        updateData.phoneVerifiedAt = null;
      }
    }

    const image = body.image === undefined ? normalizeString(body.avatar, 4000) : normalizeString(body.image, 4000);
    if (image !== undefined) updateData.image = image;

    const companyName = normalizeString(body.companyName, 200);
    if (companyName !== undefined) updateData.companyName = companyName;

    const nextEmail = normalizeString(body.email, 320);
    if (nextEmail !== undefined && nextEmail !== null && nextEmail.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Zmiana email wymaga weryfikacji kodem. Użyj endpointu zmiany email.' },
        { status: 409 }
      );
    }

    if (Object.keys(updateData).length === 0) {
      const passkeyCount = await prisma.authenticator.count({ where: { userId: user.id } });
      const shapedCurrent = { ...shapeMobileUser(user), hasPasskey: passkeyCount > 0 };
      return NextResponse.json({ success: true, user: shapedCurrent, ...shapedCurrent });
    }

    const updated = await prisma.user
      .update({
        where: { id: user.id },
        data: updateData,
        select: PROFILE_SELECT,
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = Array.isArray(error.meta?.target)
            ? (error.meta.target as string[]).join(',')
            : String(error.meta?.target || '');
          if (target.includes('phone')) {
            throw new Error('CONFLICT_PHONE');
          }
          throw new Error('CONFLICT_UNIQUE');
        }
        throw error;
      });

    const passkeyCount = await prisma.authenticator.count({ where: { userId: updated.id } });
    const shaped = { ...shapeMobileUser(updated), hasPasskey: passkeyCount > 0 };
    return NextResponse.json({ success: true, user: shaped, ...shaped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się zapisać profilu.';
    if (message === 'CONFLICT_PHONE') {
      return NextResponse.json(
        { success: false, error: 'Ten numer telefonu jest już używany przez inne konto.' },
        { status: 409 }
      );
    }
    if (message === 'CONFLICT_UNIQUE') {
      return NextResponse.json(
        { success: false, error: 'Konflikt unikalności danych profilu.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return PATCH(req);
}
