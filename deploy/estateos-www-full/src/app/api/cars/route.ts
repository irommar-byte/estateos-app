import { NextResponse } from "next/server";
import { createCarListing, listCars, listCarsByUser } from "@/lib/carsStorage";
import type { CarListingUpdateInput } from "@/lib/carsStorage";
import { normalizeCarExteriorColor } from "@/lib/carColors";
import { sanitizeCarListingForViewer } from "@/lib/carVehicleDocPrivacy";
import { isPromotionActive } from "@/lib/listingPromotion";
import { resolveUploaderUserId } from "@/lib/upload/resolveUploader";

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
    return NextResponse.json(mine.map((listing) => withFeaturedFlag(listing)), { status: 200 });
  }
  const sellerId = Number(searchParams.get("userId") || "");
  if (Number.isFinite(sellerId) && sellerId > 0) {
    const sellerCars = await listCarsByUser(sellerId, 50);
    return NextResponse.json(
      sellerCars.map((listing) => withFeaturedFlag(sanitizeCarListingForViewer(listing))),
      { status: 200 },
    );
  }
  const all = await listCars(100);
  return NextResponse.json(
    all.map((listing) => withFeaturedFlag(sanitizeCarListingForViewer(listing))),
    { status: 200 },
  );
}

export async function POST(req: Request) {
  try {
    const userId = await resolveUploaderUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Musisz być zalogowany, aby dodać auto." }, { status: 401 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const payload = validateBody(body);
    if (!payload.title || !payload.make || !payload.model || payload.pricePln <= 0) {
      return NextResponse.json({ error: "Invalid car listing payload" }, { status: 400 });
    }
    const created = await createCarListing({
      ...payload,
      userId,
    });
    return NextResponse.json({ success: true, listing: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create car listing" }, { status: 500 });
  }
}
