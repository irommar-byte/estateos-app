import { NextResponse } from "next/server";
import { createCarListing, listCars, listCarsByUser } from "@/lib/carsStorage";
import type { CarListingUpdateInput } from "@/lib/carsStorage";
import { normalizeCarExteriorColor } from "@/lib/carColors";
import { sanitizeCarListingForViewer } from "@/lib/carVehicleDocPrivacy";
import { isPromotionActive } from "@/lib/listingPromotion";
import { rehostRemoteCarImages } from "@/lib/rehostRemoteCarImages";
import { resolveUploaderUserId } from "@/lib/upload/resolveUploader";


async function ensureCarEngagementTable() {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CarEngagement (
      carId INT NOT NULL,
      viewsCount INT NOT NULL DEFAULT 0,
      favoritesCount INT NOT NULL DEFAULT 0,
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (carId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function loadCarEngagement(ids: number[]): Promise<Map<number, { viewsCount: number; favoritesCount: number }>> {
  const map = new Map<number, { viewsCount: number; favoritesCount: number }>();
  if (!ids.length) return map;
  try {
    const { prisma } = await import("@/lib/prisma");
    await ensureCarEngagementTable();
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT carId, viewsCount, favoritesCount FROM CarEngagement WHERE carId IN (${ids.join(",")})`,
    )) as Array<{ carId: number; viewsCount: number; favoritesCount: number }>;
    for (const row of rows) {
      map.set(Number(row.carId), {
        viewsCount: Number(row.viewsCount || 0),
        favoritesCount: Number(row.favoritesCount || 0),
      });
    }
  } catch {
    // ignore
  }
  return map;
}

function withEngagement<T extends { id: number }>(
  listing: T,
  engagement: Map<number, { viewsCount: number; favoritesCount: number }>,
) {
  const stats = engagement.get(Number(listing.id)) || { viewsCount: 0, favoritesCount: 0 };
  return {
    ...listing,
    viewsCount: stats.viewsCount,
    favoritesCount: stats.favoritesCount,
    views: stats.viewsCount,
  };
}

function withFeaturedFlag<T extends { promotedUntil?: string | null }>(listing: T) {
  return {
    ...listing,
    featured: isPromotionActive(listing.promotedUntil),
  };
}

function toSafeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeVinInput(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-HJ-NPR-Z0-9]/g, "");
}

function validateBody(raw: Record<string, unknown>): CarListingUpdateInput & { userId: number | null } {
  const doorCountRaw = raw?.doorCount;
  const doorCount =
    doorCountRaw == null || String(doorCountRaw).trim() === ""
      ? null
      : toSafeNumber(doorCountRaw, 0) || null;

  return {
    userId: raw?.userId == null ? null : toSafeNumber(raw.userId, 0),
    title: String(raw?.title || "").trim(),
    make: String(raw?.make || "").trim(),
    model: String(raw?.model || "").trim(),
    year: toSafeNumber(raw?.year, 2020),
    mileageKm: toSafeNumber(raw?.mileageKm, 0),
    fuelType: String(raw?.fuelType || "").trim() || "Benzyna",
    transmission: String(raw?.transmission || "").trim() || "Automatyczna",
    bodyType: String(raw?.bodyType || "").trim() || "Sedan",
    vehicleType: String(raw?.vehicleType || "car").trim() || "car",
    exteriorColor: normalizeCarExteriorColor(raw?.exteriorColor),
    generation: String(raw?.generation || "").trim(),
    enginePower: String(raw?.enginePower || "").trim(),
    engineCapacity: String(raw?.engineCapacity || "").trim(),
    trimVersion: String(raw?.trimVersion || "").trim(),
    doorCount,
    pricePln: toSafeNumber(raw?.pricePln, 0),
    city: String(raw?.city || "").trim() || "Polska",
    imageUrl: String(raw?.imageUrl || "").trim(),
    images: Array.isArray(raw?.images)
      ? raw.images.map((item) => String(item || "").trim()).filter(Boolean)
      : undefined,
    description: String(raw?.description || "").trim(),
    cityLat:
      raw?.cityLat == null || String(raw.cityLat).trim() === ""
        ? null
        : toSafeNumber(raw.cityLat, 0) || null,
    cityLng:
      raw?.cityLng == null || String(raw.cityLng).trim() === ""
        ? null
        : toSafeNumber(raw.cityLng, 0) || null,
    localityCountry: String(raw?.localityCountry || "").trim() || "Polska",
    vin: normalizeVinInput(raw?.vin),
    registrationNumber: String(raw?.registrationNumber || "").trim().toUpperCase(),
    firstRegistrationDate: String(raw?.firstRegistrationDate || "").trim(),
    insuranceValidUntil: String(raw?.insuranceValidUntil || "").trim(),
    restrictVehicleDocs: Boolean(raw?.restrictVehicleDocs),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const viewerUserId = await resolveUploaderUserId(req);
  if (scope === "mine") {
    if (!viewerUserId) return NextResponse.json([], { status: 200 });
    const mine = await listCarsByUser(viewerUserId, 100);
    const engagement = await loadCarEngagement(mine.map((c) => c.id));
    return NextResponse.json(
      mine.map((listing) => withEngagement(withFeaturedFlag(listing), engagement)),
      { status: 200 },
    );
  }
  const sellerId = Number(searchParams.get("userId") || "");
  if (Number.isFinite(sellerId) && sellerId > 0) {
    const sellerCars = await listCarsByUser(sellerId, 50);
    const engagement = await loadCarEngagement(sellerCars.map((c) => c.id));
    return NextResponse.json(
      sellerCars.map((listing) =>
        withEngagement(withFeaturedFlag(sanitizeCarListingForViewer(listing)), engagement),
      ),
      { status: 200 },
    );
  }
  const all = await listCars(100);
  const engagement = await loadCarEngagement(all.map((c) => c.id));
  return NextResponse.json(
    all.map((listing) =>
      withEngagement(withFeaturedFlag(sanitizeCarListingForViewer(listing)), engagement),
    ),
    { status: 200 },
  );
}

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const userId = await resolveUploaderUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Musisz być zalogowany, aby dodać auto." }, { status: 401 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const payload = validateBody(body);
    if (!payload.title || !payload.make || !payload.model || payload.pricePln <= 0) {
      return NextResponse.json(
        { error: "Uzupełnij tytuł, markę, model i cenę, aby opublikować ogłoszenie." },
        { status: 400 },
      );
    }

    const sourceImages =
      payload.images && payload.images.length
        ? payload.images
        : payload.imageUrl
          ? [payload.imageUrl]
          : [];

    let hostedImages = sourceImages;
    try {
      hostedImages = await rehostRemoteCarImages({ userId, imageUrls: sourceImages });
      if (!hostedImages.length) hostedImages = sourceImages;
    } catch (rehostError) {
      console.error("cars rehost", rehostError);
      hostedImages = sourceImages;
    }

    try {
      const created = await createCarListing({
        ...payload,
        userId,
        images: hostedImages,
        imageUrl: hostedImages[0] || payload.imageUrl,
      });
      return NextResponse.json({ success: true, listing: created }, { status: 201 });
    } catch (createError) {
      console.error("cars create", createError);
      return NextResponse.json(
        {
          error:
            createError instanceof Error
              ? `Nie udało się zapisać ogłoszenia: ${createError.message}`
              : "Nie udało się zapisać ogłoszenia.",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("cars POST", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się zapisać ogłoszenia." },
      { status: 500 },
    );
  }
}
