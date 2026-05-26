import AsyncStorage from '@react-native-async-storage/async-storage';
import { Passkey } from 'react-native-passkey';

const PASSKEY_USER_ID_KEY = '@estateos_passkey_user_id';
const LAST_EMAIL_KEY = '@estateos_last_login_email';

export async function markPasskeyEnabledForUser(userId: string | number): Promise<void> {
  const id = String(userId || '').trim();
  if (!id) return;
  await AsyncStorage.multiSet([
    [`@passkey_${id}`, 'active'],
    [PASSKEY_USER_ID_KEY, id],
  ]);
}

export async function clearPasskeyLocalForUser(userId: string | number): Promise<void> {
  const id = String(userId || '').trim();
  if (!id) return;
  await AsyncStorage.multiRemove([`@passkey_${id}`, PASSKEY_USER_ID_KEY]);
}

/** Czy po starcie aplikacji pokazać natychmiastowy prompt Passkey (jak Uber). */
export async function shouldAutoPromptPasskeyOnLaunch(): Promise<{
  shouldPrompt: boolean;
  email: string;
}> {
  try {
    const supported = await Passkey.isSupported();
    if (!supported) return { shouldPrompt: false, email: '' };

    const email = String((await AsyncStorage.getItem(LAST_EMAIL_KEY)) || '')
      .trim()
      .toLowerCase();
    if (!email) return { shouldPrompt: false, email: '' };

    const userId = String((await AsyncStorage.getItem(PASSKEY_USER_ID_KEY)) || '').trim();
    if (!userId) return { shouldPrompt: false, email };

    const flag = await AsyncStorage.getItem(`@passkey_${userId}`);
    return { shouldPrompt: flag === 'active', email };
  } catch {
    return { shouldPrompt: false, email: '' };
  }
}
