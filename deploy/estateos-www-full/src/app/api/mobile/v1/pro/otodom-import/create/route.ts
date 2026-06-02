import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { computeIsProActive } from '@/lib/mobileUserShape';
import type { OtodomImportDraft } from '@/lib/otodomImport';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { createOfferFromOtodomDraft } from '@/lib/otodomImportCreate';
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

export async function POST(req: Request) {
  const gate = await requireInvestorPro(req);
  if (!gate.ok) return gate.response;

  let consumedKind: 'PLUS_CREDIT' | 'BONUS_COUPON' | 'PLUS_IAP' | null = null;
  let consumedCouponId: string | null = null;
  let consumedIapTransactionId: string | null = null;
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
    const redemptionSource = String(body?.redemption?.source || '').trim().toLowerCase();
    const couponId = String(body?.redemption?.couponId || '').trim();
    const iapTransactionId = String(body?.redemption?.transactionId || '').trim();

    if (
      redemptionSource !== 'plus_credit' &&
      redemptionSource !== 'bonus_coupon' &&
      redemptionSource !== 'plus_iap'
    ) {
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

    if (redemptionSource === 'plus_credit') {
      const consumed = await prisma.$executeRawUnsafe(
        `
          UPDATE \`User\`
          SET extraListings = GREATEST(0, extraListings - 1)
          WHERE id = ?
            AND extraListings > 0
            AND plusExpiresAt IS NOT NULL
            AND plusExpiresAt > NOW(3)
        `,
        gate.userId
      );
      if (Number(consumed || 0) < 1) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'PUBLICATION_REQUIRES_PLUS',
            message: 'Brak dostępnego kredytu Pakietu Plus. Użyj kuponu lub doładuj kredyt.',
            quote,
          },
          { status: 409 }
        );
      }
      consumedKind = 'PLUS_CREDIT';
    } else if (redemptionSource === 'bonus_coupon') {
      if (!couponId) {
        return NextResponse.json(
          { success: false, errorCode: 'COUPON_REQUIRED', message: 'Podaj ID kuponu do wykorzystania.' },
          { status: 400 }
        );
      }
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS MobileProfilePromoCard (
          id VARCHAR(64) NOT NULL,
          userId INT NOT NULL,
          kind VARCHAR(32) NOT NULL DEFAULT 'admin_promo',
          title VARCHAR(191) NOT NULL,
          subtitle VARCHAR(255) NOT NULL DEFAULT '',
          meta TEXT NULL,
          accentColor VARCHAR(32) NULL,
          iconName VARCHAR(64) NULL,
          pillLabel VARCHAR(64) NULL,
          templateId VARCHAR(64) NULL,
          grantsFreeListing TINYINT(1) NOT NULL DEFAULT 0,
          couponUsed TINYINT(1) NOT NULL DEFAULT 0,
          purpose VARCHAR(32) NULL,
          birthdayYear INT NULL,
          expiresAt DATETIME(3) NULL,
          createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          KEY MobileProfilePromoCard_user_idx (userId, couponUsed, createdAt)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      const consumedCoupon = await prisma.$executeRawUnsafe(
        `
          UPDATE MobileProfilePromoCard
          SET couponUsed = 1, updatedAt = NOW(3)
          WHERE id = ?
            AND userId = ?
            AND grantsFreeListing = 1
            AND couponUsed = 0
            AND (expiresAt IS NULL OR expiresAt > NOW(3))
        `,
        couponId.slice(0, 64),
        gate.userId
      );
      if (Number(consumedCoupon || 0) < 1) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'COUPON_NOT_AVAILABLE',
            message: 'Kupon jest nieważny, wygasł lub został już wykorzystany.',
          },
          { status: 409 }
        );
      }
      consumedKind = 'BONUS_COUPON';
      consumedCouponId = couponId.slice(0, 64);
    } else {
      if (!iapTransactionId) {
        return NextResponse.json(
          { success: false, errorCode: 'IAP_TRANSACTION_REQUIRED', message: 'Brak ID transakcji IAP.' },
          { status: 400 }
        );
      }
      const consumedIap = await prisma.$executeRawUnsafe(
        `
          UPDATE MobileIapPurchase
          SET consumedAt = COALESCE(consumedAt, NOW(3)),
              verifyStatus = 'VERIFIED'
          WHERE userId = ?
            AND transactionId = ?
            AND productId = 'pl.estateos.app.pakiet_plus_30d'
            AND consumedAt IS NULL
            AND verifyStatus = 'VERIFIED'
        `,
        gate.userId,
        iapTransactionId.slice(0, 128)
      );
      if (Number(consumedIap || 0) < 1) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'IAP_TRANSACTION_NOT_AVAILABLE',
            message: 'Nie znaleziono niewykorzystanej transakcji IAP dla Pakietu Plus.',
          },
          { status: 409 }
        );
      }
      consumedKind = 'PLUS_IAP';
      consumedIapTransactionId = iapTransactionId.slice(0, 128);
    }

    const result = await createOfferFromOtodomDraft(draft, gate.userId);
    if (!result.ok) {
      if (consumedKind === 'PLUS_CREDIT') {
        await prisma.$executeRawUnsafe('UPDATE `User` SET extraListings = extraListings + 1 WHERE id = ?', gate.userId);
      } else if (consumedKind === 'BONUS_COUPON' && consumedCouponId) {
        await prisma.$executeRawUnsafe(
          'UPDATE MobileProfilePromoCard SET couponUsed = 0, updatedAt = NOW(3) WHERE id = ? AND userId = ?',
          consumedCouponId,
          gate.userId
        );
      } else if (consumedKind === 'PLUS_IAP' && consumedIapTransactionId) {
        await prisma.$executeRawUnsafe(
          `
            UPDATE MobileIapPurchase
            SET consumedAt = NULL
            WHERE userId = ?
              AND transactionId = ?
              AND productId = 'pl.estateos.app.pakiet_plus_30d'
          `,
          gate.userId,
          consumedIapTransactionId
        );
      }
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
      redemption: consumedKind,
      editUrl: result.editUrl,
      publicUrl: result.publicUrl,
      message:
        result.images.uploaded > 0
          ? `Utworzono ofertę #${result.offerId} (PENDING) z ${result.images.uploaded} zdjęciami.`
          : `Utworzono ofertę #${result.offerId} (PENDING). Zdjęcia nie zostały pobrane — uzupełnij ręcznie.`,
    });
  } catch (error) {
    if (consumedKind === 'PLUS_CREDIT') {
      await prisma.$executeRawUnsafe('UPDATE `User` SET extraListings = extraListings + 1 WHERE id = ?', gate.userId);
    } else if (consumedKind === 'BONUS_COUPON' && consumedCouponId) {
      await prisma.$executeRawUnsafe(
        'UPDATE MobileProfilePromoCard SET couponUsed = 0, updatedAt = NOW(3) WHERE id = ? AND userId = ?',
        consumedCouponId,
        gate.userId
      );
    } else if (consumedKind === 'PLUS_IAP' && consumedIapTransactionId) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE MobileIapPurchase
          SET consumedAt = NULL
          WHERE userId = ?
            AND transactionId = ?
            AND productId = 'pl.estateos.app.pakiet_plus_30d'
        `,
        gate.userId,
        consumedIapTransactionId
      );
    }
    const message = error instanceof Error ? error.message : 'Nie udało się utworzyć oferty z importu.';
    return NextResponse.json({ success: false, message }, { status: 422 });
  }
}
