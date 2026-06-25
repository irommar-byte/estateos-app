import type { Locale } from './config';

export type PortalOnboardingDictionary = {
  loading: string;
  inviteMissingTitle: string;
  inviteMissingBody: string;
  backHome: string;
  brand: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroSubtitle: string;
  statImport: string;
  statImportValue: string;
  statTime: string;
  statTimeValue: string;
  statCost: string;
  statCostValue: string;
  step1: string;
  step1Label: string;
  step1Placeholder: string;
  previewCta: string;
  previewReady: string;
  photosToCopy: (n: number) => string;
  step2: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  emailTaken: string;
  phoneTaken: string;
  rightsLabel: string;
  termsLabel: string;
  termsLink: string;
  privacyLink: string;
  submitCta: string;
  footerNote: string;
  successTitle: string;
  successBody: (offerId: number, images: number) => string;
  successCta: string;
  publishing: string;
  publishingTitle: string;
  progressAccount: string;
  progressFetch: string;
  progressRewrite: string;
  progressPhotos: string;
  progressPublish: string;
  radarEyebrow: string;
  radarTitle: (count: number) => string;
  radarSubtitle: (city: string) => string;
  radarHighIntent: (n: number) => string;
  radarEcosystem: (total: number) => string;
  radarScanning: string;
  radarAfterPublish: string;
  sourceOtodom: string;
  sourceOlx: string;
  sourceNieruchomosci: string;
  priceNegotiable: string;
  perMonth: string;
};

const pl: PortalOnboardingDictionary = {
  loading: 'Ładowanie…',
  inviteMissingTitle: 'Link zaproszenia jest niekompletny',
  inviteMissingBody:
    'Poproś zespół EstateOS o pełny link do formularza — powinien zawierać parametr zaproszenia.',
  backHome: 'Wróć na stronę główną',
  brand: 'EstateOS™',
  heroTitle: 'Przenieś ogłoszenie',
  heroTitleAccent: 'na mapę EstateOS™',
  heroSubtitle:
    'Wklej link z OtoDom lub innego portalu, załóż konto — skopiujemy treść i zdjęcia 1:1 z portalu i przekażemy ogłoszenie do weryfikacji na Twoim profilu.',
  statImport: 'Import z portali',
  statImportValue: 'OtoDom · OLX',
  statTime: 'Czas',
  statTimeValue: '~2 minuty',
  statCost: 'Koszt startu',
  statCostValue: '0 zł',
  step1: 'Link do ogłoszenia',
  step1Label: 'Adres URL z OtoDom, OLX lub Nieruchomosci-Online',
  step1Placeholder: 'https://www.otodom.pl/pl/oferta/...',
  previewCta: 'Podgląd ogłoszenia',
  previewReady: 'gotowe do importu',
  photosToCopy: (n) => `${n} zdjęć do skopiowania`,
  step2: 'Twoje dane — profil właściciela',
  firstName: 'Imię',
  lastName: 'Nazwisko',
  email: 'E-mail',
  phone: 'Telefon',
  password: 'Hasło (min. 6 znaków)',
  emailTaken: 'Ten e-mail jest już zajęty.',
  phoneTaken: 'Ten numer jest już w użyciu.',
  rightsLabel:
    'Oświadczam, że jestem właścicielem lub upoważnionym przedstawicielem tej nieruchomości i mam prawo publikować dane oraz zdjęcia z wklejonego ogłoszenia w EstateOS™.',
  termsLabel: 'Akceptuję',
  termsLink: 'Regulamin',
  privacyLink: 'Politykę prywatności',
  submitCta: 'Zarejestruj się i opublikuj moje ogłoszenie',
  footerNote:
    'Po akceptacji przez zespół EstateOS™ oferta pojawi się na mapie i w Radarze — kupujący z dopasowanymi kryteriami dostaną powiadomienie.',
  successTitle: 'Ogłoszenie przekazane do weryfikacji',
  successBody: (offerId, images) =>
    images > 0
      ? `Oferta #${offerId} jest na Twoim profilu (status: oczekujące) wraz z ${images} zdjęciami i oryginalnym opisem. Zespół sprawdzi ją przed publikacją — za chwilę pokażemy Ci panel.`
      : `Oferta #${offerId} jest na Twoim profilu i czeka na weryfikację. Za chwilę pokażemy Ci, co dalej.`,
  successCta: 'Przejdź do profilu',
  publishing: 'Importujemy…',
  publishingTitle: 'Przenosimy ogłoszenie do EstateOS™',
  progressAccount: 'Tworzenie konta',
  progressFetch: 'Pobieranie ogłoszenia',
  progressRewrite: 'Kopiowanie opisu z portalu',
  progressPhotos: 'Kopiowanie zdjęć',
  progressPublish: 'Przekazanie do weryfikacji',
  radarEyebrow: 'Podgląd Radaru',
  radarTitle: (count) =>
    count === 1 ? '1 inwestor czeka na taką ofertę' : `${count} inwestorów czeka na taką ofertę`,
  radarSubtitle: (city) =>
    `Po publikacji i ustawieniu Radaru — kupujący szukający w ${city || 'Twojej okolicy'} dostaną powiadomienie.`,
  radarHighIntent: (n) => `${n} z bardzo wysokim dopasowaniem profilu`,
  radarEcosystem: (total) => `${total.toLocaleString('pl-PL')} aktywnych profili w ekosystemie EstateOS™`,
  radarScanning: 'Skanujemy dopasowania…',
  radarAfterPublish: 'Powiadomienia wysyłamy automatycznie po aktywacji oferty na mapie.',
  sourceOtodom: 'OtoDom',
  sourceOlx: 'OLX',
  sourceNieruchomosci: 'Nieruchomosci-Online',
  priceNegotiable: 'Cena do uzgodnienia',
  perMonth: 'zł / mies.',
};

