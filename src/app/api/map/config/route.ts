import { NextResponse } from "next/server";
import { attachCacheHeaders } from "@/lib/httpCache";

/** Token Mapbox dla klienta (publiczny pk.*) — runtime, także gdy jest tylko MAPBOX_TOKEN na VPS. */
export async function GET() {
  const mapboxToken =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    process.env.MAPBOX_TOKEN?.trim() ||
    null;

  return attachCacheHeaders(NextResponse.json({ mapboxToken }), 300, 3600);
}
