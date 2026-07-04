import { NextResponse } from "next/server";
import { importOfferFromUrl, isSupportedImportOfferUrl } from "@/lib/otodomImport";
import { buildOtodomPresentationCopy } from "@/lib/otodomImportRewrite";
import { requireOtodomImporter } from "@/lib/otodomImportAuth";
import { collectOtodomImportDraftIssues } from "@/lib/importDraftValidate";
import { enrichOtodomImportDraft } from "@/lib/portalImportEnrich";
import { peekLastImageInfo } from "@/lib/otodomImportFloorPlan";

export const maxDuration = 120;

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

    const rawDraft = await importOfferFromUrl(url);
    const draft = await enrichOtodomImportDraft(rawDraft);
    const presentation = await buildOtodomPresentationCopy(draft);
    const issues = collectOtodomImportDraftIssues(draft);
    const imagePeek = peekLastImageInfo(draft);
    return NextResponse.json({ ok: true, draft, presentation, issues, imagePeek });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import oferty nie powiódł się.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
