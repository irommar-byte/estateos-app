import { NextResponse } from "next/server";
import { createCarListing, listCars, listCarsByUser } from "@/lib/carsStorage";
import type { CarListingRecord } from "@/lib/carsStorage";
import { resolveUploaderUserId } from "@/lib/upload/resolveUploader";

function toSafeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function validateBody(raw: Record<string, unknown>): Omit<CarListingRecord, "id" | "createdAt" | "updatedAt"> {
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
    pricePln: toSafeNumber(raw?.pricePln, 0),
    city: String(raw?.city || "").trim() || "Polska",
    imageUrl: String(raw?.imageUrl || "").trim(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  if (scope === "mine") {
    const userId = await resolveUploaderUserId(req);
    if (!userId) return NextResponse.json([], { status: 200 });
    const mine = await listCarsByUser(userId, 100);
    return NextResponse.json(mine, { status: 200 });
  }
  const all = await listCars(100);
  return NextResponse.json(all, { status: 200 });
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
