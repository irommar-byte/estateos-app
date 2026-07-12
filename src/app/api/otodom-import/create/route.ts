import { NextResponse } from "next/server";
import type { OtodomImportDraft } from "@/lib/otodomImport";
import { importOfferFromUrl, isSupportedImportOfferUrl } from "@/lib/otodomImport";
import { createOfferFromOtodomDraft } from "@/lib/otodomImportCreate";
import { requireOtodomImporter } from "@/lib/otodomImportAuth";
import type { OtodomPublicationInput } from "@/lib/otodomImportPublication";
import {
  applyImportDraftPatch,
  filterImportDraftImages,
  type PortalImportPatch,
} from "@/lib/portalImportEnrich";

function isOtodomDraft(value: unknown): value is OtodomImportDraft {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    (row.source === "OTODOM" || row.source === "OLX" || row.source === "NIERUCHOMOSCI_ONLINE") &&
    typeof row.externalId === "number"
  );
}

function parseImportPatch(body: Record<string, unknown>): PortalImportPatch | undefined {
  const patch = body?.patch;
  if (!patch || typeof patch !== "object") return undefined;
  const row = patch as Record<string, unknown>;
  return {
    city: row.city != null ? String(row.city) : undefined,
    district: row.district != null ? String(row.district) : undefined,
    price: row.price != null ? Number(row.price) : undefined,
    area: row.area != null ? Number(row.area) : undefined,
  };
}

function parseSelectedImageIndices(body: Record<string, unknown>): number[] | null {
  if (!Array.isArray(body?.selectedImageIndices)) return null;
  const indices = body.selectedImageIndices
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0);
  return indices.length ? indices : null;
}

function parseFloorPlanImageIndex(body: Record<string, unknown>): number | null | undefined {
  if (body?.floorPlanImageIndex === null) return null;
  if (body?.floorPlanImageIndex === undefined) return undefined;
  const index = Number(body.floorPlanImageIndex);
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

function parsePublicationBody(body: Record<string, unknown>): OtodomPublicationInput | null {
  const pub = (body?.publication ?? body) as Record<string, unknown>;
  if (!pub || typeof pub !== "object") return null;
  const kind = pub.kind != null ? String(pub.kind) : undefined;
  const bonusCouponId = pub.bonusCouponId != null ? String(pub.bonusCouponId) : undefined;
  const iapTransactionId = pub.iapTransactionId != null ? String(pub.iapTransactionId) : undefined;
  const consumePlusPublication = pub.consumePlusPublication === true;
  if (!kind && !bonusCouponId && !consumePlusPublication && !iapTransactionId) return null;
  return { kind, bonusCouponId, iapTransactionId, consumePlusPublication };
}

export const maxDuration = 300;

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
    let draft: OtodomImportDraft | null = isOtodomDraft(body?.draft) ? body.draft : null;

    const url = String(body?.url ?? "").trim();
    if (!draft && url) {
      if (!isSupportedImportOfferUrl(url)) {
        return NextResponse.json(
          { error: "Obsługiwane są linki: OtoDom (/oferta/...), OLX (/d/oferta/...) lub Nieruchomosci-Online (.../12345.html)." },
          { status: 400 },
        );
      }
      draft = await importOfferFromUrl(url);
    }

    if (!draft) {
      return NextResponse.json(
        { error: "Najpierw przeanalizuj ofertę lub prześlij poprawny draft." },
        { status: 400 },
      );
    }

    draft = applyImportDraftPatch(draft, parseImportPatch(body as Record<string, unknown>));

    const selectedImageIndices = parseSelectedImageIndices(body as Record<string, unknown>);
    const floorPlanImageIndex = parseFloorPlanImageIndex(body as Record<string, unknown>);
    const filtered = filterImportDraftImages(draft, selectedImageIndices, floorPlanImageIndex);
    draft = filtered.draft;

    if (body?.rightsConfirmed !== true) {
      return NextResponse.json(
        { error: "Wymagane oświadczenie o posiadaniu praw do publikacji danych i materiałów." },
        { status: 400 },
      );
    }

    const publication = parsePublicationBody(body as Record<string, unknown>);
    if (!publication) {
      return NextResponse.json(
        {
          error:
            "Przed importem wybierz metodę publikacji (kupon lub kredyt Pakiet Plus) — tak jak przy zwykłym wystawieniu oferty.",
          code: "PUBLICATION_REQUIRED",
        },
        { status: 400 },
      );
    }

    const result = await createOfferFromOtodomDraft(draft, user.id, publication, {
      floorPlanImageIndex: filtered.floorPlanImageIndex,
      lastImageFloorPlan: filtered.floorPlanImageIndex == null ? false : undefined,
      skipAutoFloorPlanProbe: true,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          error: result.message,
          existingOfferId: result.existingOfferId,
          editUrl: `/edytuj-oferte/${result.existingOfferId}`,
          publicUrl: `/oferta/${result.existingOfferId}`,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      offerId: result.offerId,
      offer: result.offer,
      images: result.images,
      presentation: result.presentation,
      editUrl: result.editUrl,
      publicUrl: result.publicUrl,
      publicationReserved: true,
      message:
        result.images.uploaded > 0
          ? `Utworzono ofertę #${result.offerId} (opłacona, oczekuje weryfikacji) z ${result.images.uploaded} zdjęciami.`
          : `Utworzono ofertę #${result.offerId} (opłacona, oczekuje weryfikacji). Uzupełnij zdjęcia w edycji.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się utworzyć oferty z importu.";
    if (message === "NO_PLUS_CREDIT_AVAILABLE") {
      return NextResponse.json(
        { error: "Brak dostępnego kredytu Pakietu Plus.", code: "NO_PLUS_CREDIT" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
