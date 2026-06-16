import { Platform } from 'react-native';

type TFn = (key: string, options?: Record<string, unknown>) => string;

export function authPasskeyButtonLabel(t: TFn): string {
  return Platform.OS === 'android' ? t('auth.passkeyAndroid') : t('auth.passkeyFaceId');
}

export function profilePasskeyActiveLabel(t: TFn): string {
  return Platform.OS === 'android' ? t('profile.security.passkeyActiveAndroid') : t('profile.security.passkeyActiveIos');
}

export function profilePasskeyInactiveLabel(t: TFn): string {
  return Platform.OS === 'android' ? t('profile.security.passkeyInactiveAndroid') : t('profile.security.passkeyInactive');
}