const en: PortalOnboardingDictionary = {
  ...pl,
  loading: 'Loading…',
  inviteMissingTitle: 'Invitation link is incomplete',
  inviteMissingBody: 'Ask the EstateOS team for the full form link — it must include the invitation parameter.',
  backHome: 'Back to homepage',
  heroTitle: 'Bring your listing',
  heroTitleAccent: 'to the EstateOS™ map',
  heroSubtitle:
    'Paste a link from OtoDom or another portal, create an account — we copy content and photos 1:1 and submit your listing for review on your profile.',
  statImport: 'Portal import',
  statImportValue: 'OtoDom · OLX',
  statTime: 'Time',
  statTimeValue: '~2 minutes',
  statCost: 'Start cost',
  statCostValue: '0 PLN',
  step1: 'Listing link',
  step1Label: 'URL from OtoDom, OLX or Nieruchomosci-Online',
  step1Placeholder: 'https://www.otodom.pl/pl/oferta/...',
  previewCta: 'Preview listing',
  previewReady: 'ready to import',
  photosToCopy: (n) => `${n} photos to copy`,
  step2: 'Your details — owner profile',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  password: 'Password (min. 6 characters)',
  emailTaken: 'This email is already taken.',
  phoneTaken: 'This phone number is already in use.',
  rightsLabel:
    'I confirm I am the owner or authorised representative and may publish the data and photos from the pasted listing on EstateOS™.',
  termsLabel: 'I accept the',
  termsLink: 'Terms',
  privacyLink: 'Privacy Policy',
  submitCta: 'Register and publish my listing',
  footerNote:
    'After team approval your listing appears on the map and Radar — matching buyers get notified.',
  successTitle: 'Listing submitted for review',
  successBody: (offerId, images) =>
    images > 0
      ? `Listing #${offerId} is on your profile (pending) with ${images} photos and the original description. We will guide you through the panel next.`
      : `Listing #${offerId} is on your profile awaiting review.`,
  successCta: 'Go to profile',
  publishing: 'Importing…',
  publishingTitle: 'Moving your listing to EstateOS™',
  progressRewrite: 'Copying description from portal',
  progressPublish: 'Submitting for review',
  radarEyebrow: 'Radar preview',
  radarTitle: (count) =>
    count === 1 ? '1 investor is waiting for a listing like this' : `${count} investors are waiting for a listing like this`,
  radarSubtitle: (city) =>
    `After publication and Radar setup — buyers searching in ${city || 'your area'} will be notified.`,
  radarHighIntent: (n) => `${n} with a very strong profile match`,
  radarEcosystem: (total) => `${total.toLocaleString('en-US')} active profiles in the EstateOS™ ecosystem`,
  radarScanning: 'Scanning matches…',
  radarAfterPublish: 'Notifications are sent automatically once the listing is live on the map.',
  sourceOtodom: 'OtoDom',
  sourceOlx: 'OLX',
  sourceNieruchomosci: 'Nieruchomosci-Online',
  priceNegotiable: 'Price on request',
  perMonth: 'PLN / month',
};

const uk: PortalOnboardingDictionary = {
  ...en,
  loading: 'Завантаження…',
  inviteMissingTitle: 'Посилання запрошення неповне',
  inviteMissingBody: 'Попросіть команду EstateOS надіслати повне посилання на форму.',
  backHome: 'На головну',
  heroTitle: 'Перенесіть оголошення',
  heroTitleAccent: 'на мапу EstateOS™',
  heroSubtitle:
    'Вставте посилання з OtoDom або іншого порталу, створіть обліковий запис — ми перепишемо текст, скопіюємо фото та опублікуємо на вашому профілі.',
  statCostValue: '0 zł',
  step1: 'Посилання на оголошення',
  previewCta: 'Перегляд оголошення',
  step2: 'Ваші дані — профіль власника',
  submitCta: 'Зареєструватися та опублікувати оголошення',
  radarTitle: (count) =>
    count === 1 ? '1 інвестор чекає на таку пропозицію' : `${count} інвесторів чекають на таку пропозицію`,
  radarScanning: 'Скануємо відповідності…',
};

const MAP: Record<Locale, PortalOnboardingDictionary> = { pl, en, uk };

export function getPortalOnboardingDict(locale: Locale): PortalOnboardingDictionary {
  return MAP[locale] ?? pl;
}
