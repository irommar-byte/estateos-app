import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildMarketReportHtml } from '@/lib/market/reportHtml';
import type { ValuationResult, ValuationSubject } from '@/lib/market/types';

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
  const row = await prisma.marketValuationReport.create({
    data: {
      userId: params.userId,
      email: emailLabel,
      purpose: params.purpose,
      creditUsed: params.creditUsed,
      subjectJson: JSON.stringify(params.subject),
      resultJson: JSON.stringify(params.result),
    },
  });
  const html = buildMarketReportHtml(params.result, { recipientName: params.name });
  return { reportId: row.id, html, emails };
}

export async function emailMarketReport(params: {
  emails: string[];
  name?: string | null;
  result: ValuationResult;
}) {
  const emails = uniqEmails(params.emails);
  if (!emails.length) return { emailed: false, emails: [] as string[], html: '' };
  const html = buildMarketReportHtml(params.result, { recipientName: params.name });
  let emailed = false;
  for (const to of emails) {
    const ok = await sendTransactionalEmail({
      to,
      subject: `EstateOS™ Market — analiza wartości (${params.result.subject.city})`,
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
