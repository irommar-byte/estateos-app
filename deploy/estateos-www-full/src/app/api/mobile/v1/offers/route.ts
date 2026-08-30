export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOffer, OfferValidationError, updateOffer } from '@/lib/services/offer.service';
import { LocationMismatchError } from '@/lib/offerGeolocationValidate';
import {
  assertContactVerified,
  contactVerificationJson,
  loadUserForContactVerification,
  PUBLISH_CONTACT_REQUIREMENTS,
} from '@/lib/contactVerification';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { enrichOfferWithLegalAliases } from '@/lib/mobileOfferLegalPayload';
import {
  enrichOfferPriceDiscountFields,
  fetchMaxHistoricalPricePlnByOfferIds,
  resolveEffectiveListPricePln,
} from '@/lib/offerPriceHistory';
import { MOBILE_OFFER_PRISMA_SELECT } from '@/lib/mobileOfferPrismaSelect';
import { MOBILE_OFFER_CATALOG_SELECT } from '@/lib/mobileOfferCatalogSelect';
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
  submitOfferActivation,
} from '@/lib/offerPublication';
import { markProfilePromoCardUsed } from '@/lib/profilePromoCards';
import { trimOfferForMobileCatalog } from '@/lib/mobileOfferCatalogTrim';
import { shapeOfferForMobileCatalog } from '@/lib/mobileOfferCatalogEnrich';
import {
  buildCatalogEtag,
  catalogJsonResponse,
  catalogNotModifiedResponse,
  etagMatches,
  isCatalogCacheFresh,
  readMobileCatalogCache,
  writeMobileCatalogCache,
} from '@/lib/mobileOfferCatalogCache';

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
  const catalogOnly = searchParams.get('catalog') === '1' || searchParams.get('catalog') === 'true';
  const userId = searchParams.get('userId');
  const isPublicCatalog = catalogOnly && !userId && !includeAll;
  const ifNoneMatch = req.headers.get('if-none-match') || req.headers.get('x-catalog-etag');

  if (isPublicCatalog) {
    const cached = readMobileCatalogCache();
    if (cached && isCatalogCacheFresh(cached)) {
      if (ifNoneMatch && etagMatches(ifNoneMatch, cached.etag)) {
        return catalogNotModifiedResponse(cached.etag);
      }
      return catalogJsonResponse(cached.body, cached.etag);
    }
  }

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
    const offers = await prisma.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: (catalogOnly ? MOBILE_OFFER_CATALOG_SELECT : MOBILE_OFFER_PRISMA_SELECT) as any,
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
        : offers.filter((offer: any) => publicVisibleIds.has(Number(offer.id)));

    // Po utracie rekordów OfferPublication (np. drift schematu) nie chowaj całego rynku.
    const publicationGatedOffers =
      publicVisibleIds !== null && visibleOffers.length === 0 && offers.length > 0
        ? offers
        : visibleOffers;

    const offerIds = publicationGatedOffers.map((o) => Number(o.id)).filter((id) => Number.isFinite(id));
    if (!offerIds.length) {
      const emptyBody = JSON.stringify({ success: true, offers: [] });
      if (isPublicCatalog) {
        const etag = buildCatalogEtag([]);
        writeMobileCatalogCache(etag, emptyBody);
        return catalogJsonResponse(emptyBody, etag);
      }
      return NextResponse.json({ success: true, offers: [] }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    if (catalogOnly && isPublicCatalog) {
      const normalizedOffers = publicationGatedOffers.map((offer: any) =>
        shapeOfferForMobileCatalog(offer as Record<string, unknown>),
      );
      const etag = buildCatalogEtag(normalizedOffers);
      const body = JSON.stringify({ success: true, offers: normalizedOffers });
      writeMobileCatalogCache(etag, body);
      if (ifNoneMatch && etagMatches(ifNoneMatch, etag)) {
        return catalogNotModifiedResponse(etag);
      }
      return catalogJsonResponse(body, etag);
    }

    let viewsMap = new Map<number, number>();
    let favoritesMap = new Map<number, number>();
    const [viewsResult, favoritesResult, legalOverrides, historyMaxMap] = await Promise.all([
      (async () => {
        try {
          const viewsRows = await prisma.$queryRawUnsafe<any[]>(
            `
              SELECT offerId, COUNT(*) AS total
              FROM OfferViewLog
              WHERE offerId IN (${offerIds.join(',')})
              GROUP BY offerId
            `,
          );
          return new Map<number, number>(
            viewsRows.map((row: any) => [Number(row.offerId), Number(row.total || 0)]),
          );
        } catch {
          return new Map<number, number>();
        }
      })(),
      (async () => {
        try {
          const favRows = await prisma.favoriteOffer.groupBy({
            by: ['offerId'],
            where: { offerId: { in: offerIds } },
            _count: { _all: true },
          });
          return new Map(
            favRows.map((row) => [Number(row.offerId), Number(row._count._all || 0)]),
          );
        } catch {
          return new Map<number, number>();
        }
      })(),
      legalStatusOverridesForOffers(prisma, offerIds),
      fetchMaxHistoricalPricePlnByOfferIds(offerIds),
    ]);
    viewsMap = viewsResult;
    favoritesMap = favoritesResult;

    const normalizedOffers = publicationGatedOffers.map((offer: any) => {
      const viewsCount = viewsMap.get(Number(offer.id)) || 0;
      const favoritesCount = favoritesMap.get(Number(offer.id)) || 0;
      const legalOffer = applyLegalStatusOverride(offer, legalOverrides);
      const withListPrice = {
        ...legalOffer,
        listPricePln: resolveEffectiveListPricePln(
          legalOffer,
          historyMaxMap.get(Number(offer.id)),
        ),
        views: viewsCount,
        viewsCount,
        favoritesCount,
      };
      const enriched = enrichOfferWithLegalAliases(enrichOfferPriceDiscountFields(withListPrice));
      return catalogOnly ? trimOfferForMobileCatalog(enriched) : enriched;
    });

    const cacheHeaders: Record<string, string> = catalogOnly && !userId && !includeAll
      ? {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
          Vary: 'Accept-Encoding',
        }
      : { 'Cache-Control': 'private, no-store, max-age=0' };

    return NextResponse.json({ success: true, offers: normalizedOffers }, {
      headers: cacheHeaders,
    });

  } catch (error: unknown) {
    if (isOfferSchemaCompatibilityError(error)) {
      return schemaCompatibilityResponse();
    }
    if (isPublicCatalog) {
      const stale = readMobileCatalogCache();
      if (stale) return catalogJsonResponse(stale.body, stale.etag);
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

    const bonusCouponId = pub?.bonusCouponId ? String(pub.bonusCouponId).trim() : '';

    const staged = await submitOfferActivation({
      userId: authUserId,
      offerId: Number(offer.id),
      kind: activationKind,
      bonusCouponId: bonusCouponId || null,
      iapTransactionId: activationKind === 'PLUS_PAID' ? txId : null,
      iapProductId: quote.productId,
      onFreeFirstCouponUsed: markProfilePromoCardUsed,
    });

    if (staged.alreadyActive) {
      return NextResponse.json({
        success: true,
        offer: { ...offer, status: 'ACTIVE' },
        publication: { status: 'ACTIVE', kind: activationKind },
      });
    }

    const offerStatus = staged.status;
    return NextResponse.json({
      success: true,
      awaitingModeration: staged.awaitingModeration,
      offer: {
        ...offer,
        status: offerStatus,
        ...(staged.endsAt ? { expiresAt: staged.endsAt.toISOString() } : {}),
      },
      publication: {
        status: staged.status,
        kind: staged.kind,
        endsAt: staged.endsAt?.toISOString?.() ?? null,
      },
      message: staged.awaitingModeration
        ? 'Oferta została przesłana do weryfikacji.'
        : 'Oferta jest aktywna na rynku.',
    });
  } catch (e: unknown) {
    if (e instanceof LocationMismatchError) {
      return NextResponse.json(
        {
          success: false,
          code: 'NEEDS_USER_INPUT',
          issues: [
            {
              field: 'city',
              kind: 'suggest_replace',
              from: e.selected,
              to: e.resolved,
              message: e.message,
            },
          ],
        },
        { status: 422 },
      );
    }
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
