import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/observability';

export type AdminVerifyChannel = 'email' | 'phone';
export type AdminVerifyAction = 'verify' | 'unverify';

export type AdminUserVerificationSnapshot = {
  isVerified: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
};

function shapeSnapshot(user: {
  isVerified: boolean;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
}): AdminUserVerificationSnapshot {
  return {
    isVerified: user.isVerified,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
  };
}

async function notifyUserVerified(userId: number, channel: AdminVerifyChannel) {
  const label = channel === 'email' ? 'adres e-mail' : 'numer telefonu';
  await prisma.notification.create({
    data: {
      userId,
      title: 'Konto zweryfikowane',
      body: `Administrator EstateOS potwierdził Twój ${label}. Możesz korzystać z pełnych funkcji platformy.`,
      type: NotificationType.SYSTEM_ALERT,
    },
  });
}

export async function applyAdminUserVerification(params: {
  userId: number;
  channel: AdminVerifyChannel;
  action: AdminVerifyAction;
  adminId: number;
}): Promise<
  | { ok: true; verification: AdminUserVerificationSnapshot }
  | { ok: false; status: number; error: string }
> {
  const { userId, channel, action, adminId } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      isVerified: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
    },
  });

  if (!user) {
    return { ok: false, status: 404, error: 'Użytkownik nie istnieje' };
  }

  if (channel === 'email') {
    if (action === 'verify') {
      if (!String(user.email || '').trim()) {
        return { ok: false, status: 400, error: 'Użytkownik nie ma adresu e-mail.' };
      }
      if (user.isVerified && user.emailVerifiedAt) {
        return { ok: false, status: 400, error: 'E-mail jest już potwierdzony.' };
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          emailVerifiedAt: new Date(),
          emailVerifyCode: null,
          emailVerifyExpiresAt: null,
        },
        select: { isVerified: true, emailVerifiedAt: true, phoneVerifiedAt: true },
      });

      await notifyUserVerified(userId, 'email');
      logEvent('info', 'admin_user_email_verified', 'admin_users', { userId, adminId });
      return { ok: true, verification: shapeSnapshot(updated) };
    }

    if (!user.emailVerifiedAt && !user.isVerified) {
      return { ok: false, status: 400, error: 'E-mail nie jest potwierdzony.' };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: false,
        emailVerifiedAt: null,
        emailVerifyCode: null,
        emailVerifyExpiresAt: null,
      },
      select: { isVerified: true, emailVerifiedAt: true, phoneVerifiedAt: true },
    });

    logEvent('info', 'admin_user_email_unverified', 'admin_users', { userId, adminId });
    return { ok: true, verification: shapeSnapshot(updated) };
  }

  if (action === 'verify') {
    if (!String(user.phone || '').trim()) {
      return { ok: false, status: 400, error: 'Użytkownik nie ma numeru telefonu.' };
    }
    if (user.phoneVerifiedAt) {
      return { ok: false, status: 400, error: 'Telefon jest już potwierdzony.' };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerifiedAt: new Date(),
        otpCode: null,
        otpExpiry: null,
      },
      select: { isVerified: true, emailVerifiedAt: true, phoneVerifiedAt: true },
    });

    await notifyUserVerified(userId, 'phone');
    logEvent('info', 'admin_user_phone_verified', 'admin_users', { userId, adminId });
    return { ok: true, verification: shapeSnapshot(updated) };
  }

  if (!user.phoneVerifiedAt) {
    return { ok: false, status: 400, error: 'Telefon nie jest potwierdzony.' };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      phoneVerifiedAt: null,
      otpCode: null,
      otpExpiry: null,
    },
    select: { isVerified: true, emailVerifiedAt: true, phoneVerifiedAt: true },
  });

  logEvent('info', 'admin_user_phone_unverified', 'admin_users', { userId, adminId });
  return { ok: true, verification: shapeSnapshot(updated) };
}
