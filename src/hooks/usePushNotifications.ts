import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shouldSuppressDealPushForActiveChat } from '../utils/activeDealroomPush';
import {
  isContactPushNotification,
  resolveContactPushDisplayBody,
  resolveContactPushDisplayTitle,
  resolveContactPushThreadIdentifier,
  shouldSuppressContactPushForActiveChat,
} from '../utils/activeContactPush';
import { mergePushPayload as mergeCanonicalPushPayload } from '../contracts/parityContracts';
import type { Notification } from 'expo-notifications';
import { API_URL } from '../config/network';

const ESTATEOS_NOTIFY_SOUND = 'estateos_notify.wav';

function resolveDealroomPushThreadIdentifier(notification: Notification): string | null {
  const data = mergeCanonicalPushPayload({
    baseData: notification.request.content?.data,
    triggerPayload: (notification.request as any)?.trigger?.payload,
  });
  const explicit = String(data.threadIdentifier ?? '').trim();
  if (explicit) return explicit;
  const dealId = Number(data.dealId ?? data.targetId);
  if (Number.isFinite(dealId) && dealId > 0) return `estateos-deal-${dealId}`;
  return null;
}

function isDealroomChatPush(notification: Notification): boolean {
  const data = mergeCanonicalPushPayload({
    baseData: notification.request.content?.data,
    triggerPayload: (notification.request as any)?.trigger?.payload,
  });
  const type = String(data.targetType ?? data.target ?? data.notificationType ?? data.kind ?? '').toUpperCase();
  return type.includes('DEAL') || type.includes('DEALROOM') || String(data.kind || '') === 'deal_message';
}

Notifications.setNotificationHandler({
  handleNotification: async (notification: Notification) => {
    if (shouldSuppressDealPushForActiveChat(notification) || shouldSuppressContactPushForActiveChat(notification)) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
      };
    }

    if (isContactPushNotification(notification)) {
      const existingThread = String(notification.request.content.threadIdentifier || '').trim();
      if (existingThread) {
        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      }

      const threadIdentifier = resolveContactPushThreadIdentifier(notification);
      const title = resolveContactPushDisplayTitle(notification);
      const body = resolveContactPushDisplayBody(notification);
      const data = notification.request.content.data;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            subtitle: 'EstateOS Contact',
            body,
            sound: ESTATEOS_NOTIFY_SOUND,
            threadIdentifier,
            data: {
              ...(typeof data === 'object' && data != null ? data : {}),
              threadIdentifier,
            },
          },
          trigger: null,
        });
      } catch {
        /* fallback: pokaż oryginalne powiadomienie */
        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      }

      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    }

    if (isDealroomChatPush(notification)) {
      const existingThread = String(notification.request.content.threadIdentifier || '').trim();
      if (!existingThread) {
        const threadIdentifier = resolveDealroomPushThreadIdentifier(notification);
        if (threadIdentifier) {
          const data = notification.request.content.data;
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: notification.request.content.title || 'Dealroom',
                subtitle: notification.request.content.subtitle || undefined,
                body: notification.request.content.body || '',
                sound: ESTATEOS_NOTIFY_SOUND,
                threadIdentifier,
                data: {
                  ...(typeof data === 'object' && data != null ? data : {}),
                  threadIdentifier,
                },
              },
              trigger: null,
            });
            return {
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: true,
              shouldSetBadge: true,
            };
          } catch {
            /* fallback poniżej */
          }
        }
      }
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

