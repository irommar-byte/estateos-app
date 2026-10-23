import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { prisma } from '@/lib/prisma';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';
import { buildClientVoice } from '@/lib/crm/clientVoice';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstNameFrom(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || '';
}

export function buildBuyerIntakePortalWelcomeEmailHtml(params: {
  clientFirstName: string;
  agentName: string;
  agencyName: string;
  portalUrl: string;
  intelligenceStarted: boolean;
}): string {
  const voice = buildClientVoice({ firstName: firstNameFrom(params.clientFirstName), agentName: params.agentName });
  const hello = escapeHtml(voice.greeting.replace(/,$/, ''));
  const agentName = escapeHtml(params.agentName);
  const agencyName = escapeHtml(params.agencyName);
  const portalUrl = escapeHtml(params.portalUrl);
  const intro = params.intelligenceStarted
    ? 'Pierwsza propozycja czeka już w panelu.'
    : 'Pierwsze propozycje pojawią się w panelu, gdy tylko znajdę coś wartego uwagi.';

  return `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:20px;padding:32px 28px;border:1px solid rgba(0,0,0,0.06);">
        <tr><td>
          <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#10b981;">Panel wyszukiwania</p>
          <h1 style="margin:0 0 14px;font-size:26px;font-weight:800;line-height:1.2;color:#0f172a;">${hello}</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#475569;">
            Dziękuję za wypełnienie ankiety — mam wszystko, czego potrzebuję, żeby zacząć szukać. ${intro}
          </p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
            Przy każdej ofercie wystarczy kliknąć <strong>Chcę obejrzeć</strong>, <strong>Do przemyślenia</strong> albo <strong>Nie pasuje</strong>.
            Po kilku takich odpowiedziach będę dokładnie wiedzieć, czego szukać — i nie będę zawracać głowy ofertami, które nie pasują.
          </p>
          <p style="margin:0 0 18px;text-align:center;">
            <a href="${portalUrl}" style="display:inline-block;background:#10b981;color:#052e1c;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;">Otwórz panel</a>
          </p>
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Pozdrawiam serdecznie,</p>
          <p style="margin:0;font-size:16px;font-weight:800;color:#111827;">${agentName}</p>
          <p style="margin:2px 0 18px;font-size:13px;color:#6b7280;">${agencyName}</p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
            Ten link to stałe wejście do panelu — warto go zachować. Dla kupujących usługa jest bezpłatna.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

export async function sendBuyerIntakePortalWelcomeEmail(params: {
  clientEmail: string;
  clientFirstName: string;
  agentUserId: number;
  portalToken: string;
  intelligenceStarted: boolean;
}): Promise<boolean> {
  const email = params.clientEmail.trim().toLowerCase();
  if (!email) return false;

  const agent = await prisma.user.findUnique({
    where: { id: params.agentUserId },
    select: {
      name: true,
      companyName: true,
      agencyMembership: { select: { company: { select: { name: true } } } },
    },
  });

  const agentName = resolveSellerPersonName(agent) || agent?.name || 'Twój agent';
  const agencyName =
    agent?.agencyMembership?.company?.name?.trim() || agent?.companyName?.trim() || 'EstateOS';
  const portalUrl = buildPortalUrl(params.portalToken);

  return sendTransactionalEmail({
    to: email,
    subject: 'Dziękuję za ankietę — link do panelu',
    html: buildBuyerIntakePortalWelcomeEmailHtml({
      clientFirstName: params.clientFirstName,
      agentName,
      agencyName,
      portalUrl,
      intelligenceStarted: params.intelligenceStarted,
    }),
  });
}
