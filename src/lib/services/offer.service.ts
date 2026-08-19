import { prisma } from '@/lib/prisma';
import {
  MOBILE_OFFER_PRISMA_SELECT,
  MOBILE_OFFER_WRITE_RESPONSE_SELECT,
} from '@/lib/mobileOfferPrismaSelect';
import {
  TransactionType,
  PropertyType,
  PropertyCondition,
  OfferStatus
} from '@prisma/client';
import { validateCityDistrict } from '@/lib/location/locationCatalog';
import { assertCoordinatesMatchCity } from '@/lib/offerGeolocationValidate';
import {
  attachVerificationMetaToDescription,
  buildOfferVerificationMeta,
  extractVerificationMeta,
} from '@/lib/offerVerification';
import { dispatchFavoritesPriceChangePush, dispatchFavoritesStatusChangePush, dispatchFavoritesNewSimilarPush } from '@/lib/favoritesPricePush';
import { notifyAdminsLegalVerificationPending } from '@/lib/adminAttentionPush';
import { syncOfferPriceHistory } from '@/lib/offerPriceHistory';
import { validateAgentCommissionPercent } from '@/lib/agentCommission';
import {
  isOfferAlterPrivilegeError,
  isOfferLegalColumnMissingError,
  isOfferLocalityColumnMissingError,
  isOfferMoneyColumnMissingError,
} from '@/lib/offerSchemaErrors';
import {
  bodyTouchesOfferPrice,
  getCanonicalOfferPricePln,
} from '@/lib/money/offerPrice';
import { resolveOfferPriceFromBody } from '@/lib/money/offerPrice.server';
import {
  assertPlotAreaRequired,
  resolvePlotAreaForPersistence,
} from '@/lib/offerPlotAreaValidate';
import {
  inferCountryFromCoordinates,
  resolvePersistedLocalityFields,
  resolvePersistedLocalityFieldsAsync,
} from '@/lib/offerLocalityCountry';

/** Błąd walidacji pól oferty — mapowany na HTTP 4xx w API mobilnym. */
export class OfferValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'OfferValidationError';
  }
}

/** Format pełnego numeru księgi wieczystej (PL) — po `trim` + `toUpperCase`. */
const POLISH_KW_FULL_REGEX = /^[A-Z]{2}[0-9A-Z]{2}\/[0-9]{8}\/[0-9]$/;

export function validateLandRegistryNumberInput(raw: unknown): void {
  if (raw === undefined || raw === null) return;
  const value = String(raw).trim().toUpperCase();
  if (!value) return;
  if (!POLISH_KW_FULL_REGEX.test(value)) {
    throw new OfferValidationError(
      'Nieprawidłowy format numeru KW. Wymagany format: 2 litery + 2 znaki alfanumeryczne, ukośnik, 8 cyfr, ukośnik, 1 cyfra (np. WA3D/00012345/9).'
    );
  }
}

function stripLegacyLegalColumns(data: Record<string, unknown>) {
  delete data.landRegistryNumber;
  delete data.apartmentNumber;
  delete data.legalCheckStatus;
  delete data.legalCheckSubmittedAt;
  delete data.legalCheckReviewedAt;
  delete data.legalCheckReviewedBy;
  delete data.legalCheckRejectionReason;
  delete data.legalCheckRejectionText;
  delete data.legalCheckOwnerNote;
  delete data.isLegalSafeVerified;
}

function stripMoneyColumns(data: Record<string, unknown>) {
  delete data.priceCurrency;
  delete data.pricePln;
  delete data.exchangeRateUsed;
  delete data.exchangeRateDate;
}

function stripLocalityColumns(data: Record<string, unknown>) {
  delete data.localityCountry;
  delete data.localityCountryCode;
}

let offerLegalColumnsEnsured = false;
let offerLegalColumnsPromise: Promise<void> | null = null;
let offerMoneyColumnsEnsured = false;
let offerMoneyColumnsPromise: Promise<void> | null = null;
let offerLocalityColumnsEnsured = false;
let offerLocalityColumnsPromise: Promise<void> | null = null;
let extendedAmenityColumnsEnsured = false;
let extendedAmenityColumnsPromise: Promise<void> | null = null;

function isIgnorableAddColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Duplicate column name/i.test(message) || /already exists/i.test(message);
}

function isAddColumnSyntaxError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /syntax/i.test(message) && /if not exists/i.test(message);
}

