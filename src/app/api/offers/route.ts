import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOffer } from '@/lib/services/offer.service';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  legalStatusOverridesForOffers,
} from '@/lib/offerLegalStatusOverlay';
import { loadOfferViewCounts, shapePublicListOffer } from '@/lib/offers/publicListShape';
import {
  getOfferSchemaCompatibilityMessage,
  isOfferSchemaCompatibilityError,
} from '@/lib/offerSchemaErrors';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';
import {
  enrichOfferMoneyFields,
  enrichOfferMoneyFieldsWithRate,
} from '@/lib/money/offerPrice';
import { DEFAULT_EUR_PLN_RATE } from '@/lib/money/constants';
import { getNbpEurPlnRate } from '@/lib/money/nbpEurPln';

export const dynamic = 'force-dynamic';

// =======================
// GET
// =======================
export async function GET() {
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
      where: { status: { in: ["ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
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

    let listFxRate = DEFAULT_EUR_PLN_RATE;
    let listFxDate: string | null = new Date().toISOString().slice(0, 10);
    try {
      const fx = await getNbpEurPlnRate();
      listFxRate = fx.rate;
      listFxDate = fx.date;
    } catch {
      /* fallback rate */
    }

    const offerIds = visibleOffers.map((o) => Number(o.id)).filter((id) => Number.isFinite(id));
    const viewsMap = await loadOfferViewCounts(prisma, offerIds);
    const legalOverrides = offerIds.length
      ? await legalStatusOverridesForOffers(prisma, offerIds)
      : null;
    const fx = { rate: listFxRate, date: listFxDate };

    return NextResponse.json(
      visibleOffers.map((offer: any) =>
        shapePublicListOffer(offer, {
          viewsCount: viewsMap.get(Number(offer.id)) || 0,
          fx,
          legalOverrides,
        }),
      ),
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

    const offer = await createOffer({ ...body, userId: resolvedUserId });

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
