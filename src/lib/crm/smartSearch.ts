import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { buildClientMessageEmailHtml } from '@/lib/crm/clientMessageEmail';
import { logTeamEvent } from '@/lib/crm/teamLog';
import { getSmartAgentAccess, smartCompanyContext } from '@/lib/crm/smartAgent';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { loadAppleClientEmailIdentity } from '@/lib/email/appleClientEmail';

/**
 * Wyszukiwarka /szukam w imieniu agenta ze Smart Agent OS™:
 * link /szukam/s/{kod} (losowy kod, nie numer agenta) — kupujący wypełnia formularz z twarzą agenta,
 * trafia od razu do jego klientów, a Smart Agent sam dopasowuje i wysyła mu oferty.
 */
export const SMART_SEARCH_LEAD_KIND = 'SMART_SEARCH_LEAD';

function siteOrigin(): string {
  return String(process.env.NEXT_PUBLIC_SITE_URL || 'https://estateos.pl').replace(/\/$/, '');
}

const CODE_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(): string {
  const bytes = randomBytes(12);
  let code = '';
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

export function smartSearchUrl(code: string): string {
  return `${siteOrigin()}/szukam/s/${code}`;
}

export type SmartLinkScope = 'enterprise' | 'office' | 'personal';
type LinkTarget = { scope: SmartLinkScope; companyId: number | null; userId: number | null };
type LinkRow = LinkTarget & { code: string; revokedAt: Date | null };

/** Do kogo należy link: stanowisko Enterprise i opłacone z puli — biuro; opłacone kredytami agenta — agent. */
async function linkTarget(userId: number): Promise<LinkTarget | null> {
  const access = await getSmartAgentAccess(userId);
  if (!access.active) return null;
  if (access.mode === 'enterprise') {
    const ctx = await smartCompanyContext(userId);
    return ctx ? { scope: 'enterprise', companyId: ctx.companyId, userId: null } : null;
  }
  if (access.paidWith === 'office') {
    const ctx = await smartCompanyContext(userId);
    return ctx ? { scope: 'office', companyId: ctx.companyId, userId } : null;
  }
  return { scope: 'personal', companyId: null, userId };
}

async function findActiveLink(t: LinkTarget): Promise<LinkRow | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT code, scope, companyId, userId, revokedAt FROM SmartSearchLink
     WHERE scope = ? AND revokedAt IS NULL AND (companyId <=> ?) AND (userId <=> ?) ORDER BY createdAt DESC LIMIT 1`,
    t.scope,
    t.companyId,
    t.userId,
  )) as LinkRow[];
  return rows[0] || null;
}

async function createLink(t: LinkTarget): Promise<string> {
  const code = newCode();
  await prisma.$executeRawUnsafe(
    `INSERT INTO SmartSearchLink (code, scope, companyId, userId) VALUES (?, ?, ?, ?)`,
    code,
    t.scope,
    t.companyId,
    t.userId,
  );
  return code;
}

/** Aktualny link agenta (tworzony przy pierwszym użyciu). Bez aktywnego Smart Agenta — brak linku. */
export async function currentSmartLink(userId: number): Promise<{ code: string; scope: SmartLinkScope } | null> {
  const target = await linkTarget(userId);
  if (!target) return null;
  const existing = await findActiveLink(target);
  if (existing) return { code: existing.code, scope: existing.scope };
  return { code: await createLink(target), scope: target.scope };
}

/** Nowy link w miejsce starego (np. gdy wyciekł). Link biura wymienia tylko kierownik. */
export async function regenerateSmartLink(userId: number): Promise<{ code: string; scope: SmartLinkScope }> {
  const target = await linkTarget(userId);
  if (!target) throw new Error('Link działa przy aktywnym Smart Agent OS™.');
  if (target.scope !== 'personal') {
    const ctx = await smartCompanyContext(userId);
    if (!ctx?.isAdmin) throw new Error('Link biura wymienia kierownik biura.');
  }
  await prisma.$executeRawUnsafe(
    `UPDATE SmartSearchLink SET revokedAt = NOW(3) WHERE scope = ? AND revokedAt IS NULL AND (companyId <=> ?) AND (userId <=> ?)`,
    target.scope,
    target.companyId,
    target.userId,
  );
  const code = await createLink(target);
  await logTeamEvent({ userId, kind: 'SMART_SEARCH_LINK', title: 'Wygenerował nowy link wyszukiwarki — stary przestał działać' });
  return { code, scope: target.scope };
}

/**
 * Kto przyjmuje kupującego z linku:
 * enterprise — aktualny posiadacz stanowiska Enterprise, bez niego → kierownik biura;
 * office — agent ze stanowiskiem opłaconym z puli; po wygaśnięciu albo odejściu z biura → kierownik;
 * personal — agent, dopóki jego Smart Agent jest aktywny; potem link chwilowo nie działa.
 */
export async function resolveSmartLink(
  code: string,
): Promise<{ agentUserId: number; viaFallback: boolean } | { agentUserId: null; reason: 'not_found' | 'inactive' }> {
  const clean = String(code || '').trim();
  if (!/^[A-Za-z0-9]{6,24}$/.test(clean)) return { agentUserId: null, reason: 'not_found' };
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT code, scope, companyId, userId, revokedAt FROM SmartSearchLink WHERE code = ? LIMIT 1`,
    clean,
  )) as LinkRow[];
  const link = rows[0];
  if (!link || link.revokedAt) return { agentUserId: null, reason: 'not_found' };

  if (link.scope === 'personal') {
    if (!link.userId) return { agentUserId: null, reason: 'not_found' };
    const access = await getSmartAgentAccess(link.userId);
    return access.active && access.paidWith === 'personal'
      ? { agentUserId: link.userId, viaFallback: false }
      : { agentUserId: null, reason: 'inactive' };
  }

  if (!link.companyId) return { agentUserId: null, reason: 'not_found' };
  const company = await prisma.agencyCompany.findUnique({ where: { id: link.companyId }, select: { ownerUserId: true } });
  if (!company) return { agentUserId: null, reason: 'not_found' };

  const candidate = link.scope === 'enterprise' ? ((await smartCompanyContext(company.ownerUserId))?.holderUserId ?? null) : link.userId;
  if (candidate) {
    const member =
      candidate === company.ownerUserId ||
      Boolean(
        await prisma.agencyCompanyMember.findFirst({
          where: { userId: candidate, companyId: link.companyId, status: 'ACTIVE' },
          select: { id: true },
        }),
      );
    const access = member ? await getSmartAgentAccess(candidate) : null;
    const holds = Boolean(access?.active && (link.scope === 'enterprise' ? access.mode === 'enterprise' : access.paidWith === 'office'));
    if (holds) return { agentUserId: candidate, viaFallback: false };
  }
  // Stanowisko wygasło albo agent odszedł — kupujący trafia do kierownika biura.
  return { agentUserId: company.ownerUserId, viaFallback: true };
}

