import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, AppState, ColorSchemeName, useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  themeMode: ThemeMode;
  /** Ostatni znany schemat systemu — aktualizowany przez Appearance.addChangeListener. */
  systemScheme: ColorSchemeName;
  setThemeMode: (mode: ThemeMode) => void;
  getResolvedTheme: () => 'light' | 'dark';
}

function normalizeScheme(scheme: ColorSchemeName | null | undefined): 'light' | 'dark' {
  return scheme === 'dark' ? 'dark' : 'light';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'auto',
      systemScheme: Appearance.getColorScheme(),

      setThemeMode: (mode) => set({ themeMode: mode }),

      getResolvedTheme: () => {
        const { themeMode, systemScheme } = get();
        if (themeMode === 'auto') {
          return normalizeScheme(systemScheme);
        }
        return themeMode;
      },
    }),
    {
      name: 'estateos-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ themeMode: state.themeMode }),
    },
  ),
);

let appearanceListenerAttached = false;

function syncSystemSchemeFromOs(): void {
  useThemeStore.setState({ systemScheme: Appearance.getColorScheme() });
}

/** Jednorazowy listener — reaguje na zmianę jasny/ciemny w ustawieniach iPhone’a. */
export function ensureThemeAppearanceListener(): void {
  if (appearanceListenerAttached) return;
  appearanceListenerAttached = true;

  syncSystemSchemeFromOs();

  Appearance.addChangeListener(({ colorScheme }) => {
    useThemeStore.setState({ systemScheme: colorScheme });
  });

  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      syncSystemSchemeFromOs();
    }
  });
}

/** Preferowany hook — reaguje na zmianę motywu systemowego i preferencji użytkownika. */
export function useResolvedTheme(): 'light' | 'dark' {
  ensureThemeAppearanceListener();
  const themeMode = useThemeStore((s) => s.themeMode);
  const storeSystemScheme = useThemeStore((s) => s.systemScheme);
  const hookSystemScheme = useColorScheme();
  if (themeMode === 'auto') {
    const scheme = hookSystemScheme ?? storeSystemScheme;
    return normalizeScheme(scheme);
  }
  return themeMode;
}

export function useIsDarkTheme(): boolean {
  return useResolvedTheme() === 'dark';
}
