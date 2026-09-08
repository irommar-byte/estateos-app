import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildMarketReportHtml, buildMarketReportPair, type ReportHtmlOpts } from '@/lib/market/reportHtml';
import { wrapReportEmailWithPortal } from '@/lib/market/reportEmailWrap';
import { resolveRcnAsOfDate } from '@/lib/market/asOf';
import { buildPricePulse } from '@/lib/market/pricePulse';
import type { MarketReportVariant, ValuationResult, ValuationSubject } from '@/lib/market/types';

function uniqEmails(emails: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function parseReportVariant(raw: unknown): MarketReportVariant {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pro' || s === 'professional' || s === 'mapa' || s === 'client') return 'pro';
  return 'classic';
}

export function reportLetterOpts(params: {
  name?: string | null;
  emails?: string[];
  generatedAt?: Date | string | null;
  variant?: MarketReportVariant;
}): ReportHtmlOpts {
  const email = (params.emails || []).find((item) => String(item).includes('@')) || '';
  return {
    recipientName: params.name,
    recipientEmail: email,
    generatedAt: params.generatedAt,
    variant: params.variant || 'classic',
  };
}

export async function attachReportContext(result: ValuationResult): Promise<ValuationResult> {
  try {
    const [asOf, pulse] = await Promise.all([
      resolveRcnAsOfDate(result.coverage.city).catch(() => null),
      buildPricePulse().catch(() => null),
    ]);
    const district = String(result.subject.district || '');
    const row = pulse?.districts.find((d) => d.district === district);
    const listingPpsm = row?.listingPpsm ?? pulse?.windows.d30.listingPpsm ?? null;
    const listingDeedPpsm = row?.deedPpsm ?? pulse?.windows.d30.deedPpsm ?? result.stats.medianPpsm;
    const listingCount = row?.listingCount ?? pulse?.windows.d30.listingCount ?? null;
    const listingVsDeedsPct =
      listingPpsm && listingDeedPpsm ? ((listingPpsm - listingDeedPpsm) / listingDeedPpsm) * 100 : null;
    return {
      ...result,
      reportContext: {
        asOf: asOf ? asOf.toISOString() : null,
        listingPpsm,
        listingDeedPpsm,
        listingVsDeedsPct: listingVsDeedsPct != null ? Number(listingVsDeedsPct.toFixed(1)) : null,
        listingCount,
        listingScope: district || result.coverage.city,
      },
    };
  } catch {
    return result;
  }
}

export function collectReportEmails(body: Record<string, unknown>, clientEmail?: string | null) {
  return uniqEmails([
    String(body.email || ''),
    String(body.alternateEmail || ''),
    clientEmail || '',
  ]);
}

export type StoredOfferReport = {
  id: number;
  createdAt: string;
  mid: number | null;
  city: string | null;
  address: string | null;
  sentClassic: boolean;
  sentPro: boolean;
};

export async function recordMarketReportGeneration(params: {
  userId: number | null;
  emails: string[];
  fallbackEmail?: string | null;
  name?: string | null;
  purpose: string;
  creditUsed: boolean;
  subject: ValuationSubject;
  result: ValuationResult;
  clientId?: number | null;
  offerId?: number | null;
}) {
  const emails = uniqEmails(params.emails);
  const emailLabel = (emails.join(', ') || params.fallbackEmail || 'generated').slice(0, 191);
  const result = await attachReportContext(params.result);
  const row = await prisma.marketValuationReport.create({
    data: {
      userId: params.userId,
      clientId: params.clientId || null,
      offerId: params.offerId || null,
      email: emailLabel,
      purpose: params.purpose,
      creditUsed: params.creditUsed,
      subjectJson: JSON.stringify(params.subject),
      resultJson: JSON.stringify(result),
    },
  });
  const letter = reportLetterOpts({ name: params.name, emails, variant: 'classic' });
  const pair = await buildMarketReportPair(result, letter);
  return { reportId: row.id, html: pair.html, htmlPro: pair.htmlPro, emails, result };
}

export async function emailMarketReport(params: {
  emails: string[];
  name?: string | null;
  result: ValuationResult;
  variant?: MarketReportVariant;
  portalUrl?: string | null;
}) {
  const emails = uniqEmails(params.emails);
  if (!emails.length) return { emailed: false, emails: [] as string[], html: '' };
  const html = wrapReportEmailWithPortal(
    await buildMarketReportHtml(
      params.result,
      reportLetterOpts({ name: params.name, emails, variant: params.variant || 'classic' }),
    ),
    params.portalUrl,
  );
  const place = params.result.subject.address
    ? `${params.result.subject.city}, ${params.result.subject.address}`
    : params.result.subject.city;
  const variantLabel =
    params.variant === 'pro' ? 'wersja z mapą i rekomendacją' : 'zestawienie transakcji';
  let emailed = false;
  for (const to of emails) {
    const ok = await sendTransactionalEmail({
      to,
      subject: `Raport wartości nieruchomości — ${place} (${variantLabel})`,
      html,
    });
    if (ok) emailed = true;
  }
  return { emailed, emails, html };
}

export async function previewUserMarketReport(params: {
  userId: number;
  reportId: number;
  variant: MarketReportVariant;
  name?: string | null;
  email?: string | null;
}) {
  const stored = await loadUserMarketReport(params.userId, params.reportId);
  if (!stored) return null;
  const html = await buildMarketReportHtml(
    stored.result,
    reportLetterOpts({
      name: params.name,
      emails: params.email ? [params.email] : [],
      generatedAt: stored.row.createdAt,
      variant: params.variant,
    }),
  );
  return { html, result: stored.result, createdAt: stored.row.createdAt.toISOString() };
}

function parseStoredResult(row: { resultJson: string; subjectJson: string; createdAt: Date; id: number }) {
  try {
    const result = JSON.parse(row.resultJson) as ValuationResult;
    const subject = JSON.parse(row.subjectJson) as ValuationSubject;
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      mid: Number.isFinite(result?.estimated?.mid) ? Math.round(result.estimated.mid) : null,
      city: subject?.city || result?.subject?.city || null,
      address: subject?.address || result?.subject?.address || null,
    };
  } catch {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      mid: null,
      city: null,
      address: null,
    };
  }
}