export async function smartSearchSummary(userId: number) {
  const where = { agencyUserId: userId, kind: SMART_SEARCH_LEAD_KIND };
  const [link, leads, last] = await Promise.all([
    currentSmartLink(userId),
    prisma.agencyClientActivity.count({ where }),
    prisma.agencyClientActivity.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);
  const ctx = link && link.scope !== 'personal' ? await smartCompanyContext(userId) : null;
  return {
    url: link ? smartSearchUrl(link.code) : null,
    qrUrl: link ? `/szukam/s/${link.code}/qr` : null,
    scope: link?.scope ?? null,
    canRegenerate: Boolean(link && (link.scope === 'personal' || ctx?.isAdmin)),
    leads,
    lastLeadAt: last?.createdAt.toISOString() ?? null,
  };
}

/** Zapis po formularzu z linku agenta: ślad na karcie klienta i w dzienniku zespołu. */
export async function recordSmartSearchLead(params: { agentUserId: number; clientId: number; name: string; reused: boolean; city: string | null }) {
  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agentUserId,
      kind: SMART_SEARCH_LEAD_KIND,
      title: params.reused ? 'Wrócił przez Twoją wyszukiwarkę' : 'Przyszedł z Twojej wyszukiwarki',
      body: params.city ? `Szuka: ${params.city}` : null,
    },
  });
  await logTeamEvent({
    userId: params.agentUserId,
    kind: SMART_SEARCH_LEAD_KIND,
    title: `${params.reused ? 'Kupujący wrócił przez wyszukiwarkę' : 'Nowy kupujący z wyszukiwarki'}: ${params.name}`,
    body: params.city ? `Szuka: ${params.city}` : null,
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Zaproszenie e-mailem w imieniu agenta — tylko przy aktywnym Smart Agent OS™. */
export async function sendSmartSearchInvite(params: { userId: number; email: string; name?: string | null }) {
  const access = await getSmartAgentAccess(params.userId);
  if (!access.active) throw new Error('Wyszukiwarka w Twoim imieniu działa przy aktywnym Smart Agent OS™.');
  const email = String(params.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
  const firstName = String(params.name || '').trim().split(/\s+/)[0]?.slice(0, 60) || null;

  const [identity, agent] = await Promise.all([
    loadAppleClientEmailIdentity(params.userId),
    prisma.user.findUnique({ where: { id: params.userId }, select: { email: true } }),
  ]);
  const agentFirst = (identity.agentName || '').split(/\s+/)[0] || 'Twój agent';
  const link = await currentSmartLink(params.userId);
  if (!link) throw new Error('Wyszukiwarka w Twoim imieniu działa przy aktywnym Smart Agent OS™.');
  const url = smartSearchUrl(link.code);
  const html = await buildClientMessageEmailHtml({
    agencyUserId: params.userId,
    client: { id: 0, firstName, salutation: null },
    eyebrow: 'Wyszukiwanie nieruchomości',
    title: 'Znajdę dla Ciebie nieruchomość',
    paragraphs: [
      'Opisz w dwie minuty, czego szukasz — lokalizację, budżet i to, co jest dla Ciebie ważne.',
      'Od tej chwili szukam dla Ciebie na całym rynku. Dopasowane oferty trafią do Twojego panelu, a Ty oceniasz je jednym dotknięciem.',
    ],
    bullets: ['oferty dopasowane do Twoich kryteriów, także te spoza portali,', 'oglądania umawiane w Twoim terminie,', 'negocjacje i dokumenty w jednym miejscu.'],
    closing: 'Dla kupujących usługa jest bezpłatna.',
    ctas: [{ label: 'Opisz, czego szukasz', href: url }],
  });
  const sent = await sendTransactionalEmail({
    to: email,
    subject: `${agentFirst} — znajdę dla Ciebie nieruchomość`,
    html,
    replyTo: agent?.email || undefined,
  });
  if (!sent) throw new Error('Nie udało się wysłać wiadomości. Spróbuj ponownie.');
  await logTeamEvent({ userId: params.userId, kind: 'SMART_SEARCH_INVITE', title: `Wysłał wyszukiwarkę: ${email}` });
}
