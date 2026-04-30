import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const API_URL = 'https://estateos.pl/api/notifications/device';

export function usePushNotifications(authToken: string | null) {
  const isRegisteredRef = useRef(false);
  const lastAuthTokenRef = useRef<string | null>(null);

  const normalizedAuthToken =
    authToken && authToken.trim()
      ? authToken.trim().startsWith('Bearer ')
        ? authToken.trim().slice('Bearer '.length).trim()
        : authToken.trim()
      : null;

  const registerToken = async (showPrompt = false) => {
    if (!Device.isDevice || !normalizedAuthToken) return false;
    if (isRegisteredRef.current && lastAuthTokenRef.current === normalizedAuthToken) return false;

    try {
      console.log("STEP 2 START"); const { status: existingStatus } = await Notifications.getPermissionsAsync(); console.log("PERMISSION:", existingStatus);
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
        console.error('❌ Brak projectId');
        return false;
      }

      console.log("STEP 3 START"); const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data; console.log("TOKEN RAW:", pushToken);
      if (!pushToken) return false;

      const payload = {
        expoPushToken: pushToken,
        platform: Platform.OS.toUpperCase(),
        deviceModel: Device.modelName ?? 'Unknown',
        appVersion: Constants.expoConfig?.version ?? '1.0',
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${normalizedAuthToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.log('⚠️ Błąd wysyłki tokena');
        return false;
      }

      await AsyncStorage.setItem('pushToken', pushToken);
      console.log('🚀 Push token registered');
      isRegisteredRef.current = true;
      lastAuthTokenRef.current = normalizedAuthToken;
      return true;

    } catch (e) {
      console.error('❌ Push setup error:', e);
      return false;
    }
  };

  useEffect(() => {
    // Ważne: po zmianie konta/tokenu wymuszamy ponowną rejestrację push,
    // żeby token urządzenia nie został przypisany do poprzedniego użytkownika.
    if (lastAuthTokenRef.current !== normalizedAuthToken) {
      isRegisteredRef.current = false;
    }
    registerToken(false);
  }, [normalizedAuthToken]);

  return { askForPermission: () => registerToken(true) };
}
