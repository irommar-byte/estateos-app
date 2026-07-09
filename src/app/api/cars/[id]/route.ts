import { NextResponse } from "next/server";
import { findCarById, updateCarListing, deleteCarListing } from "@/lib/carsStorage";
import type { CarListingRecord } from "@/lib/carsStorage";
import { resolveUploaderUserId } from "@/lib/upload/resolveUploader";

function toSafeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function validateBody(raw: Record<string, unknown>): Omit<CarListingRecord, "id" | "userId" | "createdAt" | "updatedAt"> {
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
    generation: String(raw?.generation || "").trim(),
    enginePower: String(raw?.enginePower || "").trim(),
    engineCapacity: String(raw?.engineCapacity || "").trim(),
    trimVersion: String(raw?.trimVersion || "").trim(),
    doorCount,
    pricePln: toSafeNumber(raw?.pricePln, 0),
    city: String(raw?.city || "").trim() || "Polska",
    imageUrl: String(raw?.imageUrl || "").trim(),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await findCarById(Number(id));
  if (!listing) {
    return NextResponse.json({ error: "Car listing not found" }, { status: 404 });
  }
  return NextResponse.json(listing, { status: 200 });
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
