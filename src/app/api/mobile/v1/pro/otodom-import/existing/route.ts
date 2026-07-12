import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { computeIsProActive } from '@/lib/mobileUserShape';
import type { OtodomImportDraft } from '@/lib/otodomImport';
import { isSupportedImportOfferUrl, normalizeImportPortalUrl } from '@/lib/otodomImport';
import {
  findExistingImportedOffer,
  findExistingImportedOfferByPortalUrl,
} from '@/lib/otodomImportCreate';
import { readPendingPublication } from '@/lib/offerPendingPublication';

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
        { status: 403 },
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

/** Sprawdza czy import z danego URL już utworzył ofertę (np. po timeout 504). */
export async function POST(req: Request) {
  const gate = await requireInvestorPro(req);
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => ({}));
    const draft = isImportDraft(body?.draft) ? body.draft : null;
    const url = String(body?.url ?? draft?.externalUrl ?? '').trim();

    if (!draft && !url) {
      return NextResponse.json(
        { success: false, message: 'Podaj url lub draft importu.' },
        { status: 400 },
      );
    }

    if (url && !isSupportedImportOfferUrl(url)) {
      return NextResponse.json(
        { success: false, message: 'Obsługiwane są linki OtoDom, OLX oraz Nieruchomosci-Online.' },
        { status: 400 },
      );
    }

    const existing = draft
      ? await findExistingImportedOffer(draft)
      : await findExistingImportedOfferByPortalUrl(normalizeImportPortalUrl(url));

    if (!existing) {
      return NextResponse.json({ success: true, found: false });
    }

    const pending = await readPendingPublication(existing.id);
    return NextResponse.json({
      success: true,
      found: true,
      offerId: existing.id,
      status: existing.status,
      publicationReserved: Boolean(pending?.kind),
      editUrl: `/edytuj-oferte/${existing.id}`,
      publicUrl: `/oferta/${existing.id}`,
      message: `Oferta #${existing.id} już istnieje (${existing.status}).`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się sprawdzić importu.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
