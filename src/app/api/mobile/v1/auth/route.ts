import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { signMobileToken } from '@/lib/jwtMobile';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';

function parseUserIdFromAuthToken(token: string): number | null {
  const verified = verifyMobileToken(token) as Record<string, unknown> | null;
  const verifiedUserId = Number(verified?.id || verified?.userId || verified?.sub);
  if (verifiedUserId && !Number.isNaN(verifiedUserId)) {
    return verifiedUserId;
  }

  return null;
}

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const xAccessToken = req.headers.get('x-access-token');
  const authToken = req.headers.get('auth-token');

  const raw = String(authHeader || xAccessToken || authToken || '').trim();
  if (!raw) return null;
  if (raw.startsWith('Bearer ')) return raw.slice('Bearer '.length).trim() || null;
  // Backward compatibility: część buildów mobilnych wysyła sam token bez "Bearer".
  return raw;
}

async function performMobileLogin(emailRaw: unknown, passwordRaw: unknown) {
  const email = String(emailRaw || '').trim().toLowerCase();
  const password = String(passwordRaw || '');

  if (!email || !password) {
    return NextResponse.json({ success: false, message: 'Brak emaila lub hasła' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy email lub hasło' }, { status: 401 });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy email lub hasło' }, { status: 401 });
  }

  const token = signMobileToken({ id: user.id, email: user.email, role: user.role });
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: MOBILE_USER_SELECT,
  });

  return NextResponse.json({
    success: true,
    user: fullUser ? shapeMobileUser(fullUser) : null,
    token,
  });
}

export async function GET(req: Request) {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ success: false, message: 'Brak tokenu' }, { status: 401 });
    }

    const userId = parseUserIdFromAuthToken(token);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: MOBILE_USER_SELECT,
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: shapeMobileUser(user) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action,
      email,
      password,
      firstName,
      lastName,
      phone,
      avatar,
      userId,
      role,
      login,
      identifier,
    } = body;

    // Backward compatibility (legacy app):
    // - action: "login"
    // - brak/nieznane action, ale payload ma email+password
    // - identifier zamiast email
    const normalizedAction = String(action || '').trim().toLowerCase();
    const credentialEmail = email || identifier || login || body?.user?.email || body?.username;
    const credentialPassword = password || body?.user?.password || body?.pass;
    if (
      normalizedAction === 'login' ||
      (normalizedAction !== 'register' &&
        normalizedAction !== 'update' &&
        !!credentialEmail &&
        !!credentialPassword)
    ) {
      return await performMobileLogin(credentialEmail, credentialPassword);
    }

    if (normalizedAction === 'register') {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        return NextResponse.json({ success: false, message: 'Brak adresu email' }, { status: 400 });
      }
      if (!password || String(password).length < 6) {
        return NextResponse.json({ success: false, message: 'Hasło musi mieć min. 6 znaków' }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) return NextResponse.json({ success: false, message: 'Email zajęty' }, { status: 400 });
      
      const hashedPassword = await bcrypt.hash(password, 10);

      const isPartner = String(role || '').toUpperCase() === 'PARTNER';
      const fullName = `${firstName || ''} ${lastName || ''}`.trim();

      // Partner (EstateOS™ Partner) = plan agencji w całym systemie — jak `/api/auth/register-agency`.
      // Samo `role: AGENT` nie włącza trybu Partner w UI (tam wymagane jest `planType: AGENCY`).
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          name: fullName || normalizedEmail,
          phone: phone || null,
          role: 'USER',
          planType: isPartner ? 'AGENCY' : 'NONE',
        },
        select: MOBILE_USER_SELECT,
      });

      return NextResponse.json({ success: true, user: shapeMobileUser(user) });
    }
    
    if (normalizedAction === 'update') {
      const token = extractTokenFromRequest(req);
      if (!token) {
        return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
      }
      const authUserId = parseUserIdFromAuthToken(token);
      const targetUserId = Number(userId);
      if (!authUserId) {
        return NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 });
      }
      if (!Number.isFinite(targetUserId) || targetUserId <= 0 || targetUserId !== authUserId) {
        return NextResponse.json({ success: false, message: 'Brak uprawnień do edycji tego profilu' }, { status: 403 });
      }
      const safeAvatar = String(avatar || '').trim();
      if (!safeAvatar) {
        return NextResponse.json({ success: false, message: 'Brak obrazu avatara' }, { status: 400 });
      }
      const updatedUser = await prisma.user.update({
        where: { id: targetUserId },
        data: { image: safeAvatar },
        select: MOBILE_USER_SELECT,
      });
      return NextResponse.json({ success: true, user: shapeMobileUser(updatedUser) });
    }

    return NextResponse.json({ success: false, message: 'Błędna akcja' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
