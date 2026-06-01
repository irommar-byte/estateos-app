import { NextResponse } from "next/server";
import { importOfferFromOtodomUrl, isOtodomOfferUrl } from "@/lib/otodomImport";
import { buildOtodomPresentationCopy } from "@/lib/otodomImportRewrite";
import { requireOtodomImporter } from "@/lib/otodomImportAuth";

export async function POST(req: Request) {
  try {
    const user = await requireOtodomImporter();
    if (!user) {
      return NextResponse.json(
        { error: "Import OtoDom jest dostępny wyłącznie dla kont Pro lub administratorów." },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const url = String(body?.url ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "Podaj link do oferty OtoDom." }, { status: 400 });
    }
    if (!isOtodomOfferUrl(url)) {
      return NextResponse.json(
        { error: "Obsługiwane są wyłącznie linki otodom.pl/oferta/..." },
        { status: 400 },
      );
    }

    const draft = await importOfferFromOtodomUrl(url);
    const presentation = await buildOtodomPresentationCopy(draft);
    return NextResponse.json({ ok: true, draft, presentation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import z OtoDom nie powiódł się.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
