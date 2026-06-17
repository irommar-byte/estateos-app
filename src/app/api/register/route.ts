import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { encryptSession } from '@/lib/sessionUtils';
import { cookies } from 'next/headers';
import { PlanType, Role } from '@prisma/client';
import { buildWelcomeEmailHtml, buildWelcomeEmailSubject, sendTransactionalEmail } from '@/lib/email/transactional';
import {
  buildPhoneLookupVariants,
  extractPhoneFromBody,
  normalizePhoneE164,
} from '@/lib/phoneE164';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';
import { uniqueCompanySlug } from '@/lib/agencyCompany';

const normalizeEmail = (value: unknown) => String(value || '').toLowerCase().trim();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      name,
      role,
      companyName,
      firstName,
      lastName,
      companyAddress,
      companyWebsite,
      companyLogoUrl,
      officePhone,
      officeEmail,
      agencyMode,
      joinCompanyId,
    } = body;
    const cleanEmail = normalizeEmail(email);
    const phoneE164 = normalizePhoneE164(extractPhoneFromBody(body));
    const companyNameTrimmed =
      typeof companyName === 'string' ? companyName.trim() : String(companyName || '').trim();
    const companyAddressTrimmed =
      typeof companyAddress === 'string' ? companyAddress.trim() : String(companyAddress || '').trim();
    const companyWebsiteTrimmed =
      typeof companyWebsite === 'string' ? companyWebsite.trim() : String(companyWebsite || '').trim();
    const companyLogoUrlTrimmed =
      typeof companyLogoUrl === 'string' ? companyLogoUrl.trim() : String(companyLogoUrl || '').trim();
    const officePhoneTrimmed =
      typeof officePhone === 'string' ? officePhone.trim() : String(officePhone || '').trim();
    const officeEmailTrimmed = normalizeEmail(officeEmail);
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

    const agencyModeNorm = String(agencyMode || 'create').toLowerCase();
    const joinCompanyIdNum = Number(joinCompanyId);
    const isJoinAgency = dbRole === Role.AGENT && agencyModeNorm === 'join';

    if (dbRole === Role.AGENT && !isJoinAgency && !companyNameTrimmed) {
      return NextResponse.json(
        {
          success: false,
          code: 'AGENT_COMPANY_NAME_REQUIRED',
          message: 'Dla roli AGENT wymagane jest pole companyName (nazwa biura).',
        },
        { status: 400 }
      );
    }
    if (isJoinAgency && !Number.isFinite(joinCompanyIdNum)) {
      return NextResponse.json(
        { success: false, message: 'Wybierz istniejącą agencję, do której chcesz dołączyć.' },
        { status: 400 },
      );
    }
    if (dbRole === Role.AGENT && officeEmailTrimmed && !officeEmailTrimmed.includes('@')) {
      return NextResponse.json({ success: false, message: 'E-mail biura ma nieprawidłowy format.' }, { status: 400 });
    }
    if (dbRole === Role.AGENT && companyWebsiteTrimmed && !/^https?:\/\//i.test(companyWebsiteTrimmed)) {
      return NextResponse.json(
        { success: false, message: 'Strona www agencji musi zaczynać się od http:// lub https://.' },
        { status: 400 },
      );
    }

    let joinCompany: {
      id: number;
      name: string;
      address: string | null;
      website: string | null;
      logoUrl: string | null;
      officePhone: string | null;
      officeEmail: string | null;
    } | null = null;
    if (isJoinAgency) {
      joinCompany = await prisma.agencyCompany.findUnique({
        where: { id: joinCompanyIdNum },
        select: {
          id: true,
          name: true,
          address: true,
          website: true,
          logoUrl: true,
          officePhone: true,
          officeEmail: true,
        },
      });
      if (!joinCompany) {
        return NextResponse.json({ success: false, message: 'Wybrana agencja nie istnieje.' }, { status: 400 });
      }
    }

    const resolvedCompanyName = isJoinAgency ? joinCompany!.name : companyNameTrimmed;
    const resolvedCompanyAddress = isJoinAgency ? joinCompany!.address : companyAddressTrimmed || null;
    const resolvedCompanyWebsite = isJoinAgency ? joinCompany!.website : companyWebsiteTrimmed || null;
    const resolvedCompanyLogo = isJoinAgency ? joinCompany!.logoUrl : companyLogoUrlTrimmed || null;
    const resolvedOfficePhone = isJoinAgency ? joinCompany!.officePhone : officePhoneTrimmed || null;
    const resolvedOfficeEmail = isJoinAgency ? joinCompany!.officeEmail : officeEmailTrimmed || null;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: cleanEmail,
          password: hashed,
          name: displayName,
          phone: phoneE164,
          role: dbRole,
          planType: userPlanType,
          companyName: resolvedCompanyName || null,
        },
        select: MOBILE_USER_SELECT,
      });

      if (dbRole === Role.AGENT && !isJoinAgency) {
        const slug = await uniqueCompanySlug(companyNameTrimmed);
        const company = await tx.agencyCompany.create({
          data: {
            name: companyNameTrimmed,
            slug,
            address: companyAddressTrimmed || null,
            website: companyWebsiteTrimmed || null,
            logoUrl: companyLogoUrlTrimmed || null,
            officePhone: officePhoneTrimmed || null,
            officeEmail: officeEmailTrimmed || null,
            ownerUserId: created.id,
          },
        });
        await tx.agencyCompanyMember.create({
          data: {
            companyId: company.id,
            userId: created.id,
            role: 'ADMIN',
            status: 'ACTIVE',
            approvedAt: new Date(),
            approvedById: created.id,
          },
        });
      } else if (dbRole === Role.AGENT && isJoinAgency && joinCompany) {
        await tx.agencyCompanyMember.create({
          data: {
            companyId: joinCompany.id,
            userId: created.id,
            role: 'AGENT',
            status: 'PENDING',
          },
        });
      }

      return created;
    });

    void sendTransactionalEmail({
      to: user.email,
      subject: buildWelcomeEmailSubject({ userName: user.name }),
      html: buildWelcomeEmailHtml({ userName: user.name }),
    });

    const session = encryptSession({ id: user.id, email: user.email, role: user.role || 'USER' });

    (await cookies()).set('estateos_session', session, { httpOnly: true, path: '/' });

    const shapedUser = shapeMobileUser(user);

    const membership = dbRole === Role.AGENT
      ? await prisma.agencyCompanyMember.findUnique({
          where: { userId: user.id },
          select: { status: true, role: true },
        })
      : null;

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
      agencyMembership: membership
        ? { status: membership.status, role: membership.role, pendingApproval: membership.status === 'PENDING' }
        : null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('🔥 BŁĄD REJESTRACJI:', e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
