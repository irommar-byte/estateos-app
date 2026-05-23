import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { getPasskeyRpId } from '@/lib/env.server';

export async function GET(req: Request) {
  const ip = getClientIp(req);

  const bucket = checkRateLimit(`web-passkeys-auth-options:ip:${ip}`, 20, 60_000);
  if (!bucket.allowed) {
    return rateLimitResponse(bucket.retryAfterSeconds);
  }

  try {
    const options = await generateAuthenticationOptions({
      rpID: getPasskeyRpId(),
      userVerification: 'preferred',
    });

    const cookieStore = await cookies();
    cookieStore.set('passkey_auth_challenge', options.challenge, {
      httpOnly: true,
      maxAge: 60 * 5,
      path: '/',
    });

    return NextResponse.json(options);
  } catch (error) {
    logEvent('error', 'web_passkey_auth_options_failed', 'api.passkeys.auth-options', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Błąd generowania opcji' }, { status: 500 });
  }
}