async function hasOfferColumn(columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Offer'
        AND column_name = ?
    `,
    columnName
  );
  return Number(rows?.[0]?.total || 0) > 0;
}

async function ensureOfferColumn(columnName: string, columnSqlType: string) {
  const quotedColumn = `\`${columnName}\``;
  const alterSql = `ALTER TABLE \`Offer\` ADD COLUMN IF NOT EXISTS ${quotedColumn} ${columnSqlType} NULL`;
  try {
    await prisma.$executeRawUnsafe(alterSql);
    return;
  } catch (error) {
    if (isIgnorableAddColumnError(error)) return;
    if (!isAddColumnSyntaxError(error)) throw error;
  }

  // Fallback for older MySQL/MariaDB that don't support ADD COLUMN IF NOT EXISTS.
  const exists = await hasOfferColumn(columnName);
  if (!exists) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`Offer\` ADD COLUMN ${quotedColumn} ${columnSqlType} NULL`
    );
  }
}

/**
 * Self-healing guard for production environments where DB schema lagged behind Prisma schema.
 * Keeps offer create/update usable even if deploy omitted the Offer legal columns migration.
 */
export async function ensureOfferLegalColumns() {
  if (offerLegalColumnsEnsured) return;
  if (offerLegalColumnsPromise) return offerLegalColumnsPromise;

  offerLegalColumnsPromise = (async () => {
    await ensureOfferColumn('landRegistryNumber', 'VARCHAR(64)');
    await ensureOfferColumn('apartmentNumber', 'VARCHAR(32)');
    await ensureOfferColumn('legalCheckStatus', 'VARCHAR(16)');
    await ensureOfferColumn('legalCheckSubmittedAt', 'DATETIME(3)');
    await ensureOfferColumn('legalCheckReviewedAt', 'DATETIME(3)');
    await ensureOfferColumn('legalCheckReviewedBy', 'INT');
    await ensureOfferColumn('legalCheckRejectionReason', 'VARCHAR(64)');
    await ensureOfferColumn('legalCheckRejectionText', 'TEXT');
    await ensureOfferColumn('legalCheckOwnerNote', 'TEXT');
    await ensureOfferColumn('isLegalSafeVerified', 'BOOLEAN');
    // Legacy rows may have NULL in fields now modeled as non-null in Prisma.
    await prisma.$executeRawUnsafe(
      `UPDATE \`Offer\` SET \`legalCheckStatus\` = 'NONE' WHERE \`legalCheckStatus\` IS NULL OR TRIM(\`legalCheckStatus\`) = ''`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE \`Offer\` SET \`isLegalSafeVerified\` = 0 WHERE \`isLegalSafeVerified\` IS NULL`
    );

    offerLegalColumnsEnsured = true;
  })();

  try {
    await offerLegalColumnsPromise;
  } catch (error) {
    if (isOfferAlterPrivilegeError(error) || isOfferLegalColumnMissingError(error)) {
      // Fallback mode: DB user cannot ALTER or legacy schema still missing columns.
      offerLegalColumnsEnsured = true;
      return;
    }
    throw error;
  } finally {
    offerLegalColumnsPromise = null;
  }
}

export async function ensureOfferMoneyColumns() {
  if (offerMoneyColumnsEnsured) return;
  if (offerMoneyColumnsPromise) return offerMoneyColumnsPromise;

  offerMoneyColumnsPromise = (async () => {
    await ensureOfferColumn('priceCurrency', "VARCHAR(8) NOT NULL DEFAULT 'PLN'");
    await ensureOfferColumn('pricePln', 'DOUBLE NULL');
    await ensureOfferColumn('exchangeRateUsed', 'DOUBLE NULL');
    await ensureOfferColumn('exchangeRateDate', 'DATE NULL');
    await prisma.$executeRawUnsafe(
      `UPDATE \`Offer\` SET \`priceCurrency\` = 'PLN' WHERE \`priceCurrency\` IS NULL OR TRIM(\`priceCurrency\`) = ''`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE \`Offer\` SET \`pricePln\` = \`price\` WHERE \`pricePln\` IS NULL`
    );
    offerMoneyColumnsEnsured = true;
  })();

  try {
    await offerMoneyColumnsPromise;
  } catch (error) {
    if (isOfferAlterPrivilegeError(error) || isOfferMoneyColumnMissingError(error)) {
      offerMoneyColumnsEnsured = true;
      return;
    }
    throw error;
  } finally {
    offerMoneyColumnsPromise = null;
  }
}

