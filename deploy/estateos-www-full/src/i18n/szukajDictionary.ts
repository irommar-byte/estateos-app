import type { Locale } from "./config";

export type SzukajDictionary = {
  propertyTypes: string[];
  amenities: string[];
  defaultPropertyType: string;
  otpInvalid: string;
  serverError: string;
  registerError: string;
  connectionError: string;
  verifyTitle: string;
  verifyTitleAccent: string;
  verifySent: string;
  verifyConfirm: string;
  back: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroSubtitle: string;
  loggedInAs: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailAvailable: string;
  emailTaken: string;
  emailTakenHint: string;
  passwordLabel: string;
  phoneLabel: string;
  phoneAvailable: string;
  phoneTaken: string;
  phoneTakenHint: string;
  cityLabel: string;
  districtsLabel: string;
  propertyTypeLabel: string;
  maxBudgetLabel: string;
  maxBudgetPlaceholder: string;
  maxBudgetHint: string;
  minAreaLabel: string;
  minAreaPlaceholder: string;
  minRoomsLabel: string;
  roomsAny: string;
  roomsStudio: string;
  roomsN: (n: number) => string;
  amenitiesLabel: string;
  buyerTypeLabel: string;
  buyerPrivate: string;
  buyerInvestor: string;
  trustDataTitle: string;
  trustDataBody: string;
  trustInfoTitle: string;
  trustInfoBody: string;
  trustQualityTitle: string;
  trustQualityBody: string;
  termsLabel: string;
  submitActivating: string;
  submitIncomplete: string;
  submitCta: string;
};

const pl: SzukajDictionary = {
  propertyTypes: ["Mieszkanie", "Segment", "Dom Wolnostojący", "Lokal Użytkowy", "Działka"],
  amenities: ["Balkon", "Garaż/Miejsce park.", "Piwnica/Pom. gosp.", "Ogródek", "Dwupoziomowe", "Winda"],
  defaultPropertyType: "Mieszkanie",
  otpInvalid: "Nieprawidłowy kod SMS.",
  serverError: "Błąd serwera",
  registerError: "Wystąpił błąd podczas rejestracji.",
  connectionError: "Błąd połączenia z serwerem.",
  verifyTitle: "Weryfikacja",
  verifyTitleAccent: "SMS",
  verifySent: "Wysłaliśmy 6-cyfrowy kod na podany numer",
  verifyConfirm: "Potwierdź Kod",
  back: "← Wróć",
  heroTitle: "Kupujesz?",
  heroTitleAccent: "Znajdziemy to.",
  heroSubtitle:
    "Zdefiniuj parametry. Nasz inteligentny system prześle Ci priorytetowe powiadomienie, gdy tylko pojawi się idealna oferta.",
  loggedInAs: "Zalogowano jako",
  nameLabel: "Imię i Nazwisko",
  namePlaceholder: "np. Jan Kowalski",
  emailLabel: "E-mail (do logowania)",
  emailPlaceholder: "jan@kowalski.pl",
  emailAvailable: "WOLNY",
  emailTaken: "ZAJĘTY",
  emailTakenHint: "Konto z tym adresem już istnieje. Zaloguj się.",
  passwordLabel: "Hasło (min. 6 znaków)",
  phoneLabel: "Numer telefonu",
  phoneAvailable: "WOLNY",
  phoneTaken: "ZAJĘTY",
  phoneTakenHint: "Ten numer jest przypisany do innego konta. Zaloguj się.",
  cityLabel: "Miasto",
  districtsLabel: "Zaznacz dzielnice",
  propertyTypeLabel: "Typ Nieruchomości",
  maxBudgetLabel: "Maksymalny Budżet (PLN)",
  maxBudgetPlaceholder: "2 000 000",
  maxBudgetHint:
    "Podaj ostateczną, górną granicę inwestycji. Zaniżenie kwoty choćby o 1 PLN wykluczy z systemu potencjalnie idealne oferty.",
  minAreaLabel: "Minimalny metraż (m²)",
  minAreaPlaceholder: "np. 45",
  minRoomsLabel: "Min. Liczba Pokoi",
  roomsAny: "Dowolna",
  roomsStudio: "1 (Kawalerka)",
  roomsN: (n) => `${n}`,
  amenitiesLabel: "Wymagane Udogodnienia",
  buyerTypeLabel: "Profil Inwestora",
  buyerPrivate: "Kupuję na własne potrzeby",
  buyerInvestor: "Inwestor / Flip",
  trustDataTitle: "Pełna Kontrola Danych",
  trustDataBody:
    "To Ty decydujesz, komu i kiedy udostępniasz swój numer telefonu lub e-mail. Dane przekazywane są wyłącznie wybranym osobom po umówieniu prezentacji. Nigdy wcześniej.",
  trustInfoTitle: "Prawdziwe Informacje",
  trustInfoBody:
    "Podanie prawidłowych i działających danych kontaktowych jest kluczowe. Usprawnia to proces rezerwacji i gwarantuje sprawne zarządzanie terminami.",
  trustQualityTitle: "System Jakości",
  trustQualityBody:
    "Platforma monitoruje rzetelność użytkowników. Po odbytej prezentacji obie strony wystawiają sobie wzajemne opinie, budując zaufanie całej społeczności.",
  termsLabel:
    "Zgadzam się na warunki korzystania z platformy. Oświadczam, że wprowadzone przeze mnie dane są prawdziwe. Rozumiem, że system weryfikuje użytkowników w trosce o najwyższy standard obsługi.",
  submitActivating: "Aktywacja systemu...",
  submitIncomplete: "Wypełnij i Zaakceptuj Warunki",
  submitCta: "Uruchom Inteligentny System Dopasowań",
};

