import { prisma } from '@/lib/prisma';

export type CarRadarPreferenceRecord = {
  id: number;
  userId: number;
  queryText: string;
  vehicleType: string;
  make: string;
  model: string;
  generation: string;
  fuelType: string;
  bodyType: string;
  exteriorColor: string;
  transmission: string;
  city: string;
  minPrice: number | null;
  maxPrice: number | null;
  minYear: number | null;
  maxYear: number | null;
  minMileage: number | null;
  maxMileage: number | null;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  pushNotifications: boolean;
  enabled: boolean;
  minMatchThreshold: number;
  createdAt: string;
  updatedAt: string;
};

export type CarRadarPreferenceInput = {
  userId: number;
  queryText?: string | null;
  vehicleType?: string | null;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  fuelType?: string | null;
  bodyType?: string | null;
  exteriorColor?: string | null;
  transmission?: string | null;
  city?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minYear?: number | null;
  maxYear?: number | null;
  minMileage?: number | null;
  maxMileage?: number | null;
  lat?: number | null;
  lng?: number | null;
  radius?: number | null;
  pushNotifications?: boolean;
  enabled?: boolean;
  minMatchThreshold?: number | null;
};

let ensured = false;

export async function ensureCarRadarStorage() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CarRadarPreference (
      id INT NOT NULL AUTO_INCREMENT,
      userId INT NOT NULL,
      queryText VARCHAR(512) NOT NULL DEFAULT '',
      vehicleType VARCHAR(64) NOT NULL DEFAULT '',
      make VARCHAR(128) NOT NULL DEFAULT '',
      model VARCHAR(128) NOT NULL DEFAULT '',
      generation VARCHAR(128) NOT NULL DEFAULT '',
      fuelType VARCHAR(64) NOT NULL DEFAULT '',
      bodyType VARCHAR(64) NOT NULL DEFAULT '',
      exteriorColor VARCHAR(64) NOT NULL DEFAULT '',
      transmission VARCHAR(64) NOT NULL DEFAULT '',
      city VARCHAR(128) NOT NULL DEFAULT '',
      minPrice DOUBLE NULL,
      maxPrice DOUBLE NULL,
      minYear INT NULL,
      maxYear INT NULL,
      minMileage INT NULL,
      maxMileage INT NULL,
      lat DOUBLE NULL,
      lng DOUBLE NULL,
      radius DOUBLE NULL,
      pushNotifications TINYINT(1) NOT NULL DEFAULT 1,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      minMatchThreshold INT NOT NULL DEFAULT 70,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY CarRadarPreference_userId_key (userId),
      KEY CarRadarPreference_push_enabled_idx (pushNotifications, enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  ensured = true;
}

function asFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

function mapRow(row: Record<string, unknown>): CarRadarPreferenceRecord {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    queryText: asString(row.queryText),
    vehicleType: asString(row.vehicleType),
    make: asString(row.make),
    model: asString(row.model),
    generation: asString(row.generation),
    fuelType: asString(row.fuelType),
    bodyType: asString(row.bodyType),
    exteriorColor: asString(row.exteriorColor),
    transmission: asString(row.transmission),
    city: asString(row.city),
    minPrice: asFiniteNumber(row.minPrice),
    maxPrice: asFiniteNumber(row.maxPrice),
    minYear: asFiniteNumber(row.minYear),
    maxYear: asFiniteNumber(row.maxYear),
    minMileage: asFiniteNumber(row.minMileage),
    maxMileage: asFiniteNumber(row.maxMileage),
    lat: asFiniteNumber(row.lat),
    lng: asFiniteNumber(row.lng),
    radius: asFiniteNumber(row.radius),
    pushNotifications: Boolean(Number(row.pushNotifications ?? 1)),
    enabled: Boolean(Number(row.enabled ?? 0)),
    minMatchThreshold: asFiniteNumber(row.minMatchThreshold) ?? 70,
    createdAt: row.createdAt ? new Date(String(row.createdAt)).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)).toISOString() : new Date().toISOString(),
  };
}