export async function ensureOfferExtendedAmenityColumns() {
  if (extendedAmenityColumnsEnsured) return;
  if (extendedAmenityColumnsPromise) return extendedAmenityColumnsPromise;
  extendedAmenityColumnsPromise = (async () => {
    await ensureOfferColumn("hasAirConditioning", "BOOLEAN NOT NULL DEFAULT false");
    await ensureOfferColumn("isDuplex", "BOOLEAN NOT NULL DEFAULT false");
    await ensureOfferColumn("floorPlanExtraUrls", "TEXT");
    extendedAmenityColumnsEnsured = true;
  })();
  try {
    await extendedAmenityColumnsPromise;
  } finally {
    extendedAmenityColumnsPromise = null;
  }
}

export async function ensureOfferLocalityCountryColumns() {
  if (offerLocalityColumnsEnsured) return;
  if (offerLocalityColumnsPromise) return offerLocalityColumnsPromise;

  offerLocalityColumnsPromise = (async () => {
    await ensureOfferColumn('localityCountry', "VARCHAR(64) NULL DEFAULT 'Polska'");
    await ensureOfferColumn('localityCountryCode', "VARCHAR(8) NULL DEFAULT 'PL'");
    await prisma.$executeRawUnsafe(
      `UPDATE \`Offer\` SET \`localityCountry\` = 'Polska' WHERE \`localityCountry\` IS NULL OR TRIM(\`localityCountry\`) = ''`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE \`Offer\` SET \`localityCountryCode\` = 'PL' WHERE \`localityCountryCode\` IS NULL OR TRIM(\`localityCountryCode\`) = ''`
    );

    const batch = await prisma.$queryRaw<
      Array<{
        id: number;
        city: string | null;
        lat: number | null;
        lng: number | null;
        localityCountry: string | null;
        localityCountryCode: string | null;
      }>
    >`SELECT id, city, lat, lng, localityCountry, localityCountryCode FROM Offer`;
    for (const row of batch) {
      let resolved = resolvePersistedLocalityFields({
        localityCountry: row.localityCountry,
        localityCountryCode: row.localityCountryCode,
        city: row.city,
        lat: row.lat,
        lng: row.lng,
      });
      if (!resolved.localityCountryCode && row.lat != null && row.lng != null) {
        resolved = await inferCountryFromCoordinates(row.lat, row.lng);
      }
      if (
        resolved.localityCountryCode !== String(row.localityCountryCode || '').trim().toUpperCase() ||
        resolved.localityCountry !== String(row.localityCountry || '').trim()
      ) {
        await prisma.$executeRawUnsafe(
          'UPDATE `Offer` SET `localityCountry` = ?, `localityCountryCode` = ? WHERE `id` = ?',
          resolved.localityCountry,
          resolved.localityCountryCode,
          row.id,
        );
      }
    }

    offerLocalityColumnsEnsured = true;
  })();

  try {
    await offerLocalityColumnsPromise;
  } catch (error) {
    if (isOfferAlterPrivilegeError(error)) {
      offerLocalityColumnsEnsured = true;
      return;
    }
    throw error;
  } finally {
    offerLocalityColumnsPromise = null;
  }
}

// =======================
// MAPOWANIA
// =======================
function mapTransactionType(val?: string): TransactionType {
  switch (val) {
    case 'SALE': return TransactionType.SELL;
    case 'SELL': return TransactionType.SELL;
    case 'RENT': return TransactionType.RENT;
    default: return TransactionType.SELL;
  }
}

function mapPropertyType(val?: string): PropertyType {
  switch (val) {
    case 'APARTMENT': return PropertyType.FLAT;
    case 'FLAT': return PropertyType.FLAT;
    case 'HOUSE': return PropertyType.HOUSE;
    case 'PLOT': return PropertyType.PLOT;
    case 'COMMERCIAL': return PropertyType.COMMERCIAL;
    case 'PREMISES': return PropertyType.COMMERCIAL;
    default: return PropertyType.FLAT;
  }
}

function mapCondition(val?: string): PropertyCondition {
  switch (val) {
    case 'READY': return PropertyCondition.READY;
    case 'NEEDS_RENOVATION': return PropertyCondition.NEEDS_RENOVATION;
    case 'RENOVATION': return PropertyCondition.NEEDS_RENOVATION;
    case 'DEVELOPER_STATE': return PropertyCondition.DEVELOPER_STATE;
    case 'DEVELOPER': return PropertyCondition.DEVELOPER_STATE;
    case 'NOT_APPLICABLE': return PropertyCondition.NOT_APPLICABLE;
    default: return PropertyCondition.READY;
  }
}

