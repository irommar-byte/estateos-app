import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { encryptSession } from '@/lib/sessionUtils';
import { cookies } from 'next/headers';
import { PlanType, Role } from '@prisma/client';
import { buildWelcomeEmailHtml, sendTransactionalEmail } from '@/lib/email/transactional';
import {
  buildPhoneLookupVariants,
  extractPhoneFromBody,
  normalizePhoneE164,
} from '@/lib/phoneE164';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';

const normalizeEmail = (value: unknown) => String(value || '').toLowerCase().trim();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, role, companyName, firstName, lastName } = body;
    const cleanEmail = normalizeEmail(email);
    const phoneE164 = normalizePhoneE164(extractPhoneFromBody(body));
    const companyNameTrimmed =
      typeof companyName === 'string' ? companyName.trim() : String(companyName || '').trim();
    const fullNameFromParts = [String(firstName || '').trim(), String(lastName || '').trim()]
      .filter(Boolean)
      .join(' ');
    const displayName = fullNameFromParts || String(name || '').trim() || 'Użytkownik';
    const roleUpper = String(role || '').toUpperCase();
    const isPartner = roleUpper === 'PARTNER';

    if (isPartner) {
      return NextResponse.json(
        {
          success: false,
          code: 'PARTNER_WEB_ONLY',
          message:
            'Rejestracja partnera odbywa się przez onboarding na stronie — skorzystaj z sekcji Cennik / Pro.',
        },
        { status: 400 },
      );
    }

    if (!cleanEmail || !password) {
      return NextResponse.json({ success: false, message: 'Brak danych' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ success: false, message: 'Hasło musi mieć min. 6 znaków' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Ten adres e-mail jest już zarejestrowany.' }, { status: 400 });
    }

    if (phoneE164) {
      const phoneVariants = buildPhoneLookupVariants(phoneE164);
      const existingPhone = await prisma.user.findFirst({
        where: {
          OR: phoneVariants.map((variant) => ({ phone: variant })),
        },
      });
      if (existingPhone) {
        return NextResponse.json({ success: false, message: 'Ten numer telefonu jest już w użyciu.' }, { status: 400 });
      }
    }

    const hashed = await bcrypt.hash(password, 10);

    let dbRole: Role = Role.USER;
    let userPlanType: PlanType = PlanType.NONE;
    if (isPartner) {
      dbRole = Role.USER;
      userPlanType = PlanType.AGENCY;
    } else if (roleUpper === 'AGENT') {
      dbRole = Role.AGENT;
    } else if (roleUpper === 'ADMIN') {
      dbRole = Role.ADMIN;
    }

    if (dbRole === Role.AGENT && !companyNameTrimmed) {
      return NextResponse.json(
        {
          success: false,
          code: 'AGENT_COMPANY_NAME_REQUIRED',
          message: 'Dla roli AGENT wymagane jest pole companyName (nazwa biura).',
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashed,
        name: displayName,
        phone: phoneE164,
        role: dbRole,
        planType: userPlanType,
        companyName: companyNameTrimmed || null,
        buyerType: dbRole === Role.AGENT ? "agency" : undefined,
      },
      select: MOBILE_USER_SELECT,
    });

    void sendTransactionalEmail({
      to: user.email,
      subject: 'Witamy w EstateOS',
      html: buildWelcomeEmailHtml({ userName: user.name }),
    });

    const session = encryptSession({ id: user.id, email: user.email, role: user.role || 'USER' });

    (await cookies()).set('estateos_session', session, { httpOnly: true, path: '/' });

    const shapedUser = shapeMobileUser(user);

    return NextResponse.json({
      success: true,
      token: session,
      role: user.role || 'USER',
      name: user.name,
      id: user.id,
      companyName: user.companyName ?? null,
      phone: phoneE164,
      contactPhone: phoneE164,
      user: shapedUser,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('🔥 BŁĄD REJESTRACJI:', e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
