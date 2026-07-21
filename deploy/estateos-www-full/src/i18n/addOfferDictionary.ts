import type { Locale } from "./config";
import {
  getAddOfferFormExtended,
  type AddOfferFormExtended,
} from "./addOfferFormExtended";

export type AddOfferDictionary = AddOfferFormExtended & {
  formBadge: string;
  title: string;
  titleHighlight: string;
  stepLabel: string;
  stepOf: string;
  stepExperience: string;
  sell: string;
  rent: string;
  step1Title: string;
  step2Title: string;
  step3Title: string;
  step4Title: string;
  step5Title: string;
  step6Title: string;
  conditionLabel: string;
  locationExact: string;
  locationApprox: string;
  locationVisibilityTitle: string;
  locationVisibilityBody: string;
  searchAddress: string;
  searchAddressPlaceholder: string;
  myLocationLabel: string;
  myLocationDenied: string;
  myLocationUnsupported: string;
  cityPlaceholder: string;
  buildingNumberRequired: string;
  city: string;
  district: string;
  areaLabel: string;
  areaPlaceholder: string;
  localityLabel: string;
  countryLabel: string;
  localityAutoHint: string;
  countryAutoHint: string;
  apartmentNumber: string;
  apartmentPlaceholder: string;
  landRegistry: string;
  landRegistryPlaceholder: string;
  pinError: string;
  price: string;
  priceCurrency: string;
  pricePln: string;
  priceEur: string;
  nbpApprox: string;
  area: string;
  rooms: string;
  floor: string;
  description: string;
  descriptionPlaceholder: string;
  amenities: string;
  heating: string;
  photos: string;
  photosMain: string;
  photosUpload: string;
  photosError: string;
  photosDrag: string;
  agencyName: string;
  agencyPlaceholder: string;
  commission: string;
  prev: string;
  next: string;
  publish: string;
  publishing: string;
  limitReached: string;
  verifyAccount: string;
  serverError: string;
  serverErrorHint: string;
  propertyFlat: string;
  propertyHouse: string;
  propertyPlot: string;
  propertyCommercial: string;
  conditionReady: string;
  conditionRenovation: string;
  conditionDeveloper: string;
  amenityBalcony: string;
  amenityGarage: string;
  amenityStorage: string;
  amenityGarden: string;
  amenityDuplex: string;
  amenityElevator: string;
  amenityAc: string;
  heatingCity: string;
  heatingGas: string;
  heatingElectric: string;
  heatingHeatPump: string;
  heatingCoal: string;
  heatingOther: string;
  selectPlaceholder: string;
  mapLoading: string;
  aptNumberPlaceholder: string;
  landRegistryExample: string;
  docVerificationTitle: string;
  docVerificationOptionalBadge: string;
  docVerificationIntro: string;
  docVerificationApartmentLabel: string;
  docVerificationApartmentHintNonFlat: string;
  docVerificationKwLabel: string;
  docVerificationKwHint: string;
  docVerificationKwFormatError: string;
  docVerificationPrivacy: string;
  docVerificationStatusReady: string;
  docVerificationStatusSkip: string;
  docVerificationBenefit1: string;
  docVerificationBenefit2: string;
  docVerificationBenefit3: string;
  docVerificationPreviewKicker: string;
  docVerificationPreviewBody: string;
  docVerificationBadgeLabel: string;
  docVerificationBadgeInactiveLabel: string;
  docVerificationBadgeSublabel: string;
  docVerificationPreviewTrust: string;
  rentPlaceholder: string;
  descriptionPlaceholderAttr: string;
  agencyNamePlaceholder: string;
  floorPlanAlt: string;
  thumbAlt: string;
};

