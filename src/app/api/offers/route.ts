import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveEliteBadges } from '@/lib/eliteStatus';
import { createOffer } from '@/lib/services/offer.service';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { extractVerificationMeta } from '@/lib/offerVerification';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { computePublicLegalFields } from '@/lib/offerLegalPublicShape';
import {
  applyLegalStatusOverride,
  legalStatusOverridesForOffers,
} from '@/lib/offerLegalStatusOverlay';
import {
  getOfferSchemaCompatibilityMessage,
  isOfferSchemaCompatibilityError,
} from '@/lib/offerSchemaErrors';
import {
  activateOfferPublication,
  activePublicationOfferIds,
  getPublicationQuote,
} from '@/lib/offerPublication';
import { markProfilePromoCardUsed } from '@/lib/profilePromoCards';
import { setPendingPublication } from '@/lib/offerPendingPublication';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { enrichOfferMoneyFields } from '@/lib/money/offerPrice';

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
    const visibleOffers = offers.filter((offer: any) => activeIds.has(Number(offer.id)));

    const toPublicOffer = (offer: any, viewsCount: number) => {
      const { user, ...rest } = offer;
      const elite = resolveEliteBadges({ user });
      const badges = {
        ...elite,
        isPartner: elite.isProgramPartner || elite.isAgent,
      };
      const { cleanDescription, verification } = extractVerificationMeta(rest.description);
      const legal = computePublicLegalFields({
        description: rest.description,
        legalCheckStatus: rest.legalCheckStatus,
        isLegalSafeVerified: rest.isLegalSafeVerified,
      });
      return enrichOfferMoneyFields({
        ...rest,
        imageUrl: resolveOfferPrimaryImage(rest),
        description: cleanDescription,
        apartmentNumber: verification.apartmentNumber || rest.buildingNumber || '',
        landRegistryNumber: verification.landRegistryNumber || '',
        ...legal,
        badges,
        views: viewsCount,
        viewsCount,
      });
    };

    const offerIds = visibleOffers.map((o) => Number(o.id)).filter((id) => Number.isFinite(id));
    if (!offerIds.length) {
      return NextResponse.json(visibleOffers.map((o) => toPublicOffer(o, 0)));
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
    const legalOverrides = await legalStatusOverridesForOffers(prisma, offerIds);

    return NextResponse.json(
      visibleOffers.map((offer: any) => {
        const viewsCount = viewsMap.get(Number(offer.id)) || 0;
        return toPublicOffer(applyLegalStatusOverride(offer, legalOverrides), viewsCount);
      })
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

    const wantsActivation = body?.activateOnCreate === true || body?.publication;
    if (!wantsActivation) {
      return NextResponse.json({ success: true, offer });
    }

    const quote = await getPublicationQuote({
      userId: resolvedUserId,
      offerId: Number(offer.id),
      action: 'CREATE_AND_ACTIVATE',
    });
    const pub = body?.publication;
    const txId = String(body?.iapTransactionId ?? pub?.iapTransactionId ?? '').trim();
    const bonusCouponId = String(pub?.bonusCouponId ?? body?.bonusCouponId ?? '').trim();
    const bypassPaymentRequirement =
      pub?.kind === 'FREE_FIRST' ||
      Boolean(bonusCouponId) ||
      pub?.kind === 'PLUS_CREDIT' ||
      pub?.consumePlusPublication === true;

    if (quote.requiresPayment && !txId && !bypassPaymentRequirement) {
      return NextResponse.json(
        {
          success: false,
          offer,
          activationSkipped: true,
          errorCode: 'PUBLICATION_REQUIRES_PLUS',
          message: 'Publikacja tego ogłoszenia na 30 dni wymaga Pakiet Plus.',
          quote,
        },
        { status: 422 },
      );
    }

    const activationKind =
      pub?.kind === 'PLUS_PAID' || (txId && pub?.kind !== 'FREE_FIRST' && pub?.kind !== 'PLUS_CREDIT')
        ? 'PLUS_PAID'
        : pub?.kind === 'PLUS_CREDIT' || pub?.consumePlusPublication === true
          ? 'PLUS_CREDIT'
          : pub?.kind === 'FREE_FIRST' || bonusCouponId
            ? 'FREE_FIRST'
            : txId
              ? 'PLUS_PAID'
              : 'PLUS_CREDIT';

    // WWW flow: new offers should be verified by admin first.
    // Store the intended publication choice and let admin activation consume it.
    await setPendingPublication({
      offerId: Number(offer.id),
      kind: activationKind,
      bonusCouponId: bonusCouponId || null,
      iapTransactionId: activationKind === 'PLUS_PAID' ? txId : null,
    });

    let adminEmail = String(process.env.ADMIN_OFFERS_EMAIL || '').trim();
    if (!adminEmail) {
      const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { email: true },
        orderBy: { id: 'asc' },
      });
      adminEmail = String(adminUser?.email || '').trim();
    }
    if (adminEmail) {
      const subject = `[EstateOS] Nowa oferta do weryfikacji (#${offer.id})`;
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
          <h2 style="color:#059669;margin:0 0 16px">Nowa oferta do weryfikacji</h2>
          <p><strong>ID:</strong> ${offer.id}</p>
          <p><strong>Tytuł:</strong> ${String(offer.title || '').slice(0, 180)}</p>
          <p><strong>Miasto:</strong> ${String((offer as any).city || '')}</p>
          <p><strong>Akcja:</strong> ${activationKind} (publikacja po akceptacji)</p>
          <p><a href="https://estateos.pl/centrala/oferty" target="_blank" rel="noreferrer">Otwórz centralę → Oferty</a></p>
        </div>
      `;
      await sendTransactionalEmail({ to: adminEmail, subject, html });
    }

    return NextResponse.json({
      success: true,
      offer,
      publication: {
        status: 'PENDING_REVIEW',
        kind: activationKind,
      },
    });

  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'IAP_TRANSACTION_NOT_AVAILABLE') {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'IAP_TRANSACTION_NOT_AVAILABLE',
          message: 'Nie znaleziono niewykorzystanej płatności za publikację.',
        },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === 'NO_PLUS_CREDIT_AVAILABLE') {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'PUBLICATION_REQUIRES_PLUS',
          message: 'Brak dostępnego kredytu Pakietu Plus.',
        },
        { status: 409 },
      );
    }
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
