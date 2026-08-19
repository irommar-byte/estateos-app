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

export async function deliverMarketReport(params: {
  userId: number | null;
  emails: string[];
  name?: string | null;
  purpose: string;
  creditUsed: boolean;
  subject: ValuationSubject;
  result: ValuationResult;
}) {
  const emails = uniqEmails(params.emails);
  if (!emails.length) return { emailed: false, emails: [] as string[] };

  await prisma.marketValuationReport.create({
    data: {
      userId: params.userId,
      email: emails.join(', ').slice(0, 191),
      purpose: params.purpose,
      creditUsed: params.creditUsed,
      subjectJson: JSON.stringify(params.subject),
      resultJson: JSON.stringify(params.result),
    },
  });
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

export { uniqEmails };
