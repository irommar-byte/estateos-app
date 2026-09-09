import { prisma } from "@/lib/prisma";
import { normalizeCarExteriorColor } from "@/lib/carColors";

export type CarListingRecord = {
  id: number;
  userId: number | null;
  title: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  fuelType: string;
  transmission: string;
  bodyType: string;
  vehicleType: string;
  exteriorColor: string;
  generation: string;
  enginePower: string;
  engineCapacity: string;
  trimVersion: string;
  doorCount: number | null;
  /** Kwota w walucie ogłoszenia (PLN|EUR). */
  price: number;
  priceCurrency: 'PLN' | 'EUR';
  pricePln: number;
  exchangeRateUsed: number | null;
  exchangeRateDate: string | null;
  city: string;
  imageUrl: string;
  images: string;
  description: string;
  cityLat: number | null;
  cityLng: number | null;
  localityCountry: string;
  vin: string;
  registrationNumber: string;
  firstRegistrationDate: string;
  insuranceValidUntil: string;
  restrictVehicleDocs: boolean;
  /** Gdy true — na stronie oferty widać przycisk „Zadzwoń” z numerem sprzedającego. */
  showContactPhone: boolean;
  promotedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: unknown, fallback = ""): string {
  const txt = String(value ?? "").trim();
  return txt || fallback;
}

function parseImagesJson(raw: unknown, fallbackImageUrl = ""): string[] {
  const fallback = String(fallbackImageUrl || "").trim();
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const urls = parsed.map((item) => String(item || "").trim()).filter(Boolean);
        if (urls.length) return urls;
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return fallback ? [fallback] : [];
}

function serializeImages(images: string[] | undefined, imageUrl = ""): string {
  const list = Array.isArray(images)
    ? images.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const normalized = list.length ? list : imageUrl ? [imageUrl] : [];
  return JSON.stringify(normalized);
}

