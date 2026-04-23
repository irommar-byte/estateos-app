export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { activeChallenges, rpID, origin } from '../../store';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { userId, credential } = await req.json();

    const expectedChallenge = activeChallenges.get(String(userId));
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Challenge expired lub brak sesji" }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const regInfo = verification.registrationInfo as any;
      
      const rawCredID = regInfo.credentialID || regInfo.credential?.id;
      const rawPubKey = regInfo.credentialPublicKey || regInfo.credential?.publicKey;
      const counter = regInfo.counter ?? regInfo.credential?.counter ?? 0;
      const deviceType = regInfo.credentialDeviceType || "singleDevice";
      const backedUp = regInfo.credentialBackedUp || false;

      if (!rawCredID || !rawPubKey) {
         throw new Error("Brak danych klucza w weryfikacji!");
      }

      const credIDBase64 = typeof rawCredID === 'string' 
        ? rawCredID 
        : Buffer.from(rawCredID).toString('base64url');

      await prisma.authenticator.upsert({
        where: { credentialID: credIDBase64 },
        update: { counter: counter },
        create: {
          credentialID: credIDBase64,
          userId: Number(userId),
          providerAccountId: 'passkey_' + credIDBase64.substring(0, 16),
          // 🔥 USUNIĘTO POLA 'provider' ORAZ 'type', KTÓRYCH PRISMA TUTAJ NIE ZNA!
          credentialPublicKey: Buffer.from(rawPubKey).toString('base64'),
          counter: counter,
          credentialDeviceType: deviceType,
          credentialBackedUp: backedUp,
        }
      });

      activeChallenges.delete(String(userId));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Verification failed on server" }, { status: 400 });

  } catch (e: any) {
    console.error("[PASSKEY REGISTER FINISH ERROR]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
