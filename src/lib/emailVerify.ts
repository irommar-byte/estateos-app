import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/observability';

const CODE_TTL_MS = 15 * 60_000;

export type EmailVerifyResult =
  | { ok: true; status?: number; data?: Record<string, unknown> }
  | { ok: false; status: number; error: string };

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST?.trim(),
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER?.trim(),
      pass: process.env.EMAIL_PASS?.trim(),
    },
  });
}

async function sendVerifyEmail(toEmail: string, code: string, userName: string | null) {
  const transporter = getTransporter();
  const greeting = userName ? `Cześć ${userName.split(/\s+/)[0]},` : 'Cześć,';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color:#0b1220;">
      <h2 style="margin:0 0 12px 0;">Potwierdzenie adresu e-mail w EstateOS</h2>
      <p>${greeting}</p>
      <p>Twój kod weryfikacyjny:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; background:#f1f5f9; padding:12px 16px; display:inline-block; border-radius:10px;">${code}</p>
      <p>Kod wygasa za 15 minut. Jeśli to nie Ty inicjowałeś weryfikację, zignoruj tę wiadomość.</p>
      <p style="color:#475569; font-size:13px;">EstateOS · estateos.pl</p>
    </div>
  `;
  await transporter.sendMail({
    from: '"EstateOS" <powiadomienia@estateos.pl>',
    to: toEmail,
    subject: 'Kod weryfikacyjny adresu e-mail',
    html,
  });
}

export async function requestEmailVerify(userId: number): Promise<EmailVerifyResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isVerified: true, emailVerifiedAt: true },
  });
  if (!user) return { ok: false, status: 404, error: 'Użytkownik nie istnieje' };
  if (!user.email) return { ok: false, status: 400, error: 'Brak adresu e-mail do weryfikacji' };

  if (user.isVerified || user.emailVerifiedAt) {
    return { ok: false, status: 400, error: 'E-mail już potwierdzony' };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifyCode: code, emailVerifyExpiresAt: expiresAt },
  });

  try {
    await sendVerifyEmail(user.email, code, user.name);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logEvent('error', 'email_verify_send_failed', 'mobile_email_verify', { userId, message: msg });
    return { ok: false, status: 502, error: 'Nie udało się wysłać kodu — spróbuj ponownie' };
  }

  logEvent('info', 'email_verify_requested', 'mobile_email_verify', { userId });
  return { ok: true, status: 200, data: { success: true } };
}

export async function confirmEmailVerify(
  userId: number,
  rawCode: unknown
): Promise<EmailVerifyResult> {
  const code = String(rawCode ?? '').trim();
  if (!code) return { ok: false, status: 400, error: 'Nieprawidłowy kod' };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isVerified: true,
      emailVerifiedAt: true,
      emailVerifyCode: true,
      emailVerifyExpiresAt: true,
    },
  });
  if (!user) return { ok: false, status: 404, error: 'Użytkownik nie istnieje' };

  if (user.isVerified || user.emailVerifiedAt) {
    return { ok: false, status: 400, error: 'E-mail już potwierdzony' };
  }

  if (!user.emailVerifyCode || !user.emailVerifyExpiresAt) {
    return { ok: false, status: 404, error: 'Brak aktywnej prośby o weryfikację' };
  }
  if (user.emailVerifyExpiresAt.getTime() < Date.now()) {
    return { ok: false, status: 400, error: 'Kod wygasł' };
  }
  if (user.emailVerifyCode !== code) {
    return { ok: false, status: 400, error: 'Nieprawidłowy kod' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isVerified: true,
      emailVerifiedAt: new Date(),
      emailVerifyCode: null,
      emailVerifyExpiresAt: null,
    },
  });

  logEvent('info', 'email_verify_confirmed', 'mobile_email_verify', { userId });
  return { ok: true, status: 200 };
}
