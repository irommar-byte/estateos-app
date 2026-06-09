import type { Locale } from "./config";

export type AuthDictionary = {
  backToMap: string;
  loginTitle: string;
  loginTitleMuted: string;
  recoverTitle: string;
  recoverTitleHighlight: string;
  emailOrPhone: string;
  emailOrPhonePlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  forgotPassword: string;
  submitLogin: string;
  noAccount: string;
  registerLink: string;
  passkeyDivider: string;
  passkeyButton: string;
  passkeyCancelled: string;
  passkeyFailed: string;
  connectionError: string;
  invalidCredentials: string;
  otpRequired: string;
  smsAuthTitle: string;
  smsAuthSent: string;
  smsAuthValidity: string;
  smsAuthHint: string;
  smsCodeLabel: string;
  smsCodePlaceholder: string;
  verifyPhone: string;
  backToLogin: string;
  resetTitle: string;
  resetDesc: string;
  sendCode: string;
  resetSent: string;
  resetAuthTitle: string;
  resetAuthDesc: string;
  verificationCode: string;
  newPassword: string;
  newPasswordMin: string;
  confirmNewPassword: string;
  cancel: string;
  registerPageTitle: string;
  registerPageTitleHighlight: string;
  registerPageIntro: string;
  registerPageIntroPrivate: string;
  registerPageIntroAgent: string;
  registerPagePricing: string;
  firstName: string;
  lastName: string;
  email: string;
  emailPlaceholder: string;
  passwordMin: string;
  passwordRepeat: string;
  accountTypeLabel: string;
  accountPrivate: string;
  accountPrivateDesc: string;
  accountAgent: string;
  accountAgentDesc: string;
  proPricingNote: string;
  agencyName: string;
  agencyPlaceholder: string;
  checkingEmail: string;
  emailTaken: string;
  acceptTermsPrefix: string;
  termsLink: string;
  acceptTermsMiddle: string;
  privacyLink: string;
  submitRegister: string;
  submittingRegister: string;
  hasAccount: string;
  signInLink: string;
  errNameRequired: string;
  errEmailInvalid: string;
  errPhoneInvalid: string;
  errPasswordShort: string;
  errPasswordMismatch: string;
  errAgencyShort: string;
  errTerms: string;
  errEmailTaken: string;
  errPhoneTaken: string;
  errRegisterFailed: string;
  successRegister: string;
  errConnection: string;
  resetCodeSent: string;
  passwordChanged: string;
  resetInvalidCode: string;
};