function buildFavoritesPayload(input: any): {
  enabled: boolean;
  notifyPriceChange: boolean;
  notifyDealProposals: boolean;
  notifyNegotiation: boolean;
  notifyIncludeAmounts: boolean;
  notifyStatusChange: boolean;
  notifyNewSimilar: boolean;
  ids?: number[];
} {
  const rawEnabled = input?.enabled;
  const enabled = typeof rawEnabled === 'boolean' ? rawEnabled : Array.isArray(input?.ids) ? input.ids.length > 0 : false;
  const boolOr = (value: any, fallback = true) => (typeof value === 'boolean' ? value : fallback);
  const notifyDealProposals = boolOr(input?.notifyDealProposals, boolOr(input?.notifyNegotiation, true));
  const notifyNegotiation = boolOr(input?.notifyNegotiation, notifyDealProposals);
  const ids = Array.isArray(input?.ids)
    ? input.ids
        .map((v: any) => Number(v))
        .filter((v: number) => Number.isFinite(v) && v > 0)
    : undefined;
  const base = {
    enabled,
    notifyPriceChange: boolOr(input?.notifyPriceChange, true),
    notifyDealProposals,
    notifyNegotiation,
    notifyIncludeAmounts: boolOr(input?.notifyIncludeAmounts, true),
    notifyStatusChange: boolOr(input?.notifyStatusChange, true),
    notifyNewSimilar: boolOr(input?.notifyNewSimilar, true),
  };
  return ids && ids.length > 0 ? { ...base, ids } : base;
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

    const favorites = buildFavoritesPayload(params.devicePreferences?.favorites);
    const payload = {
      expoPushToken: pushToken,
      platform: Platform.OS.toUpperCase(),
      deviceModel: Device.modelName ?? 'Unknown',
      appVersion: Constants.expoConfig?.version ?? '1.0',
      devicePreferences: params.devicePreferences,
      // Backward compatibility: część backendów czyta `favorites` na root body.
      favorites,
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

function normalizeAuthToken(authToken: string | null): string | null {
  if (!authToken?.trim()) return null;
  const trimmed = authToken.trim();
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
}

/**
 * Rejestracja tokenu push + opcjonalny systemowy prompt zgody.
 * `showPrompt: false` — tylko gdy uprawnienie już `granted` (np. start aplikacji).
 */
export async function registerPushNotifications(
  authToken: string | null,
  options?: { showPrompt?: boolean },
): Promise<boolean> {
  const normalizedAuthToken = normalizeAuthToken(authToken);
  if (!Device.isDevice || !normalizedAuthToken) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    const showPrompt = options?.showPrompt === true;

    if (existingStatus !== 'granted' && showPrompt) {
      // Po odmowie iOS nie pokaże ponownie systemowego promptu — bez własnego Alertu (App Review).
      if (existingStatus === 'denied') return false;
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
        sound: 'estateos_notify.wav',
      });
      // v2: custom EstateOS sound (Android nie zmienia sound w istniejącym kanale)
      await Notifications.setNotificationChannelAsync('contact-messages-v2', {
        name: 'Wiadomości bezpośrednie',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
        sound: 'estateos_notify.wav',
      });
      await Notifications.setNotificationChannelAsync('dealroom-messages-v2', {
        name: 'Wiadomości Dealroom',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
        sound: 'estateos_notify.wav',
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
        e,
      );
      return false;
    }
    if (!pushToken) return false;

    const favorites = buildFavoritesPayload(null);
    const payload = {
      expoPushToken: pushToken,
      platform: Platform.OS.toUpperCase(),
      deviceModel: Device.modelName ?? 'Unknown',
      appVersion: Constants.expoConfig?.version ?? '1.0',
      favorites,
      devicePreferences: {
        favorites,
      },
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
          lastPostNetworkError,
        );
      }
      return false;
    }

    await AsyncStorage.setItem('pushToken', pushToken);
    return true;
  } catch (e) {
    console.error('❌ Push setup error:', e);
    return false;
  }
}

let messagesTabPushPromptInFlight = false;

/**
 * Wejście w zakładkę „Wiadomości”: od razu systemowy prompt (bez własnego Alertu — App Store).
 */
export async function promptPushNotificationsForMessagesTab(authToken: string | null): Promise<void> {
  if (!authToken || !Device.isDevice || messagesTabPushPromptInFlight) return;

  const { status } = await Notifications.getPermissionsAsync();

  if (status === 'granted') {
    await registerPushNotifications(authToken, { showPrompt: false });
    return;
  }

  if (status === 'denied') return;

  messagesTabPushPromptInFlight = true;
  try {
    await registerPushNotifications(authToken, { showPrompt: true });
  } finally {
    messagesTabPushPromptInFlight = false;
  }
}

/** Named const export — unika edge-case’ów bundlera z `export function` przy cyklicznych importach. */
export const usePushNotifications = function usePushNotifications(authToken: string | null) {
  const isRegisteredRef = useRef(false);

  const normalizedAuthToken = normalizeAuthToken(authToken);

  useEffect(() => {
    isRegisteredRef.current = false;
  }, [normalizedAuthToken]);

  const registerToken = useCallback(async (showPrompt = false) => {
    if ((isRegisteredRef.current && !showPrompt) || !Device.isDevice || !normalizedAuthToken) return false;

    const ok = await registerPushNotifications(normalizedAuthToken, { showPrompt });
    if (ok) isRegisteredRef.current = true;
    return ok;
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
};
