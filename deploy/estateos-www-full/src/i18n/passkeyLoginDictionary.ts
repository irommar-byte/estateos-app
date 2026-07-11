import type { Locale } from "./config";

export type PasskeyLoginDictionary = {
  home: string;
  usePasskey: string;
  noPairCode: string;
  pairFail: string;
  tvHint: string;
  preferPassword: string;
  loginWithPassword: string;
  pairingLoading: string;
  pairTitle: string;
};

const pl: PasskeyLoginDictionary = {
  home: "Strona główna",
  usePasskey: "Użyj Passkey (Face ID / Touch ID)",
  noPairCode: "Brak kodu parowania z Apple TV. Zeskanuj kod QR ponownie na telewizorze.",
  pairFail: "Nie udało się połączyć z Apple TV.",
  tvHint: "Ten adres służy do logowania Passkey z Apple TV. Otwórz go przez kod QR w aplikacji EstateOS na tvOS.",
  preferPassword: "Wolisz hasło?",
  loginWithPassword: "Zaloguj się hasłem",
  pairingLoading: "Trwa logowanie i wysyłanie sesji na Apple TV…",
  pairTitle: "Połącz Apple TV z kontem EstateOS",
};

const en: PasskeyLoginDictionary = {
  ...pl,
  home: "Home",
  usePasskey: "Use Passkey (Face ID / Touch ID)",
  noPairCode: "No pairing code from Apple TV. Scan the QR code on your TV again.",
  pairFail: "Could not connect to Apple TV.",
  tvHint: "This page is for Passkey login from Apple TV. Open it via QR code in the EstateOS tvOS app.",
  preferPassword: "Prefer password?",
  loginWithPassword: "Sign in with password",
  pairingLoading: "Signing in and sending session to Apple TV…",
  pairTitle: "Connect Apple TV to your EstateOS account",
};

const uk: PasskeyLoginDictionary = {
  ...en,
  home: "Головна",
  usePasskey: "Використати Passkey (Face ID / Touch ID)",
  noPairCode: "Немає коду з Apple TV. Знову відскануйте QR на телевізорі.",
  pairFail: "Не вдалося підключитися до Apple TV.",
  tvHint: "Ця сторінка для входу Passkey з Apple TV. Відкрийте через QR у застосунку EstateOS на tvOS.",
  preferPassword: "Краще пароль?",
  loginWithPassword: "Увійти паролем",
  pairingLoading: "Вхід і надсилання сесії на Apple TV…",
  pairTitle: "Підключіть Apple TV до акаунта EstateOS",
};

export function getPasskeyLoginDictionary(locale: Locale): PasskeyLoginDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
