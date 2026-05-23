export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { activeChallenges, getRpID } from '../../store';
import { prisma } from '@/lib/prisma';
import {
  encodeCredentialPublicKeyForDb,
  normalizeCredentialIdToBase64URL,
} from '@/lib/passkeyDbEncoding';
import {
  buildExpectedPasskeyOrigins,
  extractOriginFromWebAuthnResponse,
} from '@/lib/passkeyOrigins';
import {
  clearPasskeyRegisterChallenge,
  getPasskeyRegisterChallenge,
} from '@/lib/passkeyChallengeDb';
import { extractRegistrationResponse } from '@/lib/passkeyMobileRequest';
import { logEvent } from '@/lib/observability';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = Number(body?.userId);
    const registrationResponse = extractRegistrationResponse(body);

    if (!Number.isFinite(userId) || userId <= 0 || !registrationResponse) {
      return NextResponse.json({ error: 'Brak userId lub credential' }, { status: 400 });
    }

    const expectedChallenge =
      activeChallenges.get(String(userId)) || (await getPasskeyRegisterChallenge(userId));

    if (!expectedChallenge) {
      return NextResponse.json(
        {
          error: 'Challenge wygasł — wyłącz i włącz Passkey ponownie w profilu',
          code: 'CHALLENGE_EXPIRED',
        },
        { status: 400 }
      );
    }

    const parsedOrigin = extractOriginFromWebAuthnResponse(registrationResponse);
    const expectedOrigin = buildExpectedPasskeyOrigins(parsedOrigin);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: getRpID(),
        requireUserVerification: false,
      });
    } catch (verifyErr: unknown) {
      const detail = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      logEvent('warn', 'passkey_register_finish_verify_throw', 'api.passkey.register.finish', {
        userId,
        parsedOrigin,
        detail,
      });
      return NextResponse.json(
        {
          error: 'Weryfikacja Passkey nie powiodła się',
          code: 'VERIFICATION_FAILED',
          origin: parsedOrigin,
          detail,
        },
        { status: 400 }
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      logEvent('warn', 'passkey_register_finish_verify_failed', 'api.passkey.register.finish', {
        userId,
        parsedOrigin,
        rpId: getRpID(),
      });
      return NextResponse.json(
        {
          error: 'Weryfikacja Passkey nie powiodła się',
          code: 'VERIFICATION_FAILED',
          origin: parsedOrigin,
        },
        { status: 400 }
      );
    }

    const regInfo = verification.registrationInfo;
    const rawCredID = regInfo.credential.id;
    const rawPubKey = regInfo.credential.publicKey;
    const counter = regInfo.credential.counter;
    const deviceType = regInfo.credentialDeviceType;
    const backedUp = regInfo.credentialBackedUp;

    const credIDBase64 = normalizeCredentialIdToBase64URL(rawCredID);
    const publicKeyDb = encodeCredentialPublicKeyForDb(Buffer.from(rawPubKey));

    await prisma.authenticator.upsert({
      where: { credentialID: credIDBase64 },
      update: {
        counter,
        userId,
        providerAccountId: 'passkey',
        credentialPublicKey: publicKeyDb,
        credentialDeviceType: deviceType,
        credentialBackedUp: backedUp,
      },
      create: {
        credentialID: credIDBase64,
        userId,
        providerAccountId: 'passkey',
        credentialPublicKey: publicKeyDb,
        counter,
        credentialDeviceType: deviceType,
        credentialBackedUp: backedUp,
      },
    });

    activeChallenges.delete(String(userId));
    await clearPasskeyRegisterChallenge(userId);

    return NextResponse.json({ success: true, hasPasskey: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[PASSKEY REGISTER FINISH ERROR]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
