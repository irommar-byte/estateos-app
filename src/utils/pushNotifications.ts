import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { API_URL } from '../config/network';

export async function registerForPushNotificationsAsync(userEmail: string) {
  if (!Device.isDevice) return;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    
    await fetch(`${API_URL}/api/mobile/v1/user/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, token: pushTokenData.data })
    });
    if (__DEV__) console.log('[push] token registered with backend');
  } catch (error) {
    if (__DEV__) console.warn('[push] token register failed:', error);
  }
}
