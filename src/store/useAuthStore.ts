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
  isVerifiedPhone?: boolean;
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
  updateAvatar: (base64Image: string) => Promise<void>;
}

const normalizeUser = (apiUser: any) => {
  if (!apiUser) return null;
  
  // Rozdzielamy 'Marian Romanienko' na imię i nazwisko dla luksusowego wyglądu
  const fullDisplayName = apiUser.name || apiUser.contactName || 'Użytkownik';
  const nameParts = fullDisplayName.split(' ');
  
  return {
    ...apiUser,
    firstName: nameParts[0] || 'Użytkownik',
    lastName: nameParts.slice(1).join(' ') || '',
    phone: apiUser.phone || apiUser.contactPhone || 'Brak numeru',
    avatar: apiUser.image || apiUser.avatar || null,
    isVerifiedPhone: apiUser.isVerified === true || apiUser.phoneVerified === true || false
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
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

  loginWithPasskey: async (email: string) => {
    Alert.alert("Passkey", "Integracja Apple Passkey wymaga Apple Developer Program.");
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
