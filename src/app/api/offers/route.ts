import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOffer } from '@/lib/services/offer.service';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  getOfferSchemaCompatibilityMessage,
  isOfferSchemaCompatibilityError,
} from '@/lib/offerSchemaErrors';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';
import { DEFAULT_EUR_PLN_RATE } from '@/lib/money/constants';
import { getNbpEurPlnRate } from '@/lib/money/nbpEurPln';
import { loadOfferViewCounts, shapePublicListOffer } from '@/lib/offers/publicListShape';
import {
  fetchMaxHistoricalPricePlnByOfferIds,
  resolveEffectiveListPricePln,
} from '@/lib/offerPriceHistory';
import {
  applyLegalStatusOverride,
  legalStatusOverridesForOffers,
} from '@/lib/offerLegalStatusOverlay';
import {
  assertAgencyCanCreateForClient,
  linkOfferToAgencyClient,
} from '@/lib/offerAgencyManagement';

export const dynamic = 'force-dynamic';

// =======================
// GET
// =======================
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");

    if (scope === "mine") {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("estateos_session") || cookieStore.get("luxestate_user");
      let userId: number | null = null;
      if (sessionCookie?.value) {
        try {
          const sessionData = decryptSession(sessionCookie.value);
          userId = Number(sessionData?.id) || null;
        } catch {
          userId = null;
        }
      }
      if (!userId) {
        return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
      }

      const mineOffers = await prisma.offer.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          transactionType: true,
          propertyType: true,
          price: true,
          priceCurrency: true,
          pricePln: true,
          city: true,
          district: true,
          localityCountry: true,
          localityCountryCode: true,
          images: true,
          status: true,
          promotedUntil: true,
          createdAt: true,
          updatedAt: true,
          lat: true,
          lng: true,
          isLegalSafeVerified: true,
          user: { select: { role: true, planType: true, isPro: true } },
        },
      });

      return NextResponse.json(
        mineOffers.map((offer) =>
          shapePublicListOffer(offer as unknown as Record<string, unknown>, {
            viewsCount: 0,
          }),
        ),
      );
    }

    const offers = await prisma.offer.findMany({
      where: { status: { in: ["ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        transactionType: true,
        propertyType: true,
        condition: true,
        price: true,
        priceCurrency: true,
        pricePln: true,
        exchangeRateUsed: true,
        exchangeRateDate: true,
        pricePerSqm: true,
        adminFee: true,
        agentCommissionPercent: true,
        deposit: true,
        area: true,
        plotArea: true,
        rooms: true,
        floor: true,
        totalFloors: true,
        yearBuilt: true,
        hasBalcony: true,
        hasElevator: true,
        hasStorage: true,
        hasParking: true,
        hasGarden: true,
        isFurnished: true,
        heating: true,
        city: true,
        district: true,
        localityCountry: true,
        localityCountryCode: true,
        listPricePln: true,
        street: true,
        buildingNumber: true,
        lat: true,
        lng: true,
        isExactLocation: true,
        images: true,
        videoUrl: true,
        floorPlanUrl: true,
        status: true,
        expiresAt: true,
        promotedUntil: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: { select: { role: true, planType: true, isPro: true } },
      },
    });

    const activeIds = await activePublicationOfferIds(
      offers.map((o) => Number(o.id)).filter((id) => Number.isFinite(id))
    );
    const visibleOffers = offers.filter((offer: any) =>
      canShowOfferOnPublicMarket(offer, activeIds),
    );

    const offerIds = visibleOffers.map((o) => Number(o.id)).filter((id) => Number.isFinite(id));
    const [viewsMap, legalOverrides, historyMaxMap, fxResult] = await Promise.all([
      loadOfferViewCounts(prisma, offerIds),
      legalStatusOverridesForOffers(prisma, offerIds),
      fetchMaxHistoricalPricePlnByOfferIds(offerIds),
      getNbpEurPlnRate().catch(() => null),
    ]);
    const listFxRate = fxResult?.rate ?? DEFAULT_EUR_PLN_RATE;
    const listFxDate = fxResult?.date ?? new Date().toISOString().slice(0, 10);
    const listFx = { rate: listFxRate, date: listFxDate };

    return NextResponse.json(
      visibleOffers.map((offer: any) => {
        const withListPrice = {
          ...offer,
          listPricePln: resolveEffectiveListPricePln(
            offer,
            historyMaxMap.get(Number(offer.id)),
          ),
        };
        return shapePublicListOffer(applyLegalStatusOverride(withListPrice, legalOverrides), {
          viewsCount: viewsMap.get(Number(offer.id)) || 0,
          fx: listFx,
        });
      }),
    );

  } catch (error) {
    if (isOfferSchemaCompatibilityError(error)) {
      return NextResponse.json(
        { error: getOfferSchemaCompatibilityMessage(), code: 'LEGAL_FIELDS_TEMP_UNAVAILABLE' },
        { status: 409 }
      );
    }
    console.error('OFFERS ERROR:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

// =======================
// POST
// =======================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let resolvedUserId: number | null = Number(body?.userId) || null;

    if (!resolvedUserId) {
      const cookieStore = await cookies();
      const nextAuthSession = await getServerSession(authOptions);
      const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');

      let email = nextAuthSession?.user?.email || null;
      let sessionUserId: number | null = null;

      if (!email && sessionCookie?.value) {
        try {
          const sessionData = decryptSession(sessionCookie.value);
          email = sessionData?.email || null;
          sessionUserId = Number(sessionData?.id) || null;
        } catch {
          email = null;
          sessionUserId = null;
        }
      }

      if (sessionUserId) {
        resolvedUserId = sessionUserId;
      } else if (email) {
        const user = await prisma.user.findUnique({
          where: { email: String(email) },
          select: { id: true }
        });
        resolvedUserId = user?.id ?? null;
      }
    }

    if (!resolvedUserId) {
      return NextResponse.json({ error: 'Brak ID użytkownika' }, { status: 401 });
    }

    const agencyClientId = body.agencyClientId != null ? Number(body.agencyClientId) : null;
    if (agencyClientId != null && Number.isFinite(agencyClientId)) {
      await assertAgencyCanCreateForClient(resolvedUserId, agencyClientId);
    }

    const offer = await createOffer({ ...body, userId: resolvedUserId });
    const createdOfferId = Number((offer as { id?: number })?.id);

    if (agencyClientId != null && Number.isFinite(agencyClientId) && Number.isFinite(createdOfferId)) {
      await linkOfferToAgencyClient({
        agencyUserId: resolvedUserId,
        clientId: agencyClientId,
        offerId: createdOfferId,
      });
    }

    return NextResponse.json({ success: true, offer });

  } catch (e: unknown) {
    if (isOfferSchemaCompatibilityError(e)) {
      return NextResponse.json(
        { error: getOfferSchemaCompatibilityMessage(), code: 'LEGAL_FIELDS_TEMP_UNAVAILABLE' },
        { status: 409 }
      );
    }
    const message = e instanceof Error ? e.message : 'Błąd serwera';
    console.error('POST ERROR:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
