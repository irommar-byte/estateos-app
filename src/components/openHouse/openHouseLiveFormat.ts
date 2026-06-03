import type { OpenHouseTickerItem } from '../../contracts/openHouseContract';
import type { AppLocale } from '../../i18n/types';
import { localeToDateFormat, t } from '../../i18n';

export function formatOpenHouseLiveDetail(
  item: OpenHouseTickerItem,
  locale: AppLocale
): string {
  const fullTitle = (item.title ?? '').trim();
  if (!item.startsAt) {
    return `${item.city ?? ''} · ${fullTitle}`.trim();
  }
  const date = new Date(item.startsAt).toLocaleString(localeToDateFormat(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return t('openHouse.ticker.openHouseInvite', {
    city: item.city,
    title: fullTitle,
    date,
    spots: String(item.spotsLeft),
  });
}

/** Pełna treść jak na pasku alertu przed schowaniem do plusa. */
export function formatOpenHouseLiveBroadcast(item: OpenHouseTickerItem, locale: AppLocale): string {
  const head = t('openHouse.ticker.alertHeadline');
  const detail = formatOpenHouseLiveDetail(item, locale);
  return `${head} · ${detail}`;
}

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
};

export function getCountdownParts(targetIso: string | null, now = Date.now()): CountdownParts {
  if (!targetIso) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  }
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  }
  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    past: false,
  };
}
