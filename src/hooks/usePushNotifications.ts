import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shouldSuppressDealPushForActiveChat } from '../utils/activeDealroomPush';
import type { Notification } from 'expo-notifications';
import { API_URL } from '../config/network';

Notifications.setNotificationHandler({
  handleNotification: async (notification: Notification) => {
    if (shouldSuppressDealPushForActiveChat(notification)) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
      };
    }
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

const PUSH_REGISTER_URL = `${API_URL}/api/notifications/device`;

const POST_REGISTER_ATTEMPTS = 3;
const POST_RETRY_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncPushDevicePreferences(params: {
  authToken: string;
  /** Preferencje per-device (np. Ulubione / Radar) — backend może ignorować nieznane pola. */
  devicePreferences: Record<string, any>;
}): Promise<boolean> {
  const normalizedAuthToken =
    params.authToken && params.authToken.trim()
      ? params.authToken.trim().startsWith('Bearer ')
        ? params.authToken.trim().slice('Bearer '.length).trim()
        : params.authToken.trim()
      : null;
  if (!Device.isDevice || !normalizedAuthToken) return false;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return false;

    let pushToken = (await AsyncStorage.getItem('pushToken')) || '';
    if (!pushToken) {
      pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (pushToken) await AsyncStorage.setItem('pushToken', pushToken);
    }
    if (!pushToken) return false;

    const payload = {
      expoPushToken: pushToken,
      platform: Platform.OS.toUpperCase(),
      deviceModel: Device.modelName ?? 'Unknown',
      appVersion: Constants.expoConfig?.version ?? '1.0',
      devicePreferences: params.devicePreferences,
    };

    const res = await fetch(PUSH_REGISTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalizedAuthToken}`,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function usePushNotifications(authToken: string | null) {
  const isRegisteredRef = useRef(false);

  const normalizedAuthToken =
    authToken && authToken.trim()
      ? authToken.trim().startsWith('Bearer ')
        ? authToken.trim().slice('Bearer '.length).trim()
        : authToken.trim()
      : null;

  useEffect(() => {
    isRegisteredRef.current = false;
  }, [normalizedAuthToken]);

  const registerToken = useCallback(async (showPrompt = false) => {
    if (isRegisteredRef.current || !Device.isDevice || !normalizedAuthToken) return false;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted' && showPrompt) {
        if (existingStatus === 'denied') {
          // iOS nie pokaże ponownie systemowego promptu — tylko Ustawienia.
          await new Promise<void>((resolve) => {
            Alert.alert(
              'Powiadomienia wyłączone',
              'Aby włączyć alerty EstateOS™, otwórz Ustawienia → Powiadomienia → EstateOS™ i włącz powiadomienia.',
              [
                { text: 'Anuluj', style: 'cancel', onPress: () => resolve() },
                { text: 'Otwórz Ustawienia', onPress: () => { void Linking.openSettings(); resolve(); } },
              ]
            );
          });
          return false;
        }
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return false;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10b981',
        });
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('❌ Push: brak extra.eas.projectId w app.json');
        return false;
      }

      let pushToken: string;
      try {
        pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch (e) {
        console.error(
          '❌ Push: getExpoPushTokenAsync (Expo / sieć do usługi tokenu). Sprawdź internet i projectId EAS.',
          e
        );
        return false;
      }
      if (!pushToken) return false;

      const payload = {
        expoPushToken: pushToken,
        platform: Platform.OS.toUpperCase(),
        deviceModel: Device.modelName ?? 'Unknown',
        appVersion: Constants.expoConfig?.version ?? '1.0',
      };

      let registerPostOk = false;
      let lastPostNetworkError: unknown;

      for (let attempt = 1; attempt <= POST_REGISTER_ATTEMPTS; attempt++) {
        try {
          const response = await fetch(PUSH_REGISTER_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${normalizedAuthToken}`,
            },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            registerPostOk = true;
            break;
          }
          const body = await response.text().catch(() => '');
          console.warn('⚠️ Push: backend odrzucił token', response.status, body?.slice(0, 200));
          break;
        } catch (e) {
          lastPostNetworkError = e;
          if (attempt < POST_REGISTER_ATTEMPTS) {
            await sleep(POST_RETRY_DELAY_MS);
          }
        }
      }

      if (!registerPostOk) {
        if (lastPostNetworkError != null) {
          console.error(
            [
              `❌ Push: po ${POST_REGISTER_ATTEMPTS} próbach POST ${PUSH_REGISTER_URL}`,
              'TypeError „Network request failed” = brak odpowiedzi sieciowej (DNS, TLS, zerwane Wi‑Fi/5G, timeout), zwykle nie 401/500 z samego API.',
              `Test na iPhonie (Safari): otwórz GET ${PUSH_REGISTER_URL} — po deployu Next oczekuj JSON z ok.`,
              `SSH: curl -sS ${PUSH_REGISTER_URL}`,
            ].join(' '),
            lastPostNetworkError
          );
        }
        return false;
      }

      await AsyncStorage.setItem('pushToken', pushToken);
      isRegisteredRef.current = true;
      return true;
    } catch (e) {
      console.error('❌ Push setup error:', e);
      return false;
    }
  }, [normalizedAuthToken]);

  useEffect(() => {
    void registerToken(false);
  }, [registerToken]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void registerToken(false);
    });
    return () => sub.remove();
  }, [registerToken]);

  return { askForPermission: () => registerToken(true) };
}
