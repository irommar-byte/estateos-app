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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractFirstName(userName?: string | null): string {
  return String(userName || '').trim().split(/\s+/)[0] || 'Użytkowniku';
}

function emailLogoMarkHtml(size = 56): string {
  const logoUrl = appUrl('/apple-touch-icon.png');
  return `<img src="${logoUrl}" width="${size}" height="${size}" alt="EstateOS" style="display:block;width:${size}px;height:${size}px;border:0;border-radius:${Math.round(size * 0.24)}px;" />`;
}

function emailBrandWordmarkHtml(fontSize = 15): string {
  return `<span style="font-size:${fontSize}px;font-weight:800;letter-spacing:-0.04em;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"><span style="color:#10b981;">E</span>state<span style="color:#10b981;">OS</span></span>`;
}

function emailPrimaryButtonHtml(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0 0;">
      <tr>
        <td align="center" style="border-radius:12px;background:#0071e3;">
          <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:12px;">${label}</a>
        </td>
      </tr>
    </table>
  `;
}

function emailFooterHtml(): string {
  const siteUrl = appUrl('/');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
      <tr>
        <td align="center" style="padding:0 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                ${emailLogoMarkHtml(28)}
              </td>
              <td style="vertical-align:middle;">
                ${emailBrandWordmarkHtml(13)}
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.5;color:#86868b;text-align:center;">
            <a href="${siteUrl}" style="color:#86868b;text-decoration:none;">estateos.pl</a>
            · Nieruchomości, negocjacje i prezentacje w jednym miejscu.
          </p>
        </td>
      </tr>
    </table>
  `;
}

function wrapTransactionalEmail(bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>EstateOS</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f7;">
    <tr>
      <td align="center" style="padding:40px 20px 48px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              ${emailLogoMarkHtml(56)}
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:20px;padding:40px 36px 32px 36px;box-shadow:0 2px 16px rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.04);">
              ${bodyHtml}
              ${emailFooterHtml()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function buildWelcomeEmailSubject(params: { userName?: string | null }): string {
  const firstName = extractFirstName(params.userName);
  return firstName === 'Użytkowniku' ? 'Witamy w EstateOS' : `Witamy w EstateOS, ${firstName}`;
}

export function buildWelcomeEmailHtml(params: { userName?: string | null }) {
  const firstName = escapeHtml(extractFirstName(params.userName));
  const panelUrl = appUrl('/moje-konto/crm');

  const body = `
    <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:#86868b;">
      Witamy w EstateOS
    </p>
    <h1 style="margin:0 0 18px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:34px;font-weight:700;line-height:1.12;letter-spacing:-0.03em;color:#1d1d1f;">
      Cześć, ${firstName}.
    </h1>
    <p style="margin:0 0 14px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;line-height:1.55;letter-spacing:-0.01em;color:#424245;">
      Twoje konto jest gotowe. Od teraz możesz dodawać oferty, prowadzić negocjacje i planować prezentacje nieruchomości — w aplikacji mobilnej i na stronie.
    </p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;line-height:1.55;letter-spacing:-0.01em;color:#424245;">
      Wszystko, co robisz w jednym miejscu, synchronizuje się między mobile a web, żebyś mógł wracać do spraw w dowolnym momencie.
    </p>
    ${emailPrimaryButtonHtml(panelUrl, 'Otwórz panel')}
  `;

  return wrapTransactionalEmail(body);
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
  const firstName = escapeHtml(extractFirstName(params.recipientName));
  const offerTitle = escapeHtml(String(params.offerTitle || 'oferta').trim());
  const partner = escapeHtml(String(params.otherPartyName || 'druga strona').trim());
  const statusLabel = escapeHtml(String(params.statusLabel || '').trim());
  const when = params.proposedDate ? new Date(params.proposedDate).toLocaleString('pl-PL') : '—';
  const safeNote = escapeHtml(String(params.note || '').trim());
  const dealUrl = appUrl(`/moje-konto/crm?tab=transakcje&dealId=${params.dealId}`);

  const body = `
    <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:#86868b;">
      Prezentacja nieruchomości
    </p>
    <h1 style="margin:0 0 18px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:28px;font-weight:700;line-height:1.15;letter-spacing:-0.03em;color:#1d1d1f;">
      Aktualizacja spotkania
    </h1>
    <p style="margin:0 0 18px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;line-height:1.55;color:#424245;">
      Cześć ${firstName}, status Twojej prezentacji został zaktualizowany.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px 0;background:#f5f5f7;border-radius:14px;border:1px solid rgba(0,0,0,0.04);">
      <tr>
        <td style="padding:18px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d1d1f;">
          <p style="margin:0 0 8px 0;"><span style="color:#86868b;">Status</span><br /><strong>${statusLabel}</strong></p>
          <p style="margin:0 0 8px 0;"><span style="color:#86868b;">Oferta</span><br /><strong>${offerTitle}</strong></p>
          <p style="margin:0 0 8px 0;"><span style="color:#86868b;">Druga strona</span><br /><strong>${partner}</strong></p>
          <p style="margin:0;"><span style="color:#86868b;">Termin</span><br /><strong>${when}</strong></p>
          ${safeNote ? `<p style="margin:12px 0 0 0;padding-top:12px;border-top:1px solid rgba(0,0,0,0.06);"><span style="color:#86868b;">Notatka</span><br /><strong>${safeNote}</strong></p>` : ''}
        </td>
      </tr>
    </table>
    ${emailPrimaryButtonHtml(dealUrl, 'Otwórz negocjacje')}
  `;

  return wrapTransactionalEmail(body);
}