function mapStatus(val?: string): OfferStatus {
  switch (val) {
    case 'ACTIVE': return OfferStatus.ACTIVE;
    case 'REJECTED': return OfferStatus.REJECTED;
    case 'ARCHIVED': return OfferStatus.ARCHIVED;
    case 'SOLD': return OfferStatus.SOLD;
    default: return OfferStatus.PENDING;
  }
}

// =======================
// CREATE
// =======================
export async function createOffer(body: any) {
  const { userId, lat, lng } = body;
  await ensureOfferLegalColumns();
  await ensureOfferMoneyColumns();
  await ensureOfferLocalityCountryColumns();
  await ensureOfferExtendedAmenityColumns();
  const resolvedPrice = await resolveOfferPriceFromBody(body);

  if (body.landRegistryNumber !== undefined && body.landRegistryNumber !== null) {
    validateLandRegistryNumberInput(body.landRegistryNumber);
  }

  if (!userId) throw new Error('Brak ID użytkownika');
  assertPlotAreaRequired(body);
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    throw new Error('Brak lokalizacji (lat/lng)');
  }

  const locationValidation = validateCityDistrict(body.city, body.district);
  if (!locationValidation.valid) {
    throw new Error(locationValidation.message || 'Nieprawidłowa lokalizacja');
  }

  await assertCoordinatesMatchCity({
    lat: Number(lat),
    lng: Number(lng),
    city: locationValidation.city,
    district: locationValidation.district,
    localityCountryCode: body.localityCountryCode ?? body.countryCode ?? null,
  });

  const verificationMeta = buildOfferVerificationMeta({
    apartmentNumber: body.apartmentNumber,
    landRegistryNumber: body.landRegistryNumber,
  });
  const descriptionWithVerification = attachVerificationMetaToDescription(
    String(body.description || ''),
    verificationMeta
  );
  const hasLegalVerificationSeed = Boolean(verificationMeta.landRegistryNumber);

  let agentCommissionPercent: number | null | undefined = undefined;
  if (body.agentCommissionPercent !== undefined && body.agentCommissionPercent !== null) {
    const v = validateAgentCommissionPercent(body.agentCommissionPercent);
    if (!v.ok) throw new Error(v.message);
    agentCommissionPercent = v.value;
  }

  const localityFields = await resolvePersistedLocalityFieldsAsync({
    localityCountry: body.localityCountry,
    localityCountryCode: body.localityCountryCode,
    city: locationValidation.city,
    lat,
    lng,
  });

  const createData: any = {
      title: body.title || "Nowa Oferta",
      description: descriptionWithVerification,

      transactionType: mapTransactionType(body.transactionType),
      propertyType: mapPropertyType(body.propertyType),
      condition: mapCondition(body.condition),

      ...resolvedPrice,
      area: Number(body.area) || 0,
      adminFee: body.adminFee !== undefined && body.adminFee !== null ? Number(body.adminFee) : null,
      deposit: body.deposit !== undefined && body.deposit !== null ? Number(body.deposit) : null,
      plotArea: resolvePlotAreaForPersistence(body),
      rooms: body.rooms !== undefined && body.rooms !== null ? Number(body.rooms) : null,

      floor: body.floor !== undefined && body.floor !== null ? Number(body.floor) : null,
      totalFloors: body.totalFloors !== undefined && body.totalFloors !== null ? Number(body.totalFloors) : null,
      yearBuilt: (() => {
        const raw = body.yearBuilt ?? body.buildYear ?? body.year;
        if (raw === undefined || raw === null || raw === "") return null;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
      })(),

      city: locationValidation.city,
      district: locationValidation.district,
      street: body.street || body.address || null,
      buildingNumber: body.buildingNumber || body.apartmentNumber || null,
      isExactLocation: body.isExactLocation !== undefined ? !!body.isExactLocation : true,

      lat: Number(lat),
      lng: Number(lng),
      localityCountry: localityFields.localityCountry,
      localityCountryCode: localityFields.localityCountryCode,

      images: typeof body.images === "string"
        ? body.images
        : JSON.stringify(body.images || []),

      videoUrl: body.videoUrl || null,
      floorPlanUrl: body.floorPlanUrl || null,
      landRegistryNumber: verificationMeta.landRegistryNumber || null,
      apartmentNumber: verificationMeta.apartmentNumber || null,
      legalCheckStatus: hasLegalVerificationSeed ? 'PENDING' : 'NONE',
      legalCheckSubmittedAt: hasLegalVerificationSeed ? new Date() : null,
      isLegalSafeVerified: false,

      hasBalcony: !!body.hasBalcony,
      hasElevator: !!body.hasElevator,
      hasStorage: !!body.hasStorage,
      hasParking: !!body.hasParking,
      hasGarden: !!body.hasGarden,
      hasAirConditioning: !!body.hasAirConditioning,
      isDuplex: !!body.isDuplex,
      isFurnished: !!body.isFurnished,
      heating: body.heating ? String(body.heating).trim() : null,

      status: mapStatus(body.status),

      ...(agentCommissionPercent !== undefined && { agentCommissionPercent }),

      userId: Number(userId)
  };

  const createOfferRecord = async (data: Record<string, unknown>, select: any) => {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true },
    });
    if (!user) throw new Error('Użytkownik nie istnieje');
    return prisma.offer.create({
      data: data as any,
      select,
    });
  };

  try {
    const created = await createOfferRecord(createData, MOBILE_OFFER_WRITE_RESPONSE_SELECT as any);
    const pln = getCanonicalOfferPricePln(created);
    if (pln > 0) {
      await syncOfferPriceHistory({
        offerId: Number(created.id),
        price: Number(created.price),
        pricePln: pln,
        priceCurrency: String((created as { priceCurrency?: string }).priceCurrency || 'PLN'),
        previousPricePln: 0,
        previousListPricePln: null,
        source: 'offer_create',
      });
    }
    if (String(created.status || '').toUpperCase() === 'ACTIVE') {
      void dispatchFavoritesNewSimilarPush({
        offerId: Number(created.id),
        city: (created as { city?: string }).city,
        transactionType: (created as { transactionType?: string }).transactionType,
        pricePln: pln,
        ownerUserId: Number((created as { userId?: number }).userId) || null,
        source: 'offer_create',
      });
    }
    if (hasLegalVerificationSeed && verificationMeta.landRegistryNumber) {
      await prisma.legalVerificationRequest.create({
        data: {
          offerId: Number(created.id),
          requesterId: Number(userId),
          status: 'PENDING',
          landRegistryNumber: verificationMeta.landRegistryNumber,
          apartmentNumber: verificationMeta.apartmentNumber || null,
        },
      });
      notifyAdminsLegalVerificationPending(
        Number(created.id),
        typeof created.title === 'string' ? created.title : null,
      );
    }
    return created;
  } catch (error) {
    if (
      !isOfferLegalColumnMissingError(error) &&
      !isOfferMoneyColumnMissingError(error) &&
      !isOfferLocalityColumnMissingError(error)
    ) {
      throw error;
    }

    const fallbackData = { ...createData };
    stripLegacyLegalColumns(fallbackData);
    stripMoneyColumns(fallbackData);
    stripLocalityColumns(fallbackData);
    const fallbackCreated = await createOfferRecord(fallbackData, MOBILE_OFFER_PRISMA_SELECT as any);
    const pln = getCanonicalOfferPricePln(fallbackCreated);
    if (pln > 0) {
      await syncOfferPriceHistory({
        offerId: Number(fallbackCreated.id),
        price: Number(fallbackCreated.price),
        pricePln: pln,
        priceCurrency: String((fallbackCreated as { priceCurrency?: string }).priceCurrency || 'PLN'),
        previousPricePln: 0,
        previousListPricePln: null,
        source: 'offer_create',
      });
    }
    if (hasLegalVerificationSeed && verificationMeta.landRegistryNumber) {
      await prisma.legalVerificationRequest.create({
        data: {
          offerId: Number(fallbackCreated.id),
          requesterId: Number(userId),
          status: 'PENDING',
          landRegistryNumber: verificationMeta.landRegistryNumber,
          apartmentNumber: verificationMeta.apartmentNumber || null,
        },
      });
      notifyAdminsLegalVerificationPending(
        Number(fallbackCreated.id),
        typeof fallbackCreated.title === 'string' ? fallbackCreated.title : null,
      );
    }
    return fallbackCreated;
  }
}

