import {
  canUseAgentMarket,
  consumeMarketReportCredit,
  grantMarketReportCredits,
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

export type ConsumeQuotaResult =
  | { ok: true; creditUsed: boolean; purpose: string }
  | { ok: false; status: number; code: string; message: string; quota: MarketReportQuota };

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
        ? `Zostało ${remaining} z ${PRO_REPORT_DAILY_CAP} wygenerowań raportu na dziś. Limit schodzi przy potwierdzeniu — wysyłka e-mail nic nie zdejmuje.`
        : `Dzienny limit ${PRO_REPORT_DAILY_CAP} wygenerowań raportu został wykorzystany.`,
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
        ? `Zostało ${remaining} z ${OFFICE_PRO_REPORT_CAP} wygenerowań raportu na ${OFFICE_PRO_REPORT_WINDOW_DAYS} dni (Partner Pro). Wysyłka e-mail nic nie zdejmuje.`
        : `Limit ${OFFICE_PRO_REPORT_CAP} wygenerowań raportu na ${OFFICE_PRO_REPORT_WINDOW_DAYS} dni został wykorzystany.`,
    };
  }

  if (user.marketReportCredits > 0) {
    return {
      kind: 'credits',
      used: 0,
      cap: user.marketReportCredits,
      remaining: user.marketReportCredits,
      windowLabel: 'kredyty',
      message: `Masz ${user.marketReportCredits} ${user.marketReportCredits === 1 ? 'kredyt' : 'kredyty'} raportu. Kredyt schodzi przy wygenerowaniu, nie przy wysyłce.`,
    };
  }

  return {
    kind: 'none',
    used: 0,
    cap: 0,
    remaining: 0,
    windowLabel: '',
    message: canUseAgentMarket(user)
      ? 'Generowanie raportów jest w Partner Pro — 5 sztuk na 30 dni dla całego zespołu z przywilejami Pro.'
      : 'Generowanie raportu z aktów jest w Investor Pro albo Partner Pro biura.',
  };
}

export async function consumeMarketReportQuota(user: MarketUser): Promise<ConsumeQuotaResult> {
  const quota = await getMarketReportQuota(user);
  const officePro = await userHasOfficePartnerPro(user.id);
  const investorPro = isActivePro(user);
  const admin = String(user.role || '').toUpperCase() === 'ADMIN';

  if (investorPro || admin) {
    if (quota.remaining <= 0) {
      return { ok: false, status: 429, code: 'DAILY_CAP', message: quota.message, quota };
    }
    return { ok: true, creditUsed: false, purpose: canUseAgentMarket(user) ? 'crm' : 'consumer' };
  }

  if (officePro) {
    if (quota.remaining <= 0) {
      return { ok: false, status: 429, code: 'PERIOD_CAP', message: quota.message, quota };
    }
    return { ok: true, creditUsed: false, purpose: 'crm' };
  }

  if (canUseAgentMarket(user)) {
    return { ok: false, status: 403, code: 'PRO_REQUIRED', message: quota.message, quota };
  }

  const consumed = await consumeMarketReportCredit(user.id);
  if (!consumed) {
    return { ok: false, status: 403, code: 'PRO_REQUIRED', message: quota.message, quota };
  }
  return { ok: true, creditUsed: true, purpose: 'consumer' };
}

export async function refundMarketReportCreditIfUsed(userId: number, creditUsed: boolean) {
  if (!creditUsed) return;
  await grantMarketReportCredits(userId, 1);
}

export async function getMarketReportQuotaForUserId(userId: number): Promise<MarketReportQuota | null> {
  const user = await loadMarketUser(userId);
  if (!user) return null;
  return getMarketReportQuota(user);
}