const pl: AuthDictionary = {
  backToMap: "← Wróć na mapę",
  loginTitle: "Zaloguj",
  loginTitleMuted: "się.",
  recoverTitle: "Odzyskaj",
  recoverTitleHighlight: "dostęp.",
  emailOrPhone: "E-mail lub telefon",
  emailOrPhonePlaceholder: "jan@example.com lub 500 600 700",
  password: "Hasło",
  passwordPlaceholder: "••••••••",
  forgotPassword: "Zapomniałem hasła",
  submitLogin: "Zaloguj się ➔",
  noAccount: "Nie masz konta?",
  registerLink: "Załóż konto",
  passkeyDivider: "Logowanie biometryczne",
  passkeyButton: "Passkey / Face ID",
  passkeyCancelled: "Anulowano lub błąd skanera Face ID / Touch ID.",
  passkeyFailed: "Weryfikacja biometryczna nieudana.",
  connectionError: "Błąd połączenia.",
  invalidCredentials: "Nieprawidłowy e-mail lub hasło.",
  otpRequired: "Wpisz kod SMS wysłany podczas rejestracji.",
  smsAuthTitle: "Autoryzacja SMS",
  smsAuthSent: "Kod autoryzacyjny został wysłany na",
  smsAuthValidity: "Ważność kodu: 24 godziny",
  smsAuthHint:
    "Ze względów bezpieczeństwa nie generujemy nowego kodu. Znajdź SMS EstateOS i wpisz 6-cyfrowy PIN.",
  smsCodeLabel: "Twój 6-cyfrowy kod SMS",
  smsCodePlaceholder: "000000",
  verifyPhone: "Zweryfikuj telefon",
  backToLogin: "Wróć do logowania",
  resetTitle: "Reset hasła",
  resetDesc: "Podaj e-mail lub telefon. Wyślemy kod autoryzacyjny (SMS lub e-mail).",
  sendCode: "Wyślij kod",
  resetSent: "Kod weryfikacyjny został wysłany na Twój adres e-mail lub telefon.",
  resetAuthTitle: "Autoryzacja",
  resetAuthDesc: "Kod został wysłany na",
  verificationCode: "Kod weryfikacyjny",
  newPassword: "Nowe hasło (min. 6 znaków)",
  newPasswordMin: "Nowe hasło (min. 6 znaków)",
  confirmNewPassword: "Potwierdź nowe hasło",
  cancel: "Anuluj",
  registerPageTitle: "Załóż",
  registerPageTitleHighlight: "konto.",
  registerPageIntro:
    "Ten sam proces co w aplikacji mobilnej EstateOS™: imię, nazwisko, e-mail, telefon z kodem kraju, hasło oraz wybór",
  registerPageIntroPrivate: "osoby prywatnej",
  registerPageIntroAgent: "agenta / biura",
  registerPagePricing: "cenniku",
  firstName: "Imię",
  lastName: "Nazwisko",
  email: "E-mail",
  emailPlaceholder: "jan@example.com",
  passwordMin: "Hasło (min. 6 znaków)",
  passwordRepeat: "Powtórz hasło",
  accountTypeLabel: "Typ konta (jak w aplikacji)",
  accountPrivate: "Osoba prywatna",
  accountPrivateDesc:
    "Szukasz i wystawiasz — jedno konto, bez podziału kupujący/sprzedający.",
  accountAgent: "Agent / biuro",
  accountAgentDesc: "Pośrednik z nazwą firmy (pole biura wymagane).",
  proPricingNote:
    "Pakiety Investor Pro i onboarding partnera — tylko w cenniku na stronie, nie przy rejestracji.",
  agencyName: "Nazwa biura",
  agencyPlaceholder: "Nazwa agencji",
  checkingEmail: "Sprawdzam e-mail…",
  emailTaken: "E-mail już zarejestrowany",
  acceptTermsPrefix: "Akceptuję",
  termsLink: "regulamin",
  acceptTermsMiddle: "oraz",
  privacyLink: "politykę prywatności",
  submitRegister: "Załóż konto",
  submittingRegister: "Tworzę konto…",
  hasAccount: "Masz konto?",
  signInLink: "Zaloguj się",
  errNameRequired: "Podaj imię i nazwisko.",
  errEmailInvalid: "Podaj prawidłowy adres e-mail.",
  errPhoneInvalid: "Podaj prawidłowy numer telefonu (z kodem kraju).",
  errPasswordShort: "Hasło musi mieć co najmniej 6 znaków.",
  errPasswordMismatch: "Hasła nie są identyczne.",
  errAgencyShort: "Podaj nazwę biura nieruchomości (min. 2 znaki).",
  errTerms: "Zaakceptuj regulamin i politykę prywatności.",
  errEmailTaken: "Ten adres e-mail jest już zarejestrowany.",
  errPhoneTaken: "Ten numer telefonu jest już w użyciu.",
  errRegisterFailed: "Rejestracja nie powiodła się.",
  successRegister: "Konto utworzone. Przekierowuję…",
  errConnection: "Błąd połączenia z serwerem.",
  resetCodeSent: "Kod weryfikacyjny został wysłany na Twój adres e-mail lub telefon.",
  passwordChanged: "Hasło zostało zmienione. Możesz się teraz zalogować.",
  resetInvalidCode: "Nieprawidłowy kod lub błąd weryfikacji.",
};

