import type { Locale } from "./config";

export type VerificationDictionary = {
  pageBack: string;
  pageEyebrow: string;
  pageTitle: string;
  pageSubtitle: string;
  loading: string;
  verifiedTitle: string;
  verifiedBody: string;
  confirmTitle: string;
  confirmIntroBeforeSms: string;
  confirmIntroAfterSms: string;
  confirmIntroBeforeEmail: string;
  confirmIntroAfterEmail: string;
  confirmBodySms: string;
  confirmBodyEmail: string;
  emailLabel: string;
  phoneLabel: string;
  sendEmailCode: string;
  confirmEmail: string;
  sendSmsCode: string;
  confirmPhone: string;
  noPhone: string;
  fillPhoneLink: string;
  codeSentEmail: string;
  codeSentSms: string;
  emailConfirmed: string;
  phoneConfirmed: string;
  sendFail: string;
  invalidCode: string;
  verifyFail: string;
  smsFail: string;
  smsSendFail: string;
};

const pl: VerificationDictionary = {
  pageBack: "Panel CRM",
  pageEyebrow: "EstateOS™",
  pageTitle: "Weryfikacja konta",
  pageSubtitle:
    "Ten sam standard co w aplikacji: zweryfikowany kontakt buduje zaufanie kupujących i sprzedających.",
  loading: "Ładowanie statusu konta…",
  verifiedTitle: "Konto zweryfikowane",
  verifiedBody: "Możesz publikować ogłoszenia i negocjować jak w aplikacji.",
  confirmTitle: "Potwierdź dane kontaktowe",
  confirmIntroBeforeSms: "Tak jak w aplikacji mobilnej: ",
  confirmIntroAfterSms: " do negocjacji i wizyt, ",
  confirmIntroBeforeEmail: "",
  confirmIntroAfterEmail: " do publikacji ogłoszeń.",
  confirmBodySms: "SMS",
  confirmBodyEmail: "SMS + e-mail",
  emailLabel: "E-mail",
  phoneLabel: "Telefon",
  sendEmailCode: "Wyślij kod (6 cyfr)",
  confirmEmail: "Potwierdź e-mail",
  sendSmsCode: "Wyślij kod SMS (4 cyfry)",
  confirmPhone: "Potwierdź telefon",
  noPhone: "Brak numeru — uzupełnij w CRM (profil).",
  fillPhoneLink: "→ Uzupełnij numer w panelu",
  codeSentEmail: "Kod wysłany na Twój e-mail.",
  codeSentSms: "Kod SMS wysłany.",
  emailConfirmed: "E-mail potwierdzony.",
  phoneConfirmed: "Telefon potwierdzony.",
  sendFail: "Nie udało się wysłać kodu.",
  invalidCode: "Nieprawidłowy kod.",
  verifyFail: "Błąd weryfikacji.",
  smsFail: "Błąd SMS.",
  smsSendFail: "Nie udało się wysłać SMS.",
};

const en: VerificationDictionary = {
  ...pl,
  pageBack: "CRM panel",
  pageTitle: "Account verification",
  pageSubtitle: "Same standard as the mobile app: verified contact builds trust with buyers and sellers.",
  loading: "Loading account status…",
  verifiedTitle: "Account verified",
  verifiedBody: "You can publish listings and negotiate like in the app.",
  confirmTitle: "Confirm contact details",
  confirmIntroBeforeSms: "As in the mobile app: ",
  confirmIntroAfterSms: " for negotiations and visits, ",
  confirmIntroBeforeEmail: "",
  confirmIntroAfterEmail: " to publish listings.",
  confirmBodySms: "SMS",
  confirmBodyEmail: "SMS + email",
  phoneLabel: "Phone",
  sendEmailCode: "Send code (6 digits)",
  confirmEmail: "Confirm email",
  sendSmsCode: "Send SMS code (4 digits)",
  confirmPhone: "Confirm phone",
  noPhone: "No number — add it in CRM (profile).",
  fillPhoneLink: "→ Add number in panel",
  codeSentEmail: "Code sent to your email.",
  codeSentSms: "SMS code sent.",
  emailConfirmed: "Email confirmed.",
  phoneConfirmed: "Phone confirmed.",
  sendFail: "Could not send code.",
  invalidCode: "Invalid code.",
  verifyFail: "Verification failed.",
  smsFail: "SMS error.",
  smsSendFail: "Could not send SMS.",
};

const uk: VerificationDictionary = {
  ...en,
  pageBack: "Панель CRM",
  pageTitle: "Верифікація акаунта",
  pageSubtitle: "Той самий стандарт, що в застосунку: верифікований контакт будує довіру.",
  loading: "Завантаження статусу акаунта…",
  verifiedTitle: "Акаунт верифіковано",
  verifiedBody: "Можете публікувати оголошення та вести переговори як у застосунку.",
  confirmTitle: "Підтвердіть контактні дані",
  confirmIntroBeforeSms: "Як у мобільному застосунку: ",
  confirmIntroAfterSms: " для переговорів і візитів, ",
  confirmIntroAfterEmail: " для публікації оголошень.",
  confirmBodySms: "SMS",
  confirmBodyEmail: "SMS + e-mail",
  phoneLabel: "Телефон",
  sendEmailCode: "Надіслати код (6 цифр)",
  confirmEmail: "Підтвердити e-mail",
  sendSmsCode: "Надіслати SMS-код (4 цифри)",
  confirmPhone: "Підтвердити телефон",
  noPhone: "Немає номера — додайте в CRM (профіль).",
  fillPhoneLink: "→ Додати номер у панелі",
  codeSentEmail: "Код надіслано на e-mail.",
  codeSentSms: "SMS-код надіслано.",
  emailConfirmed: "E-mail підтверджено.",
  phoneConfirmed: "Телефон підтверджено.",
  sendFail: "Не вдалося надіслати код.",
  invalidCode: "Невірний код.",
  verifyFail: "Помилка верифікації.",
  smsFail: "Помилка SMS.",
  smsSendFail: "Не вдалося надіслати SMS.",
};

export function getVerificationDictionary(locale: Locale): VerificationDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
