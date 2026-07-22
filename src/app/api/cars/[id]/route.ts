import { NextResponse } from "next/server";
import { findCarById, updateCarListing, deleteCarListing } from "@/lib/carsStorage";
import type { CarListingUpdateInput } from "@/lib/carsStorage";
import { normalizeCarExteriorColor } from "@/lib/carColors";
import { sanitizeCarListingForViewer } from "@/lib/carVehicleDocPrivacy";
import { resolveUploaderUserId } from "@/lib/upload/resolveUploader";

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

function validateBody(raw: Record<string, unknown>): CarListingUpdateInput {
  const doorCountRaw = raw?.doorCount;
  const doorCount =
    doorCountRaw == null || String(doorCountRaw).trim() === ""
      ? null
      : toSafeNumber(doorCountRaw, 0) || null;

  return {
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
    showContactPhone: Boolean(raw?.showContactPhone),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await findCarById(Number(id));
  if (!listing) {
    return NextResponse.json({ error: "Car listing not found" }, { status: 404 });
  }
  const viewerUserId = await resolveUploaderUserId(req);
  return NextResponse.json(sanitizeCarListingForViewer(listing, viewerUserId), { status: 200 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUploaderUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });
    }

    const { id } = await params;
    const carId = Number(id);
    if (!Number.isFinite(carId) || carId <= 0) {
      return NextResponse.json({ error: "Błędne ID ogłoszenia." }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const payload = validateBody(body);
    if (!payload.title || !payload.make || !payload.model || payload.pricePln <= 0) {
      return NextResponse.json({ error: "Invalid car listing payload" }, { status: 400 });
    }

    const updated = await updateCarListing(carId, userId, payload);
    if (!updated) {
      return NextResponse.json({ error: "Ogłoszenie nie istnieje lub brak uprawnień." }, { status: 403 });
    }

    return NextResponse.json({ success: true, listing: updated }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to update car listing" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUploaderUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Musisz być zalogowany." }, { status: 401 });
    }

    const { id } = await params;
    const carId = Number(id);
    if (!Number.isFinite(carId) || carId <= 0) {
      return NextResponse.json({ error: "Błędne ID ogłoszenia." }, { status: 400 });
    }

    const removed = await deleteCarListing(carId, userId);
    if (!removed) {
      return NextResponse.json({ error: "Ogłoszenie nie istnieje lub brak uprawnień." }, { status: 403 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to delete car listing" }, { status: 500 });
  }
}
