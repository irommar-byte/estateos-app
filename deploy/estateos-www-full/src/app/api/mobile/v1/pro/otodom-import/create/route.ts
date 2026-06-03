import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { computeIsProActive } from '@/lib/mobileUserShape';
import type { OtodomImportDraft } from '@/lib/otodomImport';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft } from '@/lib/otodomImportCreate';
import {
  consumeAndReserveImportPublication,
  deleteOfferAfterImportPaymentFailure,
  ImportPublicationError,
  type ImportRedemptionInput,
} from '@/lib/otodomImportPublication';
import { ImportDraftValidationError, issuesFromCreateErrorMessage } from '@/lib/importDraftValidate';
import { getCreatePublicationQuote } from '@/lib/offerPublication';

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

function parseRedemption(body: Record<string, unknown>): ImportRedemptionInput | null {
  const source = String(body?.redemption && typeof body.redemption === 'object'
    ? (body.redemption as Record<string, unknown>).source
    : '').trim().toLowerCase();
  if (source !== 'plus_credit' && source !== 'bonus_coupon' && source !== 'plus_iap') {
    return null;
  }
  const redemption = body.redemption as Record<string, unknown>;
  return {
    source,
    couponId: String(redemption.couponId || '').trim() || undefined,
    transactionId: String(redemption.transactionId || '').trim() || undefined,
  };
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

    const quote = await getCreatePublicationQuote({ userId: gate.userId });
    const redemption = parseRedemption(body as Record<string, unknown>);
    if (!redemption) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'ENTITLEMENT_REQUIRED',
          message: 'Przed utworzeniem oferty wybierz wykorzystanie kredytu Plus albo kuponu.',
          quote,
        },
        { status: 422 }
      );
    }

    const result = await createOfferFromOtodomDraft(draft, gate.userId);
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

    let payment: Awaited<ReturnType<typeof consumeAndReserveImportPublication>>;
    try {
      payment = await consumeAndReserveImportPublication({
        offerId: result.offerId,
        userId: gate.userId,
        redemption,
      });
    } catch (paymentError) {
      await deleteOfferAfterImportPaymentFailure(result.offerId);
      if (paymentError instanceof ImportPublicationError) {
        return NextResponse.json(
          {
            success: false,
            errorCode: paymentError.code,
            message: paymentError.message,
            quote,
          },
          { status: paymentError.status }
        );
      }
      throw paymentError;
    }

    return NextResponse.json({
      success: true,
      offerId: result.offerId,
      offer: result.offer,
      images: result.images,
      presentation: result.presentation,
      redemption: payment.kind,
      publicationReserved: true,
      wallet: {
        extraListings: payment.extraListings,
        plusExpiresAt: payment.plusExpiresAt,
      },
      editUrl: result.editUrl,
      publicUrl: result.publicUrl,
      message:
        result.images.uploaded > 0
          ? `Utworzono ofertę #${result.offerId} (PENDING) z ${result.images.uploaded} zdjęciami. Publikacja opłacona.`
          : `Utworzono ofertę #${result.offerId} (PENDING). Publikacja opłacona. Zdjęcia uzupełnij ręcznie.`,
    });
  } catch (error) {
    if (error instanceof ImportDraftValidationError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          issues: error.issues,
          message: error.message,
        },
        { status: 422 },
      );
    }
    const message = error instanceof Error ? error.message : 'Nie udało się utworzyć oferty z importu.';
    return NextResponse.json(
      {
        success: false,
        code: 'NEEDS_USER_INPUT',
        issues: issuesFromCreateErrorMessage(message),
        message,
      },
      { status: 422 },
    );
  }
}
