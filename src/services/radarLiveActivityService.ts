import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { NativeModules, Platform } from 'react-native';

import {
  buildRadarLiveActivitySnapshot,
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

const fallbackTitle = 'Radar aktywny';

const formatFallbackBody = (snapshot: RadarLiveActivitySnapshot): string => {
  const mode = snapshot.transactionType === 'RENT' ? 'Najem' : 'Sprzedaz';
  return `Monitoring rynku trwa • ${mode} • ${snapshot.city} • Prog ${snapshot.minMatchThreshold}% • Oferty ${snapshot.activeMatchesCount}`;
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
      body: formatFallbackBody(snapshot),
      sound: false,
      sticky: true,
      data: {
        feature: 'radar_live_activity',
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
  const snapshot = buildRadarLiveActivitySnapshot(incoming);
  if (!snapshot.enabled) {
    await stopRadarLiveActivity();
    return;
  }

  if (hasNativeLiveActivityModule) {
    try {
      await callNative('updateMonitoring', snapshot);
      return;
    } catch {
      try {
        await callNative('startMonitoring', snapshot);
        return;
      } catch {
        // If native ActivityKit fails (e.g. missing extension on current build), keep user-visible fallback.
      }
    }
  }

  await updateFallbackNotification(snapshot);
};

export const stopRadarLiveActivity = async () => {
  if (hasNativeLiveActivityModule) {
    try {
      await stopNative();
    } catch {
      // noop
    }
  }
  await dismissFallbackNotification();
};
