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
  pricePln: number;
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
  promotedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS CarListing (
    id INT NOT NULL AUTO_INCREMENT,
    userId INT NULL,
    title VARCHAR(255) NOT NULL,
    make VARCHAR(120) NOT NULL,
    model VARCHAR(120) NOT NULL,
    year INT NOT NULL,
    mileageKm INT NOT NULL DEFAULT 0,
    fuelType VARCHAR(80) NOT NULL,
    transmission VARCHAR(80) NOT NULL,
    bodyType VARCHAR(80) NOT NULL,
    pricePln DECIMAL(12,2) NOT NULL,
    city VARCHAR(120) NOT NULL,
    imageUrl TEXT NULL,
    images TEXT NULL,
    description TEXT NULL,
    cityLat DECIMAL(10,7) NULL,
    cityLng DECIMAL(10,7) NULL,
    generation VARCHAR(120) NULL,
    enginePower VARCHAR(80) NULL,
    engineCapacity VARCHAR(40) NULL,
    trimVersion VARCHAR(160) NULL,
    doorCount TINYINT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY CarListing_createdAt_idx (createdAt),
    KEY CarListing_userId_idx (userId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const SEED_SQL = `
  INSERT INTO CarListing
    (userId, title, make, model, year, mileageKm, fuelType, transmission, bodyType, pricePln, city, imageUrl)
  SELECT * FROM (
    SELECT NULL, 'BMW X5 xDrive30d M Sport', 'BMW', 'X5', 2022, 42800, 'Diesel', 'Automatyczna', 'SUV', 319000, 'Warszawa', 'https://images.unsplash.com/photo-1556189250-72ba954cfc2b?auto=format&fit=crop&w=1400&q=80'
    UNION ALL
    SELECT NULL, 'Porsche Taycan 4S Performance Plus', 'Porsche', 'Taycan', 2023, 16800, 'Elektryczny', 'Automatyczna', 'Sedan', 499000, 'Kraków', 'https://images.unsplash.com/photo-1614200187524-dc4b892acf16?auto=format&fit=crop&w=1400&q=80'
    UNION ALL
    SELECT NULL, 'Audi A6 Avant 45 TFSI Quattro', 'Audi', 'A6', 2021, 61200, 'Benzyna', 'Automatyczna', 'Kombi', 224900, 'Wrocław', 'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1400&q=80'
  ) seed
  WHERE NOT EXISTS (SELECT 1 FROM CarListing LIMIT 1);
`;

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
    pricePln: toNumber(row.pricePln),
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
    promotedUntil: row.promotedUntil ? new Date(row.promotedUntil).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

const ALLOWED_CAR_LISTING_COLUMNS = new Set([
  "generation",
  "enginePower",
  "engineCapacity",
  "trimVersion",
  "doorCount",
  "images",
  "description",
  "cityLat",
  "cityLng",
  "localityCountry",
  "vin",
  "registrationNumber",
  "firstRegistrationDate",
  "insuranceValidUntil",
  "restrictVehicleDocs",
  "promotedUntil",
  "exteriorColor",
  "vehicleType",
]);

async function ensureCarListingColumn(column: string, definition: string) {
  if (!ALLOWED_CAR_LISTING_COLUMNS.has(column)) return;

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'CarListing'
        AND COLUMN_NAME = '${column}'
    `,
  );
  const exists = Number(rows?.[0]?.count || 0) > 0;
  if (!exists) {
    await prisma.$executeRawUnsafe(`ALTER TABLE CarListing ADD COLUMN ${column} ${definition}`);
  }
}

export async function ensureCarsStorage() {
  await prisma.$executeRawUnsafe(CREATE_SQL);
  await ensureCarListingColumn("generation", "VARCHAR(120) NULL");
  await ensureCarListingColumn("enginePower", "VARCHAR(80) NULL");
  await ensureCarListingColumn("engineCapacity", "VARCHAR(40) NULL");
  await ensureCarListingColumn("trimVersion", "VARCHAR(160) NULL");
  await ensureCarListingColumn("doorCount", "TINYINT NULL");
  await ensureCarListingColumn("images", "TEXT NULL");
  await ensureCarListingColumn("description", "TEXT NULL");
  await ensureCarListingColumn("cityLat", "DECIMAL(10,7) NULL");
  await ensureCarListingColumn("cityLng", "DECIMAL(10,7) NULL");
  await ensureCarListingColumn("localityCountry", "VARCHAR(80) NULL");
  await ensureCarListingColumn("vin", "VARCHAR(17) NULL");
  await ensureCarListingColumn("registrationNumber", "VARCHAR(16) NULL");
  await ensureCarListingColumn("firstRegistrationDate", "VARCHAR(20) NULL");
  await ensureCarListingColumn("insuranceValidUntil", "VARCHAR(20) NULL");
  await ensureCarListingColumn("restrictVehicleDocs", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureCarListingColumn("promotedUntil", "DATETIME(3) NULL");
  await ensureCarListingColumn("exteriorColor", "VARCHAR(80) NULL");
  await ensureCarListingColumn("vehicleType", "VARCHAR(32) NULL DEFAULT 'car'");
  await prisma.$executeRawUnsafe(SEED_SQL);
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
  pricePln: number;
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
       generation, enginePower, engineCapacity, trimVersion, doorCount, pricePln, city,
       imageUrl, images, description, cityLat, cityLng, localityCountry, vin, registrationNumber,
       firstRegistrationDate, insuranceValidUntil, restrictVehicleDocs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    input.pricePln,
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
  pricePln: number;
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
};

export async function updateCarListing(
  id: number,
  userId: number,
  input: CarListingUpdateInput,
): Promise<CarListingRecord | null> {
  await ensureCarsStorage();
  const existing = await findCarById(id);
  if (!existing || existing.userId !== userId) return null;

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
          trimVersion = ?, doorCount = ?, pricePln = ?, city = ?, imageUrl = ?, images = ?,
          description = ?, cityLat = ?, cityLng = ?, localityCountry = ?, vin = ?,
          registrationNumber = ?, firstRegistrationDate = ?, insuranceValidUntil = ?,
          restrictVehicleDocs = ?,
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
    input.pricePln,
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
    id,
    userId,
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
