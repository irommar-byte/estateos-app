import type { Locale } from "./config";

export type CarsDictionary = {
  metaTitle: string;
  metaDescription: string;
  brand: string;
  catalogTitle: string;
  catalogSubtitle: string;
  addListing: string;
  tabFavorites: string;
  tabMine: string;
  tabAll: string;
  countFavorites: (filtered: number, saved: number) => string;
  countMine: (n: number) => string;
  countAll: (n: number) => string;
  loginPrompt: string;
  loginLink: string;
  favoritesEmpty: string;
  searchSectionBadge: string;
  searchTitle: string;
  clearFilters: string;
  filterSearch: string;
  searchPlaceholder: string;
  filterMake: (loading: boolean) => string;
  filterModel: (loading: boolean) => string;
  filterGeneration: (loading: boolean) => string;
  allMakes: string;
  allSeries: string;
  allGenerations: string;
  pickMakeFirst: string;
  pickSeriesFirst: string;
  filterFuel: string;
  allFuels: string;
  filterSort: string;
  filterMaxPrice: string;
  maxPricePlaceholder: string;
  resultsCount: (filtered: number, total: number) => string;
  loading: string;
  loadingOffers: string;
  noResults: string;
  featuredBadge: string;
  backToCatalog: string;
  priceLabel: string;
  sellerProfile: string;
  specSection: string;
  specYear: string;
  specMileage: string;
  specFuel: string;
  specTransmission: string;
  specBody: string;
  specGeneration: string;
  specPower: string;
  specCapacity: string;
  specTrim: string;
  specDoors: string;
  specCity: string;
  descriptionTitle: string;
  aboutListingTitle: string;
  aboutListingBody: string;
  favoriteAriaAdd: string;
  favoriteAriaRemove: string;
  formTitleLabel: string;
  formDescriptionLabel: string;
  formTitlePlaceholder: string;
  formDescriptionPlaceholder: string;
  formMileageLabel: string;
  formSave: string;
  formSaving: string;
  formCreateTitle: string;
  formEditTitle: string;
  formErrorTitle: string;
  formErrorCity: string;
  formErrorFuel: string;
  formErrorPhotos: string;
  formErrorSave: string;
  formErrorNetwork: string;
  formScanBanner: string;

  inquiryTitle: string;
  inquirySubtitle: string;
  inquiryNoSeller: string;
  inquiryViewingLabel: string;
  inquiryViewingSchedule: string;
  inquiryYourMessage: string;
  inquiryFooter: string;
  inquiryViewingAsap: string;
  inquiryViewingThisWeek: string;
  inquiryViewingNextWeek: string;
  inquiryViewingQuestionOnly: string;
  inquiryPhoneLabel: string;
  inquiryMessageLabel: string;
  inquiryDefaultMessage: (title: string) => string;
  inquirySubmit: string;
  inquirySubmitting: string;
  inquiryError: string;
  inquirySuccessTitle: string;
  inquirySuccessBody: string;
  inquiryLoginHint: string;
  ownerEdit: string;
  ownerDelete: string;
  ownerDeleting: string;
  ownerDeleteConfirm: string;
  ownerDeleteError: string;
  ownerNetworkError: string;

};

