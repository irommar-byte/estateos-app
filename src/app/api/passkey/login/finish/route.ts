export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { activeChallenges, rpID, origin } from '../../store';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, ...assertion } = body;

    const expectedChallenge = activeChallenges.get(sessionId);
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
    }

    let credID = "";
    if (typeof assertion.rawId === 'string') {
        credID = Buffer.from(assertion.rawId, "base64").toString("base64url");
    } else {
        credID = assertion.id; 
    }

    const authRecord =
      (await prisma.authenticator.findFirst({
      where: { credentialID: credID },
    })) ??
      (await prisma.authenticator.findFirst({
        where: { credentialID: assertion.id },
      }));

    if (!authRecord) {
      return NextResponse.json({ error: "Nieznany klucz biometryczny." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authRecord.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Użytkownik nie istnieje" }, { status: 400 });
    }

    let publicKeyBytes: Uint8Array<ArrayBuffer>;
    try {
      const bufUrl = Buffer.from(authRecord.credentialPublicKey, 'base64url');
      publicKeyBytes = new Uint8Array(bufUrl.byteLength ? bufUrl : Buffer.from(authRecord.credentialPublicKey, 'base64'));
    } catch {
      publicKeyBytes = new Uint8Array(Buffer.from(authRecord.credentialPublicKey, 'base64'));
    }

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authRecord.credentialID,
        publicKey: publicKeyBytes,
        counter: authRecord.counter,
      },
    });

    if (verification.verified) {
      await prisma.authenticator.update({
        where: { credentialID: authRecord.credentialID },
        data: { counter: verification.authenticationInfo.newCounter },
      });

      activeChallenges.delete(sessionId);

      const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
      if (!jwtSecret) {
        return NextResponse.json({ error: 'Brak konfiguracji JWT' }, { status: 500 });
      }
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '30d' }
      );

      const { password: _omit, ...safeUser } = user as typeof user & { password?: string | null };

      return NextResponse.json({
        token,
        user: safeUser,
      });
    }

    return NextResponse.json({ error: "Kryptografia klucza odrzucona" }, { status: 400 });

  } catch (e: any) {
    console.error("[PASSKEY LOGIN FINISH ERROR]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
