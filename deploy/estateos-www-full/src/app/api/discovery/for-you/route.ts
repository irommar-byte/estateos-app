import { NextResponse } from "next/server";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import { buildDiscoveryForYou } from "@/lib/discovery/forYou";

/**
 * Soft “Bliżej Twojego kierunku” ranking for WWW catalog.
 * Optional ?offerId= — calm one-line explainer for offer detail.
 */
export async function GET(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Zaloguj się, aby zobaczyć kierunek." },
        { status: 401 },
      );
    }

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") || 12);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(24, limitRaw) : 12;
    const transaction = url.searchParams.get("transaction");
    const explainRaw = Number(url.searchParams.get("offerId") || 0);
    const explainOfferId = Number.isFinite(explainRaw) && explainRaw > 0 ? explainRaw : null;

    const result = await buildDiscoveryForYou({
      userId,
      limit,
      transaction,
      explainOfferId,
    });

    return NextResponse.json(
      { success: true, ...result },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[DISCOVERY FOR-YOU ERROR]", error);
    return NextResponse.json({ success: false, error: "Błąd serwera" }, { status: 500 });
  }
}
