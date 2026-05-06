import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { verifyMobileToken } from '@/lib/jwtMobile';
import jwt from 'jsonwebtoken';

function computeIsProActive(user: { role: string; isPro: boolean; proExpiresAt: Date | null }) {
  const proExpiresAt = user.proExpiresAt ? new Date(user.proExpiresAt) : null;
  return Boolean(
    user.role === 'ADMIN' ||
    (user.isPro && (!proExpiresAt || proExpiresAt.getTime() > Date.now()))
  );
}

function parseUserIdFromAuthToken(token: string): number | null {
  const verified = verifyMobileToken(token) as any;
  const verifiedUserId = Number(verified?.id || verified?.userId || verified?.sub);
  if (verifiedUserId && !Number.isNaN(verifiedUserId)) {
    return verifiedUserId;
  }

  // Fallback dla tokenów logowania passkey (mogą być podpisane innym sekretem).
  const decoded = jwt.decode(token) as any;
  const decodedUserId = Number(decoded?.id || decoded?.userId || decoded?.sub);
  if (decodedUserId && !Number.isNaN(decodedUserId)) {
    return decodedUserId;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Brak tokenu' }, { status: 401 });
    }

    const userId = parseUserIdFromAuthToken(token);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        phone: true,
        planType: true,
        isPro: true,
        proExpiresAt: true,
        isVerified: true,
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje' }, { status: 404 });
    }

    const isProActive = computeIsProActive(user);

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        isPro: isProActive,
      }
    });
  } catch (error: any) {
    console.error("🔥 BŁĄD API AUTH GET:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, password, firstName, lastName, phone, avatar, userId, role } = body;

    if (action === 'register') {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return NextResponse.json({ success: false, message: 'Email zajęty' }, { status: 400 });
      
      const hashedPassword = await bcrypt.hash(password, 10);

      const isPartner = String(role || '').toUpperCase() === 'PARTNER';
      const fullName = `${firstName || ''} ${lastName || ''}`.trim();

      // Partner (EstateOS™ Partner) = plan agencji w całym systemie — jak `/api/auth/register-agency`.
      // Samo `role: AGENT` nie włącza trybu Partner w UI (tam wymagane jest `planType: AGENCY`).
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: fullName || email,
          phone: phone || null,
          role: 'USER',
          planType: isPartner ? 'AGENCY' : 'NONE',
        },
      });

      return NextResponse.json({ success: true, user });
    }
    
    if (action === 'update') {
      // Zapisujemy avatar do istniejącej w bazie kolumny 'image'
      const user = await prisma.user.update({
        where: { id: Number(userId) },
        data: { image: avatar }
      });
      return NextResponse.json({ success: true, user });
    }

    return NextResponse.json({ success: false, message: 'Błędna akcja' }, { status: 400 });
  } catch (error: any) {
    console.error("🔥 BŁĄD API AUTH:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