const pl: CarsDictionary = {
  metaTitle: "Katalog samochodów | EstateOS™Car",
  metaDescription:
    "Przeglądaj ogłoszenia samochodowe w ekosystemie EstateOS. Jedno konto, przełączanie Home/Car i profesjonalny kontakt ze sprzedającymi.",
  brand: "EstateOS™Car",
  catalogTitle: "Profesjonalny katalog samochodów",
  catalogSubtitle:
    "Jedno konto EstateOS, przełączanie Home/Car i zapytania trafiające prosto do sprzedającego przez EstateOS Contact.",
  addListing: "Dodaj ogłoszenie auta",
  tabFavorites: "Ulubione",
  tabMine: "Moje samochody",
  tabAll: "Cały katalog",
  countFavorites: (filtered, saved) => `${filtered} ulubionych z ${saved} zapisanych`,
  countMine: (n) => `${n} Twoich ogłoszeń`,
  countAll: (n) => `${n} aktywnych ogłoszeń w katalogu`,
  loginPrompt: "Zaloguj się, aby zobaczyć swoje ogłoszenia samochodowe.",
  loginLink: "Przejdź do logowania",
  favoritesEmpty:
    "Nie masz jeszcze ulubionych aut. Kliknij serduszko na karcie ogłoszenia, aby dodać je tutaj.",
  searchSectionBadge: "Parametry wyszukiwania",
  searchTitle: "Znajdź samochód",
  clearFilters: "Wyczyść filtry",
  filterSearch: "Szukaj",
  searchPlaceholder: "BMW, Warszawa, diesel...",
  filterMake: (loading) => `Marka${loading ? "…" : ""}`,
  filterModel: (loading) => `Seria / model${loading ? "…" : ""}`,
  filterGeneration: (loading) => `Generacja${loading ? "…" : ""}`,
  allMakes: "Wszystkie marki",
  allSeries: "Wszystkie serie",
  allGenerations: "Wszystkie generacje",
  pickMakeFirst: "Najpierw wybierz markę",
  pickSeriesFirst: "Najpierw wybierz serię",
  filterFuel: "Paliwo",
  allFuels: "Wszystkie",
  filterSort: "Sortowanie",
  filterMaxPrice: "Maks. cena (PLN)",
  maxPricePlaceholder: "np. 300 000",
  resultsCount: (filtered, total) => `${filtered} z ${total} ogłoszeń`,
  loading: "Ładowanie...",
  loadingOffers: "Ładowanie ofert samochodów...",
  noResults: "Brak ogłoszeń pasujących do filtrów.",
  featuredBadge: "Wyróżnione",
  backToCatalog: "Wróć do EstateOS™Car",
  priceLabel: "Cena",
  sellerProfile: "Profil sprzedającego",
  specSection: "Specyfikacja",
  specYear: "Rocznik",
  specMileage: "Przebieg",
  specFuel: "Paliwo",
  specTransmission: "Skrzynia",
  specBody: "Nadwozie",
  specGeneration: "Generacja",
  specPower: "Moc",
  specCapacity: "Pojemność",
  specTrim: "Wersja",
  specDoors: "Drzwi",
  specCity: "Miasto",
  descriptionTitle: "Opis",
  aboutListingTitle: "O ogłoszeniu",
  aboutListingBody:
    "Ogłoszenie opublikowane w module EstateOS™Car — jednym ekosystemie z nieruchomościami EstateOS™Home. Zapytania trafiają bezpośrednio do sprzedającego przez EstateOS Contact.",
  favoriteAriaAdd: "Dodaj do ulubionych",
  favoriteAriaRemove: "Usuń z ulubionych",
  formTitleLabel: "Tytuł ogłoszenia",
  formDescriptionLabel: "Opis",
  formTitlePlaceholder: "np. BMW X5 xDrive30d M Sport",
  formDescriptionPlaceholder: "Opisz stan auta, historię serwisową, wyposażenie...",
  formMileageLabel: "Przebieg (km)",
  formSave: "Zapisz ogłoszenie",
  formSaving: "Zapisuję...",
  formCreateTitle: "Dodaj ogłoszenie samochodu",
  formEditTitle: "Edytuj ogłoszenie",
  formErrorTitle: "Uzupełnij tytuł, markę, model, miejscowość i poprawną cenę.",
  formErrorCity: "Ustaw miejscowość na mapie — przeciągnij mapę lub wybierz z wyszukiwarki.",
  formErrorFuel: "Wybierz rodzaj paliwa z katalogu.",
  formErrorPhotos: "Dodaj co najmniej jedno zdjęcie auta.",
  formErrorSave: "Nie udało się zapisać ogłoszenia.",
  formErrorNetwork: "Błąd sieci podczas zapisu ogłoszenia.",
  formScanBanner: "Dane z dowodu wczytane. Sprawdź katalog i uzupełnij ogłoszenie.",
  inquiryTitle: "Zapytaj o auto",
  inquirySubtitle: "Wiadomość trafi do sprzedającego przez EstateOS Contact.",
  inquiryNoSeller: "Zapytania będą dostępne po przypisaniu sprzedającego do tego ogłoszenia.",
  inquiryViewingLabel: "Preferowany termin oględzin",
  inquiryViewingSchedule: "Termin oględzin",
  inquiryYourMessage: "Twoja wiadomość",
  inquiryFooter: "Wysyłając zapytanie, kontaktujesz się ze sprzedającym przez EstateOS Contact. Jedno konto — Home i Car.",
  inquiryViewingAsap: "Jak najszybciej",
  inquiryViewingThisWeek: "W tym tygodniu",
  inquiryViewingNextWeek: "W przyszłym tygodniu",
  inquiryViewingQuestionOnly: "Tylko pytanie — bez oględzin",
  inquiryPhoneLabel: "Telefon (opcjonalnie)",
  inquiryMessageLabel: "Wiadomość",
  inquiryDefaultMessage: (title) =>
    `Dzień dobry, jestem zainteresowany/a ogłoszeniem „${title}”. Proszę o informację o dostępności i możliwości oględzin.`,
  inquirySubmit: "Wyślij zapytanie",
  inquirySubmitting: "Wysyłanie...",
  inquiryError: "Nie udało się wysłać zapytania.",
  inquirySuccessTitle: "Zapytanie wysłane",
  inquirySuccessBody:
    "Sprzedający otrzyma wiadomość w EstateOS Contact. Za chwilę przekierujemy Cię do czatu.",
  inquiryLoginHint: "Zaloguj się, aby wysłać zapytanie.",
  ownerEdit: "Edytuj ogłoszenie",
  ownerDelete: "Usuń ogłoszenie",
  ownerDeleting: "Usuwanie...",
  ownerDeleteConfirm: "Usunąć to ogłoszenie samochodu? Tej operacji nie można cofnąć.",
  ownerDeleteError: "Nie udało się usunąć ogłoszenia.",
  ownerNetworkError: "Błąd sieci podczas usuwania ogłoszenia.",

};

