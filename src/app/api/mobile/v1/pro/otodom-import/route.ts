import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { computeIsProActive } from '@/lib/mobileUserShape';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { buildOtodomPresentationCopy } from '@/lib/otodomImportRewrite';
import { enrichOtodomImportDraft } from '@/lib/portalImportEnrich';
import { buildSmartAddPreview } from '@/lib/importSmartAddHttp';

export const maxDuration = 120;

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

export async function POST(req: Request) {
  const gate = await requireInvestorPro(req);
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url ?? '').trim();
    if (!url) {
      return NextResponse.json({ success: false, message: 'Wklej link do oferty.' }, { status: 400 });
    }
    if (!isSupportedImportOfferUrl(url)) {
      return NextResponse.json(
        { success: false, message: 'Obsługiwane są linki OtoDom, OLX oraz Nieruchomosci-Online.' },
        { status: 400 }
      );
    }

    const rawDraft = await importOfferFromUrl(url);
    const draft = await enrichOtodomImportDraft(rawDraft);
    const presentation = await buildOtodomPresentationCopy(draft);
    const smartAdd = await buildSmartAddPreview(gate.userId, draft);
    return NextResponse.json({ success: true, draft, presentation, ...smartAdd });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import oferty nie powiódł się.';
    return NextResponse.json({ success: false, message }, { status: 422 });
  }
}
