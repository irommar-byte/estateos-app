import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MOBILE_USER_SELECT, shapeMobileUser, type MobileUserCore } from '@/lib/mobileUserShape';

export const CONTACT_VERIFY_USER_SELECT = {
  id: true,
  role: true,
  email: true,
  phone: true,
  isVerified: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
} as const;

export type ContactVerificationRequirements = {
  requirePhone?: boolean;
  requireEmail?: boolean;
};

export type ContactVerificationFlags = {
  phoneVerified: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
};

export function getContactVerificationFlags(
  user: Pick<MobileUserCore, 'role' | 'isVerified' | 'emailVerifiedAt' | 'phone' | 'phoneVerifiedAt'>
): ContactVerificationFlags {
  if (String(user.role || '').toUpperCase() === 'ADMIN') {
    return { phoneVerified: true, emailVerified: true, isAdmin: true };
  }
  const shaped = shapeMobileUser(user as MobileUserCore);
  return {
    phoneVerified: Boolean(shaped.isVerifiedPhone),
    emailVerified: Boolean(shaped.isEmailVerified),
    isAdmin: false,
  };
}

export async function loadUserForContactVerification(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: CONTACT_VERIFY_USER_SELECT,
  });
}

export function assertContactVerified(
  user: Pick<MobileUserCore, 'role' | 'isVerified' | 'emailVerifiedAt' | 'phone' | 'phoneVerifiedAt'> | null,
  requirements: ContactVerificationRequirements
):
  | { ok: true; flags: ContactVerificationFlags }
  | { ok: false; errorCode: string; message: string; status: number; flags: ContactVerificationFlags } {
  if (!user) {
    return {
      ok: false,
      errorCode: 'AUTH_REQUIRED',
      message: 'Zaloguj się, aby kontynuować.',
      status: 401,
      flags: { phoneVerified: false, emailVerified: false, isAdmin: false },
    };
  }

  const flags = getContactVerificationFlags(user);
  if (flags.isAdmin) return { ok: true, flags };

  if (requirements.requirePhone && !flags.phoneVerified) {
    return {
      ok: false,
      errorCode: 'PHONE_VERIFICATION_REQUIRED',
      message: 'Potwierdź numer telefonu SMS-em w profilu, aby kontynuować.',
      status: 422,
      flags,
    };
  }

  if (requirements.requireEmail && !flags.emailVerified) {
    return {
      ok: false,
      errorCode: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Potwierdź adres e-mail kodem z wiadomości, aby kontynuować.',
      status: 422,
      flags,
    };
  }

  return { ok: true, flags };
}

export function contactVerificationJson(
  result: Extract<ReturnType<typeof assertContactVerified>, { ok: false }>
) {
  return NextResponse.json(
    {
      success: false,
      error: result.message,
      message: result.message,
      errorCode: result.errorCode,
      verification: result.flags,
    },
    { status: result.status }
  );
}

/** Publikacja ogłoszenia — jak w aplikacji mobilnej (Step6). */
export const PUBLISH_CONTACT_REQUIREMENTS: ContactVerificationRequirements = {
  requirePhone: true,
  requireEmail: true,
};

/** Negocjacje, wizyty, dealroom — jak guardPhoneVerification w OfferDetail. */
export const BUYER_CONTACT_REQUIREMENTS: ContactVerificationRequirements = {
  requirePhone: true,
  requireEmail: false,
};
