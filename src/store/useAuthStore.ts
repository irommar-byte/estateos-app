import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { PasskeyService } from '../services/passkeyService'; // 🔥 IMPORT NASZEGO SERWISU!

const formatPhone = (p?: string) => {
  if (!p) return "Brak numeru";
  const digits = p.replace(/\D/g, "").replace(/^48/, "");
  if (digits.length !== 9) return p;
  return "+48 " + digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
};

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
  isPro?: boolean;
  proExpiresAt?: string | null;
  isVerifiedPhone?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isRadarActive: boolean; // 🔥 Nowość
  setRadarActive: (isActive: boolean) => Promise<void>; // 🔥 Nowość
  login: (email: string, pass: string) => Promise<boolean>;
  register: (email: string, pass: string, fName: string, lName: string, phone: string, role: string) => Promise<boolean>;
  loginWithPasskey: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  updateAvatar: (base64Image: string) => Promise<void>;
}

const normalizeUser = (apiUser: any) => {
  if (!apiUser) return null;
  
  const fullDisplayName = apiUser.name || apiUser.contactName || 'Użytkownik';
  const nameParts = fullDisplayName.split(' ');
  
  return {
    ...apiUser,
    firstName: nameParts[0] || 'Użytkownik',
    lastName: nameParts.slice(1).join(' ') || '',
    phone: formatPhone(apiUser.phone || apiUser.contactPhone),
    avatar: apiUser.image || apiUser.avatar || null,
    isVerifiedPhone: apiUser.isVerified === true || apiUser.phoneVerified === true || false
  };
};

const normalizeToken = (rawToken: string | null | undefined) => {
  if (!rawToken) return null;
  const trimmed = String(rawToken).trim();
  if (!trimmed) return null;
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  isRadarActive: false, // Domyślnie wyłączony

  // 🔥 NOWA FUNKCJA ZARZĄDZAJĄCA STANEM RADARU
  setRadarActive: async (isActive: boolean) => {
    set({ isRadarActive: isActive });
    try {
      await AsyncStorage.setItem('@estateos_radar_active', isActive ? '1' : '0');
    } catch (e) {
      console.log("Error saving radar state", e);
    }
  },

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
      const normalizedToken = normalizeToken(data.token);
      if (!normalizedToken) throw new Error('Nie otrzymano poprawnego tokena logowania');
      await AsyncStorage.setItem('mobile_token', normalizedToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(normUser));
      set({ user: normUser, token: normalizedToken, isLoading: false });
      await get().refreshUser();
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
        body: JSON.stringify({ 
          email, 
          password: pass, 
          name: `${fName} ${lName}`, 
          phone: phone,
          role: role 
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Błąd rejestracji');
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  updateAvatar: async (base64Image: string) => {
    const { user, token } = get();
    if (!user) return;
    const updatedUser = { ...user, avatar: base64Image };
    set({ user: updatedUser });
    await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
    
    try {
      await fetch('https://estateos.pl/api/mobile/v1/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ image: base64Image, userId: user.id })
      });
    } catch (e) { console.log("Avatar sync error", e); }
  },

  // 🔥 PRAWDZIWE LOGOWANIE PASSKEY 🔥
  loginWithPasskey: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await PasskeyService.login();
      
      if (data && data.token) {
        const normUser = normalizeUser(data.user);
        const normalizedToken = normalizeToken(data.token);
        if (!normalizedToken) throw new Error('Nie otrzymano poprawnego tokena passkey');
        await AsyncStorage.setItem('mobile_token', normalizedToken);
        await AsyncStorage.setItem('user_data', JSON.stringify(normUser));
        set({ user: normUser, token: normalizedToken, isLoading: false });
        await get().refreshUser();
        return true; 
      }
      
      set({ isLoading: false });
      return false;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  refreshUser: async () => {
    const { token, user } = get();
    if (!token || !user?.id) return;
    try {
      const res = await fetch('https://estateos.pl/api/mobile/v1/auth', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.user) {
        const refreshed = normalizeUser(data.user);
        set({ user: refreshed });
        await AsyncStorage.setItem('user_data', JSON.stringify(refreshed));
      }
    } catch (e) {
      console.log('Refresh user error', e);
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('mobile_token');
    await AsyncStorage.removeItem('user_data');
    await AsyncStorage.removeItem('@estateos_radar_active'); // Czyścimy radar
    set({ user: null, token: null, isRadarActive: false });
  },

  restoreSession: async () => {
    try {
      const token = normalizeToken(await AsyncStorage.getItem('mobile_token'));
      const userData = await AsyncStorage.getItem('user_data');
      const radarState = await AsyncStorage.getItem('@estateos_radar_active');
      
      if (token && userData) {
        set({ 
          token, 
          user: normalizeUser(JSON.parse(userData)),
          isRadarActive: radarState === '1'
        });
        await get().refreshUser();
      }
    } catch (e) {
      console.log("Restore session error", e);
    }
  }
}));
