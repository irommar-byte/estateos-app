/**
 * Bezpieczna obudowa orientation API.
 * Dev client bez przebudowy nie ma ExpoScreenOrientation — nie wolno wtedy
 * ładować `expo-screen-orientation` (requireNativeModule → crash).
 */

import { requireOptionalNativeModule } from 'expo-modules-core';

type OrientationApi = {
  lockPortrait: () => void;
  unlockAll: () => void;
};

function createNoop(): OrientationApi {
  return {
    lockPortrait: () => {},
    unlockAll: () => {},
  };
}

let cached: OrientationApi | null = null;

export function getScreenOrientationApi(): OrientationApi {
  if (cached) return cached;

  // Najpierw sprawdź native — bez tego require pakietu JS wywali appkę.
  if (!requireOptionalNativeModule('ExpoScreenOrientation')) {
    cached = createNoop();
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ScreenOrientation = require('expo-screen-orientation') as typeof import('expo-screen-orientation');
    const lock = ScreenOrientation?.OrientationLock?.PORTRAIT_UP;
    if (!ScreenOrientation?.lockAsync || lock == null) {
      cached = createNoop();
      return cached;
    }
    cached = {
      lockPortrait: () => {
        void ScreenOrientation.lockAsync(lock).catch(() => {});
      },
      unlockAll: () => {
        void ScreenOrientation.unlockAsync().catch(() => {});
      },
    };
    return cached;
  } catch {
    cached = createNoop();
    return cached;
  }
}
