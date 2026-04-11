import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  getResolvedTheme: () => 'light' | 'dark';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'auto', // Domyślnie słuchamy systemu
      
      setThemeMode: (mode) => set({ themeMode: mode }),
      
      // Ta funkcja tłumaczy tryb "auto" na konkretny kolor (jasny lub ciemny) 
      // w zależności od ustawień telefonu w danej sekundzie.
      getResolvedTheme: () => {
        const { themeMode } = get();
        if (themeMode === 'auto') {
          const systemTheme = Appearance.getColorScheme();
          return systemTheme === 'light' ? 'light' : 'dark';
        }
        return themeMode;
      },
    }),
    {
      name: 'estateos-theme-storage', // Bezpieczna nazwa klucza w pamięci telefonu
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