const en: SzukajDictionary = {
  ...pl,
  propertyTypes: ["Apartment", "Semi-detached", "Detached house", "Commercial", "Plot"],
  amenities: ["Balcony", "Garage/Parking", "Storage", "Garden", "Duplex", "Elevator"],
  defaultPropertyType: "Apartment",
  otpInvalid: "Invalid SMS code.",
  serverError: "Server error",
  registerError: "Registration failed.",
  connectionError: "Connection error.",
  verifyTitle: "SMS",
  verifyTitleAccent: "verification",
  verifySent: "We sent a 6-digit code to",
  verifyConfirm: "Confirm code",
  back: "← Back",
  heroTitle: "Buying?",
  heroTitleAccent: "We'll find it.",
  heroSubtitle:
    "Set your criteria. Our smart system will send you a priority alert when the perfect listing appears.",
  loggedInAs: "Signed in as",
  nameLabel: "Full name",
  namePlaceholder: "e.g. John Smith",
  emailLabel: "Email (for login)",
  emailPlaceholder: "you@example.com",
  emailAvailable: "AVAILABLE",
  emailTaken: "TAKEN",
  emailTakenHint: "An account with this email exists. Sign in.",
  passwordLabel: "Password (min. 6 characters)",
  phoneLabel: "Phone number",
  phoneAvailable: "AVAILABLE",
  phoneTaken: "TAKEN",
  phoneTakenHint: "This number is linked to another account. Sign in.",
  cityLabel: "City",
  districtsLabel: "Select districts",
  propertyTypeLabel: "Property type",
  maxBudgetLabel: "Maximum budget (PLN)",
  maxBudgetPlaceholder: "2,000,000",
  maxBudgetHint:
    "Enter your final upper investment limit. Even 1 PLN below may exclude a perfect match.",
  minAreaLabel: "Minimum area (m²)",
  minAreaPlaceholder: "e.g. 45",
  minRoomsLabel: "Min. rooms",
  roomsAny: "Any",
  roomsStudio: "1 (Studio)",
  roomsN: (n) => `${n}`,
  amenitiesLabel: "Required amenities",
  buyerTypeLabel: "Buyer profile",
  buyerPrivate: "Buying for myself",
  buyerInvestor: "Investor / flip",
  trustDataTitle: "Full data control",
  trustDataBody:
    "You decide who gets your phone or email and when — only after scheduling a viewing. Never before.",
  trustInfoTitle: "Accurate information",
  trustInfoBody:
    "Valid contact details are essential for smooth booking and scheduling.",
  trustQualityTitle: "Quality system",
  trustQualityBody:
    "The platform tracks reliability. After viewings, both sides leave reviews to build trust.",
  termsLabel:
    "I accept the platform terms. I confirm my data is accurate. I understand user verification protects service quality.",
  submitActivating: "Activating...",
  submitIncomplete: "Complete form and accept terms",
  submitCta: "Start smart matching",
};

