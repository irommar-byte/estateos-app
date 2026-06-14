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
    return NextResponse.json({ ok: false, error: 'Nieobsługiwany URL.' }, { status: 422 });
  }

  try {
    const peek = await peekKeiPortalListing(portalUrl);
    const imageUrl = peek.lastImageUrl;
    if (!imageUrl) {
      return NextResponse.json({ ok: false, error: 'Brak zdjęcia.' }, { status: 404 });
    }

    const upstream = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
        Referer: `${new URL(portalUrl).origin}/`,
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json({ ok: false, error: 'Nie udało się pobrać miniatury.' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Podgląd nie powiódł się.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