const en: CarsDictionary = {
  ...pl,
  metaTitle: "Car catalog | EstateOS™Car",
  metaDescription:
    "Browse car listings in the EstateOS ecosystem. One account, Home/Car switching, and direct seller contact.",
  catalogTitle: "Professional car catalog",
  catalogSubtitle:
    "One EstateOS account, Home/Car switching, and inquiries delivered directly to the seller via EstateOS Contact.",
  addListing: "Add car listing",
  tabFavorites: "Favorites",
  tabMine: "My cars",
  tabAll: "Full catalog",
  countFavorites: (filtered, saved) => `${filtered} favorites of ${saved} saved`,
  countMine: (n) => `${n} of your listings`,
  countAll: (n) => `${n} active listings in catalog`,
  loginPrompt: "Sign in to see your car listings.",
  loginLink: "Go to login",
  favoritesEmpty: "No favorite cars yet. Tap the heart on a listing card to add it here.",
  searchSectionBadge: "Search parameters",
  searchTitle: "Find a car",
  clearFilters: "Clear filters",
  filterSearch: "Search",
  searchPlaceholder: "BMW, Warsaw, diesel...",
  filterMake: (loading) => `Make${loading ? "…" : ""}`,
  filterModel: (loading) => `Series / model${loading ? "…" : ""}`,
  filterGeneration: (loading) => `Generation${loading ? "…" : ""}`,
  allMakes: "All makes",
  allSeries: "All series",
  allGenerations: "All generations",
  pickMakeFirst: "Select make first",
  pickSeriesFirst: "Select series first",
  filterFuel: "Fuel",
  allFuels: "All",
  filterSort: "Sort",
  filterMaxPrice: "Max price (PLN)",
  maxPricePlaceholder: "e.g. 300,000",
  resultsCount: (filtered, total) => `${filtered} of ${total} listings`,
  loading: "Loading...",
  loadingOffers: "Loading car listings...",
  noResults: "No listings match your filters.",
  featuredBadge: "Featured",
  backToCatalog: "Back to EstateOS™Car",
  priceLabel: "Price",
  sellerProfile: "Seller profile",
  specSection: "Specification",
  specYear: "Year",
  specMileage: "Mileage",
  specFuel: "Fuel",
  specTransmission: "Transmission",
  specBody: "Body",
  specGeneration: "Generation",
  specPower: "Power",
  specCapacity: "Engine size",
  specTrim: "Trim",
  specDoors: "Doors",
  specCity: "City",
  descriptionTitle: "Description",
  aboutListingTitle: "About this listing",
  aboutListingBody:
    "Listed in EstateOS™Car — one ecosystem with EstateOS™Home property listings. Inquiries go directly to the seller via EstateOS Contact.",
  favoriteAriaAdd: "Add to favorites",
  favoriteAriaRemove: "Remove from favorites",
  formTitleLabel: "Listing title",
  formDescriptionLabel: "Description",
  formTitlePlaceholder: "e.g. BMW X5 xDrive30d M Sport",
  formDescriptionPlaceholder: "Describe condition, service history, equipment...",
  formMileageLabel: "Mileage (km)",
  formSave: "Save listing",
  formSaving: "Saving...",
  formCreateTitle: "Add car listing",
  formEditTitle: "Edit listing",
  formErrorTitle: "Complete title, make, model, city, and valid price.",
  formErrorCity: "Set city on the map — drag the map or search.",
  formErrorFuel: "Select fuel type from catalog.",
  formErrorPhotos: "Add at least one photo.",
  formErrorSave: "Could not save listing.",
  formErrorNetwork: "Network error while saving.",
  formScanBanner: "Registration data loaded. Check catalog and complete listing.",
  inquiryTitle: "Ask about this car",
  inquirySubtitle: "Your message goes to the seller via EstateOS Contact.",
  inquiryNoSeller: "Inquiries will be available once a seller is assigned to this listing.",
  inquiryViewingLabel: "Preferred viewing time",
  inquiryViewingSchedule: "Viewing time",
  inquiryYourMessage: "Your message",
  inquiryFooter: "By sending an inquiry you contact the seller via EstateOS Contact. One account — Home and Car.",
  inquiryViewingAsap: "As soon as possible",
  inquiryViewingThisWeek: "This week",
  inquiryViewingNextWeek: "Next week",
  inquiryViewingQuestionOnly: "Question only — no viewing",
  inquiryPhoneLabel: "Phone (optional)",
  inquiryMessageLabel: "Message",
  inquiryDefaultMessage: (title) => `Hello, I am interested in "${title}". Please let me know about availability and a viewing.`,
  inquirySubmit: "Send inquiry",
  inquirySubmitting: "Sending...",
  inquiryError: "Could not send inquiry.",
  inquirySuccessTitle: "Inquiry sent",
  inquirySuccessBody: "The seller will receive your message in EstateOS Contact. Redirecting to chat shortly.",
  inquiryLoginHint: "Sign in to send an inquiry.",
  ownerEdit: "Edit listing",
  ownerDelete: "Delete listing",
  ownerDeleting: "Deleting...",
  ownerDeleteConfirm: "Delete this car listing? This cannot be undone.",
  ownerDeleteError: "Could not delete listing.",
  ownerNetworkError: "Network error while deleting listing.",
};

