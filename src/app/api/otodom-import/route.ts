import { NextResponse } from "next/server";
import { importOfferFromUrl, isSupportedImportOfferUrl } from "@/lib/otodomImport";
import { buildOtodomPresentationCopy } from "@/lib/otodomImportRewrite";
import { requireOtodomImporter } from "@/lib/otodomImportAuth";

export async function POST(req: Request) {
  try {
    const user = await requireOtodomImporter();
    if (!user) {
      return NextResponse.json(
        { error: "Import ofert jest dostępny wyłącznie dla kont Pro lub administratorów." },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const url = String(body?.url ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "Podaj link do oferty OtoDom, OLX lub Nieruchomosci-Online." }, { status: 400 });
    }
    if (!isSupportedImportOfferUrl(url)) {
      return NextResponse.json(
        { error: "Obsługiwane są linki: OtoDom (/oferta/...), OLX (/d/oferta/...) lub Nieruchomosci-Online (.../12345.html)." },
        { status: 400 },
      );
    }

    const draft = await importOfferFromUrl(url);
    const presentation = await buildOtodomPresentationCopy(draft);
    return NextResponse.json({ ok: true, draft, presentation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import oferty nie powiódł się.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
