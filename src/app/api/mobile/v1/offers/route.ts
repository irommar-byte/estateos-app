export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOffer, OfferValidationError, updateOffer } from '@/lib/services/offer.service';
import {
  assertContactVerified,
  contactVerificationJson,
  loadUserForContactVerification,
  PUBLISH_CONTACT_REQUIREMENTS,
} from '@/lib/contactVerification';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { enrichOfferWithLegalAliases } from '@/lib/mobileOfferLegalPayload';
import { MOBILE_OFFER_PRISMA_SELECT } from '@/lib/mobileOfferPrismaSelect';
import {
  applyLegalStatusOverride,
  legalStatusOverridesForOffers,
} from '@/lib/offerLegalStatusOverlay';
import {
  getOfferSchemaCompatibilityMessage,
  isOfferSchemaCompatibilityError,
  toPublicOfferErrorMessage,
} from '@/lib/offerSchemaErrors';
import {
  activePublicationOfferIds,
  getPublicationQuote,
  stageOfferPublicationForReview,
} from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
type PendingCreate = { createdAt: number; promise: Promise<any> };
const globalAny = global as any;
if (!globalAny.mobileOfferCreateMap) {
  globalAny.mobileOfferCreateMap = new Map<string, PendingCreate>();
}

function cleanupIdempotencyMap() {
  const now = Date.now();
  const map: Map<string, PendingCreate> = globalAny.mobileOfferCreateMap;
  for (const [key, value] of map.entries()) {
    if (now - value.createdAt > IDEMPOTENCY_TTL_MS) {
      map.delete(key);
    }
  }
}

function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as any;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

function schemaCompatibilityResponse() {
  return NextResponse.json(
    {
      success: false,
      message: getOfferSchemaCompatibilityMessage(),
      code: 'LEGAL_FIELDS_TEMP_UNAVAILABLE',
    },
    { status: 409 }
  );
}

