import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { peekKeiPortalListing } from '@/lib/keiAmerExport';
import { isSupportedImportOfferUrl } from '@/lib/otodomImport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 90;

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const portalUrl = new URL(req.url).searchParams.get('portalUrl')?.trim() || '';
  if (!portalUrl || !isSupportedImportOfferUrl(portalUrl)) {
    return NextResponse.json({ ok: false, error: 'Nieobsługiwany URL portalu.' }, { status: 422 });
  }

  try {
    const result = await peekKeiPortalListing(portalUrl);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Podgląd nie powiódł się.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
