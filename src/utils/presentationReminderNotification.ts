import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const TWO_H_MS = 2 * 60 * 60 * 1000;
const KIND = 'presentation-2h';

function presentationReminderFilter(dealId: number | string) {
  return (r: Notifications.NotificationRequest) =>
    r.content?.data?.kind === KIND && String(r.content?.data?.dealId ?? '') === String(dealId);
}

/** Usuwa zaplanowane przypomnienie „2 h przed” dla danego deala (np. po zmianie terminu lub po prezentacji). */
export async function cancelPresentationTwoHourReminder(dealId: number | string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all.filter(presentationReminderFilter(dealId)).map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier))
    );
  } catch {
    /* noop */
  }
}

/**
 * Planuje lokalne powiadomienie dokładnie na 2 h przed umówioną prezentacją.
 * Gdy do startu zostało mniej niż 2 h — nie planuje (za późno na ten mechanizm).
 */
export async function schedulePresentationTwoHourReminder(params: {
  dealId: number | string;
  offerId?: number | string | null;
  presentationIso: string;
  listingTitle?: string;
}): Promise<void> {
  if (Platform.OS === 'web') return;

  const atMs = new Date(params.presentationIso).getTime();
  if (!Number.isFinite(atMs)) return;

  await cancelPresentationTwoHourReminder(params.dealId);

  const fireAtMs = atMs - TWO_H_MS;
  const now = Date.now();
  if (fireAtMs <= now) return;

  const seconds = Math.floor((fireAtMs - now) / 1000);
  if (seconds < 120) return;

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') return;
    }
  } catch {
    return;
  }

  const title = 'Prezentacja za 2 godziny';
  const shortTitle = params.listingTitle ? String(params.listingTitle).slice(0, 80) : '';
  const body = shortTitle
    ? `Za dwie godziny spotkanie przy ofercie „${shortTitle}”. Życzymy owocnego spotkania!`
    : 'Za dwie godziny masz umówioną prezentację nieruchomości. Powodzenia — życzymy owocnego spotkania!';

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        subtitle: params.dealId ? `Dealroom · TX-${params.dealId}` : undefined,
        data: {
          target: 'dealroom',
          dealId: params.dealId,
          kind: KIND,
          offerId: params.offerId ?? undefined,
          deeplink: `estateos://dealroom/${params.dealId}`,
        },
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      } as Notifications.NotificationContentInput,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
  } catch {
    /* noop */
  }
}