const pl: Omit<AddOfferDictionary, keyof AddOfferFormExtended> = {
  formBadge: "Formularz EstateOS Premium",
  title: "Dodaj",
  titleHighlight: "Ofertę.",
  stepLabel: "Krok",
  stepOf: "z",
  stepExperience: "EstateOS Form Experience",
  sell: "Sprzedaż",
  rent: "Wynajem",
  step1Title: "Rodzaj Nieruchomości",
  step2Title: "Lokalizacja i Mapa",
  step3Title: "Parametry i Cena",
  step4Title: "Opis i Udogodnienia",
  step5Title: "Zdjęcia",
  step6Title: "Publikacja",
  conditionLabel: "Stan wykończenia",
  locationExact: "Dokładna (Szpilka)",
  locationApprox: "Przybliżona (Dysk)",
  locationVisibilityTitle: "Widoczność publiczna:",
  locationVisibilityBody:
    "Przy Dokładnej lokalizacji wyświetlimy nazwę ulicy (i nr budynku dla mieszkań). Przy Przybliżonej pokazujemy jedynie orientacyjny obszar dzielnicy.",
  searchAddress: "Wyszukaj Adres *",
  searchAddressPlaceholder: "Np. Bernardyńska 8, Kalwaria Zebrzydowska",
  myLocationLabel: "Moja lokalizacja",
  myLocationDenied: "Brak dostępu do lokalizacji. Zezwól w ustawieniach przeglądarki.",
  myLocationUnsupported: "Twoja przeglądarka nie obsługuje geolokalizacji.",
  cityPlaceholder: "Np. Kraków lub Kalwaria Zebrzydowska",
  buildingNumberRequired: "Wymagany numer budynku przed przecinkiem.",
  city: "Miasto *",
  district: "Dzielnica *",
  areaLabel: "Obszar / osiedle",
  areaPlaceholder: "Np. osiedle / sołectwo / część miasta",
  localityLabel: "Miejscowość",
  countryLabel: "Państwo",
  localityAutoHint: "Ustalana z mapy i adresu (geokodowanie). Przesuń pinezkę lub wpisz adres z numerem, aby zmienić nazwę.",
  countryAutoHint: "Wykrywane z mapy i kontekstu geokodowania.",
  apartmentNumber: "Nr mieszkania",
  apartmentPlaceholder: "Np. 12",
  landRegistry: "Nr KW (opcjonalnie)",
  landRegistryPlaceholder: "Np. WA1M/00000000/0",
  pinError: "Nie udało się ustawić pinezki. Wybierz adres z listy podpowiedzi.",
  price: "Cena *",
  priceCurrency: "Waluta ceny",
  pricePln: "PLN",
  priceEur: "EUR",
  nbpApprox: "Przeliczenie orientacyjne (NBP):",
  area: "Powierzchnia (m²) *",
  rooms: "Liczba pokoi",
  floor: "Piętro",
  description: "Opis oferty",
  descriptionPlaceholder: "Rozpocznij tworzenie luksusowego opisu...",
  amenities: "Udogodnienia",
  heating: "Ogrzewanie",
  photos: "Galeria zdjęć",
  photosMain: "Główne",
  photosUpload: "Dodaj zdjęcia",
  photosError: "Błąd",
  photosDrag: "Przeciągnij zdjęcia lub kliknij, aby dodać",
  agencyName: "Nazwa biura",
  agencyPlaceholder: "Wpisz nazwę biura...",
  commission: "Prowizja agenta (%)",
  prev: "Wstecz",
  next: "Dalej",
  publish: "Opublikuj ofertę",
  publishing: "Publikuję…",
  limitReached: "Osiągnięto limit aktywnych ogłoszeń. Rozszerz plan w cenniku.",
  verifyAccount: "Zweryfikuj konto (e-mail i telefon), aby publikować oferty.",
  serverError: "Nie udało się zapisać oferty",
  serverErrorHint: "Sprawdź poprawność wprowadzonych danych.",
  propertyFlat: "Mieszkanie",
  propertyHouse: "Dom",
  propertyPlot: "Działka",
  propertyCommercial: "Lokal",
  conditionReady: "Gotowe",
  conditionRenovation: "Do remontu",
  conditionDeveloper: "Deweloperski",
  amenityBalcony: "Balkon / Taras",
  amenityGarage: "Garaż / Parking",
  amenityStorage: "Piwnica / Komórka",
  amenityGarden: "Ogródek",
  amenityDuplex: "Dwupoziomowe",
  amenityElevator: "Winda",
  amenityAc: "Klimatyzacja",
  heatingCity: "Miejskie",
  heatingGas: "Gazowe",
  heatingElectric: "Elektryczne",
  heatingHeatPump: "Pompa Ciepła",
  heatingCoal: "Węglowe/Pellet",
  heatingOther: "Inne",
  selectPlaceholder: "Wybierz...",
  mapLoading: "Ładowanie mapy…",
  aptNumberPlaceholder: "Np. 12",
  landRegistryExample: "WA1M/00012345/9",
  docVerificationTitle: "Weryfikacja księgi wieczystej",
  docVerificationOptionalBadge: "Opcjonalnie",
  docVerificationIntro:
    "Możesz pominąć ten krok — oferta zostanie opublikowana bez znaczka. Podanie numeru lokalu i KW pozwala nam zweryfikować własność i wyróżnić ogłoszenie na stronie.",
  docVerificationApartmentLabel: "Nr lokalu (opcjonalnie)",
  docVerificationApartmentHintNonFlat: "Pole aktywne dla mieszkań — dla domu lub działki nie jest wymagane.",
  docVerificationKwLabel: "Numer księgi wieczystej (opcjonalnie)",
  docVerificationKwHint: "Format: 4 znaki · 8 cyfr · cyfra kontrolna — np. WA1M/00012345/9. Cyfry skalują się na małym ekranie.",
  docVerificationKwFormatError:
    "Nieprawidłowy format KW. Wymagany wzór: WA1M/00012345/9 (4 znaki / 8 cyfr / 1 cyfra).",
  docVerificationPrivacy:
    "Dane chronimy i nie publikujemy publicznie. Po weryfikacji przez zespół EstateOS oferta otrzymuje połyskującą tarczę zaufania na stronie ogłoszenia.",
  docVerificationStatusReady: "Gotowe do weryfikacji",
  docVerificationStatusSkip: "Pominięte",
  docVerificationBenefit1: "Więcej zaufania kupujących",
  docVerificationBenefit2: "Wyróżnienie na liście ofert",
  docVerificationBenefit3: "Połyskująca tarcza 3D na stronie",
  docVerificationPreviewKicker: "Twój znaczek po weryfikacji",
  docVerificationPreviewBody:
    "Tak będzie wyglądać tarcza przy Twojej ofercie — widoczna dla kupujących szukających potwierdzonej własności.",
  docVerificationBadgeLabel: "Zweryfikowany",
  docVerificationBadgeInactiveLabel: "Niezweryfikowany",
  docVerificationBadgeSublabel: "EstateOS™ Quality Shield",
  docVerificationPreviewTrust: "Widoczne tylko po pozytywnej weryfikacji",
  rentPlaceholder: "Np. 1500",
  descriptionPlaceholderAttr: "Rozpocznij tworzenie luksusowego opisu...",
  agencyNamePlaceholder: "Wpisz nazwę biura...",
  floorPlanAlt: "Rzut",
  thumbAlt: "Miniatura",
};

