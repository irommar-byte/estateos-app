import { NextResponse } from "next/server";
import { resolveContactUserId } from "@/lib/contactRequestAuth";
import { submitCarInquiry } from "@/lib/carInquiry";

const VIEWING_OPTIONS = new Set([
  "Jak najszybciej",
  "W tym tygodniu",
  "W przyszłym tygodniu",
  "Tylko pytanie — bez oględzin",
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const buyerUserId = await resolveContactUserId(req);
    if (!buyerUserId) {
      return NextResponse.json({ error: "Musisz być zalogowany, aby wysłać zapytanie." }, { status: 401 });
    }

    const { id } = await params;
    const carId = Number(id);
    if (!Number.isFinite(carId) || carId <= 0) {
      return NextResponse.json({ error: "Błędne ID ogłoszenia." }, { status: 400 });
    }

    const body = (await req.json()) as {
      message?: string;
      viewingPreference?: string;
      phone?: string;
    };

    const viewingPreference = String(body.viewingPreference || "Jak najszybciej").trim();
    if (!VIEWING_OPTIONS.has(viewingPreference)) {
      return NextResponse.json({ error: "Nieprawidłowy termin oględzin." }, { status: 400 });
    }

    const result = await submitCarInquiry({
      carId,
      buyerUserId,
      userMessage: String(body.message || ""),
      viewingPreference,
      phone: String(body.phone || "").trim() || undefined,
      siteOrigin: new URL(req.url).origin,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      threadId: result.threadId,
      peerUserId: result.peerUserId,
    });
  } catch {
    return NextResponse.json({ error: "Nie udało się wysłać zapytania." }, { status: 500 });
  }
}
