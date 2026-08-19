import { decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { OfferStatus, PropertyCondition } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import {
  attachVerificationMetaToDescription,
  buildOfferVerificationMeta,
  extractVerificationMeta,
} from '@/lib/offerVerification';
import { dispatchFavoritesPriceChangePush, dispatchFavoritesStatusChangePush } from '@/lib/favoritesPricePush';
import { applyOfferReapproval, diffOfferForReview, withPriceChangeIfReviewing } from '@/lib/offerEditReview';
import { enrichOfferPriceDiscountFields, ensureOfferPriceHistorySchema, syncOfferPriceHistory } from '@/lib/offerPriceHistory';
import {
  ensureOfferLegalColumns,
  ensureOfferMoneyColumns,
  ensureOfferLocalityCountryColumns,
  ensureOfferExtendedAmenityColumns,
  OfferValidationError,
  validateLandRegistryNumberInput,
} from '@/lib/services/offer.service';
import { notifyAdminsLegalVerificationPending } from '@/lib/adminAttentionPush';
import { enrichOfferMoneyFieldsForApi, resolveOfferPriceFromBody } from '@/lib/money/offerPrice.server';
import { enrichOfferMoneyFields, parsePriceAmount, getCanonicalOfferPricePln } from '@/lib/money/offerPrice';
import { WEB_OFFER_PUBLIC_PRISMA_SELECT } from '@/lib/mobileOfferPrismaSelect';
import { computePublicLegalFields } from '@/lib/offerLegalPublicShape';
import { validateAgentCommissionPercent } from '@/lib/agentCommission';
import { formatOfferBuildYear, resolveOfferBuildYear } from '@/lib/offerDisplayLabels';
import { deleteOfferCompletely } from '@/lib/deleteOfferCompletely';
import {
  applyLegalStatusOverride,
  legalStatusOverridesForOffers,
} from '@/lib/offerLegalStatusOverlay';
import {
  getOfferSchemaCompatibilityMessage,
  isOfferLegalColumnMissingError,
  isOfferSchemaCompatibilityError,
} from '@/lib/offerSchemaErrors';
import { resolveOfferDetailAccess } from '@/lib/offerPublicAccess';
import {
  resolveSellerDisplayName,
  resolveSellerPersonName,
  resolveServicingCompanyName,
} from '@/lib/sellerDisplay';
import { resolvePersistedLocalityFieldsAsync } from '@/lib/offerLocalityCountry';
import { formatOfferPropertyType, formatOfferCondition } from '@/lib/offerDisplayLabels';
import { getOfferMarketListingMeta } from '@/lib/offerPublication';
import { getAgencyPublicBranding, getUserDisplayAvatar } from '@/lib/agencyCompany';
import {
  presentingAgentAsOfferUser,
  resolvePresentingAgent,
} from '@/lib/offerPresentingAgent';
import { isSellerOnlineFromLastLogin } from '@/lib/offerGuestInquiry';
import { planDiscoveryGallery, isPersonalizedGalleryPlan } from '@/lib/discovery/gallery';
import { topStatEntries } from '@/lib/discoveryInsights';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { userHasMarketPro } from '@/lib/officePartnerPro';

/** Pola używane przy edycji WWW — jawny select po `update` (bez implicit full-row / P2022). */
const OFFER_WEB_PUT_SELECT = {
  id: true,
  userId: true,
  title: true,
  description: true,
  propertyType: true,
  district: true,
  price: true,
  priceCurrency: true,
  pricePln: true,
  area: true,
  images: true,
  rooms: true,
  floor: true,
  yearBuilt: true,
  adminFee: true,
  hasBalcony: true,
  hasElevator: true,
  hasStorage: true,
  hasParking: true,
  hasGarden: true,
  hasAirConditioning: true,
  isDuplex: true,
  condition: true,
  agentCommissionPercent: true,
  plotArea: true,
  floorPlanUrl: true,
  floorPlanExtraUrls: true,
  heating: true,
  isFurnished: true,
  transactionType: true,
  street: true,
  buildingNumber: true,
  lat: true,
  lng: true,
  isExactLocation: true,
  status: true,
  city: true,
  totalFloors: true,
  landRegistryNumber: true,
  apartmentNumber: true,
  legalCheckStatus: true,
  isLegalSafeVerified: true,
  localityCountryCode: true,
} as const;

function mapWebCondition(val: unknown): PropertyCondition | undefined {
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  const n = String(val).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (n === 'NEEDS_RENOVATION' || n === 'RENOVATION' || n === 'TO_RENOVATION') {
    return PropertyCondition.NEEDS_RENOVATION;
  }
  if (n === 'DEVELOPER' || n === 'DEVELOPER_STATE') return PropertyCondition.DEVELOPER_STATE;
  if (n === 'NOT_APPLICABLE') return PropertyCondition.NOT_APPLICABLE;
  return PropertyCondition.READY;
}

function mapWebTransactionType(val: unknown): 'SELL' | 'RENT' | undefined {
  const n = String(val || '').trim().toUpperCase();
  if (n === 'RENT') return 'RENT';
  if (n === 'SELL' || n === 'SALE') return 'SELL';
  return undefined;
}

async function resolveCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');
  if (!sessionCookie?.value) return null;

  try {
    const sessionData = decryptSession(sessionCookie.value);
    const sessionUserId = Number(sessionData?.id);
    if (Number.isFinite(sessionUserId) && sessionUserId > 0) {
      const user = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true, role: true, email: true },
      });
      if (user) return user;
    }
    const sessionEmail = String(sessionData?.email || '').trim().toLowerCase();
    if (sessionEmail) {
      const user = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true, role: true, email: true },
      });
      if (user) return user;
    }
  } catch {
    // fallback below
  }

  const raw = String(sessionCookie.value || '').trim();
  if (raw.includes('@')) {
    const user = await prisma.user.findUnique({
      where: { email: raw.toLowerCase() },
      select: { id: true, role: true, email: true },
    });
    if (user) return user;
  }

  return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOfferLegalColumns();
    await ensureOfferMoneyColumns();
    await ensureOfferExtendedAmenityColumns();
    await ensureOfferLocalityCountryColumns();
    await ensureOfferPriceHistorySchema();
    const resolvedParams = await params;
    const offerId = Number(resolvedParams.id);
    const reqUrl = new URL(req.url);
    const portalToken = reqUrl.searchParams.get('portal');
    const agentUserId = reqUrl.searchParams.get('agent');
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

    const offer = await prisma.offer.findUnique({
      where: { id: Number(resolvedParams.id) },
      select: WEB_OFFER_PUBLIC_PRISMA_SELECT as any,
    });
    
    if (!offer) return NextResponse.json({ error: "Nie znaleziono oferty" }, { status: 404 });

    let extraFloorPlanUrls: string | null = null;
    try {
      const extraRow = await prisma.offer.findUnique({
        where: { id: Number(resolvedParams.id) },
        select: { floorPlanExtraUrls: true } as any,
      });
      extraFloorPlanUrls = (extraRow as { floorPlanExtraUrls?: string | null } | null)?.floorPlanExtraUrls || null;
    } catch {
      extraFloorPlanUrls = null;
    }

    const currentUser = await resolveCurrentUser();
    const offerRow = offer as unknown as {
      id: number;
      userId: number;
      status: unknown;
      expiresAt?: Date | null;
    };
    const access = await resolveOfferDetailAccess(prisma, offerRow, {
      userId: currentUser?.id,
      role: currentUser?.role,
      portalToken,
    });
    if (!access.allowed) {
      return NextResponse.json({ error: 'Oferta niedostępna' }, { status: 404 });
    }

    let isRealPro = false;
    const viewerId = await resolveWebUserId(req);
    if (viewerId) {
      const realUser = await prisma.user.findUnique({
        where: { id: viewerId },
        select: { id: true, role: true, isPro: true, proExpiresAt: true },
      });
      if (realUser) {
        isRealPro = await userHasMarketPro(realUser);
      }
    }

    const viewsRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total FROM OfferViewLog WHERE offerId = ?`,
      Number(resolvedParams.id)
    );
    const viewsCount = Number(viewsRows?.[0]?.total || 0);
    let favoritesCount = 0;
    try {
      favoritesCount = await prisma.favoriteOffer.count({ where: { offerId: Number(resolvedParams.id) } });
    } catch {
      favoritesCount = 0;
    }

    const legalOverrides = await legalStatusOverridesForOffers(prisma, [Number(resolvedParams.id)]);
    const legalOffer = applyLegalStatusOverride(offer as any, legalOverrides);
    const { cleanDescription, verification } = extractVerificationMeta(legalOffer.description);
    const legal = computePublicLegalFields({
      description: legalOffer.description,
      legalCheckStatus: legalOffer.legalCheckStatus,
      isLegalSafeVerified: legalOffer.isLegalSafeVerified,
    });

    const yearBuilt = resolveOfferBuildYear(legalOffer as Record<string, unknown>);
    const buildYear = yearBuilt;

    const moneyOffer = await enrichOfferMoneyFieldsForApi(
      legalOffer as Record<string, unknown>,
    );

    // EstateOS™ Intelligence — Smart Gallery plan (seller hero kept; soft taste reorder when ready)
    let galleryTaste: { confidence: number; dislikeReasons: Array<{ key: string; value: number }> } | null =
      null;
    try {
      const viewerId = await resolveWebUserId(req);
      if (viewerId) {
        const discoveryProfile = await prisma.discoveryProfile.findUnique({
          where: { userId: viewerId },
          select: { confidence: true, reasonStats: true },
        });
        if (discoveryProfile) {
          galleryTaste = {
            confidence: Number(discoveryProfile.confidence || 0),
            dislikeReasons: topStatEntries(discoveryProfile.reasonStats, 4),
          };
        }
      }
    } catch {
      galleryTaste = null;
    }

    const gallerySourceImages = (() => {
      const raw = (moneyOffer as { images?: unknown }).images;
      if (Array.isArray(raw)) return raw.map(String);
      if (typeof raw === 'string') return raw;
      return null;
    })();
    const galleryPlan = planDiscoveryGallery(gallerySourceImages, galleryTaste);
    const galleryPersonalized = isPersonalizedGalleryPlan(galleryPlan);

    const offerUser = (legalOffer as { user?: Record<string, unknown> }).user;
    let sellerDisplayName = offerUser ? resolveSellerDisplayName(offerUser) : '';
    let sellerPersonName = offerUser ? resolveSellerPersonName(offerUser) : null;
    let servicingCompanyName = resolveServicingCompanyName(offerUser, (legalOffer as { agencyName?: string }).agencyName);

    const presentingAgent = await resolvePresentingAgent({
      offerId,
      portalToken,
      agentUserId: agentUserId ? Number(agentUserId) : null,
    });
    const isPresentedByAgent = Boolean(presentingAgent);
    if (presentingAgent) {
      sellerDisplayName = presentingAgent.displayName;
      sellerPersonName = presentingAgent.personName;
      servicingCompanyName = presentingAgent.companyName;
    }
    const marketListing = await getOfferMarketListingMeta(offerId);
    const localityResolved = await resolvePersistedLocalityFieldsAsync({
      localityCountry: (legalOffer as { localityCountry?: string }).localityCountry,
      localityCountryCode: (legalOffer as { localityCountryCode?: string }).localityCountryCode,
      city: legalOffer.city,
      lat: legalOffer.lat,
      lng: legalOffer.lng,
    });
    const enrichedUserFinal = presentingAgent
      ? presentingAgentAsOfferUser(presentingAgent)
      : offerUser
        ? {
            ...offerUser,
            displayName: sellerDisplayName,
            publicName: sellerDisplayName,
            personName: sellerPersonName,
            servicingCompanyName,
          }
        : offerUser;

    const sellerUserId = presentingAgent?.userId ?? Number((offerUser as { id?: number })?.id ?? offerRow.userId);
    const branding =
      sellerUserId > 0 ? await getAgencyPublicBranding(sellerUserId) : { companyLogoUrl: null, agentPhotoUrl: null };

    let sellerReviewsData = { totalReviews: 0, averageRating: 0 };
    let sellerIsOnline = false;
    let sellerLastSeenAt: string | null = null;
    if (sellerUserId > 0) {
      const [reviewAgg, sellerPresence] = await Promise.all([
        prisma.review.aggregate({
          where: { revieweeId: sellerUserId, isAutoGenerated: false },
          _avg: { rating: true },
          _count: { _all: true },
        }),
        prisma.user.findUnique({
          where: { id: sellerUserId },
          select: { lastLoginAt: true },
        }),
      ]);
      const totalReviews = Number(reviewAgg._count._all || 0);
      const averageRating =
        totalReviews > 0 && reviewAgg._avg.rating != null ? Number(reviewAgg._avg.rating) : 0;
      sellerReviewsData = { totalReviews, averageRating };
      sellerIsOnline = isSellerOnlineFromLastLogin(sellerPresence?.lastLoginAt);
      sellerLastSeenAt = sellerPresence?.lastLoginAt ? sellerPresence.lastLoginAt.toISOString() : null;
    }

    const userWithAvatar =
      sellerUserId > 0 && enrichedUserFinal
        ? await (async () => {
            const displayImage =
              branding.agentPhotoUrl || (await getUserDisplayAvatar(sellerUserId));
            const base = {
              ...enrichedUserFinal,
              reviewsData: sellerReviewsData,
              isOnline: sellerIsOnline,
              lastSeenAt: sellerLastSeenAt,
              companyLogoUrl: branding.companyLogoUrl,
              agentPhotoUrl: branding.agentPhotoUrl,
            };
            if (!displayImage) return base;
            return {
              ...base,
              image: displayImage,
              avatar: displayImage,
              displayAvatarUrl: displayImage,
              agentPhotoUrl: branding.agentPhotoUrl || displayImage,
            };
          })()
        : enrichedUserFinal
          ? {
              ...enrichedUserFinal,
              reviewsData: sellerReviewsData,
              isOnline: sellerIsOnline,
              lastSeenAt: sellerLastSeenAt,
            }
          : enrichedUserFinal;

    return NextResponse.json(
      enrichOfferPriceDiscountFields({
      ...moneyOffer,
      user: userWithAvatar,
      sellerDisplayName,
      sellerPersonName,
      servicingCompanyName,
      sellerIsOnline,
      sellerLastSeenAt,
      sellerReviewsData,
      servicingCompanyLogoUrl: branding.companyLogoUrl,
      agentPhotoUrl: branding.agentPhotoUrl || presentingAgent?.image || null,
      isPresentedByAgent,
      presentingAgent: presentingAgent
        ? {
            userId: presentingAgent.userId,
            name: presentingAgent.name,
            personName: presentingAgent.personName,
            companyName: presentingAgent.companyName,
            displayName: presentingAgent.displayName,
            phone: presentingAgent.phone,
            email: presentingAgent.email,
            image: branding.agentPhotoUrl || presentingAgent.image,
          }
        : null,
      propertyTypeLabel: formatOfferPropertyType((legalOffer as { propertyType?: unknown }).propertyType, 'pl'),
      propertyTypeLabelEn: formatOfferPropertyType((legalOffer as { propertyType?: unknown }).propertyType, 'en'),
      conditionLabel: formatOfferCondition((legalOffer as { condition?: unknown }).condition, 'pl'),
      conditionLabelEn: formatOfferCondition((legalOffer as { condition?: unknown }).condition, 'en'),
      description: cleanDescription,
      apartmentNumber: legalOffer.apartmentNumber || verification.apartmentNumber || '',
      landRegistryNumber: legalOffer.landRegistryNumber || verification.landRegistryNumber || '',
      ...legal,
      yearBuilt,
      buildYear,
      year: yearBuilt,
      buildYearLabel: formatOfferBuildYear(legalOffer as Record<string, unknown>),
      floorPlanUrl: (legalOffer as { floorPlanUrl?: string | null }).floorPlanUrl || null,
      floorPlan: (legalOffer as { floorPlanUrl?: string | null }).floorPlanUrl || null,
      floorPlanExtraUrls: extraFloorPlanUrls,
      floorPlan3dUrl: (legalOffer as { floorPlan3dUrl?: string | null }).floorPlan3dUrl || null,
      floorPlanScanMeta: (legalOffer as { floorPlanScanMeta?: string | null }).floorPlanScanMeta || null,
      marketListedAt: marketListing.marketListedAt,
      marketRenewedAt: marketListing.marketRenewedAt,
      localityCountry: localityResolved.localityCountry,
      localityCountryCode: localityResolved.localityCountryCode,
      _viewerIsPro: isRealPro,
      views: viewsCount,
      viewsCount,
      favoritesCount,
      galleryPlan,
      galleryPersonalized,
    }),
    );
  } catch (error) {
    if (isOfferSchemaCompatibilityError(error)) {
      return NextResponse.json(
        { error: getOfferSchemaCompatibilityMessage(), code: 'LEGAL_FIELDS_TEMP_UNAVAILABLE' },
        { status: 409 }
      );
    }
    console.error('[GET /api/offers/:id]', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOfferLegalColumns();
    await ensureOfferMoneyColumns();
    await ensureOfferLocalityCountryColumns();
    await ensureOfferExtendedAmenityColumns();
    await ensureOfferPriceHistorySchema();
    const resolvedParams = await params;
    const body = await req.json();
    
    // Pobieramy aktualny stan oferty z bazy przed dokonaniem zmian
    const currentOffer = await prisma.offer.findUnique({
       where: { id: Number(resolvedParams.id) },
       select: OFFER_WEB_PUT_SELECT,
    });

    if (!currentOffer) {
       return NextResponse.json({ error: "Oferta nie istnieje" }, { status: 404 });
    }

    const actor = await resolveCurrentUser();
    if (!actor) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const isAdmin = String(actor.role || '').toUpperCase() === 'ADMIN';
    if (!isAdmin && Number(currentOffer.userId) !== Number(actor.id)) {
      return NextResponse.json({ error: 'Brak uprawnień do edycji tej oferty' }, { status: 403 });
    }

    const existingVerification = extractVerificationMeta(currentOffer.description);
    const existingKw = String(
      (currentOffer as { landRegistryNumber?: string | null }).landRegistryNumber ||
        existingVerification.verification.landRegistryNumber ||
        '',
    )
      .trim()
      .toUpperCase();
    const existingApt = String(
      (currentOffer as { apartmentNumber?: string | null }).apartmentNumber ||
        existingVerification.verification.apartmentNumber ||
        '',
    ).trim();
    const legalVerified =
      String((currentOffer as { legalCheckStatus?: string | null }).legalCheckStatus || '').toUpperCase() ===
        'VERIFIED' || Boolean((currentOffer as { isLegalSafeVerified?: boolean }).isLegalSafeVerified);

    let requestedKw = existingKw;
    let requestedApt = existingApt;
    if (body.landRegistryNumber !== undefined) {
      requestedKw = String(body.landRegistryNumber || '').trim().toUpperCase().slice(0, 64);
    }
    if (body.apartmentNumber !== undefined) {
      requestedApt = String(body.apartmentNumber || '').trim().slice(0, 32);
    }
    if (legalVerified && !isAdmin) {
      requestedKw = existingKw;
      requestedApt = existingApt;
    }
    if (requestedKw) {
      try {
        validateLandRegistryNumberInput(requestedKw);
      } catch (error) {
        if (error instanceof OfferValidationError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    const hasVerificationPayload =
      body.apartmentNumber !== undefined || body.landRegistryNumber !== undefined || body.verificationStatus !== undefined;
    const nextVerification = hasVerificationPayload
      ? buildOfferVerificationMeta({
          apartmentNumber: requestedApt,
          landRegistryNumber: requestedKw,
        })
      : existingVerification.verification;
    const nextDescription = body.description != null
      ? attachVerificationMetaToDescription(String(body.description), nextVerification)
      : attachVerificationMetaToDescription(existingVerification.cleanDescription, nextVerification);
    const kwChanged = existingKw !== String(nextVerification.landRegistryNumber || '').trim().toUpperCase();
    const shouldResetLegalVerification = Boolean(
      hasVerificationPayload && nextVerification.landRegistryNumber && kwChanged,
    );

    let requireReverification = false;
    const reviewChanges = withPriceChangeIfReviewing(
      currentOffer as Record<string, unknown>,
      body as Record<string, unknown>,
      diffOfferForReview(currentOffer as Record<string, unknown>, body as Record<string, unknown>),
    );
    const reapproval = applyOfferReapproval({
      existingStatus: String(currentOffer.status),
      isAdmin,
      changes: reviewChanges,
      offerId: Number(resolvedParams.id),
      offerTitle: currentOffer.title,
    });
    requireReverification = reapproval.needsReview;

    let newStatus: OfferStatus = currentOffer.status;
    if (requireReverification) {
        newStatus = 'PENDING';
    }

    const parsedPrice = parseFloat(String(body.price ?? currentOffer.price).replace(',', '.'));
    const oldPricePln = getCanonicalOfferPricePln(currentOffer as { pricePln?: number; price?: number });
    let previousListPricePln: number | null = null;
    try {
      const listRows = (await prisma.$queryRawUnsafe(
        `SELECT listPricePln FROM \`Offer\` WHERE id = ? LIMIT 1`,
        Number(resolvedParams.id),
      )) as Array<{ listPricePln: number | null }>;
      const raw = Number(listRows[0]?.listPricePln);
      previousListPricePln = Number.isFinite(raw) && raw > 0 ? raw : null;
    } catch {
      previousListPricePln = null;
    }

    const pricePatch =
      body.price != null && Number.isFinite(parsedPrice)
        ? await resolveOfferPriceFromBody({
            price: parsedPrice,
            priceAmount: parsedPrice,
            priceCurrency: String(body.priceCurrency ?? (currentOffer as { priceCurrency?: string }).priceCurrency ?? 'PLN'),
          })
        : body.priceCurrency != null
          ? await resolveOfferPriceFromBody({
              price: Number(currentOffer.price),
              priceAmount: Number(currentOffer.price),
              priceCurrency: String(body.priceCurrency),
            })
          : {};
    const parsedArea = parseFloat(String(body.area ?? currentOffer.area).replace(',', '.'));
    const parsedRooms =
      body.rooms !== undefined && String(body.rooms).trim() !== ''
        ? parseInt(String(body.rooms), 10)
        : currentOffer.rooms;
    const parsedFloor =
      body.floor !== undefined && String(body.floor).trim() !== ''
        ? parseInt(String(body.floor), 10)
        : currentOffer.floor;
    const parsedTotalFloors =
      body.totalFloors !== undefined
        ? String(body.totalFloors).trim() === ''
          ? null
          : parseInt(String(body.totalFloors), 10)
        : (currentOffer as { totalFloors?: number | null }).totalFloors;
    const parsedPlot =
      body.plotArea !== undefined && String(body.plotArea).trim() !== ''
        ? parseFloat(String(body.plotArea).replace(',', '.'))
        : currentOffer.plotArea;
    const parsedYear =
      body.year !== undefined || body.buildYear !== undefined || body.yearBuilt !== undefined
        ? (() => {
            const raw = body.yearBuilt ?? body.year ?? body.buildYear;
            const n = parseInt(String(raw), 10);
            return Number.isFinite(n) ? n : currentOffer.yearBuilt;
          })()
        : currentOffer.yearBuilt;

    let agentCommissionPercent: number | null | undefined = undefined;
    if (body.agentCommissionPercent !== undefined) {
      if (body.agentCommissionPercent === null || body.agentCommissionPercent === '') {
        agentCommissionPercent = null;
      } else {
        const v = validateAgentCommissionPercent(body.agentCommissionPercent);
        if (!v.ok) {
          return NextResponse.json({ error: v.message, code: v.code }, { status: 400 });
        }
        agentCommissionPercent = v.value;
      }
    }

    const mappedCondition =
      body.condition !== undefined
        ? String(body.propertyType || currentOffer.propertyType || '').toUpperCase() === 'PLOT'
          ? PropertyCondition.NOT_APPLICABLE
          : mapWebCondition(body.condition)
        : undefined;
    const mappedTransaction =
      body.transactionType !== undefined ? mapWebTransactionType(body.transactionType) : undefined;

    const updateData: Record<string, unknown> = {
        title: body.title != null ? String(body.title) : currentOffer.title,
        description: nextDescription,
        propertyType: body.propertyType ?? currentOffer.propertyType,
        district: body.district != null ? String(body.district) : currentOffer.district,
        city:
          body.city != null
            ? String(body.city)
            : (currentOffer as { city?: string | null }).city,
        price: Number.isFinite(parsedPrice) ? parsedPrice : currentOffer.price,
        ...(pricePatch as Record<string, unknown>),
        area: Number.isFinite(parsedArea) ? parsedArea : currentOffer.area,
        images:
          body.images != null
            ? typeof body.images === 'string'
              ? body.images
              : JSON.stringify(body.images)
            : currentOffer.images,
        rooms: parsedRooms ?? null,
        floor: Number.isFinite(Number(parsedFloor)) ? parsedFloor : currentOffer.floor,
        totalFloors:
          parsedTotalFloors === null || Number.isFinite(Number(parsedTotalFloors))
            ? parsedTotalFloors
            : (currentOffer as { totalFloors?: number | null }).totalFloors ?? null,
        yearBuilt: parsedYear ?? null,
        plotArea: parsedPlot ?? null,
        floorPlanUrl:
          body.floorPlanUrl != null
            ? String(body.floorPlanUrl)
            : body.floorPlan != null
              ? String(body.floorPlan)
              : currentOffer.floorPlanUrl,
        floorPlanExtraUrls:
          body.floorPlanExtraUrls !== undefined
            ? body.floorPlanExtraUrls
              ? typeof body.floorPlanExtraUrls === 'string'
                ? body.floorPlanExtraUrls
                : JSON.stringify(body.floorPlanExtraUrls)
              : null
            : (currentOffer as { floorPlanExtraUrls?: string | null }).floorPlanExtraUrls ?? null,
        floorPlan3dUrl:
          body.floorPlan3dUrl !== undefined
            ? body.floorPlan3dUrl
              ? String(body.floorPlan3dUrl)
              : null
            : (currentOffer as { floorPlan3dUrl?: string | null }).floorPlan3dUrl ?? null,
        floorPlanScanMeta:
          body.floorPlanScanMeta !== undefined
            ? body.floorPlanScanMeta
              ? String(body.floorPlanScanMeta)
              : null
            : (currentOffer as { floorPlanScanMeta?: string | null }).floorPlanScanMeta ?? null,
        street: body.street != null ? String(body.street) : currentOffer.street,
        buildingNumber: body.buildingNumber != null ? String(body.buildingNumber) : currentOffer.buildingNumber,
        isExactLocation: body.isExactLocation !== undefined ? !!body.isExactLocation : currentOffer.isExactLocation,
        lat:
          body.lat !== undefined && body.lat !== null && body.lat !== ''
            ? Number(body.lat)
            : currentOffer.lat,
        lng:
          body.lng !== undefined && body.lng !== null && body.lng !== ''
            ? Number(body.lng)
            : currentOffer.lng,
        heating: body.heating !== undefined
          ? (body.heating ? String(body.heating) : null)
          : currentOffer.heating,
        isFurnished: body.isFurnished !== undefined
          ? !!body.isFurnished
          : currentOffer.isFurnished,
        adminFee:
          body.adminFee !== undefined
            ? body.adminFee === null || body.adminFee === ''
              ? null
              : Number(body.adminFee)
            : currentOffer.adminFee,
        hasBalcony: body.hasBalcony !== undefined ? !!body.hasBalcony : currentOffer.hasBalcony,
        hasElevator: body.hasElevator !== undefined ? !!body.hasElevator : currentOffer.hasElevator,
        hasStorage: body.hasStorage !== undefined ? !!body.hasStorage : currentOffer.hasStorage,
        hasParking: body.hasParking !== undefined ? !!body.hasParking : currentOffer.hasParking,
        hasGarden: body.hasGarden !== undefined ? !!body.hasGarden : currentOffer.hasGarden,
        hasAirConditioning:
          body.hasAirConditioning !== undefined ? !!body.hasAirConditioning : currentOffer.hasAirConditioning,
        isDuplex: body.isDuplex !== undefined ? !!body.isDuplex : currentOffer.isDuplex,
        condition: mappedCondition ?? currentOffer.condition,
        ...(mappedTransaction ? { transactionType: mappedTransaction } : {}),
        ...(hasVerificationPayload
          ? {
              landRegistryNumber: requestedKw || null,
              apartmentNumber: requestedApt || null,
            }
          : {}),
        ...(shouldResetLegalVerification
          ? {
              legalCheckStatus: 'PENDING',
              legalCheckSubmittedAt: new Date(),
              legalCheckReviewedAt: null,
              legalCheckReviewedBy: null,
              legalCheckRejectionReason: null,
              legalCheckRejectionText: null,
              isLegalSafeVerified: false,
            }
          : {}),
        ...(agentCommissionPercent !== undefined && { agentCommissionPercent }),
        status: newStatus,
      };

    let updatedOffer: typeof currentOffer;
    try {
      updatedOffer = await prisma.offer.update({
        where: { id: Number(resolvedParams.id) },
        data: updateData as never,
        select: OFFER_WEB_PUT_SELECT,
      });
    } catch (error) {
      if (!isOfferLegalColumnMissingError(error)) throw error;
      const fallbackData = { ...updateData };
      delete fallbackData.landRegistryNumber;
      delete fallbackData.apartmentNumber;
      delete fallbackData.legalCheckStatus;
      delete fallbackData.legalCheckSubmittedAt;
      delete fallbackData.legalCheckReviewedAt;
      delete fallbackData.legalCheckReviewedBy;
      delete fallbackData.legalCheckRejectionReason;
      delete fallbackData.legalCheckRejectionText;
      delete fallbackData.isLegalSafeVerified;
      updatedOffer = await prisma.offer.update({
        where: { id: Number(resolvedParams.id) },
        data: fallbackData as never,
        select: OFFER_WEB_PUT_SELECT,
      });
    }

    const oldPrice = oldPricePln;
    const newPrice = getCanonicalOfferPricePln(updatedOffer as { pricePln?: number; price?: number });
    if (Number.isFinite(newPrice) && newPrice > 0) {
      await syncOfferPriceHistory({
        offerId: Number(updatedOffer.id),
        price: Number(updatedOffer.price),
        pricePln: newPrice,
        priceCurrency: String((updatedOffer as { priceCurrency?: string }).priceCurrency || 'PLN'),
        previousPricePln: oldPrice,
        previousListPricePln,
        source: 'web_offers_put',
      });
    }
    if (Number.isFinite(oldPrice) && Number.isFinite(newPrice) && oldPrice !== newPrice) {
      await dispatchFavoritesPriceChangePush({
        offerId: Number(updatedOffer.id),
        oldPrice,
        newPrice,
        changedByUserId: Number(currentOffer.userId) || null,
        source: 'web_offers_put',
      });
    }
    const prevStatus = String(currentOffer.status || '');
    const nextStatus = String(updatedOffer.status || '');
    if (prevStatus && nextStatus && prevStatus !== nextStatus) {
      await dispatchFavoritesStatusChangePush({
        offerId: Number(updatedOffer.id),
        oldStatus: prevStatus,
        newStatus: nextStatus,
        changedByUserId: Number(currentOffer.userId) || null,
        source: 'web_offers_put',
      });
    }

    if (shouldResetLegalVerification && requestedKw) {
      try {
        const latest = await prisma.legalVerificationRequest.findFirst({
          where: { offerId: Number(resolvedParams.id) },
          orderBy: { createdAt: 'desc' },
        });
        const samePending =
          String(latest?.status || '').toUpperCase() === 'PENDING' &&
          String(latest?.landRegistryNumber || '').trim().toUpperCase() === requestedKw;
        if (!samePending) {
          await prisma.legalVerificationRequest.create({
            data: {
              offerId: Number(resolvedParams.id),
              requesterId: Number(currentOffer.userId),
              status: 'PENDING',
              landRegistryNumber: requestedKw,
              apartmentNumber: requestedApt || null,
            },
          });
          notifyAdminsLegalVerificationPending(
            Number(resolvedParams.id),
            typeof updatedOffer.title === 'string' ? updatedOffer.title : null,
          );
        }
      } catch (error) {
        console.error('[PUT /api/offers/:id] legal verification enqueue', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      offer: enrichOfferMoneyFields(updatedOffer as Record<string, unknown>),
      statusChanged: requireReverification,
    });
  } catch (error) {
    if (isOfferSchemaCompatibilityError(error)) {
      return NextResponse.json(
        { error: getOfferSchemaCompatibilityMessage(), code: 'LEGAL_FIELDS_TEMP_UNAVAILABLE' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Błąd serwera przy zapisie" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOfferLegalColumns();
    const resolvedParams = await params;
    const offerId = Number(resolvedParams.id);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
    }

    const actor = await resolveCurrentUser();
    if (!actor) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, userId: true, status: true },
    });
    if (!offer) return NextResponse.json({ error: 'Oferta nie istnieje' }, { status: 404 });

    const isAdmin = String(actor.role || '').toUpperCase() === 'ADMIN';
    if (!isAdmin && Number(offer.userId) !== Number(actor.id)) {
      return NextResponse.json({ error: 'Brak uprawnień do usunięcia tej oferty' }, { status: 403 });
    }

    if (isAdmin && String(offer.status).toUpperCase() === 'ARCHIVED') {
      const result = await deleteOfferCompletely(offerId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, deleted: true, offerId: result.deletedId });
    }

    const relatedDeals = await prisma.deal.count({ where: { offerId } });
    if (relatedDeals > 0) {
      await prisma.offer.update({
        where: { id: offerId },
        data: {
          status: 'ARCHIVED',
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      return NextResponse.json({ success: true, archived: true, reason: 'HAS_DEAL_HISTORY' });
    }

    try {
      await prisma.offer.delete({ where: { id: offerId } });
      return NextResponse.json({ success: true, deleted: true });
    } catch {
      await prisma.offer.update({
        where: { id: offerId },
        data: {
          status: 'ARCHIVED',
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      return NextResponse.json({ success: true, archived: true, reason: 'DELETE_FALLBACK_ARCHIVE' });
    }
  } catch {
    return NextResponse.json({ error: 'Błąd serwera przy usuwaniu' }, { status: 500 });
  }
}
