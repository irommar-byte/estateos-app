import {
  buildAppleClientEmailHtml,
  escapeEmailHtml as e,
  loadAppleClientEmailIdentity,
  type AppleClientEmailCta,
} from '@/lib/email/appleClientEmail';
import { buildClientVoice, capFirst } from '@/lib/crm/clientVoice';

export type ClientEmailFact = { label: string; value: string; tone?: 'good' | 'warn' | 'bad' };

const TONE: Record<NonNullable<ClientEmailFact['tone']>, string> = {
  good: 'background:#ecfdf3;color:#047857;',
  warn: 'background:#fff7ed;color:#c2410c;',
  bad: 'background:#fef2f2;color:#b91c1c;',
};

/** Zdanie z wielkiej litery i z kropką na końcu — notatki klientów bywają pisane na szybko. */
export function tidySentence(text: string): string {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!?…]$/.test(cap) ? cap : `${cap}.`;
}

/**
 * Mail do klienta w tym samym szablonie co reszta poczty: nagłówek, powitanie z wołaczem, akapity,
 * lista punktów, karta z nieruchomością i faktami, cytat, przyciski i wizytówka agenta.
 */
export async function buildClientMessageEmailHtml(params: {
  agencyUserId: number;
  client: { id: number; firstName: string | null; salutation: string | null };
  eyebrow: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  closing?: string | null;
  property?: { title: string; address?: string | null } | null;
  facts?: ClientEmailFact[];
  quote?: { label: string; text: string } | null;
  ctas?: AppleClientEmailCta[];
}): Promise<string> {
  const identity = await loadAppleClientEmailIdentity(params.agencyUserId);
  const voice = buildClientVoice({
    clientId: params.client.id,
    firstName: params.client.firstName,
    salutation: params.client.salutation,
    agentName: identity.agentName,
  });

  const bodyHtml = params.paragraphs
    .filter(Boolean)
    .map((text) => `<p style="margin:0 0 14px;">${e(capFirst(text.trim()))}</p>`)
    .join('');
  const bulletsHtml = (params.bullets || []).length
    ? `<ul style="margin:0 0 14px;padding:0 0 0 20px;">${(params.bullets || []).map((item) => `<li style="margin:0 0 6px;">${e(item)}</li>`).join('')}</ul>`
    : '';
  const closingHtml = params.closing ? `<p style="margin:0 0 14px;">${e(params.closing)}</p>` : '';

  const factRows = (params.facts || [])
    .filter((fact) => fact.value)
    .map(
      (fact) => `<tr>
        <td style="padding:10px 0;border-top:1px solid #eef2f7;font-size:13px;color:#6b7280;vertical-align:top;">${e(fact.label)}</td>
        <td style="padding:10px 0;border-top:1px solid #eef2f7;text-align:right;vertical-align:top;">${
          fact.tone
            ? `<span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;${TONE[fact.tone]}">${e(fact.value)}</span>`
            : `<span style="font-size:14px;font-weight:800;color:#111827;">${e(fact.value)}</span>`
        }</td>
      </tr>`,
    )
    .join('');

  const property = params.property
    ? `<p style="margin:0;font-size:16px;font-weight:900;color:#111827;letter-spacing:-0.01em;">${e(params.property.title)}</p>
       ${params.property.address ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${e(params.property.address)}</p>` : ''}`
    : '';

  const quote = params.quote?.text
    ? `<div style="margin:${property || factRows ? '14px' : '0'} 0 0;padding:12px 14px;border-left:3px solid #10b981;background:#ffffff;border-radius:0 12px 12px 0;">
         <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;">${e(params.quote.label)}</p>
         <p style="margin:6px 0 0;font-size:14px;line-height:1.55;color:#1f2937;font-style:italic;">„${e(params.quote.text)}”</p>
       </div>`
    : '';

  const highlightHtml =
    property || factRows || quote
      ? `<div style="margin:6px 0 0;padding:16px 18px;border-radius:18px;background:#f8fafc;border:1px solid #e5e7eb;">
          ${property}
          ${factRows ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:${property ? '12px' : '0'};border-collapse:collapse;">${factRows}</table>` : ''}
          ${quote}
        </div>`
      : null;

  return buildAppleClientEmailHtml({
    eyebrow: params.eyebrow,
    title: params.title,
    greetingName: params.client.firstName || '',
    bodyHtml: `${bodyHtml}${bulletsHtml}${closingHtml}`,
    identity,
    ctas: params.ctas,
    highlightHtml,
    voice,
  });
}
