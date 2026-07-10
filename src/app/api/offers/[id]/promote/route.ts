import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession } from "@/lib/sessionUtils";
import { promoteOfferListing } from "@/lib/listingPromotion";

async function resolveUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("estateos_session") || cookieStore.get("luxestate_user");
  if (!sessionCookie?.value) return null;
  try {
    const session = decryptSession(sessionCookie.value);
    const id = Number(session?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: "Zaloguj się, aby wyróżnić ogłoszenie." }, { status: 401 });

    const { id } = await params;
    const offerId = Number(id);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ error: "Nieprawidłowe ogłoszenie." }, { status: 400 });
    }

    const result = await promoteOfferListing({ userId, offerId });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się wyróżnić ogłoszenia.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
