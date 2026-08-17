import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildAcquisitionIcs } from '@/lib/agencyClientBusinessCard';
import { buildPortalUrl } from '@/lib/agencyClientNotify';

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
}
