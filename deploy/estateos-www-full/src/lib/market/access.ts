import { prisma } from '@/lib/prisma';
import { computeIsProActive } from '@/lib/mobileUserShape';
import { isAgentOrAgencySeller } from '@/lib/sellerDisplay';
import {
  OFFICE_PRO_REPORT_CAP,
  OFFICE_PRO_REPORT_WINDOW_DAYS,
  PRO_REPORT_DAILY_CAP,
} from '@/lib/market/constants';
import { userHasMarketPro, userHasOfficePartnerPro } from '@/lib/officePartnerPro';

export type MarketUser = {
  id: number;
  role: string;
  isPro: boolean;
  proExpiresAt: Date | null;
  planType: string | null;
  buyerType: string | null;
  marketReportCredits: number;
  email: string;
};

export function isActivePro(user: Pick<MarketUser, 'role' | 'isPro' | 'proExpiresAt'>) {
  return computeIsProActive(user);
}

export function isAgencyOperator(user: Pick<MarketUser, 'role' | 'planType' | 'buyerType'>) {
  return user.role === 'ADMIN' || isAgentOrAgencySeller(user);
}

/** CRM pozyskanie i hub Market — agent w CRM, Pro albo admin. */
export function canUseAgentMarket(user: MarketUser) {
  return isAgencyOperator(user) || isActivePro(user);
}

/** Helper przy dodawaniu oferty — tylko aktywne Investor Pro (oraz admin). */
export function canUseListingMarketHelper(user: MarketUser) {
  return isActivePro(user);
}

export async function loadMarketUser(userId: number): Promise<MarketUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isPro: true,
      proExpiresAt: true,
      planType: true,
      buyerType: true,
      email: true,
      marketReportCredits: true,
    },
  });
  return user;
}

export async function proReportsToday(userId: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return marketReportsSince(userId, start);
}

export async function marketReportsSince(userId: number, since: Date) {
  return prisma.marketValuationReport.count({
    where: { userId, createdAt: { gte: since }, purpose: { in: ['consumer', 'crm'] } },
  });
}

export async function officeProReportsInWindow(userId: number) {
  const since = new Date();
  since.setDate(since.getDate() - OFFICE_PRO_REPORT_WINDOW_DAYS);
  return marketReportsSince(userId, since);
}

export async function canUsePublicMarket(user: MarketUser | null): Promise<boolean> {
  if (!user) return false;
  return userHasMarketPro(user);
}

export { OFFICE_PRO_REPORT_CAP, OFFICE_PRO_REPORT_WINDOW_DAYS, userHasOfficePartnerPro };

export async function consumeMarketReportCredit(userId: number): Promise<boolean> {
  const updated = await prisma.user.updateMany({
    where: { id: userId, marketReportCredits: { gte: 1 } },
    data: { marketReportCredits: { decrement: 1 } },
  });
  return updated.count > 0;
}

export async function grantMarketReportCredits(userId: number, amount = 1) {
  await prisma.user.update({
    where: { id: userId },
    data: { marketReportCredits: { increment: amount } },
  });
}

export { PRO_REPORT_DAILY_CAP };
