import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '@/lib/otodomImport';
import { buildOtodomPresentationCopy } from '@/lib/otodomImportRewrite';
import { enrichOtodomImportDraft } from '@/lib/portalImportEnrich';
import { buildSmartAddPreview } from '@/lib/importSmartAddHttp';

export const maxDuration = 120;

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url ?? '').trim();
    if (!url) {
      return NextResponse.json({ success: false, message: 'Wklej link do oferty.' }, { status: 400 });
    }
    if (!isSupportedImportOfferUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Obsługiwane są wyłącznie linki OtoDom, OLX lub Nieruchomosci-Online.',
        },
        { status: 400 }
      );
    }

    const rawDraft = await importOfferFromUrl(url);
    const draft = await enrichOtodomImportDraft(rawDraft);
    const presentation = await buildOtodomPresentationCopy(draft);
    const smartAdd = await buildSmartAddPreview(gate.adminId, draft);
    return NextResponse.json({ success: true, draft, presentation, ...smartAdd });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import oferty nie powiódł się.';
    return NextResponse.json({ success: false, message }, { status: 422 });
  }
}
