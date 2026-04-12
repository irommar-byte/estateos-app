import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

interface User {
  id: number;
  email: string;
  name: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  role: string;
  planType: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<boolean>;
  register: (email: string, pass: string, fName: string, lName: string, phone: string, role: string) => Promise<boolean>;
  loginWithPasskey: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

// 🧠 AUTOMATYCZNY TŁUMACZ DANYCH Z BACKENDU
const normalizeUser = (apiUser: any) => {
  if (!apiUser) return null;
  const nameParts = (apiUser.name || '').split(' ');
  return {
    ...apiUser,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || ''
  };
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email: string, pass: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('https://estateos.pl/api/mobile/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Błąd logowania');
      
      const normUser = normalizeUser(data.user);
      await AsyncStorage.setItem('mobile_token', data.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(normUser));
      set({ user: normUser, token: data.token, isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  register: async (email, pass, fName, lName, phone, role) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('https://estateos.pl/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, contactName: `${fName} ${lName}`, contactPhone: phone, advertiserType: role.toLowerCase() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Błąd rejestracji');
      
      Alert.alert("Sukces", "Konto utworzone! Możesz się teraz zalogować.");
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  loginWithPasskey: async (email: string) => {
     Alert.alert("Passkey", "Integracja Apple Passkey wymaga konfiguracji Apple Developer Program. Na razie użyj hasła.");
     return false;
  },

  logout: async () => {
    await AsyncStorage.removeItem('mobile_token');
    await AsyncStorage.removeItem('user_data');
    set({ user: null, token: null });
  },

  restoreSession: async () => {
    const token = await AsyncStorage.getItem('mobile_token');
    const userData = await AsyncStorage.getItem('user_data');
    if (token && userData) set({ token, user: normalizeUser(JSON.parse(userData)) });
  }
}));
