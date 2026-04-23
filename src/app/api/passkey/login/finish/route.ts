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

    const auth = await prisma.authenticator.findFirst({
      where: { credentialID: credID }
    });

    if (!auth) {
      const fallbackAuth = await prisma.authenticator.findFirst({
         where: { credentialID: assertion.id }
      });
      if (!fallbackAuth) {
         return NextResponse.json({ error: "Nieznany klucz biometryczny." }, { status: 400 });
      }
      Object.assign(auth || {}, fallbackAuth);
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId }
    });

    if (!user) {
      return NextResponse.json({ error: "Użytkownik nie istnieje" }, { status: 400 });
    }

    const authArgs: any = {
      response: assertion,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: new Uint8Array(Buffer.from(auth.credentialID, 'base64url')),
        credentialPublicKey: new Uint8Array(Buffer.from(auth.credentialPublicKey, 'base64')),
        counter: auth.counter,
      },
      credential: {
        id: auth.credentialID,
        publicKey: new Uint8Array(Buffer.from(auth.credentialPublicKey, 'base64')),
        counter: auth.counter,
      }
    };

    const verification = await verifyAuthenticationResponse(authArgs);

    if (verification.verified) {
      await prisma.authenticator.update({
        where: { credentialID: auth.credentialID },
        data: { counter: verification.authenticationInfo.newCounter }
      });

      activeChallenges.delete(sessionId);

      const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '30d' }
      );

      // 🔥 FIX: Zwracamy wszystkie dane z bazy (bez ukrytego hasła), żeby aplikacja miała co wyświetlić!
      const { password, ...safeUser } = user as any;

      return NextResponse.json({
        token,
        user: safeUser
      });
    }

    return NextResponse.json({ error: "Kryptografia klucza odrzucona" }, { status: 400 });

  } catch (e: any) {
    console.error("[PASSKEY LOGIN FINISH ERROR]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
