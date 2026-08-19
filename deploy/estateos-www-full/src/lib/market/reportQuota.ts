import {
  canUseAgentMarket,
  isActivePro,
  loadMarketUser,
  officeProReportsInWindow,
  proReportsToday,
  type MarketUser,
} from '@/lib/market/access';
import {
  OFFICE_PRO_REPORT_CAP,
  OFFICE_PRO_REPORT_WINDOW_DAYS,
  PRO_REPORT_DAILY_CAP,
} from '@/lib/market/constants';
import { userHasOfficePartnerPro } from '@/lib/officePartnerPro';

export type MarketReportQuota = {
  kind: 'admin' | 'investor' | 'office' | 'credits' | 'none';
  used: number;
  cap: number | null;
  remaining: number;
  windowLabel: string;
  message: string;
};

export async function getMarketReportQuota(user: MarketUser): Promise<MarketReportQuota> {
  const admin = String(user.role || '').toUpperCase() === 'ADMIN';
  const investorPro = isActivePro(user);
  const officePro = await userHasOfficePartnerPro(user.id);

  if (admin || investorPro) {
    const used = await proReportsToday(user.id);
    const remaining = Math.max(0, PRO_REPORT_DAILY_CAP - used);
    return {
      kind: admin ? 'admin' : 'investor',
      used,
      cap: PRO_REPORT_DAILY_CAP,
      remaining,
      windowLabel: 'dzisiaj',
      message: remaining
        ? `Zostało ${remaining} z ${PRO_REPORT_DAILY_CAP} raportów na dziś.`
        : `Dzienny limit ${PRO_REPORT_DAILY_CAP} raportów został wykorzystany.`,
    };
  }

  if (officePro) {
    const used = await officeProReportsInWindow(user.id);
    const remaining = Math.max(0, OFFICE_PRO_REPORT_CAP - used);
    return {
      kind: 'office',
      used,
      cap: OFFICE_PRO_REPORT_CAP,
      remaining,
      windowLabel: `${OFFICE_PRO_REPORT_WINDOW_DAYS} dni`,
      message: remaining
        ? `Zostało ${remaining} z ${OFFICE_PRO_REPORT_CAP} raportów na ${OFFICE_PRO_REPORT_WINDOW_DAYS} dni (Partner Pro).`
        : `Limit ${OFFICE_PRO_REPORT_CAP} raportów na ${OFFICE_PRO_REPORT_WINDOW_DAYS} dni został wykorzystany.`,
    };
  }

  if (user.marketReportCredits > 0) {
    return {
      kind: 'credits',
      used: 0,
      cap: user.marketReportCredits,
      remaining: user.marketReportCredits,
      windowLabel: 'kredyty',
      message: `Masz ${user.marketReportCredits} ${user.marketReportCredits === 1 ? 'kredyt' : 'kredyty'} raportu.`,
    };
  }

  return {
    kind: 'none',
    used: 0,
    cap: 0,
    remaining: 0,
    windowLabel: '',
    message: canUseAgentMarket(user)
      ? 'Raporty e-mail są w Partner Pro — 5 sztuk na 30 dni dla całego zespołu z przywilejami Pro.'
      : 'Raport z aktów na e-mail jest w Investor Pro albo Partner Pro biura.',
  };
}

export async function getMarketReportQuotaForUserId(userId: number): Promise<MarketReportQuota | null> {
  const user = await loadMarketUser(userId);
  if (!user) return null;
  return getMarketReportQuota(user);
}
