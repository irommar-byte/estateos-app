import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildMarketReportHtml } from '@/lib/market/reportHtml';
import type { ValuationResult, ValuationSubject } from '@/lib/market/types';

export async function deliverMarketReport(params: {
  userId: number | null;
  email: string;
  name?: string | null;
  purpose: string;
  creditUsed: boolean;
  subject: ValuationSubject;
  result: ValuationResult;
}) {
  await prisma.marketValuationReport.create({
    data: {
      userId: params.userId,
      email: params.email,
      purpose: params.purpose,
      creditUsed: params.creditUsed,
      subjectJson: JSON.stringify(params.subject),
      resultJson: JSON.stringify(params.result),
    },
  });
  const html = buildMarketReportHtml(params.result, { recipientName: params.name });
  return sendTransactionalEmail({
    to: params.email,
    subject: `EstateOS™ Market — analiza wartości (${params.result.subject.city})`,
    html,
  });
}
