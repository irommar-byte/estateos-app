import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Passkey } from 'react-native-passkey';

const API_URL = 'https://estateos.pl/api/mobile/v1/auth';
const PASSKEY_URL = 'https://estateos.pl/api/mobile/v1/passkeys';

const normalizeUser = (u: any) => {
  if (!u) return u;
  if (u.name && !u.firstName) {
    const parts = u.name.split(' ');
    u.firstName = parts[0];
    u.lastName = parts.slice(1).join(' ');
  }
  if (u.image && !u.avatar) u.avatar = u.image;
  return u;
};

export const useAuthStore = create((set, get: any) => ({
  isLoggedIn: false,
  user: null,
  token: null,

  login: async (email, password) => {
    const res = await fetch('https://estateos.pl/api/mobile/v1/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Błąd logowania');
    
    const normalizedUser = normalizeUser(data.user);
    await AsyncStorage.setItem('userToken', data.token);
    await AsyncStorage.setItem('userData', JSON.stringify(normalizedUser));
    set({ isLoggedIn: true, user: normalizedUser, token: data.token });
  },

  // PASSKEY: LOGOWANIE DO SYSTEMU
  loginWithPasskey: async (email: string) => {
    try {
      if (!Passkey.isSupported()) throw new Error('Twoje urządzenie nie wspiera Passkey.');
      
      const optionsRes = await fetch(`${PASSKEY_URL}/auth-options`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      let options;
      try { options = await optionsRes.json(); } catch (err) { throw new Error(`Błąd serwera (${optionsRes.status}).`); }
      if (!optionsRes.ok) throw new Error(options.error || 'Błąd pobierania opcji Passkey');

      // POPRAWIONA METODA: Passkey.get()
      const authResult = await Passkey.get(options);

      const verifyRes = await fetch(`${PASSKEY_URL}/auth-verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, response: authResult })
      });
      let verifyData;
      try { verifyData = await verifyRes.json(); } catch (err) { throw new Error(`Błąd weryfikacji na serwerze (${verifyRes.status}).`); }
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Autoryzacja odrzucona');

      const normalizedUser = normalizeUser(verifyData.user);
      const token = verifyData.token || 'session_passkey_' + Math.random().toString(36).substr(2);
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(normalizedUser));
      set({ isLoggedIn: true, user: normalizedUser, token });
    } catch (e: any) { throw new Error(e.message || "Wystąpił błąd Passkey"); }
  },

  // PASSKEY: TWORZENIE NOWEGO KLUCZA Z PROFILU
  registerPasskey: async () => {
    try {
      const { user } = get();
      if (!user) throw new Error("Musisz być zalogowany, aby dodać klucz.");
      if (!Passkey.isSupported()) throw new Error('Twoje urządzenie nie wspiera Passkey.');

      const optionsRes = await fetch(`${PASSKEY_URL}/register-options`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email })
      });
      let options;
      try { options = await optionsRes.json(); } catch (err) { throw new Error(`Serwer odpowiedział błędem (${optionsRes.status}).`); }
      if (!optionsRes.ok) throw new Error(options.error || 'Błąd pobierania opcji rejestracji');

      // POPRAWIONA METODA: Passkey.create()
      const registerResult = await Passkey.create(options);

      const verifyRes = await fetch(`${PASSKEY_URL}/register-verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, response: registerResult })
      });
      let verifyData;
      try { verifyData = await verifyRes.json(); } catch (err) { throw new Error(`Błąd weryfikacji klucza (${verifyRes.status}).`); }
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Odrzucono rejestrację klucza');

      return true;
    } catch (e: any) { throw new Error(e.message || "Nie udało się wygenerować klucza Passkey"); }
  },

  register: async (email, password, firstName, lastName, phone, role) => {
    const res = await fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', email, password, firstName, lastName, phone, role })
    });
    let data;
    try { data = await res.json(); } catch (e) { throw new Error(`Błąd serwera (${res.status}).`); }
    if (!res.ok) throw new Error(data.message || 'Błąd rejestracji');
    
    const normalizedUser = normalizeUser(data.user);
    const fakeToken = 'session_' + Math.random().toString(36).substr(2);
    await AsyncStorage.setItem('userToken', fakeToken);
    await AsyncStorage.setItem('userData', JSON.stringify(normalizedUser));
    set({ isLoggedIn: true, user: normalizedUser, token: fakeToken });
  },

  updateAvatar: async (base64Img: string) => {
    const { user } = get();
    if (!user) return;
    const updatedUser = { ...user, avatar: base64Img };
    set({ user: updatedUser });
    await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
    try {
      await fetch('https://estateos.pl/api/mobile/v1/user/update', { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, image: base64Img }) 
      });
    } catch (e) { console.log("Błąd zapisu avatara", e); }
  },

  logout: async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    set({ isLoggedIn: false, user: null, token: null });
  },

  checkUser: async () => {
    const token = await AsyncStorage.getItem('userToken');
    const userData = await AsyncStorage.getItem('userData');
    if (token && userData) set({ isLoggedIn: true, user: JSON.parse(userData), token });
  }
}));
