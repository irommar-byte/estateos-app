export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { activeChallenges, getRpID } from '../../store';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { normalizeCredentialIdToBase64URL } from '@/lib/passkeyDbEncoding';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || body?.identifier || body?.login || '').trim().toLowerCase();

    const ipBucket = checkRateLimit(`passkey-login-start:ip:${ip}`, 20, 60_000);
    if (!ipBucket.allowed) {
      return rateLimitResponse(ipBucket.retryAfterSeconds);
    }

    if (email) {
      const identifierBucket = checkRateLimit(`passkey-login-start:id:${email}`, 8, 60_000);
      if (!identifierBucket.allowed) {
        return rateLimitResponse(identifierBucket.retryAfterSeconds);
      }
    }

    let allowCredentials: Array<{ id: string; type: 'public-key' }> | undefined;

    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user) {
        const authenticators = await prisma.authenticator.findMany({
          where: { userId: user.id },
          select: { credentialID: true },
        });
        if (authenticators.length > 0) {
          allowCredentials = authenticators.map((a) => ({
            id: normalizeCredentialIdToBase64URL(a.credentialID as string),
            type: 'public-key' as const,
          }));
        }
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: getRpID(),
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials,
    });

    const sessionId = crypto.randomUUID();
    activeChallenges.set(sessionId, options.challenge);

    return NextResponse.json({ publicKey: options, sessionId });
  } catch (error) {
    logEvent('error', 'passkey_login_start_failed', 'api.passkey.login.start', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
