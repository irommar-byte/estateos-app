import type { Locale } from "./config";

export type DeleteAccountDictionary = {
  title: string;
  updated: string;
  intro: string;
  method1Title: string;
  method1Steps: string[];
  passkeyHint: string;
  method2Title: string;
  method2Body: string;
  deletedTitle: string;
  deletedItems: string[];
  retainedTitle: string;
  retainedBody: string;
  termsLink: string;
  privacyLink: string;
  privacyLabel: string;
};

const pl: DeleteAccountDictionary = {
  title: "Usunięcie konta EstateOS",
  updated: "Ostatnia aktualizacja: 15 czerwca 2026",
  intro:
    "Jeśli masz konto w aplikacji EstateOS, możesz poprosić o trwałe usunięcie konta i powiązanych danych osobowych. Usunięcie jest nieodwracalne.",
  method1Title: "Sposób 1 — w aplikacji (zalecany)",
  method1Steps: [
    "Otwórz aplikację EstateOS i zaloguj się.",
    "Przejdź do zakładki Profil.",
    "Wybierz Usuń konto (na dole ustawień konta).",
    "Potwierdź hasłem i zatwierdź trwałe usunięcie.",
  ],
  passkeyHint:
    "Jeśli logujesz się wyłącznie przez Passkey (Face ID) i nie masz hasła, najpierw ustaw hasło przez opcję „Nie pamiętam hasła” na ekranie logowania, a następnie powtórz usunięcie konta.",
  method2Title: "Sposób 2 — e-mail",
  method2Body:
    "Możesz też wysłać prośbę z adresu e-mail przypisanego do konta na: privacy@estateos.pl. W wiadomości podaj adres e-mail konta. Odpowiemy w rozsądnym terminie po weryfikacji tożsamości.",
  deletedTitle: "Co zostaje usunięte",
  deletedItems: [
    "dane profilu (imię, e-mail konta, avatar),",
    "preferencje radaru i ustawienia aplikacji powiązane z kontem,",
    "klucze Passkey przypisane do konta,",
    "dostęp do wiadomości i deal roomów powiązanych z kontem.",
  ],
  retainedTitle: "Co może zostać zachowane",
  retainedBody:
    "Dane wymagane prawem (np. krótkie logi bezpieczeństwa, rozliczenia) lub anonimowe statystyki mogą być przechowywane przez okres wynikający z przepisów. Opublikowane ogłoszenia mogą zostać zarchiwizowane lub zdjęte zgodnie z regulaminem — szczegóły w regulaminie.",
  termsLink: "regulaminie",
  privacyLink: "/polityka-prywatnosci",
  privacyLabel: "Polityka prywatności:",
};

const en: DeleteAccountDictionary = {
  ...pl,
  title: "Delete your EstateOS account",
  updated: "Last updated: 15 June 2026",
  intro:
    "If you have an EstateOS account, you can request permanent deletion of your account and related personal data. This cannot be undone.",
  method1Title: "Method 1 — in the app (recommended)",
  method1Steps: [
    "Open the EstateOS app and sign in.",
    "Go to the Profile tab.",
    "Choose Delete account (at the bottom of account settings).",
    "Confirm with your password and approve permanent deletion.",
  ],
  passkeyHint:
    "If you sign in only with Passkey (Face ID) and have no password, set a password first via Forgot password on the login screen, then delete your account.",
  method2Title: "Method 2 — email",
  method2Body:
    "You can also send a request from the email linked to your account to privacy@estateos.pl. Include your account email. We will respond within a reasonable time after identity verification.",
  deletedTitle: "What is deleted",
  deletedItems: [
    "profile data (name, account email, avatar),",
    "radar preferences and app settings linked to the account,",
    "Passkeys linked to the account,",
    "access to messages and deal rooms linked to the account.",
  ],
  retainedTitle: "What may be retained",
  retainedBody:
    "Data required by law (e.g. short security logs, billing) or anonymous statistics may be kept for the period required by regulations. Published listings may be archived or removed per the terms of service.",
  termsLink: "terms of service",
  privacyLabel: "Privacy policy:",
};

const uk: DeleteAccountDictionary = {
  ...en,
  title: "Видалення акаунта EstateOS",
  updated: "Останнє оновлення: 15 червня 2026",
  intro:
    "Якщо у вас є акаунт EstateOS, ви можете подати запит на остаточне видалення акаунта та пов’язаних персональних даних. Це незворотно.",
  method1Title: "Спосіб 1 — у застосунку (рекомендовано)",
  method1Steps: [
    "Відкрийте застосунок EstateOS і увійдіть.",
    "Перейдіть на вкладку Профіль.",
    "Оберіть Видалити акаунт (внизу налаштувань).",
    "Підтвердіть паролем і затвердіть остаточне видалення.",
  ],
  passkeyHint:
    "Якщо ви входите лише через Passkey (Face ID) без пароля, спочатку встановіть пароль через «Забув пароль» на екрані входу, потім видаліть акаунт.",
  method2Title: "Спосіб 2 — e-mail",
  method2Body:
    "Також надішліть запит з e-mail, прив’язаного до акаунта, на privacy@estateos.pl. Вкажіть e-mail акаунта. Відповімо в розумний термін після верифікації.",
  deletedTitle: "Що видаляється",
  deletedItems: [
    "дані профілю (ім’я, e-mail, аватар),",
    "налаштування Radar і застосунку, пов’язані з акаунтом,",
    "ключі Passkey, прив’язані до акаунта,",
    "доступ до повідомлень і deal room, пов’язаних з акаунтом.",
  ],
  retainedTitle: "Що може зберегтися",
  retainedBody:
    "Дані, вимагані законом (напр. короткі логи безпеки, розрахунки), або анонімна статистика можуть зберігатися відповідно до норм. Опубліковані оголошення можуть бути архівовані згідно з регламентом.",
  termsLink: "регламенті",
  privacyLabel: "Політика конфіденційності:",
};

export function getDeleteAccountDictionary(locale: Locale): DeleteAccountDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
