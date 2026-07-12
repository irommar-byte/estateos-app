import { NextResponse } from 'next/server';
import type { OtodomImportDraft } from '@/lib/otodomImport';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft } from '@/lib/otodomImportCreate';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';

export const maxDuration = 300;

function isImportDraft(value: unknown): value is OtodomImportDraft {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    (row.source === 'OTODOM' || row.source === 'OLX' || row.source === 'NIERUCHOMOSCI_ONLINE') &&
    typeof row.externalId === 'number'
  );
}

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => ({}));
    let draft: OtodomImportDraft | null = isImportDraft(body?.draft) ? body.draft : null;

    const url = String(body?.url ?? '').trim();
    if (!draft && url) {
      if (!isSupportedImportOfferUrl(url)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Obsługiwane są wyłącznie linki OtoDom, OLX lub Nieruchomosci-Online.',
          },
          { status: 400 }
        );
      }
      draft = await importOfferFromUrl(url);
    }

    if (!draft) {
      return NextResponse.json(
        { success: false, message: 'Najpierw przeanalizuj ofertę lub podaj poprawny draft.' },
        { status: 400 }
      );
    }

    if (body?.rightsConfirmed !== true) {
      return NextResponse.json(
        { success: false, message: 'Wymagane potwierdzenie praw do publikacji danych.' },
        { status: 400 }
      );
    }

    const result = await createOfferFromOtodomDraft(draft, gate.adminId, undefined, {
      skipAutoFloorPlanProbe: true,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message,
          existingOfferId: result.existingOfferId,
          editUrl: `/edytuj-oferte/${result.existingOfferId}`,
          publicUrl: `/oferta/${result.existingOfferId}`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      offerId: result.offerId,
      offer: result.offer,
      images: result.images,
      presentation: result.presentation,
      editUrl: result.editUrl,
      publicUrl: result.publicUrl,
      message:
        result.images.uploaded > 0
          ? `Utworzono ofertę #${result.offerId} (PENDING) z ${result.images.uploaded} zdjęciami.`
          : `Utworzono ofertę #${result.offerId} (PENDING). Zdjęcia nie zostały pobrane — uzupełnij ręcznie.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się utworzyć oferty z importu.';
    return NextResponse.json({ success: false, message }, { status: 422 });
  }
}
