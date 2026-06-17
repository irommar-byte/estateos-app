import { NextResponse } from "next/server";
import { listAgenciesWithStats } from "@/lib/offerAgencyManagement";

export const dynamic = 'force-dynamic';

/** Alias kompatybilności — eksperci = agencje z prawdziwymi opiniami. */
export async function GET() {
  try {
    const agencies = await listAgenciesWithStats();
    return NextResponse.json(
      agencies.map((a) => ({
        id: a.id,
        name: a.displayName,
        email: null,
        phone: a.phone,
        image: a.image,
        companyName: a.companyName,
        rating: a.averageRating != null ? String(a.averageRating) : null,
        reviewsCount: a.reviewsCount,
        transactions: a.activeListings,
        createdAt: a.memberSince,
      })),
    );
  } catch {
    return NextResponse.json([]);
  }
}