const uk: CarsDictionary = {
  ...en,
  metaTitle: "Каталог авто | EstateOS™Car",
  metaDescription:
    "Переглядайте оголошення про авто в екосистемі EstateOS. Один акаунт, перемикання Home/Car і прямий контакт із продавцем.",
  catalogTitle: "Професійний каталог автомобілів",
  catalogSubtitle:
    "Один акаунт EstateOS, перемикання Home/Car і запити безпосередньо до продавця через EstateOS Contact.",
  addListing: "Додати оголошення авто",
  tabFavorites: "Обране",
  tabMine: "Мої авто",
  tabAll: "Увесь каталог",
  countFavorites: (filtered, saved) => `${filtered} обраних із ${saved} збережених`,
  countMine: (n) => `${n} ваших оголошень`,
  countAll: (n) => `${n} активних оголошень у каталозі`,
  loginPrompt: "Увійдіть, щоб побачити свої оголошення про авто.",
  loginLink: "Перейти до входу",
  favoritesEmpty:
    "У вас ще немає обраних авто. Натисніть сердечко на картці оголошення, щоб додати його сюди.",
  searchSectionBadge: "Параметри пошуку",
  searchTitle: "Знайти автомобіль",
  clearFilters: "Очистити фільтри",
  filterSearch: "Пошук",
  searchPlaceholder: "BMW, Варшава, дизель...",
  filterMake: (loading) => `Марка${loading ? "…" : ""}`,
  filterModel: (loading) => `Серія / модель${loading ? "…" : ""}`,
  filterGeneration: (loading) => `Покоління${loading ? "…" : ""}`,
  allMakes: "Усі марки",
  allSeries: "Усі серії",
  allGenerations: "Усі покоління",
  pickMakeFirst: "Спочатку оберіть марку",
  pickSeriesFirst: "Спочатку оберіть серію",
  filterFuel: "Паливо",
  allFuels: "Усі",
  filterSort: "Сортування",
  filterMaxPrice: "Макс. ціна (PLN)",
  maxPricePlaceholder: "напр. 300 000",
  resultsCount: (filtered, total) => `${filtered} з ${total} оголошень`,
  loading: "Завантаження...",
  loadingOffers: "Завантаження оголошень про авто...",
  noResults: "Немає оголошень за вашими фільтрами.",
  featuredBadge: "Виділене",
  backToCatalog: "Назад до EstateOS™Car",
  priceLabel: "Ціна",
  sellerProfile: "Профіль продавця",
  specSection: "Специфікація",
  specYear: "Рік",
  specMileage: "Пробіг",
  specFuel: "Паливо",
  specTransmission: "Коробка",
  specBody: "Кузов",
  specGeneration: "Покоління",
  specPower: "Потужність",
  specCapacity: "Об'єм",
  specTrim: "Версія",
  specDoors: "Двері",
  specCity: "Місто",
  descriptionTitle: "Опис",
  aboutListingTitle: "Про оголошення",
  aboutListingBody:
    "Оголошення опубліковане в модулі EstateOS™Car — єдиній екосистемі з нерухомістю EstateOS™Home. Запити надходять безпосередньо продавцю через EstateOS Contact.",
  favoriteAriaAdd: "Додати до обраного",
  favoriteAriaRemove: "Прибрати з обраного",
  formTitleLabel: "Заголовок оголошення",
  formDescriptionLabel: "Опис",
  formTitlePlaceholder: "напр. BMW X5 xDrive30d M Sport",
  formDescriptionPlaceholder: "Опишіть стан, історію сервісу, комплектацію...",
  formMileageLabel: "Пробіг (км)",
  formSave: "Зберегти оголошення",
  formSaving: "Зберігаю...",
  formCreateTitle: "Додати оголошення авто",
  formEditTitle: "Редагувати оголошення",
  formErrorTitle: "Заповніть заголовок, марку, модель, місто та коректну ціну.",
  formErrorCity: "Вкажіть місто на карті — перетягніть карту або знайдіть у пошуку.",
  formErrorFuel: "Оберіть тип палива з каталогу.",
  formErrorPhotos: "Додайте щонайменше одне фото.",
  formErrorSave: "Не вдалося зберегти оголошення.",
  formErrorNetwork: "Помилка мережі під час збереження.",
  formScanBanner: "Дані з посвідчення завантажено. Перевірте каталог і доповніть оголошення.",
  inquiryTitle: "Запитати про авто",
  inquirySubtitle: "Повідомлення надійде продавцю через EstateOS Contact.",
  inquiryNoSeller: "Запити будуть доступні після призначення продавця до цього оголошення.",
  inquiryViewingLabel: "Бажаний час огляду",
  inquiryViewingSchedule: "Час огляду",
  inquiryYourMessage: "Ваше повідомлення",
  inquiryFooter: "Надсилаючи запит, ви зв'язуєтеся з продавцем через EstateOS Contact. Один акаунт — Home і Car.",
  inquiryViewingAsap: "Якнайшвидше",
  inquiryViewingThisWeek: "Цього тижня",
  inquiryViewingNextWeek: "Наступного тижня",
  inquiryViewingQuestionOnly: "Лише питання — без огляду",
  inquiryPhoneLabel: "Телефон (необов'язково)",
  inquiryMessageLabel: "Повідомлення",
  inquiryDefaultMessage: (title) => `Доброго дня, мене цікавить оголошення «${title}». Будь ласка, повідомте про доступність і можливість огляду.`,
  inquirySubmit: "Надіслати запит",
  inquirySubmitting: "Надсилання...",
  inquiryError: "Не вдалося надіслати запит.",
  inquirySuccessTitle: "Запит надіслано",
  inquirySuccessBody: "Продавець отримає повідомлення в EstateOS Contact. Незабаром перенаправимо вас до чату.",
  inquiryLoginHint: "Увійдіть, щоб надіслати запит.",
  ownerEdit: "Редагувати оголошення",
  ownerDelete: "Видалити оголошення",
  ownerDeleting: "Видалення...",
  ownerDeleteConfirm: "Видалити це оголошення про авто? Цю дію не можна скасувати.",
  ownerDeleteError: "Не вдалося видалити оголошення.",
  ownerNetworkError: "Помилка мережі під час видалення оголошення.",
};

export function getCarsDictionary(locale: Locale): CarsDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
