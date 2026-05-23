import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPasskeyRpId } from '@/lib/env.server';
import { clearRegisterPasskeyChallenge, getRegisterPasskeyChallenge } from '../_challengeStore';
import { encodeCredentialPublicKeyForDb } from '@/lib/passkeyDbEncoding';
import {
  extractRegistrationResponse,
  resolvePasskeyUser,
} from '@/lib/passkeyMobileRequest';
import {
  buildExpectedPasskeyOrigins,
  extractOriginFromWebAuthnResponse,
} from '@/lib/passkeyOrigins';
import { logEvent } from '@/lib/observability';
import { getClientIp } from '@/lib/observability';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const response = extractRegistrationResponse(body);
    const sessionId = String(body?.sessionId ?? body?.challengeId ?? '').trim();

    const resolved = await resolvePasskeyUser(req, body);
    if (!resolved || !response) {
      return NextResponse.json(
        { success: false, error: 'Brak danych rejestracji (sesja lub odpowiedź Passkey)' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: resolved.id } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Nie znaleziono użytkownika' }, { status: 404 });
    }

    const expectedChallenge = await getRegisterPasskeyChallenge(sessionId || null, user.id);
    if (!expectedChallenge) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wyzwanie wygasło — wróć do profilu i włącz Passkey ponownie',
          code: 'CHALLENGE_EXPIRED',
        },
        { status: 400 }
      );
    }

    const parsedOrigin = extractOriginFromWebAuthnResponse(response);
    const expectedOrigin = buildExpectedPasskeyOrigins(parsedOrigin);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: getPasskeyRpId(),
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      logEvent('warn', 'mobile_passkey_register_verify_failed', 'api.mobile.v1.passkeys.register-verify', {
        ip,
        userId: user.id,
        parsedOrigin,
        rpId: getPasskeyRpId(),
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Weryfikacja Passkey nie powiodła się',
          code: 'VERIFICATION_FAILED',
        },
        { status: 400 }
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const publicKeyDb = encodeCredentialPublicKeyForDb(Buffer.from(credential.publicKey));

    await prisma.authenticator.upsert({
      where: { credentialID: credential.id },
      update: {
        credentialPublicKey: publicKeyDb,
        counter: credential.counter,
        credentialDeviceType,
        credentialBackedUp,
        providerAccountId: 'passkey',
        userId: user.id,
      },
      create: {
        credentialID: credential.id,
        credentialPublicKey: publicKeyDb,
        counter: credential.counter,
        credentialDeviceType,
        credentialBackedUp,
        providerAccountId: 'passkey',
        userId: user.id,
      },
    });

    await clearRegisterPasskeyChallenge(sessionId || null, user.id);

    return NextResponse.json({ success: true, hasPasskey: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('error', 'mobile_passkey_register_verify_exception', 'api.mobile.v1.passkeys.register-verify', {
      ip,
      error: message,
    });
    console.error('[MOBILE PASSKEY REGISTER VERIFY ERROR]', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
