export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { activeChallenges, rpName, rpID } from '../../store';

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

    const decoded: any = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: "Brak danych" }, { status: 400 });
    }

    // 🔥 FIX: Rzutujemy oba ID na String przed porównaniem
    if (String(decoded.id) !== String(userId)) {
      return NextResponse.json({ error: "Unauthorized userId mismatch" }, { status: 403 });
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(String(userId))),
      userName: email,
      timeout: 60000,
      attestationType: 'none',
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