// =======================
// GET 🔥 FIX
// =======================
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeAll = searchParams.get('includeAll') === 'true';
  const userId = searchParams.get('userId');

  let where: any = {};

  // owner view: pełna lista własnych ogłoszeń (bez ograniczania do ACTIVE)
  if (userId) {
    where = { userId: Number(userId) };
  } else if (!includeAll) {
    // public view: tylko aktywne i z koordynatami
    where = {
      status: 'ACTIVE',
      lat: { not: null },
      lng: { not: null }
    };
  }

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
      where,
      orderBy: { createdAt: 'desc' },
      select: MOBILE_OFFER_PRISMA_SELECT as any,
    });

    const publicVisibleIds =
      userId || includeAll
        ? null
        : await activePublicationOfferIds(
            offers.map((offer: any) => Number(offer.id)).filter((id) => Number.isFinite(id))
          );
    const visibleOffers =
      publicVisibleIds === null
        ? offers
        : offers.filter((offer: any) =>
            canShowOfferOnPublicMarket(offer, publicVisibleIds),
          );

    const offerIds = visibleOffers.map((o) => Number(o.id)).filter((id) => Number.isFinite(id));
    if (!offerIds.length) {
      return NextResponse.json({ success: true, offers: [] }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
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

    const normalizedOffers = visibleOffers.map((offer: any) => {
      const viewsCount = viewsMap.get(Number(offer.id)) || 0;
      const legalOffer = applyLegalStatusOverride(offer, legalOverrides);
      return enrichOfferWithLegalAliases({ ...legalOffer, views: viewsCount, viewsCount });
    });

    return NextResponse.json({ success: true, offers: normalizedOffers }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });

  } catch (error: unknown) {
    if (isOfferSchemaCompatibilityError(error)) {
      return schemaCompatibilityResponse();
    }
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    console.error("🔥 MOBILE API ERROR:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// =======================
// POST
// =======================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const authUserId = parseUserIdFromBearer(req);
    if (!authUserId) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji.' }, { status: 401 });
    }
    const bodyUserId = Number(body?.userId);
    if (!Number.isFinite(bodyUserId) || bodyUserId <= 0 || bodyUserId !== authUserId) {
      return NextResponse.json({ success: false, message: 'Błędny użytkownik w żądaniu.' }, { status: 403 });
    }

    const publisher = await loadUserForContactVerification(authUserId);
    const publishGate = assertContactVerified(publisher, PUBLISH_CONTACT_REQUIREMENTS);
    if (!publishGate.ok) return contactVerificationJson(publishGate);

    cleanupIdempotencyMap();

    const reqId = String(body?.clientRequestId || '').trim();
    const userId = Number(body?.userId);
    const safeUserId = Number.isFinite(userId) && userId > 0 ? userId : 'anon';
    const dedupeKey = reqId ? `${safeUserId}:${reqId}` : '';

    if (dedupeKey) {
      const map: Map<string, PendingCreate> = globalAny.mobileOfferCreateMap;
      const existing = map.get(dedupeKey);
      if (existing) {
        const existingOffer = await existing.promise;
        return NextResponse.json({ success: true, offer: existingOffer, deduplicated: true });
      }

      const promise = createOffer(body);
      map.set(dedupeKey, { createdAt: Date.now(), promise });
      try {
        const offer = await promise;
        return NextResponse.json({ success: true, offer });
      } catch (e) {
        map.delete(dedupeKey);
        throw e;
      }
    }

    const wantsActivation = body?.activateOnCreate === true || body?.publication;
    const offer = await createOffer(body);
    if (!wantsActivation) {
      return NextResponse.json({ success: true, offer });
    }

    const quote = await getPublicationQuote({
      userId: authUserId,
      offerId: Number(offer.id),
      action: 'CREATE_AND_ACTIVATE',
    });
    const pub = body?.publication;
    const txId = String(body?.iapTransactionId ?? pub?.iapTransactionId ?? '').trim();
    const bypassPaymentRequirement =
      pub?.kind === 'FREE_FIRST' ||
      Boolean(pub?.bonusCouponId) ||
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
        { status: 422 }
      );
    }
    const activationKind =
      pub?.kind === 'PLUS_PAID' || (txId && pub?.kind !== 'FREE_FIRST' && pub?.kind !== 'PLUS_CREDIT')
        ? 'PLUS_PAID'
        : pub?.kind === 'PLUS_CREDIT' || pub?.consumePlusPublication === true
          ? 'PLUS_CREDIT'
          : pub?.kind === 'FREE_FIRST' || pub?.bonusCouponId
            ? 'FREE_FIRST'
            : txId
                ? 'PLUS_PAID'
                : 'PLUS_CREDIT';

    const staged = await stageOfferPublicationForReview({
      userId: authUserId,
      offerId: Number(offer.id),
      kind: activationKind,
      bonusCouponId: pub?.bonusCouponId ? String(pub.bonusCouponId) : null,
      iapTransactionId: activationKind === 'PLUS_PAID' ? txId : null,
      iapProductId: quote.productId,
    });

    return NextResponse.json({
      success: true,
      offer: { ...offer, status: staged.status },
      awaitingModeration: true,
      publication: {
        status: staged.status,
        kind: staged.kind,
      },
    });
  } catch (e: unknown) {
    if (e instanceof OfferValidationError) {
      return NextResponse.json(
        { success: false, message: e.message, code: 'OFFER_VALIDATION' },
        { status: 400 }
      );
    }
    if (e instanceof Error && e.message === 'IAP_TRANSACTION_NOT_AVAILABLE') {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'IAP_TRANSACTION_NOT_AVAILABLE',
          message: 'Nie znaleziono niewykorzystanej transakcji IAP dla publikacji.',
        },
        { status: 409 }
      );
    }
    if (e instanceof Error && e.message === 'NO_PLUS_CREDIT_AVAILABLE') {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'PUBLICATION_REQUIRES_PLUS',
          message: 'Brak dostępnego kredytu Pakietu Plus. Kup nowy pakiet i spróbuj ponownie.',
        },
        { status: 409 }
      );
    }
    if (isOfferSchemaCompatibilityError(e)) {
      return schemaCompatibilityResponse();
    }
    const message = e instanceof Error ? e.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// =======================
// PUT
// =======================
export async function PUT(req: Request) {
  try {
    const authUserId = parseUserIdFromBearer(req);
    if (!authUserId) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji.' }, { status: 401 });
    }

    const body = await req.json();
    const bodyUserId = Number(body?.userId);
    if (!Number.isFinite(bodyUserId) || bodyUserId <= 0 || bodyUserId !== authUserId) {
      return NextResponse.json({ success: false, message: 'Błędny użytkownik w żądaniu.' }, { status: 403 });
    }

    const offer = await updateOffer(body);
    return NextResponse.json({ success: true, offer });
  } catch (e: unknown) {
    if (e instanceof OfferValidationError) {
      return NextResponse.json(
        { success: false, message: e.message, code: 'OFFER_VALIDATION' },
        { status: 400 }
      );
    }
    if (isOfferSchemaCompatibilityError(e)) {
      return schemaCompatibilityResponse();
    }
    const message = toPublicOfferErrorMessage(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  return PUT(req);
}
