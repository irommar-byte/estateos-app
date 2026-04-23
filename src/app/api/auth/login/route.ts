import { SignJWT } from "jose";
export const runtime = "nodejs";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { encryptSession } from '@/lib/sessionUtils';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body.email || body.login;
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Brak danych' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json({ success: false, message: 'Błędne dane logowania' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!user.password.startsWith("$2b$")) {
      const newHash = await bcrypt.hash(password, 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
    }

    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Błędne dane logowania' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
    const token = await new SignJWT({ id: user.id, email: user.email, role: user.role || "USER" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    const estateosSession = encryptSession({
      id: user.id,
      email: user.email,
      role: user.role || "USER",
      name: user.name || "",
    });

    const response = NextResponse.json({
      success: true,
      token,
      role: user.role || 'USER',
      name: user.name,
      id: user.id
    });

    response.cookies.set({
      name: 'estateos_session',
      value: estateosSession,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    response.cookies.set({
      name: 'luxestate_user',
      value: estateosSession,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    response.cookies.set({ name: 'deal_token', value: token, httpOnly: false, path: '/' });
    return response;
  } catch (e: any) {
    console.error("🔥 BŁĄD LOGOWANIA:", e);
    return NextResponse.json({ success: false, message: e.message || String(e) }, { status: 500 });
  }
}
