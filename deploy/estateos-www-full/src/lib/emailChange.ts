import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/observability';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 15 * 60_000;

export type EmailChangeResult =
  | { ok: true; status?: number; data?: Record<string, unknown> }
  | { ok: false; status: number; error: string };

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

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

async function sendVerificationEmail(toEmail: string, code: string, userName: string | null) {
  const transporter = getTransporter();
  const greeting = userName ? `Cześć ${userName.split(/\s+/)[0]},` : 'Cześć,';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color:#0b1220;">
      <h2 style="margin:0 0 12px 0;">Zmiana adresu e-mail w EstateOS</h2>
      <p>${greeting}</p>
      <p>Twój kod weryfikacyjny do zmiany adresu e-mail:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; background:#f1f5f9; padding:12px 16px; display:inline-block; border-radius:10px;">${code}</p>
      <p>Kod wygasa za 15 minut. Jeśli to nie Ty inicjowałeś zmianę, zignoruj tę wiadomość.</p>
      <p style="color:#475569; font-size:13px;">EstateOS · estateos.pl</p>
    </div>
  `;
  await transporter.sendMail({
    from: '"EstateOS" <powiadomienia@estateos.pl>',
    to: toEmail,
    subject: 'Kod weryfikacyjny zmiany e-maila',
    html,
  });
}

export async function requestEmailChange(userId: number, rawNewEmail: unknown): Promise<EmailChangeResult> {
  const newEmail = normalizeEmail(rawNewEmail);
  if (!newEmail || !EMAIL_RE.test(newEmail) || newEmail.length > 191) {
    return { ok: false, status: 400, error: 'Nieprawidłowy adres e-mail' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return { ok: false, status: 404, error: 'Użytkownik nie istnieje' };

  if (newEmail === String(user.email || '').toLowerCase()) {
    return { ok: false, status: 400, error: 'Nowy adres jest taki sam jak obecny' };
  }

  const existing = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (existing && existing.id !== userId) {
    return { ok: false, status: 409, error: 'Adres jest już używany' };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail: newEmail,
      pendingEmailCode: code,
      pendingEmailExpiresAt: expiresAt,
    },
  });

  try {
    await sendVerificationEmail(newEmail, code, user.name);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logEvent('error', 'email_change_send_failed', 'mobile_email_change', {
      userId,
      message: msg,
    });
    return { ok: false, status: 502, error: 'Nie udało się wysłać kodu — spróbuj ponownie' };
  }

  logEvent('info', 'email_change_requested', 'mobile_email_change', { userId });
  return { ok: true, status: 200, data: { success: true } };
}

export async function confirmEmailChange(
  userId: number,
  rawNewEmail: unknown,
  rawCode: unknown
): Promise<EmailChangeResult> {
  const newEmail = normalizeEmail(rawNewEmail);
  const code = String(rawCode ?? '').trim();

  if (!code) return { ok: false, status: 400, error: 'Nieprawidłowy kod' };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      pendingEmail: true,
      pendingEmailCode: true,
      pendingEmailExpiresAt: true,
    },
  });
  if (!user) return { ok: false, status: 404, error: 'Użytkownik nie istnieje' };

  if (!user.pendingEmail || !user.pendingEmailCode || !user.pendingEmailExpiresAt) {
    return { ok: false, status: 404, error: 'Brak aktywnej prośby o zmianę e-maila' };
  }

  if (newEmail && newEmail !== String(user.pendingEmail).toLowerCase()) {
    return { ok: false, status: 400, error: 'Adres e-mail nie zgadza się z aktywną prośbą' };
  }

  if (user.pendingEmailExpiresAt.getTime() < Date.now()) {
    return { ok: false, status: 400, error: 'Kod wygasł' };
  }

  if (user.pendingEmailCode !== code) {
    return { ok: false, status: 400, error: 'Nieprawidłowy kod' };
  }

  // Race-condition check
  const conflict = await prisma.user.findUnique({
    where: { email: user.pendingEmail },
    select: { id: true },
  });
  if (conflict && conflict.id !== userId) {
    return { ok: false, status: 409, error: 'Adres jest już używany' };
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: user.pendingEmail,
      isVerified: true,
      emailVerifiedAt: now,
      pendingEmail: null,
      pendingEmailCode: null,
      pendingEmailExpiresAt: null,
    },
  });

  logEvent('info', 'email_change_confirmed', 'mobile_email_change', { userId });
  return { ok: true, status: 200 };
}
