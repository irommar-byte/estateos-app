import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
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

export function usePushNotifications(authToken: string | null) {
  const isRegisteredRef = useRef(false);

  const normalizedAuthToken =
    authToken && authToken.trim()
      ? authToken.trim().startsWith('Bearer ')
        ? authToken.trim().slice('Bearer '.length).trim()
        : authToken.trim()
      : null;

  const registerToken = async (showPrompt = false) => {
    if (isRegisteredRef.current || !Device.isDevice || !normalizedAuthToken) return false;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted' && showPrompt) {
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

      try {
        const response = await fetch(PUSH_REGISTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${normalizedAuthToken}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          console.warn('⚠️ Push: backend odrzucił token', response.status, body?.slice(0, 200));
          return false;
        }
      } catch (e) {
        console.error(
          `❌ Push: fetch ${PUSH_REGISTER_URL} — backend niedostępny lub TLS/DNS.`,
          e
        );
        return false;
      }

      await AsyncStorage.setItem('pushToken', pushToken);
      isRegisteredRef.current = true;
      return true;
    } catch (e) {
      console.error('❌ Push setup error:', e);
      return false;
    }
  };

  useEffect(() => {
    registerToken(false);
  }, [normalizedAuthToken]);

  return { askForPermission: () => registerToken(true) };
}
