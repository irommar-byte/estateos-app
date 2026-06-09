export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { buildOtodomPresentationCopy } from '@/lib/otodomImportRewrite';
import { requireInvestorProWeb } from '@/lib/requireInvestorProWeb';

export async function POST(req: Request) {
  const gate = await requireInvestorProWeb(req);
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
        { status: 400 },
      );
    }

    const draft = await importOfferFromUrl(url);
    const presentation = await buildOtodomPresentationCopy(draft);
    return NextResponse.json({ success: true, draft, presentation });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import oferty nie powiódł się.';
    return NextResponse.json({ success: false, message }, { status: 422 });
  }
}
