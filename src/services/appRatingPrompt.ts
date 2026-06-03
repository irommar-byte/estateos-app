import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

const STORAGE_KEY = '@estateos:appRating:v1';
const APP_STORE_ID = '6762899098';

type StoreReviewModule = {
  isAvailableAsync: () => Promise<boolean>;
  requestReview: () => Promise<void>;
};

function loadStoreReviewModule(): StoreReviewModule | null {
  try {
    // Lazy require — dev client bez przebudowy nie ma ExpoStoreReview w binarium.
    return require('expo-store-review') as StoreReviewModule;
  } catch {
    return null;
  }
}

async function tryNativeInAppReview(): Promise<boolean> {
  const StoreReview = loadStoreReviewModule();
  if (!StoreReview) return false;
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) return false;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

type RatingState = {
  installAt: number;
  sessions: number;
  positiveMoments: number;
  lastPromptAt: number | null;
  completedAt: number | null;
  softDeclines: number;
};

const DEFAULT_STATE: RatingState = {
  installAt: Date.now(),
  sessions: 0,
  positiveMoments: 0,
  lastPromptAt: null,
  completedAt: null,
  softDeclines: 0,
};

const MIN_SESSIONS = 3;
const MIN_POSITIVE_MOMENTS = 1;
const MIN_DAYS_AFTER_INSTALL = 1;
const PROMPT_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
const SOFT_DECLINE_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;

async function loadState(): Promise<RatingState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<RatingState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function saveState(state: RatingState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export async function bootstrapAppRatingSession(): Promise<void> {
  const state = await loadState();
  state.sessions += 1;
  await saveState(state);
}

type RatingPromptListener = () => void;
const ratingPromptListeners = new Set<RatingPromptListener>();

export function subscribeAppRatingPromptEvaluation(listener: RatingPromptListener): () => void {
  ratingPromptListeners.add(listener);
  return () => {
    ratingPromptListeners.delete(listener);
  };
}

function notifyRatingPromptListeners(): void {
  for (const listener of ratingPromptListeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

export async function recordPositiveAppMoment(_reason?: string): Promise<void> {
  const state = await loadState();
  state.positiveMoments += 1;
  await saveState(state);
  notifyRatingPromptListeners();
}

export async function shouldOfferAppRatingPrompt(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;

  const state = await loadState();
  if (state.completedAt) return false;

  const now = Date.now();
  const daysSinceInstall = (now - state.installAt) / (24 * 60 * 60 * 1000);
  if (daysSinceInstall < MIN_DAYS_AFTER_INSTALL) return false;
  if (state.sessions < MIN_SESSIONS) return false;
  if (state.positiveMoments < MIN_POSITIVE_MOMENTS) return false;

  if (state.lastPromptAt) {
    const cooldown =
      state.softDeclines >= 2 ? SOFT_DECLINE_COOLDOWN_MS : PROMPT_COOLDOWN_MS;
    if (now - state.lastPromptAt < cooldown) return false;
  }

  return true;
}

export async function markAppRatingPromptShown(kind: 'completed' | 'declined' | 'soft'): Promise<void> {
  const state = await loadState();
  state.lastPromptAt = Date.now();
  if (kind === 'completed') {
    state.completedAt = Date.now();
  } else if (kind === 'soft') {
    state.softDeclines += 1;
  }
  await saveState(state);
}

export async function requestNativeStoreReview(): Promise<boolean> {
  if (await tryNativeInAppReview()) return true;

  if (Platform.OS === 'ios') {
    const url = `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      // fallback below
    }
  }

  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(`market://details?id=pl.estateos.app`);
      return true;
    } catch {
      // ignore
    }
  }

  return false;
}

export function getAppStoreReviewUrl(): string {
  return `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
}
