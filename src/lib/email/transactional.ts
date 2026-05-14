import nodemailer from 'nodemailer';

type EmailParams = {
  to: string;
  subject: string;
  html: string;
};

function asBoolEnv(value: string | undefined, defaultValue: boolean) {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function isEmailDeliveryEnabled(): boolean {
  const enabledByFlag = asBoolEnv(process.env.EMAIL_ENABLED, true);
  if (!enabledByFlag) return false;

  const host = process.env.EMAIL_HOST?.trim();
  const user = process.env.EMAIL_USER?.trim();
  const pass =
    process.env.EMAIL_PASS?.trim() ||
    process.env.EMAIL_PASSWORD?.trim() ||
    process.env.SMTP_PASS?.trim();
  return Boolean(host && user && pass);
}

function getTransport() {
  const host = process.env.EMAIL_HOST?.trim();
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USER?.trim();
  const pass =
    process.env.EMAIL_PASS?.trim() ||
    process.env.EMAIL_PASSWORD?.trim() ||
    process.env.SMTP_PASS?.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendTransactionalEmail(params: EmailParams): Promise<boolean> {
  if (!isEmailDeliveryEnabled()) return false;
  try {
    const fromAddress = process.env.EMAIL_FROM?.trim() || '"EstateOS" <powiadomienia@estateos.pl>';
    await getTransport().sendMail({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('[EMAIL SEND FAILED]', error);
    return false;
  }
}

function appUrl(path: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://estateos.pl'
  ).replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function buildWelcomeEmailHtml(params: { userName?: string | null }) {
  const firstName = String(params.userName || '').trim().split(/\s+/)[0] || 'Użytkowniku';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="padding:20px 24px;background:#0f172a;color:#ffffff">
        <strong style="font-size:16px;letter-spacing:0.08em;text-transform:uppercase">EstateOS</strong>
      </div>
      <div style="padding:24px">
        <h1 style="margin:0 0 14px 0;font-size:22px">Witamy w EstateOS, ${firstName}!</h1>
        <p style="margin:0 0 12px 0;line-height:1.6;color:#334155">Twoje konto jest gotowe. Możesz od razu dodawać oferty, prowadzić negocjacje i zarządzać prezentacjami.</p>
        <p style="margin:0 0 20px 0;line-height:1.6;color:#334155">Zadbaliśmy o spójność doświadczenia web + mobile, żeby wszystkie kluczowe akcje były dostępne w obu kanałach.</p>
        <a href="${appUrl('/moje-konto/crm')}" style="display:inline-block;padding:12px 18px;background:#10b981;color:#022c22;text-decoration:none;font-weight:700;border-radius:999px">Przejdź do panelu</a>
        <p style="margin:18px 0 0 0;font-size:12px;color:#64748b">[LOGO_PLACEHOLDER] EstateOS</p>
      </div>
    </div>
  `;
}

export function buildAppointmentUpdateEmailHtml(params: {
  recipientName?: string | null;
  offerTitle?: string | null;
  otherPartyName?: string | null;
  proposedDate?: Date | string | null;
  statusLabel: string;
  note?: string | null;
  dealId: number;
}) {
  const firstName = String(params.recipientName || '').trim().split(/\s+/)[0] || 'Użytkowniku';
  const offerTitle = String(params.offerTitle || 'oferta').trim();
  const partner = String(params.otherPartyName || 'druga strona').trim();
  const when = params.proposedDate ? new Date(params.proposedDate).toLocaleString('pl-PL') : '—';
  const safeNote = String(params.note || '').trim();

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="padding:20px 24px;background:#0f172a;color:#ffffff">
        <strong style="font-size:16px;letter-spacing:0.08em;text-transform:uppercase">EstateOS</strong>
      </div>
      <div style="padding:24px">
        <h2 style="margin:0 0 14px 0;font-size:22px">Aktualizacja prezentacji nieruchomości</h2>
        <p style="margin:0 0 10px 0;color:#334155;line-height:1.6">Cześć ${firstName}, status spotkania został zaktualizowany.</p>
        <div style="margin:14px 0;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc">
          <p style="margin:0 0 6px 0"><strong>Status:</strong> ${params.statusLabel}</p>
          <p style="margin:0 0 6px 0"><strong>Oferta:</strong> ${offerTitle}</p>
          <p style="margin:0 0 6px 0"><strong>Druga strona:</strong> ${partner}</p>
          <p style="margin:0"><strong>Termin:</strong> ${when}</p>
          ${safeNote ? `<p style="margin:8px 0 0 0"><strong>Notatka:</strong> ${safeNote}</p>` : ''}
        </div>
        <a href="${appUrl(`/moje-konto/crm?tab=transakcje&dealId=${params.dealId}`)}" style="display:inline-block;padding:12px 18px;background:#10b981;color:#022c22;text-decoration:none;font-weight:700;border-radius:999px">Otwórz negocjacje</a>
        <p style="margin:18px 0 0 0;font-size:12px;color:#64748b">[LOGO_PLACEHOLDER] EstateOS</p>
      </div>
    </div>
  `;
}
