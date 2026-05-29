import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState, NativeModules, Platform } from 'react-native';

import {
  buildRadarLiveActivitySnapshot,
  formatRadarLiveActivityLines,
  type RadarLiveActivitySnapshot,
} from '../contracts/radarLiveActivityContract';

const FALLBACK_NOTIFICATION_KEY = '@estateos_radar_live_activity_notification_id';
const FALLBACK_NOTIFICATION_IDENTIFIER = 'estateos-radar-live-activity-sticky';
const FALLBACK_MIN_INTERVAL_MS = 45_000;
/** Min. odstęp między natywnymi update Live Activity — zapobiega wyścigom bridge/Hermes. */
const NATIVE_MIN_INTERVAL_MS = 12_000;

let fallbackUpdateQueue: Promise<void> = Promise.resolve();
let nativeSyncQueue: Promise<void> = Promise.resolve();
let lastFallbackSignature = '';
let lastFallbackAtMs = 0;
let lastNativeSignature = '';
let lastNativeAtMs = 0;

type NativeRadarLiveActivityModuleShape = {
  startMonitoring?: (snapshotJson: string) => Promise<unknown> | void;
  updateMonitoring?: (snapshotJson: string) => Promise<unknown> | void;
  stopMonitoring?: () => Promise<unknown> | void;
};

const NativeRadarLiveActivityModule = (NativeModules?.RadarLiveActivityModule || null) as NativeRadarLiveActivityModuleShape | null;

const hasNativeLiveActivityModule = Platform.OS === 'ios' && !!NativeRadarLiveActivityModule;

const fallbackTitle = 'EstateOS™ · Radar';

const formatFallbackBody = (snapshot: RadarLiveActivitySnapshot): string => {
  const lines = formatRadarLiveActivityLines(snapshot).slice(1);
  return lines.join('\n');
};

const fallbackContentSignature = (snapshot: RadarLiveActivitySnapshot): string =>
  [
    snapshot.newMatchesCount,
    snapshot.activeMatchesCount,
    snapshot.city,
    snapshot.localityCountry,
    snapshot.localityCountryCode,
    snapshot.transactionType,
    snapshot.propertyType,
    snapshot.minMatchThreshold,
    (snapshot.districts || []).join(','),
  ].join('|');

/** Sygnatura bez heartbeat `updatedAtIso` — throttling sensownych zmian. */
const nativeContentSignature = (snapshot: RadarLiveActivitySnapshot): string =>
  [
    snapshot.enabled,
    snapshot.newMatchesCount,
    snapshot.activeMatchesCount,
    snapshot.unreadDealroomMessagesCount,
    snapshot.city,
    snapshot.localityCountryCode,
    snapshot.transactionType,
    snapshot.propertyType,
    snapshot.maxPrice,
    snapshot.minArea,
    snapshot.minYear,
    snapshot.areaRadiusKm,
    snapshot.minMatchThreshold,
    (snapshot.districts || []).join(','),
    snapshot.requireBalcony,
    snapshot.requireGarden,
    snapshot.requireElevator,
    snapshot.requireParking,
    snapshot.requireFurnished,
  ].join('|');

const dismissFallbackNotification = async () => {
  try {
    await Notifications.dismissNotificationAsync(FALLBACK_NOTIFICATION_IDENTIFIER);
    const prevId = await AsyncStorage.getItem(FALLBACK_NOTIFICATION_KEY);
    if (prevId && prevId !== FALLBACK_NOTIFICATION_IDENTIFIER) {
      await Notifications.dismissNotificationAsync(prevId);
    }
    await AsyncStorage.removeItem(FALLBACK_NOTIFICATION_KEY);
  } catch {
    // noop
  }
};

const updateFallbackNotification = async (snapshot: RadarLiveActivitySnapshot) => {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  const signature = fallbackContentSignature(snapshot);
  const now = Date.now();
  if (signature === lastFallbackSignature && now - lastFallbackAtMs < FALLBACK_MIN_INTERVAL_MS) {
    return;
  }

  fallbackUpdateQueue = fallbackUpdateQueue.then(async () => {
    await dismissFallbackNotification();
    await Notifications.scheduleNotificationAsync({
      identifier: FALLBACK_NOTIFICATION_IDENTIFIER,
      content: {
        title: fallbackTitle,
        subtitle: 'Radar aktywny · skan rynku trwa',
        body: formatFallbackBody(snapshot),
        sound: false,
        sticky: true,
        data: {
          feature: 'radar_live_activity',
          snapshot,
        },
      },
      trigger: null,
    });
    await AsyncStorage.setItem(FALLBACK_NOTIFICATION_KEY, FALLBACK_NOTIFICATION_IDENTIFIER);
    lastFallbackSignature = signature;
    lastFallbackAtMs = Date.now();
  });

  await fallbackUpdateQueue;
};

const callNative = async (
  method: 'startMonitoring' | 'updateMonitoring',
  snapshot: RadarLiveActivitySnapshot,
) => {
  const fn = NativeRadarLiveActivityModule?.[method];
  if (!fn) return;
  await Promise.resolve(fn(JSON.stringify(snapshot)));
};

const stopNative = async () => {
  const fn = NativeRadarLiveActivityModule?.stopMonitoring;
  if (!fn) return;
  await Promise.resolve(fn());
};

const shouldSkipNativeSync = (snapshot: RadarLiveActivitySnapshot, force: boolean): boolean => {
  if (force) return false;
  if (AppState.currentState !== 'active') return true;
  const signature = nativeContentSignature(snapshot);
  const now = Date.now();
  if (signature === lastNativeSignature && now - lastNativeAtMs < NATIVE_MIN_INTERVAL_MS) {
    return true;
  }
  return false;
};

export const syncRadarLiveActivity = async (
  incoming: Partial<RadarLiveActivitySnapshot>,
  options?: { force?: boolean },
) => {
  const snapshot = buildRadarLiveActivitySnapshot({
    ...incoming,
    updatedAtIso: new Date().toISOString(),
  });
  if (!snapshot.enabled) {
    await stopRadarLiveActivity();
    return;
  }

  if (hasNativeLiveActivityModule) {
    if (shouldSkipNativeSync(snapshot, Boolean(options?.force))) {
      return;
    }

    nativeSyncQueue = nativeSyncQueue
      .then(async () => {
        try {
          await callNative('updateMonitoring', snapshot);
          lastNativeSignature = nativeContentSignature(snapshot);
          lastNativeAtMs = Date.now();
          await dismissFallbackNotification();
        } catch {
          try {
            await stopNative();
          } catch {
            // noop
          }
          try {
            await callNative('startMonitoring', snapshot);
            lastNativeSignature = nativeContentSignature(snapshot);
            lastNativeAtMs = Date.now();
            await dismissFallbackNotification();
          } catch {
            await updateFallbackNotification(snapshot);
          }
        }
      })
      .catch(() => undefined);

    await nativeSyncQueue;
    return;
  }

  await updateFallbackNotification(snapshot);
};

export const stopRadarLiveActivity = async () => {
  lastNativeSignature = '';
  lastNativeAtMs = 0;

  if (hasNativeLiveActivityModule) {
    nativeSyncQueue = nativeSyncQueue
      .then(async () => {
        try {
          await stopNative();
        } catch {
          // noop
        }
      })
      .catch(() => undefined);
    await nativeSyncQueue;
  }
  await dismissFallbackNotification();
};
