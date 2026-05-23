import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfilePromoCardRecord } from '../contracts/profilePromoContract';
import type { TranslateFn } from '../i18n/types';

const NOTIFY_KIND = 'bonus_coupon_received';
const DEEPLINK = 'estateos://profil/kupony-bonusowe';

const seenNotifyKey = (userId: string | number) =>
  `@estateos_bonus_coupon_notify_seen_${userId}`;

/** Zapobiega równoległym wywołaniom (Bootstrap + Profil) i podwójnemu pushowi. */
const notifyRunByUser = new Map<string, Promise<void>>();
const recentlyPresentedCouponIds = new Map<string, number>();
const PRESENT_DEDUPE_MS = 120_000;

export type BonusCouponNotifyCopy = {
  title: string;
  body: string;
  subtitle: string;
};

export function buildBonusCouponNotifyCopy(card: ProfilePromoCardRecord, t: TranslateFn): BonusCouponNotifyCopy {
  const isBirthday =
    card.templateId === 'birthday_free_listing' || card.kind === 'birthday_coupon';
  if (isBirthday) {
    return {
      title: t('profile.shop.bonusCouponNotifyBirthdayTitle'),
      body: t('profile.shop.bonusCouponNotifyBirthdayBody'),
      subtitle: t('profile.shop.bonusCouponNotifyAction'),
    };
  }
  return {
    title: t('profile.shop.bonusCouponNotifyTitle'),
    body: t('profile.shop.bonusCouponNotifyBody', { title: card.title }),
    subtitle: t('profile.shop.bonusCouponNotifyAction'),
  };
}

function isAdminIssuedBonusCoupon(card: ProfilePromoCardRecord): boolean {
  if (card.kind === 'welcome_coupon') return true;
  if (card.kind === 'birthday_coupon' || card.kind === 'admin_promo') return true;
  return Boolean(card.templateId);
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return req.status === 'granted';
  } catch {
    return false;
  }
}

/** Natychmiastowe powiadomienie o nowym kuponie bonusowym. */
export async function presentBonusCouponReceivedNotification(
  card: ProfilePromoCardRecord,
  copy: BonusCouponNotifyCopy,
): Promise<void> {
  if (Platform.OS === 'web') return;
  const dedupeKey = String(card.id || '').trim();
  if (dedupeKey) {
    const last = recentlyPresentedCouponIds.get(dedupeKey) ?? 0;
    if (Date.now() - last < PRESENT_DEDUPE_MS) return;
    recentlyPresentedCouponIds.set(dedupeKey, Date.now());
  }
  if (!(await ensureNotificationPermission())) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        subtitle: copy.subtitle,
        sound: true,
        data: {
          kind: NOTIFY_KIND,
          target: 'profile_bonus_coupons',
          couponId: card.id,
          couponKind: card.kind,
          deeplink: DEEPLINK,
        },
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      } as Notifications.NotificationContentInput,
      trigger: null,
    });
  } catch {
    // noop
  }
}

async function loadSeenCouponIds(userId: string | number): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(seenNotifyKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((id) => String(id)).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function saveSeenCouponIds(userId: string | number, seen: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(seenNotifyKey(userId), JSON.stringify([...seen]));
  } catch {
    // noop
  }
}

/**
 * Porównuje listę kuponów z ostatnio powiadomionymi — dla nowych wysyła push lokalny.
 * Wywołuj po `fetchUserProfilePromoCards` (Profil, wejście w aplikację).
 */
async function detectAndNotifyNewBonusCouponsInner(
  userId: string | number,
  cards: ProfilePromoCardRecord[],
  t: TranslateFn,
): Promise<void> {
  const candidates = cards.filter(
    (c) => isAdminIssuedBonusCoupon(c) && c.couponUsed !== true,
  );
  if (candidates.length === 0) return;

  const seen = await loadSeenCouponIds(userId);
  const fresh = candidates.filter((c) => !seen.has(c.id));

  for (const card of fresh) {
    seen.add(card.id);
    await saveSeenCouponIds(userId, seen);
    const copy = buildBonusCouponNotifyCopy(card, t);
    await presentBonusCouponReceivedNotification(card, copy);
  }

  for (const c of candidates) {
    seen.add(c.id);
  }
  await saveSeenCouponIds(userId, seen);
}

export async function detectAndNotifyNewBonusCoupons(
  userId: string | number,
  cards: ProfilePromoCardRecord[],
  t: TranslateFn,
): Promise<void> {
  const uid = String(userId);
  const prev = notifyRunByUser.get(uid) ?? Promise.resolve();
  const run = prev
    .then(() => detectAndNotifyNewBonusCouponsInner(userId, cards, t))
    .catch(() => {});
  notifyRunByUser.set(uid, run);
  await run;
}
