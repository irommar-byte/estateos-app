import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';
import { getBestUserAvatarUrl } from '@/lib/userAvatar';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { formatAgentTitle } from '@/lib/agentProfile';
import { formatMeetingWhenPl } from '@/lib/datetime/warsaw';
import { buildCalendarIcs } from '@/lib/crm/calendarLinks';

export const CLIENT_MEETING_EMAIL_INTRO =
  'Umówiliśmy się na spotkanie. Termin jest ustalony — szczegóły i listę przygotowań znajdziesz poniżej.';

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://estateos.pl').replace(/\/$/, '');
}

function capitalizePl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toLocaleUpperCase('pl-PL') + trimmed.slice(1);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeVcard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildAgentVcard(params: {
  agentName: string;
  title: string;
  agencyName: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
}): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVcard(params.agentName)}`,
    `N:${escapeVcard(params.agentName)};;;`,
    `ORG:${escapeVcard(params.agencyName)}`,
    `TITLE:${escapeVcard(params.title)}`,
  ];
  if (params.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${escapeVcard(params.email)}`);
  if (params.phone) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVcard(params.phone)}`);
  if (params.website) lines.push(`URL:${escapeVcard(params.website)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function buildAcquisitionIcs(params: {
  title: string;
  startsAt: Date;
  location?: string | null;
  description?: string | null;
}): string {
  return buildCalendarIcs({
    title: params.title,
    startsAt: params.startsAt,
    location: params.location,
    description: params.description,
    uid: `acq-${Date.now()}@estateos.pl`,
  });
}

function buildBusinessCardHtml(params: {
  clientName: string;
  agentName: string;
  title: string;
  agencyName: string;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  companyLogoUrl?: string | null;
  companyUrl?: string | null;
  portalUrl?: string | null;
  message?: string | null;
  meetingHtml?: string | null;
}) {
  const avatar = params.avatarUrl
    ? `<img src="${escapeHtml(params.avatarUrl)}" width="88" height="88" alt="" style="display:block;width:88px;height:88px;border-radius:999px;object-fit:cover;border:3px solid #10b981;" />`
    : `<div style="width:88px;height:88px;border-radius:999px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:32px;font-weight:800;line-height:88px;text-align:center;">${escapeHtml(params.agentName.charAt(0).toUpperCase())}</div>`;

  const logo = params.companyLogoUrl
    ? `<img src="${escapeHtml(params.companyLogoUrl)}" height="36" alt="" style="display:block;height:36px;max-width:160px;object-fit:contain;" />`
    : `<span style="font-size:13px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#10b981;">${escapeHtml(params.agencyName)}</span>`;

  const contactRows = [
    params.phone
      ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:88px;">Telefon</td><td style="padding:8px 0;"><a href="tel:${escapeHtml(params.phone)}" style="color:#111;font-weight:700;text-decoration:none;">${escapeHtml(params.phone)}</a></td></tr>`
      : '',
    params.email
      ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">E-mail</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(params.email)}" style="color:#111;font-weight:700;text-decoration:none;">${escapeHtml(params.email)}</a></td></tr>`
      : '',
  ].join('');

  const ctaPrimary = params.companyUrl
    ? `<a href="${escapeHtml(params.companyUrl)}" style="display:block;text-align:center;background:#111;color:#fff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Zobacz wizytówkę biura</a>`
    : '';
  const ctaPortal = params.portalUrl
    ? `<a href="${escapeHtml(params.portalUrl)}" style="display:block;text-align:center;margin-top:10px;background:#10b981;color:#052e1c;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Panel klienta</a>`
    : '';

  const note = params.message?.trim()
    ? `<p style="margin:0 0 20px;color:#374151;line-height:1.6;">${escapeHtml(params.message.trim())}</p>`
    : `<p style="margin:0 0 20px;color:#374151;line-height:1.6;">Przesyłam moją wizytówkę EstateOS™ — w razie pytań o nieruchomości jestem do dyspozycji.</p>`;

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:32px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:28px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
      <div style="background:linear-gradient(135deg,#0b1220 0%,#102a23 55%,#0f766e 100%);padding:28px 28px 36px;">
        <div style="margin-bottom:22px;">${logo}</div>
        <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.55);">Wizytówka agenta</p>
        <h1 style="margin:8px 0 0;font-size:26px;line-height:1.15;color:#fff;letter-spacing:-0.03em;">Witaj ${escapeHtml(capitalizePl(params.clientName))}</h1>
      </div>
      <div style="padding:0 28px 28px;">
        <div style="margin-top:-28px;background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:22px;box-shadow:0 12px 30px rgba(15,23,42,0.06);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width:104px;vertical-align:top;">${avatar}</td>
              <td style="vertical-align:middle;padding-left:8px;">
                <p style="margin:0;font-size:22px;font-weight:900;color:#111;letter-spacing:-0.03em;">${escapeHtml(params.agentName)}</p>
                <p style="margin:6px 0 0;font-size:13px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(params.title)}</p>
                <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">${escapeHtml(params.agencyName)}</p>
              </td>
            </tr>
          </table>
          ${note}
          ${params.meetingHtml || ''}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #f3f4f6;margin-top:4px;">
            ${contactRows}
          </table>
          <div style="margin-top:22px;">
            ${ctaPrimary}${ctaPortal}
          </div>
          <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">W załączniku znajdziesz wizytówkę vCard${params.meetingHtml ? ' oraz plik kalendarza (.ics) — dodaj spotkanie jednym kliknięciem, żeby przypomniało' : ' — możesz dodać mnie do kontaktów jednym kliknięciem'}.</p>
        </div>
        <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#9ca3af;">EstateOS™ · profesjonalna obsługa nieruchomości</p>
      </div>
    </div>
  </div>`;
}

export async function sendAgencyClientBusinessCard(params: {
  clientId: number;
  agencyUserId: number;
  customMessage?: string;
  meeting?: {
    startsAt: Date;
    location?: string | null;
    notes?: string | null;
  };
  prepLabels?: string[];
}) {
  const [client, agent] = await Promise.all([
    prisma.agencyClient.findFirst({
      where: { id: params.clientId, agencyUserId: params.agencyUserId, status: 'ACTIVE' },
    }),
    prisma.user.findUnique({
      where: { id: params.agencyUserId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        image: true,
        agencyMembership: {
          select: {
            role: true,
            agentTitle: true,
            profilePhotoUrl: true,
            company: {
              select: {
                name: true,
                slug: true,
                logoUrl: true,
                website: true,
                officePhone: true,
                officeEmail: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!client) throw new Error('Nie znaleziono klienta.');
  if (!agent) throw new Error('Nie znaleziono agenta.');
  if (!client.email?.trim()) throw new Error('Klient nie ma adresu e-mail — uzupełnij kontakt.');

  const membership = agent.agencyMembership;
  const company = membership?.company;
  const agentName = resolveSellerPersonName(agent) || agent.name || 'Twój agent';
  const agencyName = company?.name?.trim() || agent.companyName?.trim() || 'EstateOS';
  const title =
    (membership?.agentTitle ? formatAgentTitle(membership.agentTitle) : null) ||
    (membership?.role === 'ADMIN' ? 'Kierownik biura' : 'Agent nieruchomości');
  const phone = agent.phone || company?.officePhone || null;
  const email = agent.email || company?.officeEmail || null;
  const avatarRaw = membership?.profilePhotoUrl || agent.image || null;
  const avatarUrl = avatarRaw
    ? avatarRaw.startsWith('http')
      ? avatarRaw
      : `${siteBase()}${avatarRaw.startsWith('/') ? '' : '/'}${avatarRaw}`
    : getBestUserAvatarUrl(agent, siteBase());
  const logoRaw = company?.logoUrl || null;
  const companyLogoUrl = logoRaw
    ? logoRaw.startsWith('http')
      ? logoRaw
      : `${siteBase()}${logoRaw.startsWith('/') ? '' : '/'}${logoRaw}`
    : null;
  const companyUrl = company?.slug ? `${siteBase()}/firma/${company.slug}` : company?.website || null;
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : null;
  const clientName = client.firstName?.trim() || 'Kliencie';

  const meeting = params.meeting;
  const prepList = (params.prepLabels || []).filter(Boolean);
  const prepHtml = prepList.length
    ? `<div style="margin:0 0 20px;padding:16px 18px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#475569;">Proszę przygotować</p>
        <ul style="margin:10px 0 0;padding:0 0 0 18px;color:#334155;font-size:14px;line-height:1.55;">
          ${prepList.map((label) => `<li style="margin:0 0 4px;">${escapeHtml(label)}</li>`).join('')}
        </ul>
      </div>`
    : '';
  const meetingHtml = meeting
    ? `<div style="margin:0 0 20px;padding:16px 18px;border-radius:18px;background:#ecfdf5;border:1px solid #a7f3d0;">
        <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#047857;">Umówione spotkanie</p>
        <p style="margin:8px 0 0;font-size:18px;font-weight:900;color:#064e3b;">${escapeHtml(formatMeetingWhenPl(meeting.startsAt))}</p>
        ${meeting.location ? `<p style="margin:6px 0 0;color:#065f46;">${escapeHtml(meeting.location)}</p>` : ''}
        ${meeting.notes ? `<p style="margin:6px 0 0;color:#374151;">${escapeHtml(capitalizePl(meeting.notes))}</p>` : ''}
      </div>${prepHtml}`
    : prepHtml;

  const html = buildBusinessCardHtml({
    clientName,
    agentName,
    title,
    agencyName,
    phone,
    email,
    avatarUrl,
    companyLogoUrl,
    companyUrl,
    portalUrl,
    message: params.customMessage || (params.meeting ? CLIENT_MEETING_EMAIL_INTRO : undefined),
    meetingHtml,
  });

  const vcard = buildAgentVcard({
    agentName,
    title,
    agencyName,
    email,
    phone,
    website: companyUrl,
  });

  const ics = meeting
    ? buildAcquisitionIcs({
        title: `Spotkanie pozyskania · ${agencyName}`,
        startsAt: meeting.startsAt,
        location: meeting.location,
        description:
          [meeting.notes || `Spotkanie z agentem ${agentName}`, prepList.length ? `Przygotować: ${prepList.join('; ')}` : '']
            .filter(Boolean)
            .join('\\n'),
      })
    : null;

  const sent = await sendTransactionalEmail({
    to: client.email,
    subject: meeting
      ? `Spotkanie ${formatMeetingWhenPl(meeting.startsAt)} · ${agencyName}`
      : `${agentName} · wizytówka ${agencyName}`,
    html,
    attachments: [
      {
        filename: `${agentName.replace(/\s+/g, '_')}.vcf`,
        content: vcard,
        contentType: 'text/vcard; charset=utf-8',
      },
      ...(ics
        ? [
            {
              filename: 'spotkanie-pozyskanie.ics',
              content: ics,
              contentType: 'text/calendar; charset=utf-8',
            },
          ]
        : []),
    ],
  });

  if (!sent) throw new Error('Nie udało się wysłać e-maila. Sprawdź konfigurację poczty.');

  await prisma.agencyClientActivity.create({
    data: {
      clientId: client.id,
      agencyUserId: params.agencyUserId,
      kind: 'BUSINESS_CARD_SENT',
      title: 'Wysłano wizytówkę',
      body: meeting
        ? `Wizytówka i termin spotkania wysłane na ${client.email}.`
        : `Wizytówka agenta wysłana na ${client.email}.`,
      metadata: {
        email: client.email,
        companyUrl,
        portalUrl,
        meetingStartsAt: meeting?.startsAt.toISOString() || null,
        prepItems: params.prepLabels || [],
      },
    },
  });

  return {
    sent: true,
    email: client.email,
    agentName,
    agencyName,
  };
}
