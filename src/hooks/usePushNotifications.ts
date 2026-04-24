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

  const registerToken = async (showPrompt = false) => {
    if (isRegisteredRef.current || !Device.isDevice) return false;

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

      const lastToken = await AsyncStorage.getItem('pushToken');
      if (lastToken === pushToken) {
        isRegisteredRef.current = true;
        return true;
      }

      await AsyncStorage.setItem('pushToken', pushToken);

      const payload = {
        expoPushToken: pushToken,
        platform: Platform.OS.toUpperCase(),
        deviceModel: Device.modelName ?? 'Unknown',
        appVersion: Constants.expoConfig?.version ?? '1.0',
      };

      fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      }).catch(() => {
        console.log('⚠️ Błąd wysyłki tokena');
      });

      console.log('🚀 Push token registered');
      isRegisteredRef.current = true;
      return true;

    } catch (e) {
      console.error('❌ Push setup error:', e);
      return false;
    }
  };

  useEffect(() => {
    registerToken(false);
  }, [authToken]);

  return { askForPermission: () => registerToken(true) };
}
