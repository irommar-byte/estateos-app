import { NextResponse } from "next/server";
import { resolveUploaderUserId } from "@/lib/upload/resolveUploader";
import { promoteCarListing } from "@/lib/listingPromotion";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUploaderUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Zaloguj się, aby wyróżnić ogłoszenie." }, { status: 401 });
    }

    const { id } = await params;
    const carId = Number(id);
    if (!Number.isFinite(carId) || carId <= 0) {
      return NextResponse.json({ error: "Nieprawidłowe ogłoszenie." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const credits = Number((body as { credits?: unknown })?.credits);
    const result = await promoteCarListing({
      userId,
      carId,
      ...(Number.isFinite(credits) ? { credits } : {}),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się wyróżnić ogłoszenia.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
