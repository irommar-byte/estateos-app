import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { registerAndImportPortalListing } from '@/lib/portalOnboarding';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const result = await registerAndImportPortalListing({
      inviteToken: String(body?.invite ?? ''),
      portalUrl: String(body?.url ?? body?.portalUrl ?? ''),
      firstName: String(body?.firstName ?? ''),
      lastName: String(body?.lastName ?? ''),
      email: String(body?.email ?? ''),
      password: String(body?.password ?? ''),
      phone: String(body?.phone ?? body?.contactPhone ?? ''),
      rightsConfirmed: body?.rightsConfirmed === true,
    });

    (await cookies()).set('estateos_session', result.sessionToken, { httpOnly: true, path: '/' });

    return NextResponse.json({
      ok: true,
      userId: result.userId,
      offerId: result.offerId,
      publicUrl: result.publicUrl,
      profileUrl: result.profileUrl,
      editUrl: result.editUrl,
      imagesUploaded: result.imagesUploaded,
      user: result.user,
      message: 'Konto utworzone, ogłoszenie opublikowane na Twoim profilu.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rejestracja nie powiodła się.';
    const status =
      message.includes('zarejestrowany') || message.includes('w użyciu') || message.includes('już w EstateOS')
        ? 409
        : message.includes('zaproszenia')
          ? 403
          : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
