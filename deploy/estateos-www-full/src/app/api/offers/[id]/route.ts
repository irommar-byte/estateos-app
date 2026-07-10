import { decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import type { OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import {
  attachVerificationMetaToDescription,
  buildOfferVerificationMeta,
  extractVerificationMeta,
} from '@/lib/offerVerification';
import { dispatchFavoritesPriceChangePush } from '@/lib/favoritesPricePush';
import { enrichOfferPriceDiscountFields, ensureOfferPriceHistorySchema, syncOfferPriceHistory } from '@/lib/offerPriceHistory';
import { ensureOfferLegalColumns, ensureOfferMoneyColumns, ensureOfferLocalityCountryColumns, ensureOfferExtendedAmenityColumns } from '@/lib/services/offer.service';
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
import { getUserDisplayAvatar } from '@/lib/agencyCompany';
import {
  presentingAgentAsOfferUser,
  resolvePresentingAgent,
} from '@/lib/offerPresentingAgent';

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
  heating: true,
  isFurnished: true,
  transactionType: true,
  street: true,
  buildingNumber: true,
  lat: true,
  lng: true,
  isExactLocation: true,
  status: true,
} as const;

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
    });
    if (!access.allowed) {
      return NextResponse.json({ error: 'Oferta niedostępna' }, { status: 404 });
    }

    let isRealPro = false;
    let loggedInEmail: string | null = null;
    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value || '';

    if (sessionToken) {
      try {
        const sessionData = decryptSession(sessionToken) as { email?: string } | null;
        loggedInEmail = sessionData?.email ? String(sessionData.email).trim().toLowerCase() : null;
      } catch {
        loggedInEmail = null;
      }
    }

    if (loggedInEmail) {
      const realUser = await prisma.user.findUnique({ where: { email: loggedInEmail } });
      if (realUser) {
        const proExpiresAt = realUser.proExpiresAt ? new Date(realUser.proExpiresAt) : null;
        isRealPro = Boolean(
          realUser.role === 'ADMIN' ||
          (realUser.isPro && (!proExpiresAt || proExpiresAt.getTime() > Date.now()))
        );
      }
    }

    const viewsRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total FROM OfferViewLog WHERE offerId = ?`,
      Number(resolvedParams.id)
    );
    const viewsCount = Number(viewsRows?.[0]?.total || 0);

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
    const userWithAvatar =
      sellerUserId > 0 && enrichedUserFinal
        ? await (async () => {
            const displayImage = await getUserDisplayAvatar(sellerUserId);
            if (!displayImage) return enrichedUserFinal;
            return {
              ...enrichedUserFinal,
              image: displayImage,
              avatar: displayImage,
              displayAvatarUrl: displayImage,
            };
          })()
        : enrichedUserFinal;

    return NextResponse.json(
      enrichOfferPriceDiscountFields({
      ...moneyOffer,
      user: userWithAvatar,
      sellerDisplayName,
      sellerPersonName,
      servicingCompanyName,
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
            image: presentingAgent.image,
          }
        : null,
      propertyTypeLabel: formatOfferPropertyType((legalOffer as { propertyType?: unknown }).propertyType, 'pl'),
      propertyTypeLabelEn: formatOfferPropertyType((legalOffer as { propertyType?: unknown }).propertyType, 'en'),
      conditionLabel: formatOfferCondition((legalOffer as { condition?: unknown }).condition, 'pl'),
      conditionLabelEn: formatOfferCondition((legalOffer as { condition?: unknown }).condition, 'en'),
      description: cleanDescription,
      apartmentNumber: legalOffer.apartmentNumber || verification.apartmentNumber || legalOffer.buildingNumber || '',
      landRegistryNumber: legalOffer.landRegistryNumber || verification.landRegistryNumber || '',
      ...legal,
      yearBuilt,
      buildYear,
      year: yearBuilt,
      buildYearLabel: formatOfferBuildYear(legalOffer as Record<string, unknown>),
      floorPlanUrl: (legalOffer as { floorPlanUrl?: string | null }).floorPlanUrl || null,
      floorPlan: (legalOffer as { floorPlanUrl?: string | null }).floorPlanUrl || null,
      floorPlan3dUrl: (legalOffer as { floorPlan3dUrl?: string | null }).floorPlan3dUrl || null,
      floorPlanScanMeta: (legalOffer as { floorPlanScanMeta?: string | null }).floorPlanScanMeta || null,
      marketListedAt: marketListing.marketListedAt,
      marketRenewedAt: marketListing.marketRenewedAt,
      localityCountry: localityResolved.localityCountry,
      localityCountryCode: localityResolved.localityCountryCode,
      _viewerIsPro: isRealPro,
      views: viewsCount,
      viewsCount,
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
    const hasVerificationPayload =
      body.apartmentNumber !== undefined || body.landRegistryNumber !== undefined || body.verificationStatus !== undefined;
    const nextVerification = hasVerificationPayload
      ? buildOfferVerificationMeta({
          apartmentNumber: body.apartmentNumber ?? existingVerification.verification.apartmentNumber,
          landRegistryNumber: body.landRegistryNumber ?? existingVerification.verification.landRegistryNumber,
        })
      : existingVerification.verification;
    const nextDescription = body.description != null
      ? attachVerificationMetaToDescription(String(body.description), nextVerification)
      : attachVerificationMetaToDescription(existingVerification.cleanDescription, nextVerification);

    let requireReverification = false;
    
    const sensitiveFields = [
      'title', 'description', 'district', 'area', 'images', 'propertyType',
      'rooms', 'floor', 'yearBuilt', 'plotArea', 'floorPlanUrl', 'street', 'buildingNumber',
      'lat', 'lng', 'transactionType', 'heating', 'isFurnished'
    ];

    for (const field of sensitiveFields) {
       const currentVal = String(currentOffer[field as keyof typeof currentOffer] ?? '').trim();
       const newVal = String(body[field] ?? '').trim();
       
       if (currentVal !== newVal) {
           requireReverification = true;
           console.log(`Zmieniono pole: ${field}. Wymagana ponowna weryfikacja.`);
           break;
       }
    }

    let newStatus: OfferStatus = currentOffer.status;
    if (requireReverification && currentOffer.status === 'ACTIVE') {
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

    const updatedOffer = await prisma.offer.update({
      where: { id: Number(resolvedParams.id) },
      data: {
        title: body.title != null ? String(body.title) : currentOffer.title,
        description: nextDescription,
        propertyType: body.propertyType ?? currentOffer.propertyType,
        district: body.district != null ? String(body.district) : currentOffer.district,
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
        floor: parsedFloor ?? null,
        yearBuilt: parsedYear ?? null,
        plotArea: parsedPlot ?? null,
        floorPlanUrl:
          body.floorPlanUrl != null
            ? String(body.floorPlanUrl)
            : body.floorPlan != null
              ? String(body.floorPlan)
              : currentOffer.floorPlanUrl,
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
        condition: body.condition !== undefined ? body.condition : currentOffer.condition,
        ...(agentCommissionPercent !== undefined && { agentCommissionPercent }),
        status: newStatus,
      },
      select: OFFER_WEB_PUT_SELECT,
    });

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
