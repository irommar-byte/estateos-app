export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { activeChallenges, rpID } from '../../store';
import crypto from 'crypto';

export async function POST() {
  try {
    const options = await generateAuthenticationOptions({
      rpID,
      timeout: 60000,
      userVerification: 'required',
    });

    const sessionId = crypto.randomUUID();
    activeChallenges.set(sessionId, options.challenge);

    return NextResponse.json({
      publicKey: options,
      sessionId
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
