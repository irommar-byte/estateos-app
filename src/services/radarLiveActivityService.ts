import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { NativeModules, Platform } from 'react-native';

import {
  buildRadarLiveActivitySnapshot,
  formatRadarLiveActivityLines,
  type RadarLiveActivitySnapshot,
} from '../contracts/radarLiveActivityContract';

const FALLBACK_NOTIFICATION_KEY = '@estateos_radar_live_activity_notification_id';

type NativeRadarLiveActivityModuleShape = {
  startMonitoring?: (snapshotJson: string) => Promise<void> | void;
  updateMonitoring?: (snapshotJson: string) => Promise<void> | void;
  stopMonitoring?: () => Promise<void> | void;
};

const NativeRadarLiveActivityModule = (NativeModules?.RadarLiveActivityModule || null) as NativeRadarLiveActivityModuleShape | null;

const hasNativeLiveActivityModule = Platform.OS === 'ios' && !!NativeRadarLiveActivityModule;

const fallbackTitle = 'EstateOS™ · Radar';

/**
 * Body sticky-notification: skupiamy się na konkretnej konfiguracji radaru
 * (tryb, lokalizacja, cena, metraż, próg, dopasowania, wymagania).
 * Linie z `formatRadarLiveActivityLines` rozdzielamy znakami nowej linii,
 * pomijając duplikat „Radar aktywny · skan rynku trwa" — tytuł i status
 * pokazuje już osobno powiadomienie (`subtitle` na iOS).
 */
const formatFallbackBody = (snapshot: RadarLiveActivitySnapshot): string => {
  const lines = formatRadarLiveActivityLines(snapshot).slice(1);
  return lines.join('\n');
};

const dismissFallbackNotification = async () => {
  try {
    const prevId = await AsyncStorage.getItem(FALLBACK_NOTIFICATION_KEY);
    if (prevId) {
      await Notifications.dismissNotificationAsync(prevId);
      await AsyncStorage.removeItem(FALLBACK_NOTIFICATION_KEY);
    }
  } catch {
    // noop
  }
};

const updateFallbackNotification = async (snapshot: RadarLiveActivitySnapshot) => {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  await dismissFallbackNotification();
  const identifier = await Notifications.scheduleNotificationAsync({
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
  await AsyncStorage.setItem(FALLBACK_NOTIFICATION_KEY, identifier);
};

const callNative = async (
  method: 'startMonitoring' | 'updateMonitoring',
  snapshot: RadarLiveActivitySnapshot
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

export const syncRadarLiveActivity = async (incoming: Partial<RadarLiveActivitySnapshot>) => {
  // Zawsze stempel czasu „teraz" — chcemy, żeby widget wiedział, że dostał nowy update,
  // nawet jeśli wszystkie inne pola pozostały takie same (heartbeat).
  const snapshot = buildRadarLiveActivitySnapshot({
    ...incoming,
    updatedAtIso: new Date().toISOString(),
  });
  if (!snapshot.enabled) {
    await stopRadarLiveActivity();
    return;
  }

  if (hasNativeLiveActivityModule) {
    try {
      await callNative('updateMonitoring', snapshot);
      return;
    } catch (updateError) {
      console.warn('[RadarLiveActivity] updateMonitoring failed — próbuję start:', updateError);
      try {
        // Stara Activity może być w niezgodnym ContentState (po przebudowie widgetu).
        // Forsujemy stop + start, żeby uzyskać świeżą instancję.
        await stopNative();
      } catch {
        // noop
      }
      try {
        await callNative('startMonitoring', snapshot);
        return;
      } catch (startError) {
        console.warn('[RadarLiveActivity] startMonitoring failed — używam fallback notification:', startError);
      }
    }
  }

  await updateFallbackNotification(snapshot);
};

export const stopRadarLiveActivity = async () => {
  if (hasNativeLiveActivityModule) {
    try {
      await stopNative();
    } catch (error) {
      console.warn('[RadarLiveActivity] stopMonitoring failed:', error);
    }
  }
  await dismissFallbackNotification();
};
