import { prisma } from '@/lib/prisma';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';
import { getBestUserAvatarUrl } from '@/lib/userAvatar';
import { formatAgentTitle } from '@/lib/agentProfile';

export function escapeEmailHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://estateos.pl'
  ).replace(/\/+$/, '');
}

export function estateOsEmailLogoUrl(): string {
  return `${siteBase()}/brand/estateos-logo-dark.jpg`;
}

function absolutize(url: string | null | undefined): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${siteBase()}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

export type AppleClientEmailIdentity = {
  agentName: string;
  agentTitle: string;
  agencyName: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  companyLogoUrl: string | null;
  companyUrl: string | null;
};

export async function loadAppleClientEmailIdentity(
  agencyUserId: number,
): Promise<AppleClientEmailIdentity> {
  const agent = await prisma.user.findUnique({
    where: { id: agencyUserId },
    select: {
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
              logoUrl: true,
              website: true,
              slug: true,
              officePhone: true,
              officeEmail: true,
            },
          },
        },
      },
    },
  });

  const membership = agent?.agencyMembership;
  const company = membership?.company;
  const agencyName = company?.name?.trim() || agent?.companyName?.trim() || 'EstateOS';
  const agentName = resolveSellerPersonName(agent) || agent?.name || 'Twój agent';
  const title =
    (membership?.agentTitle ? formatAgentTitle(membership.agentTitle) : null) ||
    (membership?.role === 'ADMIN' ? 'Kierownik biura' : 'Agent nieruchomości');
  const avatarRaw = membership?.profilePhotoUrl || agent?.image || null;
  const avatarUrl = avatarRaw
    ? absolutize(avatarRaw) || getBestUserAvatarUrl(agent, siteBase())
    : getBestUserAvatarUrl(agent, siteBase());

  return {
    agentName,
    agentTitle: title,
    agencyName,
    phone: agent?.phone || company?.officePhone || null,
    email: agent?.email || company?.officeEmail || null,
    avatarUrl: avatarUrl || null,
    companyLogoUrl: absolutize(company?.logoUrl),
    companyUrl: company?.slug
      ? `${siteBase()}/firma/${company.slug}`
      : company?.website || null,
  };
}

export type AppleClientEmailCta = {
  label: string;
  href: string;
  variant?: 'primary' | 'dark' | 'soft';
};

export function buildAppleClientEmailHtml(params: {
  eyebrow: string;
  title: string;
  greetingName: string;
  bodyHtml: string;
  identity: AppleClientEmailIdentity;
  ctas?: AppleClientEmailCta[];
  highlightHtml?: string | null;
  footerNote?: string | null;
  includeAgentCard?: boolean;
}): string {
  const e = escapeEmailHtml;
  const identity = params.identity;
  const logoUrl = identity.companyLogoUrl || estateOsEmailLogoUrl();
  const logo = `<img src="${e(logoUrl)}" height="28" alt="${e(identity.agencyName)}" style="display:block;height:28px;max-width:180px;object-fit:contain;" />`;

  const avatar = identity.avatarUrl
    ? `<img src="${e(identity.avatarUrl)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:999px;object-fit:cover;border:2px solid #10b981;" />`
    : `<div style="width:64px;height:64px;border-radius:999px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:24px;font-weight:800;line-height:64px;text-align:center;">${e(identity.agentName.charAt(0).toUpperCase())}</div>`;

  const contactBits = [
    identity.phone
      ? `<a href="tel:${e(identity.phone)}" style="color:#111827;font-weight:700;text-decoration:none;">${e(identity.phone)}</a>`
      : '',
    identity.email
      ? `<a href="mailto:${e(identity.email)}" style="color:#111827;font-weight:700;text-decoration:none;">${e(identity.email)}</a>`
      : '',
  ].filter(Boolean);

  const ctaHtml = (params.ctas || [])
    .map((cta, index) => {
      const variant = cta.variant || (index === 0 ? 'primary' : 'dark');
      const style =
        variant === 'primary'
          ? 'background:#10b981;color:#052e1c;'
          : variant === 'soft'
            ? 'background:#ecfdf3;color:#065f46;'
            : 'background:#0a0a0a;color:#ffffff;';
      const margin = index === 0 ? '0' : '10px 0 0';
      return `<a href="${e(cta.href)}" style="display:block;text-align:center;margin:${margin};${style}text-decoration:none;padding:14px 18px;border-radius:999px;font-weight:800;font-size:13px;letter-spacing:0.04em;">${e(cta.label)}</a>`;
    })
    .join('');

  const agentCard =
    params.includeAgentCard === false
      ? ''
      : `<div style="margin:26px 0 0;padding:18px;border-radius:20px;background:#f8fafc;border:1px solid #e5e7eb;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width:76px;vertical-align:top;">${avatar}</td>
              <td style="vertical-align:middle;padding-left:4px;">
                <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;">Twój agent</p>
                <p style="margin:6px 0 0;font-size:18px;font-weight:900;color:#111827;letter-spacing:-0.02em;">${e(identity.agentName)}</p>
                <p style="margin:4px 0 0;font-size:12px;font-weight:700;color:#059669;letter-spacing:0.08em;text-transform:uppercase;">${e(identity.agentTitle)}</p>
                <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${e(identity.agencyName)}</p>
                ${
                  contactBits.length
                    ? `<p style="margin:10px 0 0;font-size:13px;color:#6b7280;">${contactBits.join(' · ')}</p>`
                    : ''
                }
              </td>
            </tr>
          </table>
        </div>`;

  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f5f7;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:32px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
      <div style="background:linear-gradient(135deg,#0b1220 0%,#102a23 55%,#0f766e 100%);padding:28px 28px 34px;">
        <div style="margin-bottom:18px;">${logo}</div>
        <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.55);">${e(params.eyebrow)}</p>
        <h1 style="margin:8px 0 0;font-size:26px;line-height:1.15;color:#ffffff;letter-spacing:-0.03em;">${e(params.title)}</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#374151;">Dzień dobry ${e(params.greetingName)},</p>
        <div style="font-size:15px;line-height:1.65;color:#374151;">${params.bodyHtml}</div>
        ${params.highlightHtml || ''}
        ${ctaHtml ? `<div style="margin:22px 0 0;">${ctaHtml}</div>` : ''}
        ${agentCard}
        <div style="margin-top:26px;padding-top:18px;border-top:1px solid #f3f4f6;">
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Pozdrawiam serdecznie,</p>
          <p style="margin:0;font-size:16px;font-weight:800;color:#111827;">${e(identity.agentName)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${e(identity.agencyName)}</p>
        </div>
        <p style="margin:22px 0 0;text-align:center;font-size:11px;color:#9ca3af;">${e(params.footerNote || 'EstateOS™ · profesjonalna obsługa nieruchomości')}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