const en: Omit<AddOfferDictionary, keyof AddOfferFormExtended> = {
  formBadge: "EstateOS Premium form",
  title: "Add",
  titleHighlight: "listing.",
  stepLabel: "Step",
  stepOf: "of",
  stepExperience: "EstateOS form experience",
  sell: "Sale",
  rent: "Rent",
  step1Title: "Property type",
  step2Title: "Location & map",
  step3Title: "Details & price",
  step4Title: "Description & amenities",
  step5Title: "Photos",
  step6Title: "Publish",
  conditionLabel: "Condition",
  locationExact: "Exact (pin)",
  locationApprox: "Approximate (area)",
  locationVisibilityTitle: "Public visibility:",
  locationVisibilityBody:
    "With exact location we show the street name (and building no. for flats). With approximate we show only the district area.",
  searchAddress: "Search address *",
  searchAddressPlaceholder: "e.g. Main St 12, Kalwaria Zebrzydowska",
  myLocationLabel: "My location",
  myLocationDenied: "Location access denied. Allow it in your browser settings.",
  myLocationUnsupported: "Your browser does not support geolocation.",
  cityPlaceholder: "e.g. Kraków or Kalwaria Zebrzydowska",
  buildingNumberRequired: "Building number required before the comma.",
  city: "City *",
  district: "District *",
  areaLabel: "Area / estate",
  areaPlaceholder: "e.g. estate / village part",
  localityLabel: "Locality",
  countryLabel: "Country",
  localityAutoHint: "Set from map and address (geocoding). Move the pin or enter a full address to change.",
  countryAutoHint: "Detected from map and geocoding context.",
  apartmentNumber: "Flat no.",
  apartmentPlaceholder: "e.g. 12",
  landRegistry: "Land registry no. (optional)",
  landRegistryPlaceholder: "e.g. WA1M/00000000/0",
  pinError: "Could not place pin. Pick an address from suggestions.",
  price: "Price *",
  priceCurrency: "Price currency",
  pricePln: "PLN",
  priceEur: "EUR",
  nbpApprox: "Indicative conversion (NBP):",
  area: "Area (m²) *",
  rooms: "Rooms",
  floor: "Floor",
  description: "Listing description",
  descriptionPlaceholder: "Start writing your listing description…",
  amenities: "Amenities",
  heating: "Heating",
  photos: "Photo gallery",
  photosMain: "Main",
  photosUpload: "Add photos",
  photosError: "Error",
  photosDrag: "Drag photos or click to add",
  agencyName: "Agency name",
  agencyPlaceholder: "Enter agency name…",
  commission: "Agent commission (%)",
  prev: "Back",
  next: "Next",
  publish: "Publish listing",
  publishing: "Publishing…",
  limitReached: "Active listing limit reached. Upgrade on the pricing page.",
  verifyAccount: "Verify email and phone to publish listings.",
  serverError: "Could not save listing",
  serverErrorHint: "Check the data you entered.",
  propertyFlat: "Apartment",
  propertyHouse: "House",
  propertyPlot: "Plot",
  propertyCommercial: "Commercial",
  conditionReady: "Ready to move in",
  conditionRenovation: "Needs renovation",
  conditionDeveloper: "Developer standard",
  amenityBalcony: "Balcony / Terrace",
  amenityGarage: "Garage / Parking",
  amenityStorage: "Storage / Cellar",
  amenityGarden: "Garden",
  amenityDuplex: "Duplex",
  amenityElevator: "Elevator",
  amenityAc: "Air conditioning",
  heatingCity: "District heating",
  heatingGas: "Gas",
  heatingElectric: "Electric",
  heatingHeatPump: "Heat pump",
  heatingCoal: "Coal / pellet",
  heatingOther: "Other",
  selectPlaceholder: "Select…",
  mapLoading: "Loading map…",
  aptNumberPlaceholder: "e.g. 12",
  landRegistryExample: "WA1M/00012345/9",
  docVerificationTitle: "Land registry verification",
  docVerificationOptionalBadge: "Optional",
  docVerificationIntro:
    "You can skip this step — your listing will publish without the badge. Unit number + land registry no. let us verify ownership and highlight your listing.",
  docVerificationApartmentLabel: "Unit no. (optional)",
  docVerificationApartmentHintNonFlat: "Active for apartments — not required for houses or plots.",
  docVerificationKwLabel: "Land registry no. (optional)",
  docVerificationKwHint: "Format: 4 chars · 8 digits · check digit — e.g. WA1M/00012345/9. Scales on small screens.",
  docVerificationKwFormatError:
    "Invalid format. Required pattern: WA1M/00012345/9 (4 chars / 8 digits / 1 digit).",
  docVerificationPrivacy:
    "We protect this data and never show it publicly. After EstateOS verification your listing gets the shimmering trust shield on the offer page.",
  docVerificationStatusReady: "Ready for review",
  docVerificationStatusSkip: "Skipped",
  docVerificationBenefit1: "More buyer confidence",
  docVerificationBenefit2: "Stand out in search results",
  docVerificationBenefit3: "3D shimmering shield on page",
  docVerificationPreviewKicker: "Your badge after verification",
  docVerificationPreviewBody:
    "This is how the shield appears on your listing — visible to buyers seeking verified ownership.",
  docVerificationBadgeLabel: "Verified",
  docVerificationBadgeInactiveLabel: "Unverified",
  docVerificationBadgeSublabel: "EstateOS™ Quality Shield",
  docVerificationPreviewTrust: "Shown only after successful verification",
  rentPlaceholder: "e.g. 1500",
  descriptionPlaceholderAttr: "Start writing a premium description...",
  agencyNamePlaceholder: "Enter agency name...",
  floorPlanAlt: "Floor plan",
  thumbAlt: "Thumbnail",
};

