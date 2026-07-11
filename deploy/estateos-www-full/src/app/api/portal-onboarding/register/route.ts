import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { registerAndImportPortalListing } from '@/lib/portalOnboarding';
import { ImportDraftValidationError, issuesFromCreateErrorMessage } from '@/lib/importDraftValidate';
import { LocationMismatchError } from '@/lib/offerGeolocationValidate';
import { enforceAuthRateLimit } from '@/lib/authRateLimit';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const rl = enforceAuthRateLimit(req, {
      scope: 'portal-onboarding-register',
      identifier: String(body?.email ?? ''),
      ipMax: 10,
      idMax: 3,
      windowMs: 60 * 60_000,
    });
    if (rl) return rl;

    const result = await registerAndImportPortalListing({
      inviteToken: String(body?.invite ?? ''),
      portalUrl: String(body?.url ?? body?.portalUrl ?? ''),
      firstName: String(body?.firstName ?? ''),
      lastName: String(body?.lastName ?? ''),
      email: String(body?.email ?? ''),
      password: String(body?.password ?? ''),
      phone: String(body?.phone ?? body?.contactPhone ?? ''),
      rightsConfirmed: body?.rightsConfirmed === true,
      importPatch: {
        city: body?.city != null ? String(body.city) : undefined,
        district: body?.district != null ? String(body.district) : undefined,
        price: body?.price != null ? Number(body.price) : undefined,
        area: body?.area != null ? Number(body.area) : undefined,
      },
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
      awaitingModeration: result.awaitingModeration,
      message: 'Konto utworzone — ogłoszenie oczekuje na weryfikację zespołu EstateOS™.',
    });
  } catch (error) {
    if (error instanceof ImportDraftValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code, issues: error.issues },
        { status: 422 },
      );
    }
    if (error instanceof LocationMismatchError) {
      const issues = issuesFromCreateErrorMessage(error.message);
      return NextResponse.json(
        { error: error.message, code: error.code, issues },
        { status: 422 },
      );
    }
    const message = error instanceof Error ? error.message : 'Rejestracja nie powiodła się.';
    if (/pinezk/i.test(message)) {
      const issues = issuesFromCreateErrorMessage(message);
      return NextResponse.json(
        { error: message, code: 'LOCATION_MISMATCH', issues },
        { status: 422 },
      );
    }
    const status =
      message.includes('zarejestrowany') || message.includes('w użyciu') || message.includes('już w EstateOS')
        ? 409
        : message.includes('zaproszenia')
          ? 403
          : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