function mapRow(row: any): CarListingRecord {
  const imageUrl = toStringValue(row.imageUrl);
  const images = parseImagesJson(row.images, imageUrl);
  return {
    id: toNumber(row.id),
    userId: row.userId == null ? null : toNumber(row.userId),
    title: toStringValue(row.title),
    make: toStringValue(row.make),
    model: toStringValue(row.model),
    year: toNumber(row.year),
    mileageKm: toNumber(row.mileageKm),
    fuelType: toStringValue(row.fuelType),
    transmission: toStringValue(row.transmission),
    bodyType: toStringValue(row.bodyType),
    vehicleType: toStringValue(row.vehicleType, "car"),
    exteriorColor: toStringValue(row.exteriorColor),
    generation: toStringValue(row.generation),
    enginePower: toStringValue(row.enginePower),
    engineCapacity: toStringValue(row.engineCapacity),
    trimVersion: toStringValue(row.trimVersion),
    doorCount: row.doorCount == null ? null : toNumber(row.doorCount),
    price: toNumber(row.price != null && row.price !== '' ? row.price : row.pricePln),
    priceCurrency: String(row.priceCurrency || 'PLN').trim().toUpperCase() === 'EUR' ? 'EUR' : 'PLN',
    pricePln: toNumber(row.pricePln),
    exchangeRateUsed:
      row.exchangeRateUsed == null || row.exchangeRateUsed === ''
        ? null
        : toNumber(row.exchangeRateUsed),
    exchangeRateDate: row.exchangeRateDate
      ? new Date(row.exchangeRateDate).toISOString().slice(0, 10)
      : null,
    city: toStringValue(row.city),
    imageUrl: images[0] || imageUrl,
    images: serializeImages(images, imageUrl),
    description: toStringValue(row.description),
    cityLat: row.cityLat == null ? null : toNumber(row.cityLat),
    cityLng: row.cityLng == null ? null : toNumber(row.cityLng),
    localityCountry: toStringValue(row.localityCountry, "Polska"),
    vin: toStringValue(row.vin),
    registrationNumber: toStringValue(row.registrationNumber),
    firstRegistrationDate: toStringValue(row.firstRegistrationDate),
    insuranceValidUntil: toStringValue(row.insuranceValidUntil),
    restrictVehicleDocs: Boolean(Number(row.restrictVehicleDocs || 0)),
    showContactPhone: Boolean(Number(row.showContactPhone || 0)),
    promotedUntil: row.promotedUntil ? new Date(row.promotedUntil).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function ensureCarsStorage() {
  // Schema is applied by prisma/manual/sql/2026-09-09_legacy_runtime_tables.sql
  return;
}

export async function listCars(limit = 50): Promise<CarListingRecord[]> {
  await ensureCarsStorage();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM CarListing ORDER BY createdAt DESC LIMIT ?`,
    toNumber(limit, 50),
  );
  return rows.map(mapRow);
}

export async function listCarsByUser(userId: number, limit = 100): Promise<CarListingRecord[]> {
  await ensureCarsStorage();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM CarListing WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`,
    userId,
    toNumber(limit, 100),
  );
  return rows.map(mapRow);
}

export async function findCarById(id: number): Promise<CarListingRecord | null> {
  await ensureCarsStorage();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM CarListing WHERE id = ? LIMIT 1`,
    id,
  );
  return rows.length ? mapRow(rows[0]) : null;
}

export async function createCarListing(input: {
  userId: number | null;
  title: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  fuelType: string;
  transmission: string;
  bodyType: string;
  vehicleType?: string;
  exteriorColor?: string;
  generation?: string;
  enginePower?: string;
  engineCapacity?: string;
  trimVersion?: string;
  doorCount?: number | null;
  price: number;
  priceCurrency?: 'PLN' | 'EUR';
  pricePln: number;
  exchangeRateUsed?: number | null;
  exchangeRateDate?: Date | string | null;
  city: string;
  imageUrl?: string;
  images?: string[];
  description?: string;
  cityLat?: number | null;
  cityLng?: number | null;
  localityCountry?: string;
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
  insuranceValidUntil?: string;
  restrictVehicleDocs?: boolean;
  showContactPhone?: boolean;
}): Promise<CarListingRecord> {
  await ensureCarsStorage();
  const imageList = Array.isArray(input.images)
    ? input.images.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const coverImage = imageList[0] || String(input.imageUrl || "").trim();
  const imagesJson = serializeImages(imageList, coverImage);
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO CarListing
      (userId, title, make, model, year, mileageKm, fuelType, transmission, bodyType, vehicleType, exteriorColor,
       generation, enginePower, engineCapacity, trimVersion, doorCount, price, priceCurrency, pricePln,
       exchangeRateUsed, exchangeRateDate, city,
       imageUrl, images, description, cityLat, cityLng, localityCountry, vin, registrationNumber,
       firstRegistrationDate, insuranceValidUntil, restrictVehicleDocs, showContactPhone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.userId,
    input.title,
    input.make,
    input.model,
    input.year,
    input.mileageKm,
    input.fuelType,
    input.transmission,
    input.bodyType,
    String(input.vehicleType || "car").trim() || "car",
    normalizeCarExteriorColor(input.exteriorColor),
    input.generation ?? "",
    input.enginePower ?? "",
    input.engineCapacity ?? "",
    input.trimVersion ?? "",
    input.doorCount ?? null,
    input.price,
    String(input.priceCurrency || "PLN").toUpperCase() === "EUR" ? "EUR" : "PLN",
    input.pricePln,
    input.exchangeRateUsed ?? null,
    input.exchangeRateDate
      ? (input.exchangeRateDate instanceof Date
          ? input.exchangeRateDate
          : new Date(String(input.exchangeRateDate)))
      : null,
    input.city,
    coverImage,
    imagesJson,
    input.description ?? "",
    input.cityLat ?? null,
    input.cityLng ?? null,
    input.localityCountry ?? "Polska",
    input.vin ?? "",
    input.registrationNumber ?? "",
    input.firstRegistrationDate ?? "",
    input.insuranceValidUntil ?? "",
    input.restrictVehicleDocs ? 1 : 0,
    input.showContactPhone ? 1 : 0,
  );

  const created = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM CarListing ORDER BY id DESC LIMIT 1`,
  );
  return mapRow(created[0]);
}

