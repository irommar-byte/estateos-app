import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildMarketReportHtml, buildMarketReportPair, type ReportHtmlOpts } from '@/lib/market/reportHtml';
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

export async function recordMarketReportGeneration(params: {
  userId: number | null;
  emails: string[];
  fallbackEmail?: string | null;
  name?: string | null;
  purpose: string;
  creditUsed: boolean;
  subject: ValuationSubject;
  result: ValuationResult;
}) {
  const emails = uniqEmails(params.emails);
  const emailLabel = (emails.join(', ') || params.fallbackEmail || 'generated').slice(0, 191);
  const result = await attachReportContext(params.result);
  const row = await prisma.marketValuationReport.create({
    data: {
      userId: params.userId,
      email: emailLabel,
      purpose: params.purpose,
      creditUsed: params.creditUsed,
      subjectJson: JSON.stringify(params.subject),
      resultJson: JSON.stringify(result),
    },
  });
  const letter = reportLetterOpts({ name: params.name, emails, variant: 'classic' });
  const pair = buildMarketReportPair(result, letter);
  return { reportId: row.id, html: pair.html, htmlPro: pair.htmlPro, emails, result };
}

export async function emailMarketReport(params: {
  emails: string[];
  name?: string | null;
  result: ValuationResult;
  variant?: MarketReportVariant;
}) {
  const emails = uniqEmails(params.emails);
  if (!emails.length) return { emailed: false, emails: [] as string[], html: '' };
  const html = buildMarketReportHtml(
    params.result,
    reportLetterOpts({ name: params.name, emails, variant: params.variant || 'classic' }),
  );
  let emailed = false;
  for (const to of emails) {
    const ok = await sendTransactionalEmail({
      to,
      subject: `Analiza wartości nieruchomości — ${params.result.subject.city}${params.result.subject.address ? `, ${params.result.subject.address}` : ''}`,
      html,
    });
    if (ok) emailed = true;
  }
  return { emailed, emails, html };
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
