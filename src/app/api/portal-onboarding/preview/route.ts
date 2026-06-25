import { NextResponse } from 'next/server';
import { previewPortalListing } from '@/lib/portalOnboarding';
import { verifyPortalOnboardingInvite } from '@/lib/portalOnboardingInvite';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const invite = String(body?.invite ?? '').trim();
    const portalUrl = String(body?.url ?? body?.portalUrl ?? '').trim();

    if (!verifyPortalOnboardingInvite(invite)) {
      return NextResponse.json(
        { error: 'Link zaproszenia jest nieprawidłowy lub wygasł.' },
        { status: 403 },
      );
    }

    if (!portalUrl) {
      return NextResponse.json({ error: 'Wklej link do ogłoszenia.' }, { status: 400 });
    }

    const preview = await previewPortalListing(portalUrl);
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nie udało się odczytać ogłoszenia.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
