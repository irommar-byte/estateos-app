import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getPasskeyRpId } from '@/lib/env.server';
import { setRegisterPasskeyChallenge } from '../_challengeStore';
import { resolvePasskeyUser } from '@/lib/passkeyMobileRequest';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { normalizeCredentialIdToBase64URL } from '@/lib/passkeyDbEncoding';
import {
  formatPasskeyRegistrationOptionsForClient,
  passkeyAlreadyRegisteredPayload,
} from '@/lib/passkeyRegisterOptionsResponse';
import { userHasRegisteredPasskey } from '@/lib/mobilePasskeyStatus';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const ipBucket = checkRateLimit(`mobile-passkeys-register-options:ip:${ip}`, 20, 60_000);
  if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const forceNew = Boolean(body?.forceNew ?? body?.force);

    const resolved = await resolvePasskeyUser(req, body);
    if (!resolved) {
      return NextResponse.json({ error: 'Wymagany adres e-mail lub token sesji' }, { status: 401 });
    }

    const idBucket = checkRateLimit(`mobile-passkeys-register-options:id:${resolved.email}`, 8, 60_000);
    if (!idBucket.allowed) return rateLimitResponse(idBucket.retryAfterSeconds);

    const user = await prisma.user.findUnique({ where: { id: resolved.id } });
    if (!user) {
      return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
    }

    const hasPasskey = await userHasRegisteredPasskey(user.id);
    if (hasPasskey && !forceNew) {
      return NextResponse.json(passkeyAlreadyRegisteredPayload(user.id, user.email));
    }

    const authenticators = await prisma.authenticator.findMany({ where: { userId: user.id } });

    const excludeCredentials = authenticators.map((auth) => ({
      id: normalizeCredentialIdToBase64URL(auth.credentialID),
      type: 'public-key' as const,
    }));

    const options = await generateRegistrationOptions({
      rpName: 'EstateOS',
      rpID: getPasskeyRpId(),
      userID: new Uint8Array(Buffer.from(user.id.toString())),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const sessionId = crypto.randomUUID();
    await setRegisterPasskeyChallenge(sessionId, user.id, options.challenge);

    return NextResponse.json(
      formatPasskeyRegistrationOptionsForClient(options, { sessionId, email: user.email })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('error', 'mobile_passkey_register_options_failed', 'api.mobile.v1.passkeys.register-options', {
      ip,
      error: message,
    });
    console.error('[MOBILE PASSKEY REGISTER OPTIONS ERROR]', error);
    return NextResponse.json({ error: 'Nie udało się przygotować Passkey' }, { status: 500 });
  }
}
