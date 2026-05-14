export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { activeChallenges, rpName, getRpID } from '../../store';
import jwt from 'jsonwebtoken';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { prisma } from '@/lib/prisma';
import { normalizeCredentialIdToBase64URL } from '@/lib/passkeyDbEncoding';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Brak tokena" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return NextResponse.json({ error: "Brak tokena" }, { status: 401 });
    }

    let decoded: any = verifyMobileToken(token);
    if (!decoded) {
      const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
      if (secret) {
        try {
          decoded = jwt.verify(token, secret);
        } catch {
          decoded = jwt.decode(token);
        }
      } else {
        decoded = jwt.decode(token);
      }
    }
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: "Brak danych" }, { status: 400 });
    }

    // 🔥 FIX: Rzutujemy oba ID na String przed porównaniem
    if (String(decoded.id) !== String(userId)) {
      return NextResponse.json({ error: "Unauthorized userId mismatch" }, { status: 403 });
    }

    const authenticators = await prisma.authenticator.findMany({
      where: { userId: Number(userId) },
      select: { credentialID: true },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID: getRpID(),
      userID: new Uint8Array(Buffer.from(String(userId))),
      userName: email,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: authenticators.map((a) => ({
        id: normalizeCredentialIdToBase64URL(a.credentialID),
        type: 'public-key' as const,
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required'
      }
    });

    activeChallenges.set(String(userId), options.challenge);

    return NextResponse.json({ publicKey: options });

  } catch (e: any) {
    console.error("[PASSKEY REGISTER START ERROR]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