const uk: Omit<AddOfferDictionary, keyof AddOfferFormExtended> = {
  formBadge: "Форма EstateOS Premium",
  title: "Додати",
  titleHighlight: "оголошення.",
  stepLabel: "Крок",
  stepOf: "з",
  stepExperience: "EstateOS Form Experience",
  sell: "Продаж",
  rent: "Оренда",
  step1Title: "Тип нерухомості",
  step2Title: "Локація та карта",
  step3Title: "Параметри та ціна",
  step4Title: "Опис та зручності",
  step5Title: "Фото",
  step6Title: "Публікація",
  conditionLabel: "Стан оздоблення",
  locationExact: "Точна (шпилька)",
  locationApprox: "Приблизна (область)",
  locationVisibilityTitle: "Публічна видимість:",
  locationVisibilityBody:
    "При точній локації показуємо назву вулиці (і номер будинку для квартир). При приблизній — лише орієнтовний район.",
  searchAddress: "Пошук адреси *",
  searchAddressPlaceholder: "напр. Bernardyńska 8, Kalwaria Zebrzydowska",
  myLocationLabel: "Моя локація",
  myLocationDenied: "Немає доступу до локації. Дозвольте в налаштуваннях браузера.",
  myLocationUnsupported: "Ваш браузер не підтримує геолокацію.",
  cityPlaceholder: "напр. Kraków або Kalwaria Zebrzydowska",
  buildingNumberRequired: "Потрібен номер будинку перед комою.",
  city: "Місто *",
  district: "Район *",
  areaLabel: "Область / осел",
  areaPlaceholder: "напр. осел / село / частина міста",
  localityLabel: "Населений пункт",
  countryLabel: "Країна",
  localityAutoHint:
    "Визначається з карти та адреси (геокодування). Пересуньте шпильку або введіть повну адресу.",
  countryAutoHint: "Визначається з карти та контексту геокодування.",
  apartmentNumber: "№ квартири",
  apartmentPlaceholder: "напр. 12",
  landRegistry: "№ KW (необов'язково)",
  landRegistryPlaceholder: "напр. WA1M/00000000/0",
  pinError: "Не вдалося встановити шпильку. Оберіть адресу з підказок.",
  price: "Ціна *",
  priceCurrency: "Валюта ціни",
  pricePln: "PLN",
  priceEur: "EUR",
  nbpApprox: "Орієнтовний перерахунок (NBP):",
  area: "Площа (м²) *",
  rooms: "Кількість кімнат",
  floor: "Поверх",
  description: "Опис оголошення",
  descriptionPlaceholder: "Почніть писати опис…",
  amenities: "Зручності",
  heating: "Опалення",
  photos: "Галерея фото",
  photosMain: "Головне",
  photosUpload: "Додати фото",
  photosError: "Помилка",
  photosDrag: "Перетягніть фото або натисніть, щоб додати",
  agencyName: "Назва агентства",
  agencyPlaceholder: "Введіть назву агентства…",
  commission: "Комісія агента (%)",
  prev: "Назад",
  next: "Далі",
  publish: "Опублікувати оголошення",
  publishing: "Публікація…",
  limitReached: "Досягнуто ліміт активних оголошень. Розширте план у тарифах.",
  verifyAccount: "Підтвердіть e-mail і телефон, щоб публікувати оголошення.",
  serverError: "Не вдалося зберегти оголошення",
  serverErrorHint: "Перевірте введені дані.",
  propertyFlat: "Квартира",
  propertyHouse: "Будинок",
  propertyPlot: "Ділянка",
  propertyCommercial: "Комерційна",
  conditionReady: "Готове",
  conditionRenovation: "Потребує ремонту",
  conditionDeveloper: "Від забудовника",
  amenityBalcony: "Балкон",
  amenityGarage: "Гараж / паркінг",
  amenityStorage: "Комора / госп.",
  amenityGarden: "Садок",
  amenityDuplex: "Дворівневе",
  amenityElevator: "Ліфт",
  amenityAc: "Кондиціонер",
  heatingCity: "Центральне",
  heatingGas: "Газове",
  heatingElectric: "Електричне",
  heatingHeatPump: "Тепловий насос",
  heatingCoal: "Вугілля / пелети",
  heatingOther: "Інше",
  selectPlaceholder: "Оберіть…",
  mapLoading: "Завантаження карти…",
  aptNumberPlaceholder: "напр. 12",
  landRegistryExample: "WA1M/00012345/9",
  docVerificationTitle: "Верифікація книги постійних прав",
  docVerificationOptionalBadge: "Необов'язково",
  docVerificationIntro:
    "Можна пропустити — оголошення опублікується без значка. Номер приміщення та KW дозволяють перевірити власність і виділити оголошення.",
  docVerificationApartmentLabel: "№ приміщення (необов'язково)",
  docVerificationApartmentHintNonFlat: "Активне для квартир — для будинку чи ділянки не потрібно.",
  docVerificationKwLabel: "Номер KW (необов'язково)",
  docVerificationKwHint:
    "Формат: 4 символи · 8 цифр · контрольна цифра — напр. WA1M/00012345/9.",
  docVerificationKwFormatError:
    "Невірний формат KW. Потрібно: WA1M/00012345/9 (4 символи / 8 цифр / 1 цифра).",
  docVerificationPrivacy:
    "Дані захищені і не публікуються. Після верифікації EstateOS оголошення отримує значок довіри на сторінці.",
  docVerificationStatusReady: "Готово до перевірки",
  docVerificationStatusSkip: "Пропущено",
  docVerificationBenefit1: "Більше довіри покупців",
  docVerificationBenefit2: "Виділення у списку",
  docVerificationBenefit3: "3D-значок на сторінці",
  docVerificationPreviewKicker: "Ваш значок після верифікації",
  docVerificationPreviewBody:
    "Так виглядатиме значок на оголошенні — для покупців, які шукають підтверджену власність.",
  docVerificationBadgeLabel: "Верифіковано",
  docVerificationBadgeInactiveLabel: "Не верифіковано",
  docVerificationBadgeSublabel: "EstateOS™ Quality Shield",
  docVerificationPreviewTrust: "Видно лише після успішної верифікації",
  rentPlaceholder: "напр. 1500",
  descriptionPlaceholderAttr: "Почніть писати преміум-опис…",
  agencyNamePlaceholder: "Введіть назву агентства…",
  floorPlanAlt: "План",
  thumbAlt: "Мініатюра",
};

export function getAddOfferDictionary(locale: Locale): AddOfferDictionary {
  const extended = getAddOfferFormExtended(locale);
  if (locale === "en") return { ...en, ...extended };
  if (locale === "uk") return { ...uk, ...extended };
  return { ...pl, ...extended };
}

/** Klucze udogodnień → pole słownika */
export const AMENITY_DICT_KEYS = [
  "amenityBalcony",
  "amenityGarage",
  "amenityStorage",
  "amenityGarden",
  "amenityDuplex",
  "amenityElevator",
  "amenityAc",
] as const;

export const HEATING_DICT_KEYS = [
  "heatingCity",
  "heatingGas",
  "heatingElectric",
  "heatingHeatPump",
  "heatingCoal",
  "heatingOther",
] as const;