export type CarListingUpdateInput = {
  title: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  fuelType: string;
  transmission: string;
  bodyType: string;
  vehicleType?: string;
  exteriorColor?: string;
  generation?: string;
  enginePower?: string;
  engineCapacity?: string;
  trimVersion?: string;
  doorCount?: number | null;
  price: number;
  priceCurrency?: 'PLN' | 'EUR';
  pricePln: number;
  exchangeRateUsed?: number | null;
  exchangeRateDate?: Date | string | null;
  city: string;
  imageUrl?: string;
  images?: string[];
  description?: string;
  cityLat?: number | null;
  cityLng?: number | null;
  localityCountry?: string;
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
  insuranceValidUntil?: string;
  restrictVehicleDocs?: boolean;
  showContactPhone?: boolean;
};

export async function updateCarListing(
  id: number,
  userId: number,
  input: CarListingUpdateInput,
  options?: { asAdmin?: boolean },
): Promise<CarListingRecord | null> {
  await ensureCarsStorage();
  const existing = await findCarById(id);
  if (!existing) return null;
  const asAdmin = Boolean(options?.asAdmin);
  if (!asAdmin && existing.userId !== userId) return null;
  const ownerUserId = existing.userId;

  const imageList = Array.isArray(input.images)
    ? input.images.map((item) => String(item || "").trim()).filter(Boolean)
    : parseImagesJson(existing.images, existing.imageUrl);
  const coverImage = imageList[0] || String(input.imageUrl ?? existing.imageUrl).trim();
  const imagesJson = serializeImages(imageList, coverImage);

  await prisma.$executeRawUnsafe(
    `
      UPDATE CarListing
      SET title = ?, make = ?, model = ?, year = ?, mileageKm = ?, fuelType = ?,
          transmission = ?, bodyType = ?, vehicleType = ?, exteriorColor = ?, generation = ?, enginePower = ?, engineCapacity = ?,
          trimVersion = ?, doorCount = ?, price = ?, priceCurrency = ?, pricePln = ?,
          exchangeRateUsed = ?, exchangeRateDate = ?, city = ?, imageUrl = ?, images = ?,
          description = ?, cityLat = ?, cityLng = ?, localityCountry = ?, vin = ?,
          registrationNumber = ?, firstRegistrationDate = ?, insuranceValidUntil = ?,
          restrictVehicleDocs = ?, showContactPhone = ?,
          updatedAt = CURRENT_TIMESTAMP(3)
      WHERE id = ? AND userId = ?
    `,
    input.title,
    input.make,
    input.model,
    input.year,
    input.mileageKm,
    input.fuelType,
    input.transmission,
    input.bodyType,
    String(input.vehicleType || existing.vehicleType || "car").trim() || "car",
    normalizeCarExteriorColor(input.exteriorColor ?? existing.exteriorColor),
    input.generation ?? "",
    input.enginePower ?? "",
    input.engineCapacity ?? "",
    input.trimVersion ?? "",
    input.doorCount ?? null,
    input.price,
    String(input.priceCurrency || "PLN").toUpperCase() === "EUR" ? "EUR" : "PLN",
    input.pricePln,
    input.exchangeRateUsed ?? null,
    input.exchangeRateDate
      ? (input.exchangeRateDate instanceof Date
          ? input.exchangeRateDate
          : new Date(String(input.exchangeRateDate)))
      : null,
    input.city,
    coverImage,
    imagesJson,
    input.description ?? existing.description,
    input.cityLat ?? existing.cityLat,
    input.cityLng ?? existing.cityLng,
    input.localityCountry ?? existing.localityCountry,
    String(input.vin ?? "").trim() || existing.vin,
    String(input.registrationNumber ?? "").trim() || existing.registrationNumber,
    String(input.firstRegistrationDate ?? "").trim() || existing.firstRegistrationDate,
    String(input.insuranceValidUntil ?? "").trim() || existing.insuranceValidUntil,
    input.restrictVehicleDocs == null ? (existing.restrictVehicleDocs ? 1 : 0) : input.restrictVehicleDocs ? 1 : 0,
    input.showContactPhone == null ? (existing.showContactPhone ? 1 : 0) : input.showContactPhone ? 1 : 0,
    id,
    ownerUserId,
  );

  return findCarById(id);
}

export async function deleteCarListing(id: number, userId: number): Promise<boolean> {
  await ensureCarsStorage();
  const existing = await findCarById(id);
  if (!existing || existing.userId !== userId) return false;

  await prisma.$executeRawUnsafe(`DELETE FROM CarListing WHERE id = ? AND userId = ?`, id, userId);
  return true;
}