const en: AuthDictionary = {
  backToMap: "← Back to map",
  loginTitle: "Sign",
  loginTitleMuted: "in.",
  recoverTitle: "Recover",
  recoverTitleHighlight: "access.",
  emailOrPhone: "Email or phone",
  emailOrPhonePlaceholder: "you@example.com or +48…",
  password: "Password",
  passwordPlaceholder: "••••••••",
  forgotPassword: "Forgot password",
  submitLogin: "Sign in ➔",
  noAccount: "No account?",
  registerLink: "Create account",
  passkeyDivider: "Biometric sign-in",
  passkeyButton: "Passkey / Face ID",
  passkeyCancelled: "Cancelled or Face ID / Touch ID error.",
  passkeyFailed: "Biometric verification failed.",
  connectionError: "Connection error.",
  invalidCredentials: "Invalid email or password.",
  otpRequired: "Enter the SMS code sent during registration.",
  smsAuthTitle: "SMS verification",
  smsAuthSent: "A verification code was sent to",
  smsAuthValidity: "Code valid for: 24 hours",
  smsAuthHint:
    "For security we do not resend codes. Find your EstateOS SMS and enter the 6-digit PIN.",
  smsCodeLabel: "Your 6-digit SMS code",
  smsCodePlaceholder: "000000",
  verifyPhone: "Verify phone",
  backToLogin: "Back to sign in",
  resetTitle: "Reset password",
  resetDesc: "Enter email or phone. We will send a code via SMS or email.",
  sendCode: "Send code",
  resetSent: "A verification code was sent to your email or phone.",
  resetAuthTitle: "Verification",
  resetAuthDesc: "Code sent to",
  verificationCode: "Verification code",
  newPassword: "New password (min. 6 characters)",
  newPasswordMin: "New password (min. 6 characters)",
  confirmNewPassword: "Confirm new password",
  cancel: "Cancel",
  registerPageTitle: "Create",
  registerPageTitleHighlight: "account.",
  registerPageIntro:
    "Same flow as the EstateOS™ mobile app: name, email, phone with country code, password, and",
  registerPageIntroPrivate: "private individual",
  registerPageIntroAgent: "agent / agency",
  registerPagePricing: "pricing",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  emailPlaceholder: "you@example.com",
  passwordMin: "Password (min. 6 characters)",
  passwordRepeat: "Repeat password",
  accountTypeLabel: "Account type (same as app)",
  accountPrivate: "Private individual",
  accountPrivateDesc: "Search and list — one account, no buyer/seller split.",
  accountAgent: "Agent / agency",
  accountAgentDesc: "Broker with company name (required).",
  proPricingNote:
    "Investor Pro and partner onboarding are only on the site pricing page, not at registration.",
  agencyName: "Agency name",
  agencyPlaceholder: "Agency name",
  checkingEmail: "Checking email…",
  emailTaken: "Email already registered",
  acceptTermsPrefix: "I accept the",
  termsLink: "terms",
  acceptTermsMiddle: "and",
  privacyLink: "privacy policy",
  submitRegister: "Create account",
  submittingRegister: "Creating account…",
  hasAccount: "Already have an account?",
  signInLink: "Sign in",
  errNameRequired: "Enter first and last name.",
  errEmailInvalid: "Enter a valid email address.",
  errPhoneInvalid: "Enter a valid phone number (with country code).",
  errPasswordShort: "Password must be at least 6 characters.",
  errPasswordMismatch: "Passwords do not match.",
  errAgencyShort: "Enter agency name (min. 2 characters).",
  errTerms: "Accept the terms and privacy policy.",
  errEmailTaken: "This email is already registered.",
  errPhoneTaken: "This phone number is already in use.",
  errRegisterFailed: "Registration failed.",
  successRegister: "Account created. Redirecting…",
  errConnection: "Server connection error.",
  resetCodeSent: "A verification code was sent to your email or phone.",
  passwordChanged: "Password updated. You can sign in now.",
  resetInvalidCode: "Invalid code or verification error.",
};