// =======================
// UPDATE
// =======================
export async function updateOffer(body: any) {
  const { id, userId } = body;
  await ensureOfferLegalColumns();
  await ensureOfferMoneyColumns();
  await ensureOfferLocalityCountryColumns();
  await ensureOfferExtendedAmenityColumns();

  if (body.landRegistryNumber !== undefined && body.landRegistryNumber !== null) {
    validateLandRegistryNumberInput(body.landRegistryNumber);
  }

  if (!id || !userId) {
    throw new Error('Brak ID oferty lub użytkownika');
  }

  const existing = await prisma.offer.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      transactionType: true,
      propertyType: true,
      condition: true,
      price: true,
      priceCurrency: true,
      pricePln: true,
      area: true,
      rooms: true,
      floor: true,
      totalFloors: true,
      yearBuilt: true,
      city: true,
      district: true,
      images: true,
      videoUrl: true,
      floorPlanUrl: true,
      hasBalcony: true,
      hasElevator: true,
      hasStorage: true,
      hasParking: true,
      hasGarden: true,
      isFurnished: true,
      heating: true,
      adminFee: true,
      deposit: true,
      plotArea: true,
      isExactLocation: true,
      lat: true,
      lng: true,
      localityCountry: true,
      localityCountryCode: true,
      street: true,
      buildingNumber: true,
      status: true,
      agentCommissionPercent: true,
    }
  });

  const actor = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, role: true },
  });
  const isAdmin = String(actor?.role || '').toUpperCase() === 'ADMIN';
  if (!existing || (!isAdmin && existing.userId !== Number(userId))) {
    throw new Error('Brak uprawnień');
  }

  assertPlotAreaRequired({
    propertyType: body.propertyType ?? existing.propertyType,
    plotArea: body.plotArea !== undefined ? body.plotArea : existing.plotArea,
    area: body.area !== undefined ? body.area : existing.area,
  });

  const shouldValidateLocation = body.city !== undefined || body.district !== undefined;
  const locationValidation = shouldValidateLocation
    ? validateCityDistrict(body.city ?? existing.city, body.district ?? existing.district)
    : null;

  if (locationValidation && !locationValidation.valid) {
    throw new Error(locationValidation.message || 'Nieprawidłowa lokalizacja');
  }

  const nextLat =
    body.lat !== undefined && body.lat !== null && body.lat !== ''
      ? Number(body.lat)
      : Number(existing.lat);
  const nextLng =
    body.lng !== undefined && body.lng !== null && body.lng !== ''
      ? Number(body.lng)
      : Number(existing.lng);
  if (
    locationValidation &&
    Number.isFinite(nextLat) &&
    Number.isFinite(nextLng)
  ) {
    await assertCoordinatesMatchCity({
      lat: nextLat,
      lng: nextLng,
      city: locationValidation.city,
      district: locationValidation.district,
      localityCountryCode:
        body.localityCountryCode ?? body.countryCode ?? (existing as { localityCountryCode?: string }).localityCountryCode ?? null,
    });
  }

  let agentCommissionPercent: number | null | undefined = undefined;
  if (body.agentCommissionPercent !== undefined) {
    if (body.agentCommissionPercent === null) {
      agentCommissionPercent = null;
    } else {
      const v = validateAgentCommissionPercent(body.agentCommissionPercent);
      if (!v.ok) throw new Error(v.message);
      agentCommissionPercent = v.value;
    }
  }

  const oldPrice = getCanonicalOfferPricePln(existing);
  const existingVerification = extractVerificationMeta(String(existing.description || ''));
  const nextLandRegistryNumber =
    body.landRegistryNumber !== undefined
      ? body.landRegistryNumber === null
        ? null
        : String(body.landRegistryNumber).trim().toUpperCase().slice(0, 64) || null
      : existingVerification.verification.landRegistryNumber;
  const nextApartmentNumber =
    body.apartmentNumber !== undefined
      ? body.apartmentNumber === null
        ? null
        : String(body.apartmentNumber).trim().slice(0, 32) || null
      : existingVerification.verification.apartmentNumber;
  const legalFieldsChanged =
    body.landRegistryNumber !== undefined || body.apartmentNumber !== undefined;
  const previousKw = String(existingVerification.verification.landRegistryNumber || '')
    .trim()
    .toUpperCase();
  const nextKwNormalized = String(nextLandRegistryNumber || '').trim().toUpperCase();
  const kwChanged = previousKw !== nextKwNormalized;
  const shouldResetLegalVerification = Boolean(
    legalFieldsChanged && nextLandRegistryNumber && kwChanged
  );
  const nextDescription = attachVerificationMetaToDescription(
    String(body.description !== undefined ? body.description : existingVerification.cleanDescription || ''),
    buildOfferVerificationMeta({
      apartmentNumber: nextApartmentNumber || '',
      landRegistryNumber: nextLandRegistryNumber || '',
    })
  );

  const requestedStatusRaw = String(body.newStatus ?? body.status ?? '').toUpperCase();
  const requestedStatus = requestedStatusRaw ? mapStatus(requestedStatusRaw) : null;
  if (requestedStatus === OfferStatus.ACTIVE && existing.status !== OfferStatus.ACTIVE) {
    throw new OfferValidationError('Aktywacja oferty wymaga dedykowanego endpointu publikacji.');
  }

  const pricePatch = bodyTouchesOfferPrice(body)
    ? await resolveOfferPriceFromBody({
        price: body.priceAmount ?? body.price ?? existing.price,
        priceAmount: body.priceAmount ?? body.price,
        priceCurrency: body.priceCurrency ?? existing.priceCurrency ?? 'PLN',
      })
    : {};

  const localityFields = await resolvePersistedLocalityFieldsAsync({
    localityCountry: body.localityCountry ?? (existing as { localityCountry?: string }).localityCountry,
    localityCountryCode:
      body.localityCountryCode ?? (existing as { localityCountryCode?: string }).localityCountryCode,
    city: locationValidation?.city ?? existing.city,
    lat: nextLat,
    lng: nextLng,
  });

  const updateData: any = {
      ...(body.title !== undefined && { title: body.title }),
      description: nextDescription,
      ...(body.transactionType !== undefined && {
        transactionType: mapTransactionType(body.transactionType)
      }),
      ...(body.propertyType !== undefined && {
        propertyType: mapPropertyType(body.propertyType)
      }),
      ...(body.condition !== undefined && {
        condition: mapCondition(body.condition)
      }),
      ...pricePatch,
      ...(body.area !== undefined && {
        area: Number(body.area)
      }),
      ...(body.rooms !== undefined && {
        rooms: body.rooms === null ? null : Number(body.rooms)
      }),
      ...(body.floor !== undefined && {
        floor: body.floor === null ? null : Number(body.floor)
      }),
      ...(body.totalFloors !== undefined && {
        totalFloors: body.totalFloors === null ? null : Number(body.totalFloors)
      }),
      ...(body.yearBuilt !== undefined && {
        yearBuilt: body.yearBuilt === null ? null : Number(body.yearBuilt)
      }),
      ...(body.buildYear !== undefined && body.yearBuilt === undefined && {
        yearBuilt: body.buildYear === null || body.buildYear === '' ? null : Number(body.buildYear),
      }),
      ...(body.city !== undefined && {
        city: locationValidation?.city
      }),
      ...(body.district !== undefined && {
        district: locationValidation?.district
      }),
      ...(body.images !== undefined && {
        images: typeof body.images === 'string'
          ? body.images
          : JSON.stringify(body.images)
      }),
      ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl || null }),
      ...(body.floorPlanUrl !== undefined && { floorPlanUrl: body.floorPlanUrl || null }),
      ...(body.floorPlan3dUrl !== undefined && { floorPlan3dUrl: body.floorPlan3dUrl || null }),
      ...(body.floorPlanScanMeta !== undefined && {
        floorPlanScanMeta: body.floorPlanScanMeta ? String(body.floorPlanScanMeta) : null,
      }),
      ...(body.hasBalcony !== undefined && { hasBalcony: !!body.hasBalcony }),
      ...(body.hasElevator !== undefined && { hasElevator: !!body.hasElevator }),
      ...(body.hasStorage !== undefined && { hasStorage: !!body.hasStorage }),
      ...(body.hasParking !== undefined && { hasParking: !!body.hasParking }),
      ...(body.hasGarden !== undefined && { hasGarden: !!body.hasGarden }),
      ...(body.hasAirConditioning !== undefined && { hasAirConditioning: !!body.hasAirConditioning }),
      ...(body.isDuplex !== undefined && { isDuplex: !!body.isDuplex }),
      ...(body.isFurnished !== undefined && { isFurnished: !!body.isFurnished }),
      ...(body.heating !== undefined && {
        heating: body.heating ? String(body.heating).trim() : null
      }),
      ...(body.adminFee !== undefined && {
        adminFee: body.adminFee === null || body.adminFee === '' ? null : Number(body.adminFee),
      }),
      ...(body.deposit !== undefined && {
        deposit: body.deposit === null || body.deposit === '' ? null : Number(body.deposit),
      }),
      ...(body.plotArea !== undefined && {
        plotArea: body.plotArea === null || body.plotArea === '' ? null : Number(body.plotArea),
      }),
      ...(body.isExactLocation !== undefined && {
        isExactLocation: !!body.isExactLocation,
      }),
      ...(body.lat !== undefined && {
        lat: body.lat === null || body.lat === '' ? null : Number(body.lat),
      }),
      ...(body.lng !== undefined && {
        lng: body.lng === null || body.lng === '' ? null : Number(body.lng),
      }),
      localityCountry: localityFields.localityCountry,
      localityCountryCode: localityFields.localityCountryCode,
      ...(body.street !== undefined && {
        street: body.street ? String(body.street).trim() : null,
      }),
      ...(body.buildingNumber !== undefined && {
        buildingNumber: body.buildingNumber ? String(body.buildingNumber).trim() : null,
      }),
      ...(body.landRegistryNumber !== undefined && {
        landRegistryNumber: nextLandRegistryNumber || null,
      }),
      ...(body.apartmentNumber !== undefined && {
        apartmentNumber: nextApartmentNumber || null,
      }),
      ...(shouldResetLegalVerification && {
        legalCheckStatus: 'PENDING',
        legalCheckSubmittedAt: new Date(),
        legalCheckReviewedAt: null,
        legalCheckReviewedBy: null,
        legalCheckRejectionReason: null,
        legalCheckRejectionText: null,
        isLegalSafeVerified: false,
      }),
      ...((body.status !== undefined || body.newStatus !== undefined) && {
        status: requestedStatus,
      }),
      ...(agentCommissionPercent !== undefined && { agentCommissionPercent })
    };

  let updatedOffer: any;
  try {
    updatedOffer = await prisma.offer.update({
      where: { id: Number(id) },
      data: updateData,
      select: MOBILE_OFFER_WRITE_RESPONSE_SELECT as any,
    });
  } catch (error) {
    if (
      !isOfferLegalColumnMissingError(error) &&
      !isOfferMoneyColumnMissingError(error) &&
      !isOfferLocalityColumnMissingError(error)
    ) {
      throw error;
    }
    const fallbackData = { ...updateData };
    stripLegacyLegalColumns(fallbackData);
    stripMoneyColumns(fallbackData);
    stripLocalityColumns(fallbackData);
    updatedOffer = await prisma.offer.update({
      where: { id: Number(id) },
      data: fallbackData,
      select: MOBILE_OFFER_PRISMA_SELECT as any,
    });
  }
  const newPrice = getCanonicalOfferPricePln(updatedOffer);
  if (Number.isFinite(oldPrice) && Number.isFinite(newPrice)) {
    await syncOfferPriceHistory({
      offerId: Number(updatedOffer.id),
      price: Number(updatedOffer.price),
      pricePln: newPrice,
      priceCurrency: String((updatedOffer as { priceCurrency?: string }).priceCurrency || 'PLN'),
      previousPricePln: oldPrice,
      previousListPricePln:
        (existing as { listPricePln?: number | null }).listPricePln != null
          ? Number((existing as { listPricePln?: number | null }).listPricePln)
          : null,
      source: 'mobile_offers_put',
    });
  }
  if (Number.isFinite(oldPrice) && Number.isFinite(newPrice) && oldPrice !== newPrice) {
    await dispatchFavoritesPriceChangePush({
      offerId: Number(updatedOffer.id),
      oldPrice,
      newPrice,
      changedByUserId: Number(userId) || null,
      source: 'mobile_offers_put',
    });
  }
  const oldStatus = String(existing.status || '');
  const newStatus = String(updatedOffer.status || '');
  if (oldStatus && newStatus && oldStatus !== newStatus) {
    await dispatchFavoritesStatusChangePush({
      offerId: Number(updatedOffer.id),
      oldStatus,
      newStatus,
      changedByUserId: Number(userId) || null,
      source: 'mobile_offers_put',
    });
  }
  if (shouldResetLegalVerification && nextLandRegistryNumber) {
    const latest = await prisma.legalVerificationRequest.findFirst({
      where: { offerId: Number(id) },
      orderBy: { createdAt: 'desc' },
    });
    const samePending =
      String(latest?.status || '').toUpperCase() === 'PENDING' &&
      String(latest?.landRegistryNumber || '').trim().toUpperCase() === nextKwNormalized;
    if (!samePending) {
      await prisma.legalVerificationRequest.create({
        data: {
          offerId: Number(id),
          requesterId: Number(existing.userId),
          status: 'PENDING',
          landRegistryNumber: nextLandRegistryNumber,
          apartmentNumber: nextApartmentNumber,
        },
      });
      notifyAdminsLegalVerificationPending(
        Number(id),
        typeof updatedOffer.title === 'string' ? updatedOffer.title : null,
      );
    }
  }
  return updatedOffer;
}