const uk: SzukajDictionary = {
  ...en,
  propertyTypes: ["Квартира", "Сегмент", "Будинок", "Комерційна", "Ділянка"],
  amenities: ["Балкон", "Гараж/Паркування", "Комора", "Сад", "Дуплекс", "Ліфт"],
  defaultPropertyType: "Квартира",
  otpInvalid: "Невірний SMS-код.",
  serverError: "Помилка сервера",
  registerError: "Реєстрація не вдалася.",
  connectionError: "Помилка з'єднання.",
  verifyTitle: "SMS-",
  verifyTitleAccent: "верифікація",
  verifySent: "Ми надіслали 6-значний код на номер",
  verifyConfirm: "Підтвердити код",
  back: "← Назад",
  heroTitle: "Купуєте?",
  heroTitleAccent: "Ми знайдемо.",
  heroSubtitle:
    "Задайте параметри. Розумна система надішле пріоритетне сповіщення, коли з'явиться ідеальне оголошення.",
  loggedInAs: "Увійшли як",
  nameLabel: "Ім'я та прізвище",
  namePlaceholder: "напр. Іван Коваленко",
  emailLabel: "E-mail (для входу)",
  emailPlaceholder: "vasyl@example.com",
  emailAvailable: "ВІЛЬНИЙ",
  emailTaken: "ЗАЙНЯТИЙ",
  emailTakenHint: "Акаунт з цим e-mail уже існує. Увійдіть.",
  passwordLabel: "Пароль (мін. 6 символів)",
  phoneLabel: "Номер телефону",
  phoneAvailable: "ВІЛЬНИЙ",
  phoneTaken: "ЗАЙНЯТИЙ",
  phoneTakenHint: "Цей номер прив'язано до іншого акаунта. Увійдіть.",
  cityLabel: "Місто",
  districtsLabel: "Оберіть райони",
  propertyTypeLabel: "Тип нерухомості",
  maxBudgetLabel: "Максимальний бюджет (PLN)",
  maxBudgetPlaceholder: "2 000 000",
  maxBudgetHint:
    "Вкажіть остаточну верхню межу інвестиції. Навіть на 1 PLN менше може виключити ідеальну пропозицію.",
  minAreaLabel: "Мін. площа (м²)",
  minAreaPlaceholder: "напр. 45",
  minRoomsLabel: "Мін. кімнат",
  roomsAny: "Будь-яка",
  roomsStudio: "1 (Студія)",
  roomsN: (n) => `${n}`,
  amenitiesLabel: "Необхідні зручності",
  buyerTypeLabel: "Профіль покупця",
  buyerPrivate: "Купую для себе",
  buyerInvestor: "Інвестор / фліп",
  trustDataTitle: "Повний контроль даних",
  trustDataBody:
    "Ви вирішуєте, кому і коли надати телефон чи e-mail — лише після домовленості про перегляд. Ніколи раніше.",
  trustInfoTitle: "Достовірна інформація",
  trustInfoBody: "Коректні контактні дані важливі для швидкого бронювання та планування.",
  trustQualityTitle: "Система якості",
  trustQualityBody:
    "Платформа відстежує надійність. Після переглядів обидві сторони залишають відгуки.",
  termsLabel:
    "Приймаю умови платформи. Підтверджую достовірність даних. Розумію, що верифікація захищає якість сервісу.",
  submitActivating: "Активація...",
  submitIncomplete: "Заповніть форму та прийміть умови",
  submitCta: "Запустити розумний підбір",
};

export function getSzukajDictionary(locale: Locale): SzukajDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