export function shapeCarRadarPreference(pref: CarRadarPreferenceRecord | null) {
  if (!pref) return null;
  return {
    userId: pref.userId,
    query: pref.queryText,
    queryText: pref.queryText,
    vehicleType: pref.vehicleType || null,
    make: pref.make || null,
    model: pref.model || null,
    generation: pref.generation || null,
    fuelType: pref.fuelType || null,
    bodyType: pref.bodyType || null,
    exteriorColor: pref.exteriorColor || null,
    transmission: pref.transmission || null,
    city: pref.city || null,
    minPrice: pref.minPrice,
    maxPrice: pref.maxPrice,
    minYear: pref.minYear,
    maxYear: pref.maxYear,
    minMileage: pref.minMileage,
    maxMileage: pref.maxMileage,
    lat: pref.lat,
    lng: pref.lng,
    radius: pref.radius,
    pushNotifications: pref.pushNotifications,
    enabled: pref.enabled,
    minMatchThreshold: pref.minMatchThreshold,
  };
}

export async function getCarRadarPreference(userId: number): Promise<CarRadarPreferenceRecord | null> {
  await ensureCarRadarStorage();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM CarRadarPreference WHERE userId = ? LIMIT 1`,
    userId,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listPushEnabledCarRadarPreferences(): Promise<CarRadarPreferenceRecord[]> {
  await ensureCarRadarStorage();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM CarRadarPreference WHERE enabled = 1 AND pushNotifications = 1`,
  );
  return rows.map(mapRow);
}

export async function upsertCarRadarPreference(
  input: CarRadarPreferenceInput,
): Promise<CarRadarPreferenceRecord> {
  await ensureCarRadarStorage();
  const userId = Number(input.userId);
  const existing = await getCarRadarPreference(userId);

  const next = {
    queryText: asString(input.queryText),
    vehicleType: asString(input.vehicleType),
    make: asString(input.make),
    model: asString(input.model),
    generation: asString(input.generation),
    fuelType: asString(input.fuelType),
    bodyType: asString(input.bodyType),
    exteriorColor: asString(input.exteriorColor),
    transmission: asString(input.transmission),
    city: asString(input.city),
    minPrice: asFiniteNumber(input.minPrice),
    maxPrice: asFiniteNumber(input.maxPrice),
    minYear: asFiniteNumber(input.minYear),
    maxYear: asFiniteNumber(input.maxYear),
    minMileage: asFiniteNumber(input.minMileage),
    maxMileage: asFiniteNumber(input.maxMileage),
    lat: asFiniteNumber(input.lat),
    lng: asFiniteNumber(input.lng),
    radius: asFiniteNumber(input.radius),
    pushNotifications: input.pushNotifications !== false,
    enabled: input.enabled !== false,
    minMatchThreshold: asFiniteNumber(input.minMatchThreshold) ?? 70,
  };

  if (existing) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE CarRadarPreference SET
          queryText = ?, vehicleType = ?, make = ?, model = ?, generation = ?,
          fuelType = ?, bodyType = ?, exteriorColor = ?, transmission = ?, city = ?,
          minPrice = ?, maxPrice = ?, minYear = ?, maxYear = ?, minMileage = ?, maxMileage = ?,
          lat = ?, lng = ?, radius = ?, pushNotifications = ?, enabled = ?, minMatchThreshold = ?
        WHERE userId = ?
      `,
      next.queryText,
      next.vehicleType,
      next.make,
      next.model,
      next.generation,
      next.fuelType,
      next.bodyType,
      next.exteriorColor,
      next.transmission,
      next.city,
      next.minPrice,
      next.maxPrice,
      next.minYear,
      next.maxYear,
      next.minMileage,
      next.maxMileage,
      next.lat,
      next.lng,
      next.radius,
      next.pushNotifications ? 1 : 0,
      next.enabled ? 1 : 0,
      next.minMatchThreshold,
      userId,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO CarRadarPreference
        (userId, queryText, vehicleType, make, model, generation, fuelType, bodyType, exteriorColor,
         transmission, city, minPrice, maxPrice, minYear, maxYear, minMileage, maxMileage,
         lat, lng, radius, pushNotifications, enabled, minMatchThreshold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      userId,
      next.queryText,
      next.vehicleType,
      next.make,
      next.model,
      next.generation,
      next.fuelType,
      next.bodyType,
      next.exteriorColor,
      next.transmission,
      next.city,
      next.minPrice,
      next.maxPrice,
      next.minYear,
      next.maxYear,
      next.minMileage,
      next.maxMileage,
      next.lat,
      next.lng,
      next.radius,
      next.pushNotifications ? 1 : 0,
      next.enabled ? 1 : 0,
      next.minMatchThreshold,
    );
  }

  const saved = await getCarRadarPreference(userId);
  if (!saved) throw new Error('CarRadarPreference upsert failed');
  return saved;
}
