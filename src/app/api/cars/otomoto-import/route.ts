import { NextResponse } from "next/server";
import {
  importCarFromOtomotoUrl,
  isSupportedOtomotoOfferUrl,
} from "@/lib/otomotoCarImport";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "Podaj link do ogłoszenia Otomoto." }, { status: 400 });
    }
    if (!isSupportedOtomotoOfferUrl(url)) {
      return NextResponse.json(
        { error: "Wklej bezpośredni link do ogłoszenia Otomoto (otomoto.pl/…/oferta/…)." },
        { status: 400 },
      );
    }

    const { prefill, missingFields } = await importCarFromOtomotoUrl(url);
    return NextResponse.json({
      ok: true,
      prefill,
      missingFields,
      photoCount: prefill.images.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import z Otomoto nie powiódł się.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