export async function listUserOfferReports(params: {
  userId: number;
  clientId?: number | null;
  offerId?: number | null;
}): Promise<StoredOfferReport[]> {
  const clientId = Number(params.clientId);
  const offerId = Number(params.offerId);
  const hasClient = Number.isFinite(clientId) && clientId > 0;
  const hasOffer = Number.isFinite(offerId) && offerId > 0;
  if (!hasClient && !hasOffer) return [];

  const or: Array<{ clientId?: number; offerId?: number }> = [];
  if (hasClient) or.push({ clientId });
  if (hasOffer) or.push({ offerId });

  const rows = await prisma.marketValuationReport.findMany({
    where: { userId: params.userId, OR: or },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { id: true, resultJson: true, subjectJson: true, createdAt: true },
  });

  const sent = hasClient
    ? await prisma.agencyClientActivity.findMany({
        where: {
          clientId,
          agencyUserId: params.userId,
          kind: 'MARKET_REPORT_SENT',
          ...(hasOffer ? { offerId } : {}),
        },
        select: { metadata: true },
        take: 80,
      })
    : [];

  const sentByReport = new Map<number, { classic: boolean; pro: boolean }>();
  for (const activity of sent) {
    const meta =
      activity.metadata && typeof activity.metadata === 'object'
        ? (activity.metadata as Record<string, unknown>)
        : {};
    const reportId = Number(meta.reportId);
    if (!Number.isFinite(reportId) || reportId <= 0) continue;
    const variant = parseReportVariant(meta.reportVariant);
    const prev = sentByReport.get(reportId) || { classic: false, pro: false };
    if (variant === 'pro') prev.pro = true;
    else prev.classic = true;
    sentByReport.set(reportId, prev);
  }

  return rows.map((row) => {
    const parsed = parseStoredResult(row);
    const flags = sentByReport.get(row.id) || { classic: false, pro: false };
    return {
      ...parsed,
      sentClassic: flags.classic,
      sentPro: flags.pro,
    };
  });
}

export async function loadUserMarketReport(userId: number, reportId: number) {
  const row = await prisma.marketValuationReport.findFirst({
    where: { id: reportId, userId },
  });
  if (!row) return null;
  try {
    const result = JSON.parse(row.resultJson) as ValuationResult;
    const subject = JSON.parse(row.subjectJson) as ValuationSubject;
    return { row, result, subject };
  } catch {
    return null;
  }
}

export async function stampReportEmails(reportId: number, emails: string[]) {
  const label = uniqEmails(emails).join(', ').slice(0, 191);
  if (!label) return;
  await prisma.marketValuationReport.update({
    where: { id: reportId },
    data: { email: label },
  });
}

/** Legacy: one generation + optional e-mail. Counts once because a single row is created. */
export async function deliverMarketReport(params: {
  userId: number | null;
  emails: string[];
  name?: string | null;
  purpose: string;
  creditUsed: boolean;
  subject: ValuationSubject;
  result: ValuationResult;
}) {
  const recorded = await recordMarketReportGeneration(params);
  const sent = await emailMarketReport({
    emails: params.emails,
    name: params.name,
    result: params.result,
  });
  return { ...sent, reportId: recorded.reportId, html: recorded.html };
}

export { uniqEmails };
