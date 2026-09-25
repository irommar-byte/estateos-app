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
  proposedSlots?: Date[];
  location?: string | null;
  notes?: string | null;
  reason?: string | null;
  listingAgentCopy?: boolean;
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
  const slots = (params.proposedSlots?.length ? params.proposedSlots : [params.startsAt]).filter(Boolean);
  const when = slots.map((slot) => slot.toLocaleString('pl-PL')).join(' · ');
  const noun = params.kind === 'meeting' ? 'spotkania' : 'prezentacji';
  const title =
    params.mode === 'confirmed'
      ? `Potwierdzenie ${noun}`
      : params.mode === 'changed'
        ? `Nowy termin ${noun}`
        : params.listingAgentCopy
          ? 'Prosimy o termin u agenta wystawiającego'
          : `Propozycja ${noun}`;
  const slotsHtml = slots
    .map((slot) => `<p style="font-size:18px;font-weight:800">${escapeHtml(slot.toLocaleString('pl-PL'))}</p>`)
    .join('');
  const intro = params.listingAgentCopy
    ? `${escapeHtml(agentName)} prosi Cię o wybór godziny. Pokaz uzgadniamy z agentem wystawiającym nieruchomość.`
    : `${escapeHtml(agentName)} ${params.mode === 'confirmed' ? 'potwierdza' : 'przesyła'} termin ${noun}:`;

  const ics = buildAcquisitionIcs({
    title: `${params.kind === 'meeting' ? 'Spotkanie' : 'Prezentacja'} · ${agencyName}`,
    startsAt: params.startsAt,
    location: params.location,
    description: params.notes || params.reason || `${agentName} · ${agencyName}`,
  });

  const slotButtons =
    params.mode === 'proposed' && slots.length > 0
      ? `<div style="margin:16px 0;display:flex;flex-direction:column;gap:8px">
          ${slots
            .map(
              (slot, index) =>
                `<a href="${portalUrl}" style="display:block;background:#0a0a0a;color:#fff;padding:14px 16px;border-radius:12px;text-decoration:none;font-weight:800;text-align:center">Termin ${index + 1}: ${escapeHtml(slot.toLocaleString('pl-PL'))}</a>`,
            )
            .join('')}
          <a href="${portalUrl}" style="display:block;background:#ecfdf3;color:#065f46;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:700;text-align:center">Zaproponuj inną datę</a>
        </div>`
      : `<p><a href="${portalUrl}" style="display:inline-block;background:#10b981;color:#07130e;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Otwórz panel klienta</a></p>`;

  await sendTransactionalEmail({
    to: client.email,
    subject: `${title} · ${when} · ${agencyName}`,
    html: `<div style="font-family:-apple-system,sans-serif;padding:24px;max-width:560px">
      <p style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#059669;font-weight:800">${escapeHtml(agencyName)}</p>
      <h2 style="margin:8px 0 12px">${escapeHtml(title)}</h2>
      <p>Dzień dobry ${escapeHtml(client.firstName)},</p>
      <p>${intro}</p>
      ${params.mode === 'proposed' ? '' : slotsHtml}
      ${params.location ? `<p>Miejsce: ${escapeHtml(params.location)}</p>` : ''}
      ${params.reason ? `<p>Powód: ${escapeHtml(params.reason)}</p>` : ''}
      ${slotButtons}
      <p style="font-size:12px;color:#6b7280">W panelu możesz potwierdzić termin albo zaproponować inną godzinę z podaniem powodu. Link: ${escapeHtml(portalUrl)}</p>
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

export async function emailListingAgentShowingRequest(params: {
  to: string;
  listingAgentName?: string | null;
  requestingAgencyName: string;
  requestingAgentName: string;
  requestingPhone?: string | null;
  buyerFirstName?: string | null;
  offerTitle: string;
  offerId: number;
  slots: Date[];
  notes?: string | null;
  portalUrl?: string | null;
}): Promise<void> {
  const to = String(params.to || '').trim().toLowerCase();
  if (!to.includes('@')) return;
  const when = params.slots.map((slot) => slot.toLocaleString('pl-PL')).join(' · ');
  const requester = [params.requestingAgentName, params.requestingPhone].filter(Boolean).join(' · ');
  await sendTransactionalEmail({
    to,
    subject: `Prośba o pokaz · oferta #${params.offerId} · ${params.requestingAgencyName}`,
    html: `<div style="font-family:-apple-system,sans-serif;padding:24px;max-width:560px">
      <p style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#059669;font-weight:800">${escapeHtml(params.requestingAgencyName)}</p>
      <h2 style="margin:8px 0 12px">Prośba o pokaz nieruchomości</h2>
      <p>Dzień dobry${params.listingAgentName ? `, ${escapeHtml(params.listingAgentName)}` : ''},</p>
      <p>${escapeHtml(requester || params.requestingAgentName)} prosi o pokaz oferty <strong>#${params.offerId}</strong>${params.offerTitle ? ` — ${escapeHtml(params.offerTitle)}` : ''}.</p>
      ${params.buyerFirstName ? `<p>Kupujący: ${escapeHtml(params.buyerFirstName)} (klient ${escapeHtml(params.requestingAgencyName)}).</p>` : ''}
      <p style="font-size:18px;font-weight:800">${escapeHtml(when || 'Termin do uzgodnienia')}</p>
      ${params.notes ? `<p>${escapeHtml(params.notes)}</p>` : ''}
      <p style="font-size:13px;color:#6b7280">To prośba od agenta kupującego. Odpowiedz na ten e-mail albo zadzwoń — nie tworzymy drugiego klienta w Twoim CRM.</p>
      ${params.portalUrl ? `<p><a href="${params.portalUrl}" style="color:#059669">Zobacz ofertę</a></p>` : ''}
    </div>`,
  }).catch(() => {});
}
