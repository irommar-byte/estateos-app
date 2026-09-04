import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildAcquisitionIcs } from '@/lib/agencyClientBusinessCard';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { sendClientPortalWebPush } from '@/lib/crm/clientPortalWebPush';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function emailClientSchedule(params: {
  clientId: number;
  kind: 'meeting' | 'presentation';
  mode: 'proposed' | 'confirmed' | 'changed';
  startsAt: Date;
  location?: string | null;
  notes?: string | null;
  reason?: string | null;
}): Promise<void> {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, status: 'ACTIVE' },
    select: {
      firstName: true,
      email: true,
      portalToken: true,
      agencyUser: { select: { name: true, companyName: true } },
    },
  });
  if (!client?.email) return;

  const agencyName = client.agencyUser.companyName || 'EstateOS';
  const agentName = client.agencyUser.name || 'Twój agent';
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : 'https://estateos.pl';
  const when = params.startsAt.toLocaleString('pl-PL');
  const noun = params.kind === 'meeting' ? 'spotkania' : 'prezentacji';
  const title =
    params.mode === 'confirmed'
      ? `Potwierdzenie ${noun}`
      : params.mode === 'changed'
        ? `Nowy termin ${noun}`
        : `Propozycja ${noun}`;

  const ics = buildAcquisitionIcs({
    title: `${params.kind === 'meeting' ? 'Spotkanie' : 'Prezentacja'} · ${agencyName}`,
    startsAt: params.startsAt,
    location: params.location,
    description: params.notes || params.reason || `${agentName} · ${agencyName}`,
  });

  await sendTransactionalEmail({
    to: client.email,
    subject: `${title} · ${when} · ${agencyName}`,
    html: `<div style="font-family:-apple-system,sans-serif;padding:24px;max-width:560px">
      <p style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#059669;font-weight:800">${escapeHtml(agencyName)}</p>
      <h2 style="margin:8px 0 12px">${escapeHtml(title)}</h2>
      <p>Dzień dobry ${escapeHtml(client.firstName)},</p>
      <p>${escapeHtml(agentName)} ${params.mode === 'confirmed' ? 'potwierdza' : 'przesyła'} termin ${noun}:</p>
      <p style="font-size:18px;font-weight:800">${escapeHtml(when)}</p>
      ${params.location ? `<p>Miejsce: ${escapeHtml(params.location)}</p>` : ''}
      ${params.reason ? `<p>Powód: ${escapeHtml(params.reason)}</p>` : ''}
      <p><a href="${portalUrl}" style="display:inline-block;background:#10b981;color:#07130e;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Otwórz panel klienta</a></p>
      <p style="font-size:12px;color:#6b7280">W panelu możesz potwierdzić termin albo zaproponować inną godzinę z podaniem powodu.</p>
    </div>`,
    attachments: [
      {
        filename: `${params.kind}.ics`,
        content: ics,
        contentType: 'text/calendar; charset=utf-8',
      },
    ],
  }).catch(() => {});

  await sendClientPortalWebPush(params.clientId, {
    title,
    body: `${when}${params.location ? ` · ${params.location}` : ''}`.slice(0, 180),
    tag: `schedule-${params.kind}-${params.clientId}`,
    notificationType: 'client_schedule',
    native: true,
  }).catch(() => {});
}

export async function emailGuestAgencyPresentation(params: {
  to: string;
  visitingAgencyName: string;
  visitorName?: string | null;
  visitorPhone?: string | null;
  hostAgencyName: string;
  agentName: string;
  offerTitle: string;
  offerId: number;
  startsAt: Date;
  location?: string | null;
  notes?: string | null;
  portalUrl?: string | null;
}): Promise<void> {
  const to = String(params.to || '').trim().toLowerCase();
  if (!to.includes('@')) return;
  const when = params.startsAt.toLocaleString('pl-PL');
  const visitor = [params.visitorName, params.visitorPhone].filter(Boolean).join(' · ');
  await sendTransactionalEmail({
    to,
    subject: `Propozycja prezentacji · oferta #${params.offerId} · ${params.hostAgencyName}`,
    html: `<div style="font-family:Georgia,'Times New Roman',serif;padding:28px;max-width:560px;background:#f7f3ec;color:#1c1915">
      <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8a6a32;font-weight:700">${escapeHtml(params.hostAgencyName)}</p>
      <h2 style="margin:10px 0 16px;font-weight:500">Propozycja prezentacji</h2>
      <p>Dzień dobry${params.visitingAgencyName ? `, ${escapeHtml(params.visitingAgencyName)}` : ''},</p>
      <p>${escapeHtml(params.agentName)} proponuje termin pokazu nieruchomości <strong>#${params.offerId}</strong>${params.offerTitle ? ` — ${escapeHtml(params.offerTitle)}` : ''}.</p>
      <p style="font-size:22px;font-weight:500;margin:18px 0">${escapeHtml(when)}</p>
      ${params.location ? `<p>Miejsce: ${escapeHtml(params.location)}</p>` : ''}
      ${visitor ? `<p>Gość: ${escapeHtml(visitor)}</p>` : ''}
      ${params.notes ? `<p>${escapeHtml(params.notes)}</p>` : ''}
      <p style="font-size:13px;color:#6b6258">Właściciel dostał tę samą propozycję do akceptacji w panelu klienta.</p>
      ${params.portalUrl ? `<p><a href="${params.portalUrl}" style="color:#8a6a32">Szczegóły oferty</a></p>` : ''}
    </div>`,
  }).catch(() => {});
}
