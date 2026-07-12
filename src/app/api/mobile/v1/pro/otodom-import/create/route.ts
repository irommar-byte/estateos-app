import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { computeIsProActive } from '@/lib/mobileUserShape';
import type { OtodomImportDraft } from '@/lib/otodomImport';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft } from '@/lib/otodomImportCreate';
import { enrichOtodomImportDraft } from '@/lib/portalImportEnrich';
import type { OtodomPublicationInput } from '@/lib/otodomImportPublication';

export const maxDuration = 300;

async function requireInvestorPro(req: Request) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, role: true, isPro: true, proExpiresAt: true },
  });
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Nie znaleziono użytkownika.' }, { status: 401 }),
    };
  }

  const isProActive = computeIsProActive({
    role: user.role,
    isPro: user.isPro,
    proExpiresAt: user.proExpiresAt,
  });
  if (!isProActive) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: 'Import jest dostępny wyłącznie dla aktywnego Investor Pro.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, userId: user.id };
}

function isImportDraft(value: unknown): value is OtodomImportDraft {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    (row.source === 'OTODOM' || row.source === 'OLX' || row.source === 'NIERUCHOMOSCI_ONLINE') &&
    typeof row.externalId === 'number'
  );
}

function redemptionToPublication(body: Record<string, unknown>): OtodomPublicationInput | null {
  const redemption = body?.redemption;
  if (!redemption || typeof redemption !== 'object') return null;
  const row = redemption as Record<string, unknown>;
  const source = String(row.source || '').trim().toLowerCase();

  if (source === 'plus_credit') {
    return { consumePlusPublication: true };
  }
  if (source === 'bonus_coupon') {
    const bonusCouponId = String(row.couponId || '').trim();
    if (!bonusCouponId) return null;
    return { kind: 'bonus_coupon', bonusCouponId };
  }
  if (source === 'plus_iap') {
    const iapTransactionId = String(row.transactionId || '').trim();
    if (!iapTransactionId) return null;
    return { kind: 'plus_iap', iapTransactionId };
  }
  return null;
}

export async function POST(req: Request) {
  const gate = await requireInvestorPro(req);
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => ({}));
    let draft: OtodomImportDraft | null = isImportDraft(body?.draft) ? body.draft : null;

    const url = String(body?.url ?? '').trim();
    if (!draft && url) {
      if (!isSupportedImportOfferUrl(url)) {
        return NextResponse.json(
          { success: false, message: 'Obsługiwane są linki OtoDom, OLX oraz Nieruchomosci-Online.' },
          { status: 400 }
        );
      }
      draft = await enrichOtodomImportDraft(await importOfferFromUrl(url));
    } else if (draft) {
      draft = await enrichOtodomImportDraft(draft);
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

    const publication = redemptionToPublication(body as Record<string, unknown>);
    if (!publication) {
      return NextResponse.json(
        {
          success: false,
          code: 'PUBLICATION_REQUIRED',
          message: 'Przed utworzeniem oferty wybierz kredyt Plus, kupon lub zakup IAP.',
        },
        { status: 422 }
      );
    }

    const result = await createOfferFromOtodomDraft(draft, gate.userId, publication, {
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
      publicationReserved: true,
      redemption: body.redemption ?? null,
      message:
        result.images.uploaded > 0
          ? `Utworzono ofertę #${result.offerId} z ${result.images.uploaded} zdjęciami.`
          : `Utworzono ofertę #${result.offerId}. Uzupełnij zdjęcia w edycji.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się utworzyć oferty z importu.';
    if (message === 'NO_PLUS_CREDIT_AVAILABLE') {
      return NextResponse.json(
        { success: false, code: 'NO_PLUS_CREDIT', message: 'Brak dostępnego kredytu Pakietu Plus.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, message }, { status: 422 });
  }
}