const uk: AuthDictionary = {
  backToMap: "← Повернутися до карти",
  loginTitle: "Увійти",
  loginTitleMuted: "в систему.",
  recoverTitle: "Відновити",
  recoverTitleHighlight: "доступ.",
  emailOrPhone: "E-mail або телефон",
  emailOrPhonePlaceholder: "you@example.com або +48…",
  password: "Пароль",
  passwordPlaceholder: "••••••••",
  forgotPassword: "Забули пароль",
  submitLogin: "Увійти ➔",
  noAccount: "Немає акаунта?",
  registerLink: "Створити акаунт",
  passkeyDivider: "Біометричний вхід",
  passkeyButton: "Passkey / Face ID",
  passkeyCancelled: "Скасовано або помилка Face ID / Touch ID.",
  passkeyFailed: "Біометричну перевірку не пройдено.",
  connectionError: "Помилка з'єднання.",
  invalidCredentials: "Невірний e-mail або пароль.",
  otpRequired: "Введіть SMS-код, надісланий під час реєстрації.",
  smsAuthTitle: "SMS-верифікація",
  smsAuthSent: "Код верифікації надіслано на",
  smsAuthValidity: "Код дійсний: 24 години",
  smsAuthHint:
    "З міркувань безпеки ми не надсилаємо коди повторно. Знайдіть SMS від EstateOS і введіть 6-значний PIN.",
  smsCodeLabel: "Ваш 6-значний SMS-код",
  smsCodePlaceholder: "000000",
  verifyPhone: "Підтвердити телефон",
  backToLogin: "Повернутися до входу",
  resetTitle: "Скинути пароль",
  resetDesc: "Введіть e-mail або телефон. Ми надішлемо код через SMS або e-mail.",
  sendCode: "Надіслати код",
  resetSent: "Код верифікації надіслано на ваш e-mail або телефон.",
  resetAuthTitle: "Верифікація",
  resetAuthDesc: "Код надіслано на",
  verificationCode: "Код верифікації",
  newPassword: "Новий пароль (мін. 6 символів)",
  newPasswordMin: "Новий пароль (мін. 6 символів)",
  confirmNewPassword: "Підтвердіть новий пароль",
  cancel: "Скасувати",
  registerPageTitle: "Створити",
  registerPageTitleHighlight: "акаунт.",
  registerPageIntro:
    "Той самий процес, що й у мобільному застосунку EstateOS™: ім'я, e-mail, телефон з кодом країни, пароль та вибір",
  registerPageIntroPrivate: "приватної особи",
  registerPageIntroAgent: "агента / агентства",
  registerPagePricing: "ціннику",
  firstName: "Ім'я",
  lastName: "Прізвище",
  email: "E-mail",
  emailPlaceholder: "you@example.com",
  passwordMin: "Пароль (мін. 6 символів)",
  passwordRepeat: "Повторіть пароль",
  accountTypeLabel: "Тип акаунта (як у застосунку)",
  accountPrivate: "Приватна особа",
  accountPrivateDesc: "Шукаєте та публікуєте — один акаунт без поділу покупець/продавець.",
  accountAgent: "Агент / агентство",
  accountAgentDesc: "Брокер із назвою компанії (поле агентства обов'язкове).",
  proPricingNote:
    "Пакети Investor Pro та onboarding партнера — лише на сторінці цінника, не під час реєстрації.",
  agencyName: "Назва агентства",
  agencyPlaceholder: "Назва агентства",
  checkingEmail: "Перевірка e-mail…",
  emailTaken: "E-mail уже зареєстровано",
  acceptTermsPrefix: "Приймаю",
  termsLink: "регламент",
  acceptTermsMiddle: "та",
  privacyLink: "політику конфіденційності",
  submitRegister: "Створити акаунт",
  submittingRegister: "Створення акаунта…",
  hasAccount: "Вже маєте акаунт?",
  signInLink: "Увійти",
  errNameRequired: "Введіть ім'я та прізвище.",
  errEmailInvalid: "Введіть коректну адресу e-mail.",
  errPhoneInvalid: "Введіть коректний номер телефону (з кодом країни).",
  errPasswordShort: "Пароль має містити щонайменше 6 символів.",
  errPasswordMismatch: "Паролі не збігаються.",
  errAgencyShort: "Введіть назву агентства (мін. 2 символи).",
  errTerms: "Прийміть регламент і політику конфіденційності.",
  errEmailTaken: "Цей e-mail уже зареєстровано.",
  errPhoneTaken: "Цей номер телефону уже використовується.",
  errRegisterFailed: "Реєстрація не вдалася.",
  successRegister: "Акаунт створено. Перенаправлення…",
  errConnection: "Помилка з'єднання з сервером.",
  resetCodeSent: "Код верифікації надіслано на ваш e-mail або телефон.",
  passwordChanged: "Пароль оновлено. Тепер можете увійти.",
  resetInvalidCode: "Невірний код або помилка верифікації.",
};

export function getAuthDictionary(locale: Locale): AuthDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
