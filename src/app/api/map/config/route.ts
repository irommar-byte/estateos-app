import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Token Mapbox dla klienta (publiczny pk.*) — runtime, także gdy jest tylko MAPBOX_TOKEN na VPS. */
export async function GET() {
  const mapboxToken =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    process.env.MAPBOX_TOKEN?.trim() ||
    null;

  return NextResponse.json({ mapboxToken });
}
