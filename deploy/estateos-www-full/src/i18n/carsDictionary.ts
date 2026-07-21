import type { Locale } from "./config";
import { numberFormatLocale } from "./config";

export type CarsDictionary = {
  common: {
    cancel: string;
    loading: string;
    choose: string;
    optional: string;
    poland: string;
    automaticTransmission: string;
    suvBody: string;
    priceOnRequest: string;
    login: string;
    networkError: string;
    saveFailed: string;
    managementPanel: string;
    myListings: string;
    carsCatalog: string;
    edit: string;
    viewListing: string;
    chooseField: string;
    retry: string;
  };
  sort: {
    newest: string;
    priceAsc: string;
    priceDesc: string;
    yearDesc: string;
    mileageAsc: string;
  };
  entry: {
    heroTitle: string;
    heroDescription: string;
    privacyEyebrow: string;
    privacyTitle: string;
    privacyBody: string;
    privacyBodyRestrict: string;
    privacyBodyHistory: string;
    restrictSwitchLabel: string;
    restrictSwitchDescription: string;
    restrictHint: string;
    methodScanTitle: string;
    methodScanDescription: string;
    methodScanBadge: string;
    methodUploadTitle: string;
    methodUploadDescription: string;
    methodCaptureTitle: string;
    methodCaptureDescription: string;
    methodManualTitle: string;
    methodManualDescription: string;
    methodManualBadge: string;
    methodOtomotoTitle: string;
    methodOtomotoDescription: string;
    methodOtomotoBadge: string;
    methodDocTitle: string;
    methodDocDescription: string;
    methodDocBadge: string;
    docModeLabel: string;
    docModeLiveTitle: string;
    docModeLiveDescription: string;
    docModeUploadTitle: string;
    docModeUploadDescription: string;
    docModeCaptureTitle: string;
    docModeCaptureDescription: string;
    docContinue: string;
    manualLink: string;
    hasAccount: string;
    signIn: string;
    changeEntryMethod: string;
  };
  form: {
    guestBanner: string;
    scanLoaded: string;
    scanCheckCatalog: string;
    otomotoLoaded: string;
    otomotoCheckForm: string;
    contentEyebrow: string;
    contentTitle: string;
    contentDescription: string;
    titleLabel: string;
    titlePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    aiAssistantBtn: string;
    aiGenerating: string;
    aiMissingPrefix: string;
    aiGenFailed: string;
    offerEyebrow: string;
    offerTitle: string;
    offerDescription: string;
    mileageLabel: string;
    priceLabel: string;
    footerCreate: string;
    footerEdit: string;
    publish: string;
    publishing: string;
    saveChanges: string;
    successTitle: string;
    successBody: string;
    successCongrats: string;
    successCtaCatalog: string;
    errTitlePrice: string;
    errMapCity: string;
    errFuel: string;
    errPhotos: string;
  };
  catalogFields: {
    eyebrow: string;
    title: string;
    description: string;
    vehicleTypeLabel: string;
    modelFreePlaceholder: string;
    notApplicable: string;
    yearLabel: string;
    yearPlaceholder: string;
    makeLabel: string;
    modelLabel: string;
    generationLabel: string;
    fuelLabel: string;
    powerLabel: string;
    capacityLabel: string;
    doorsLabel: string;
    gearboxLabel: string;
    bodyLabel: string;
    colorLabel: string;
    colorPlaceholder: string;
    trimLabel: string;
    trimPlaceholder: string;
    catalogHint: string;
    yearRequiredHint: string;
  };
  docs: {
    eyebrow: string;
    title: string;
    description: string;
    vinLabel: string;
    vinPlaceholder: string;
    registrationLabel: string;
    registrationPlaceholder: string;
    firstRegLabel: string;
    firstRegPlaceholder: string;
    insuranceLabel: string;
    insurancePlaceholder: string;
    restrictLabel: string;
    restrictDescription: string;
    loginBanner: string;
    fillHintTitle: string;
    fillHintBody: string;
    scanCta: string;
    manualCta: string;
    otomotoPrivacyNote: string;
    fillFromVinCta: string;
    fillingFromVin: string;
    fillFromVinHint: string;
    errFillFromVin: string;
    verifyNeedsLogin: string;
    checkHistory: string;
    checkingHistory: string;
    checkInsurance: string;
    checkingInsurance: string;
    autoChecking: string;
    historyReady: string;
    errHistory: string;
    errInsurance: string;
    errOc: string;
  };
  scan: {
    title: string;
    subtitle: string;
    skip: string;
    uploadInstead: string;
    decoding: string;
    errDecode: string;
    errAztec: string;
    errCamera: string;
    errReadDoc: string;
    phaseStarting: string;
    phasePosition: string;
    phaseSearching: string;
    phaseHold: string;
    phaseDecoding: string;
    phaseSuccess: string;
    missingTitle: string;
    missingDescription: string;
    missingMileage: string;
    missingPrice: string;
    missingCity: string;
    missingImages: string;
    missingBannerPrefix: string;
    retry: string;
    autoScanHint: string;
    cameraDesktopHint: string;
  };
  photos: {
    eyebrow: string;
    title: string;
    description: string;
    mainBadge: string;
    addPhotos: string;
    dragHint: string;
    guestHint: string;
    uploadError: string;
    networkUploadError: string;
    errorBadge: string;
    photosCount: string;
    requiredHint: string;
  };
  map: {
    eyebrow: string;
    title: string;
    description: string;
    cityLabel: string;
    searchPlaceholder: string;
    gpsButton: string;
    gpsDenied: string;
    gpsUnsupported: string;
    mapHint: string;
    countryLabel: string;
    mapTokenMissing: string;
    resolvingCity: string;
    pinCoords: string;
    searching: string;
    gpsFailed: string;
    gpsLocating: string;
  };
  catalog: {
    heroTitle: string;
    heroDescription: string;
    statsFavorites: string;
    statsMine: string;
    statsAll: string;
    addListing: string;
    findListing: string;
    otomotoImportTitle: string;
    otomotoImportBody: string;
    otomotoImportPlaceholder: string;
    otomotoImportCta: string;
    otomotoImportLoading: string;
    tabFavorites: string;
    tabMine: string;
    tabAll: string;
    loginMineBanner: string;
    goLogin: string;
    favoritesEmpty: string;
    filtersEyebrow: string;
    filtersTitle: string;
    clearFilters: string;
    searchLabel: string;
    searchPlaceholder: string;
    vehicleTypeFilterLabel: string;
    allVehicleTypes: string;
    typeCar: string;
    typeMotorcycle: string;
    typeVan: string;
    typeTruck: string;
    makeLabel: string;
    allMakes: string;
    modelLabel: string;
    allModels: string;
    pickMakeFirst: string;
    generationLabel: string;
    allGenerations: string;
    pickModelFirst: string;
    fuelLabel: string;
    allFuels: string;
    sortLabel: string;
    maxPriceLabel: string;
    maxPricePlaceholder: string;
    resultsLoading: string;
    resultsCount: string;
    loadingOffers: string;
    noResults: string;
    featuredBadge: string;
  };
  detail: {
    description: string;
    aboutListing: string;
    specs: string;
    year: string;
    mileage: string;
    fuel: string;
    transmission: string;
    body: string;
    color: string;
    power: string;
    capacity: string;
    doors: string;
    city: string;
    sellerProfile: string;
    backToCatalog: string;
    price: string;
    aboutBody: string;
    generation: string;
    trim: string;
    version: string;
  };
  inquiry: {
    title: string;
    description: string;
    nameLabel: string;
    phoneLabel: string;
    phoneOptional: string;
    viewingLabel: string;
    viewingAsap: string;
    viewingWeek: string;
    viewingNextWeek: string;
    viewingWeekend: string;
    viewingQuestionOnly: string;
    messageLabel: string;
    messagePlaceholder: string;
    defaultMessage: string;
    submit: string;
    submitting: string;
    success: string;
    successTitle: string;
    successBody: string;
    loginRequired: string;
    noSeller: string;
    footerNote: string;
    submitFailed: string;
  };
  checks: {
    title: string;
    description: string;
    restrictedNote: string;
    loginBanner: string;
    vin: string;
    registration: string;
    firstRegistration: string;
    historyNeedsData: string;
    checkHistory: string;
    checkingHistory: string;
    checkInsurance: string;
    checkingInsurance: string;
    closeModal: string;
    historyModalTitle: string;
    errHistory: string;
    errInsurance: string;
  };
  owner: {
    edit: string;
    delete: string;
    deleting: string;
    confirmDelete: string;
    deleteFailed: string;
    deleteNetworkError: string;
  };
  edit: {
    pageTitle: string;
    pageDescription: string;
    backToDetails: string;
  };
  seller: {
    eyebrow: string;
    title: string;
  };
  favorites: {
    add: string;
    remove: string;
  };
};

const pl: CarsDictionary = {
  common: {
    cancel: "Anuluj",
    loading: "Ładowanie...",
    choose: "Wybierz →",
    optional: "Opcjonalnie",
    poland: "Polska",
    automaticTransmission: "Automatyczna",
    suvBody: "SUV",
    priceOnRequest: "Cena na zapytanie",
    login: "Zaloguj się",
    networkError: "Błąd sieci podczas zapisu ogłoszenia.",
    saveFailed: "Nie udało się zapisać ogłoszenia.",
    managementPanel: "Panel zarządzania",
    myListings: "Moje ogłoszenia",
    carsCatalog: "Katalog Cars",
    edit: "Edytuj",
    viewListing: "Zobacz ogłoszenie",
    chooseField: "Wybierz {field}",
    retry: "Spróbuj ponownie",
  },
  sort: {
    newest: "Najnowsze",
    priceAsc: "Cena rosnąco",
    priceDesc: "Cena malejąco",
    yearDesc: "Najnowszy rocznik",
    mileageAsc: "Najmniejszy przebieg",
  },
  entry: {
    heroTitle: "Jak chcesz dodać auto?",
    heroDescription:
      "Dwie ścieżki: import z Otomoto albo skan dowodu. Formularz możesz wypełnić bez logowania — konto założysz dopiero przy publikacji.",
    privacyEyebrow: "Nasza przewaga",
    privacyTitle: "Prywatność VIN i pełna historia dla kupującego",
    privacyBody:
      "Po wpisaniu VIN, numeru rejestracyjnego i daty pierwszej rejestracji możesz",
    privacyBodyRestrict: "zastrzec te dane",
    privacyBodyHistory:
      "— na publicznym ogłoszeniu widoczne będą tylko pierwsze znaki. Kupujący jednym przyciskiem sprawdzi realną historię CEPIK — stan auta, ubezpieczenie i przebieg — bez ujawniania Twoich wrażliwych danych.",
    restrictSwitchLabel: "Zastrzeż dane pojazdu (VIN, rejestracja, pierwsza rejestracja)",
    restrictSwitchDescription:
      "Przykład: na ogłoszeniu WBA*** zamiast pełnego VIN — historia w sklepie nadal kompletna dla kupującego.",
    restrictHint: "W formularzu włączysz lub wyłączysz zastrzeżenie w dowolnym momencie przed publikacją.",
    methodScanTitle: "Skanuj kod aparatem",
    methodScanDescription:
      "Ustaw tył dowodu w kadrze — kod Aztec odczytamy automatycznie i uzupełnimy markę, model oraz VIN.",
    methodScanBadge: "Najszybsze",
    methodUploadTitle: "Wgraj zdjęcie dowodu",
    methodUploadDescription:
      "Masz już zdjęcie w galerii? Wgraj plik JPG, PNG lub HEIC — system odczyta kod Aztec z obrazu.",
    methodCaptureTitle: "Zrób zdjęcie i przetwórz",
    methodCaptureDescription:
      "Zrób nowe zdjęcie tyłu dowodu aparatem telefonu lub komputera — kod zostanie odczytany od razu.",
    methodManualTitle: "Wypełnię ręcznie",
    methodManualDescription:
      "Nie masz dowodu pod ręką? Przejdź do formularza i wpisz dane samodzielnie w swoim tempie.",
    methodManualBadge: "Formularz",
    methodOtomotoTitle: "Import z Otomoto",
    methodOtomotoDescription:
      "Masz już ogłoszenie na Otomoto? Wklej link — przeniesiemy zdjęcia, opis i specyfikację do formularza.",
    methodOtomotoBadge: "Szybki start",
    methodDocTitle: "Skanuj dowód rejestracyjny",
    methodDocDescription:
      "Odczytaj kod Aztec z tyłu dowodu — uzupełnimy markę, model i VIN. Wybierz skan na żywo, wgranie lub nowe zdjęcie.",
    methodDocBadge: "Z dowodu",
    docModeLabel: "Jak chcesz odczytać kod?",
    docModeLiveTitle: "Skan na żywo",
    docModeLiveDescription: "Ustaw tył dowodu w kadrze kamery — kod odczytamy automatycznie.",
    docModeUploadTitle: "Wgraj zdjęcie",
    docModeUploadDescription: "Wybierz JPG, PNG lub HEIC z galerii telefonu lub komputera.",
    docModeCaptureTitle: "Zrób zdjęcie",
    docModeCaptureDescription: "Zrób nowe zdjęcie tyłu dowodu aparatem — od razu je przetworzymy.",
    docContinue: "Kontynuuj z dowodem",
    manualLink: "Wolę wypełnić formularz ręcznie",
    hasAccount: "Masz już konto?",
    signIn: "Zaloguj się",
    changeEntryMethod: "← Zmień sposób dodawania",
  },
  form: {
    guestBanner:
      "Możesz wypełnić formularz bez logowania. Po kliknięciu „Opublikuj” założysz konto — ogłoszenie trafi od razu do katalogu, a Ty dostaniesz powiadomienia o zapytaniach.",
    scanLoaded: "Dane z dowodu wczytane.",
    scanCheckCatalog: "Sprawdź katalog i uzupełnij ogłoszenie.",
    otomotoLoaded: "Dane z Otomoto wczytane.",
    otomotoCheckForm: "Sprawdź formularz i uzupełnij brakujące pola przed publikacją.",
    contentEyebrow: "Treść ogłoszenia",
    contentTitle: "Tytuł i opis",
    contentDescription:
      "Na końcu dodaj tytuł i opis. Asystent AI napisze opis automatycznie, gdy uzupełnisz dane pojazdu, cenę, lokalizację i zdjęcia.",
    titleLabel: "Tytuł ogłoszenia",
    titlePlaceholder: "np. BMW X5 xDrive30d M Sport",
    descriptionLabel: "Opis",
    descriptionPlaceholder: "Opisz stan auta, historię serwisową, wyposażenie...",
    aiAssistantBtn: "Asystent AI",
    aiGenerating: "Generowanie opisu…",
    aiMissingPrefix: "Uzupełnij brakujące dane przed generowaniem opisu:",
    aiGenFailed: "Nie udało się wygenerować opisu AI. Spróbuj ponownie za chwilę.",
    offerEyebrow: "Oferta",
    offerTitle: "Cena i przebieg",
    offerDescription: "Podaj aktualny przebieg i cenę sprzedaży w PLN.",
    mileageLabel: "Przebieg (km)",
    priceLabel: "Cena (PLN)",
    footerCreate: "Gotowe? Opublikuj ogłoszenie w katalogu Cars.",
    footerEdit: "Zapisz zmiany w ogłoszeniu.",
    publish: "Opublikuj ogłoszenie Cars",
    publishing: "Publikowanie...",
    saveChanges: "Zapisz zmiany",
    successTitle: "Ogłoszenie opublikowane i widoczne w katalogu Cars.",
    successBody:
      "Możesz edytować zdjęcia i dane w każdej chwili — powiadomienia o zapytaniach trafią na Twoje konto.",
    successCongrats: "Gratulacje!",
    successCtaCatalog: "Wróć do katalogu Cars",
    errTitlePrice: "Uzupełnij tytuł, markę, model, miejscowość i poprawną cenę.",
    errMapCity: "Ustaw miejscowość na mapie — przeciągnij mapę lub wybierz z wyszukiwarki.",
    errFuel: "Wybierz rodzaj paliwa z katalogu.",
    errPhotos: "Dodaj co najmniej jedno zdjęcie auta.",
  },
  catalogFields: {
    eyebrow: "Katalog pojazdu",
    title: "Marka, model i parametry",
    description: "Najpierw wybierz typ pojazdu — potem markę i model z właściwej bazy Otomoto.",
    vehicleTypeLabel: "Typ pojazdu",
    modelFreePlaceholder: "np. R 450, Actros 1845",
    notApplicable: "Nie dotyczy",
    yearLabel: "Rocznik produkcji",
    yearPlaceholder: "Wybierz rocznik",
    makeLabel: "Marka",
    modelLabel: "Model",
    generationLabel: "Generacja",
    fuelLabel: "Rodzaj paliwa",
    powerLabel: "Moc silnika",
    capacityLabel: "Pojemność silnika (cm³)",
    doorsLabel: "Liczba drzwi",
    gearboxLabel: "Skrzynia biegów",
    bodyLabel: "Nadwozie",
    colorLabel: "Kolor nadwozia",
    colorPlaceholder: "Wybierz kolor",
    trimLabel: "Wersja / wyposażenie",
    trimPlaceholder: "Opcjonalnie — wybierz po skrzyni biegów",
    catalogHint: "Po wyborze marki i modelu uzupełnimy paliwo, moc i skrzynię, jeśli są w katalogu.",
    yearRequiredHint: "Uzupełnij rocznik, aby zawęzić dostępne silniki i wersje.",
  },
  docs: {
    eyebrow: "Dokumenty pojazdu",
    title: "VIN, rejestracja i weryfikacja",
    description:
      "Dane z dowodu rejestracyjnego oraz weryfikacja CEPIK/UFG. Kupujący zobaczy historię bez ujawniania pełnych danych, jeśli włączysz zastrzeżenie.",
    vinLabel: "Numer VIN",
    vinPlaceholder: "17 znaków",
    registrationLabel: "Numer rejestracyjny",
    registrationPlaceholder: "np. WW 12345",
    firstRegLabel: "Data pierwszej rejestracji",
    firstRegPlaceholder: "DD.MM.RRRR",
    insuranceLabel: "OC ważne do",
    insurancePlaceholder: "DD.MM.RRRR",
    restrictLabel: "Zastrzeż dane na ogłoszeniu publicznym",
    restrictDescription: "Na liście i karcie ogłoszenia widoczne będą tylko fragmenty VIN i tablicy.",
    loginBanner: "Zaloguj się, aby sprawdzić historię CEPIK i OC przed publikacją.",
    fillHintTitle: "Uzupełnij dane z dowodu rejestracyjnego",
    fillHintBody:
      "Otomoto szyfruje VIN i rejestrację — nie da się ich przenieść z linku. Zeskanuj kod Aztec z dowodu albo wpisz dane ręcznie poniżej.",
    scanCta: "Zeskanuj kod z dowodu",
    manualCta: "Wpisuję ręcznie",
    otomotoPrivacyNote:
      "Po uzupełnieniu możesz zastrzec dane na ogłoszeniu — kupujący i tak sprawdzi historię i OC.",
    fillFromVinCta: "Uzupełnij formularz z VIN",
    fillingFromVin: "Pobieram dane z CEPIK…",
    fillFromVinHint:
      "Po wpisaniu VIN, tablicy i daty pierwszej rejestracji uzupełnimy markę, model, rocznik i silnik — tak jak po skanie dowodu.",
    errFillFromVin: "Nie udało się uzupełnić formularza z VIN.",
    verifyNeedsLogin: "Aby uruchomić CEPIK/OC, zaloguj się przy publikacji — dane z formularza zostaną zachowane.",
    checkHistory: "Sprawdź historię CEPIK",
    checkingHistory: "Pobieranie historii...",
    checkInsurance: "Sprawdź ważność OC",
    checkingInsurance: "Sprawdzanie OC...",
    autoChecking: "Automatyczna weryfikacja OC...",
    historyReady: "Raport historii gotowy poniżej.",
    errHistory: "Nie udało się pobrać historii.",
    errInsurance: "Nie udało się sprawdzić ubezpieczenia.",
    errOc: "Błąd sprawdzania OC.",
  },
  scan: {
    title: "Skan dowodu rejestracyjnego",
    subtitle: "Ustaw kod Aztec w ramce na środku — tył dowodu.",
    skip: "Wypełnię ręcznie",
    uploadInstead: "Wgraj zdjęcie zamiast aparatu",
    decoding: "Odczytywanie…",
    errDecode: "Nie udało się odczytać dowodu.",
    errAztec: "Nie udało się odczytać kodu Aztec — ustaw dowód w kadrze i spróbuj ponownie.",
    errCamera: "Nie udało się uruchomić aparatu.",
    errReadDoc: "Nie udało się odczytać dowodu.",
    phaseStarting: "Uruchamiam aparat…",
    phasePosition: "Ustaw tył dowodu — kod Aztec po prawej w ramce",
    phaseSearching: "Szukam kodu Aztec…",
    phaseHold: "Kod wykryty — trzymaj nieruchomo…",
    phaseDecoding: "Odczytuję dane z dowodu…",
    phaseSuccess: "Gotowe!",
    missingTitle: "tytuł",
    missingDescription: "opis",
    missingMileage: "przebieg",
    missingPrice: "cenę",
    missingCity: "miejscowość",
    missingImages: "zdjęcia",
    missingBannerPrefix: "Uzupełnij jeszcze:",
    retry: "Spróbuj ponownie",
    autoScanHint: "Przyłóż tył dowodu — przechwycimy kod sam, bez przycisku.",
    cameraDesktopHint: "Na komputerze wybierz kamerę w pasku adresu Safari/Chrome.",
  },
  photos: {
    eyebrow: "Galeria",
    title: "Zdjęcia auta",
    description: "Pierwsze zdjęcie będzie okładką ogłoszenia. Możesz dodać zdjęcia przed logowaniem.",
    mainBadge: "Główne",
    addPhotos: "Dodaj zdjęcia",
    dragHint: "Przeciągnij, aby zmienić kolejność",
    guestHint: "Zdjęcia zapisujemy lokalnie do momentu publikacji.",
    uploadError: "Upload zdjęcia nie powiódł się.",
    networkUploadError: "Błąd sieci podczas wgrywania zdjęcia.",
    errorBadge: "Błąd",
    photosCount: "{n} zdjęć",
    requiredHint: "Dodaj co najmniej jedno zdjęcie auta.",
  },
  map: {
    eyebrow: "Lokalizacja",
    title: "Miejscowość na mapie",
    description: "Przeciągnij mapę lub wyszukaj miejscowość — kupujący zobaczą przybliżoną lokalizację.",
    cityLabel: "Miejscowość",
    searchPlaceholder: "Wpisz miasto...",
    gpsButton: "Moja lokalizacja",
    gpsDenied: "Brak dostępu do lokalizacji.",
    gpsUnsupported: "Przeglądarka nie obsługuje geolokalizacji.",
    mapHint: "Przeciągnij mapę, aby ustawić pin w miejscowości sprzedaży.",
    countryLabel: "Państwo",
    mapTokenMissing: "Brak tokenu mapy — ustaw NEXT_PUBLIC_MAPBOX_TOKEN.",
    resolvingCity: "Ustalam miejscowość z pinezki…",
    pinCoords: "Pinezka: {lat}, {lng}{country}",
    searching: "Szukam…",
    gpsFailed: "Nie udało się pobrać lokalizacji GPS.",
    gpsLocating: "GPS…",
  },
  catalog: {
    heroTitle: "Profesjonalny katalog samochodów",
    heroDescription:
      "Jedno konto EstateOS, przełączanie Home/Car i zapytania trafiające prosto do sprzedającego przez EstateOS Contact.",
    statsFavorites: "{n} ulubionych z {total} zapisanych",
    statsMine: "{n} Twoich ogłoszeń",
    statsAll: "{n} aktywnych ogłoszeń w katalogu",
    addListing: "Dodaj ogłoszenie",
    findListing: "Znajdź",
    otomotoImportTitle: "Masz ogłoszenie na Otomoto?",
    otomotoImportBody:
      "Wklej link — w jeden moment przeniesiesz zdjęcia, opis i całą specyfikację do formularza EstateOS™Car.",
    otomotoImportPlaceholder: "https://www.otomoto.pl/osobowe/oferta/…",
    otomotoImportCta: "Przenieś",
    otomotoImportLoading: "Pobieram…",
    tabFavorites: "Ulubione",
    tabMine: "Moje samochody",
    tabAll: "Cały katalog",
    loginMineBanner: "Zaloguj się, aby zobaczyć swoje ogłoszenia samochodowe.",
    goLogin: "Przejdź do logowania",
    favoritesEmpty: "Nie masz jeszcze ulubionych aut. Kliknij serduszko na karcie ogłoszenia, aby dodać je tutaj.",
    filtersEyebrow: "Parametry wyszukiwania",
    filtersTitle: "Znajdź samochód",
    clearFilters: "Wyczyść filtry",
    searchLabel: "Szukaj",
    searchPlaceholder: "BMW, Warszawa, diesel...",
    vehicleTypeFilterLabel: "Typ pojazdu",
    allVehicleTypes: "Wszystkie typy",
    typeCar: "Osobowy",
    typeMotorcycle: "Motocykl",
    typeVan: "Dostawczy",
    typeTruck: "Ciężarowy",
    makeLabel: "Marka",
    allMakes: "Wszystkie marki",
    modelLabel: "Seria / model",
    allModels: "Wszystkie serie",
    pickMakeFirst: "Najpierw wybierz markę",
    generationLabel: "Generacja",
    allGenerations: "Wszystkie generacje",
    pickModelFirst: "Najpierw wybierz serię",
    fuelLabel: "Paliwo",
    allFuels: "Wszystkie",
    sortLabel: "Sortowanie",
    maxPriceLabel: "Maks. cena (PLN)",
    maxPricePlaceholder: "np. 300 000",
    resultsLoading: "Ładowanie...",
    resultsCount: "{filtered} z {total} ogłoszeń",
    loadingOffers: "Ładowanie ofert samochodów...",
    noResults: "Brak ogłoszeń pasujących do filtrów.",
    featuredBadge: "Wyróżnione",
  },
  detail: {
    description: "Opis",
    aboutListing: "O ogłoszeniu",
    specs: "Parametry",
    year: "Rocznik",
    mileage: "Przebieg",
    fuel: "Paliwo",
    transmission: "Skrzynia",
    body: "Nadwozie",
    color: "Kolor",
    power: "Moc",
    capacity: "Pojemność",
    doors: "Drzwi",
    city: "Lokalizacja",
    sellerProfile: "Profil sprzedającego",
    backToCatalog: "Wróć do katalogu",
    price: "Cena",
    aboutBody:
      "Ogłoszenie opublikowane w module EstateOS™Car — jednym ekosystemie z nieruchomościami EstateOS™Home. Zapytania trafiają bezpośrednio do sprzedającego przez EstateOS Contact.",
    generation: "Generacja",
    trim: "Wersja",
    version: "Wersja",
  },
  inquiry: {
    title: "Zapytaj o auto",
    description: "Wiadomość trafi bezpośrednio do sprzedającego przez EstateOS Contact.",
    nameLabel: "Imię i nazwisko",
    phoneLabel: "Telefon",
    phoneOptional: "opcjonalnie",
    viewingLabel: "Preferowany termin oględzin",
    viewingAsap: "Jak najszybciej",
    viewingWeek: "W tym tygodniu",
    viewingNextWeek: "W przyszłym tygodniu",
    viewingWeekend: "W weekend",
    viewingQuestionOnly: "Tylko pytanie — bez oględzin",
    messageLabel: "Twoja wiadomość",
    messagePlaceholder: "Napisz, co chcesz wiedzieć o aucie...",
    defaultMessage:
      "Dzień dobry, jestem zainteresowany/a ogłoszeniem „{title}”. Proszę o informację o dostępności i możliwości oględzin.",
    submit: "Wyślij zapytanie",
    submitting: "Wysyłanie...",
    success: "Zapytanie wysłane. Sprzedający odpowie przez EstateOS Contact.",
    successTitle: "Zapytanie wysłane",
    successBody: "Sprzedający otrzyma wiadomość w EstateOS Contact. Za chwilę przekierujemy Cię do czatu.",
    loginRequired: "Aby wysłać zapytanie, zaloguj się.",
    noSeller: "Zapytania będą dostępne po przypisaniu sprzedającego do tego ogłoszenia.",
    footerNote: "Wysyłając zapytanie, kontaktujesz się ze sprzedającym przez EstateOS Contact. Jedno konto — Home i Car.",
    submitFailed: "Nie udało się wysłać zapytania.",
  },
  checks: {
    title: "Weryfikacja pojazdu",
    description: "Sprawdź historię w CEPIK i ważność OC (UFG) na podstawie danych z ogłoszenia.",
    restrictedNote: " Sprzedający zastrzegł pełne dane VIN, rejestracji i pierwszej rejestracji.",
    loginBanner: "Sprawdzenie historii pojazdu i OC wymaga zalogowania.",
    vin: "VIN",
    registration: "Rejestracja",
    firstRegistration: "Pierwsza rejestracja",
    historyNeedsData: "Pełna historia CEPIK wymaga VIN, tablicy i daty pierwszej rejestracji od sprzedającego.",
    checkHistory: "Sprawdź historię CEPIK",
    checkingHistory: "Pobieranie historii...",
    checkInsurance: "Sprawdź ważność OC",
    checkingInsurance: "Sprawdzanie OC...",
    closeModal: "Zamknij",
    historyModalTitle: "Historia pojazdu",
    errHistory: "Błąd sprawdzania historii.",
    errInsurance: "Błąd sprawdzania ubezpieczenia.",
  },
  owner: {
    edit: "Edytuj ogłoszenie",
    delete: "Usuń ogłoszenie",
    deleting: "Usuwanie...",
    confirmDelete: "Usunąć to ogłoszenie samochodu? Tej operacji nie można cofnąć.",
    deleteFailed: "Nie udało się usunąć ogłoszenia.",
    deleteNetworkError: "Błąd sieci podczas usuwania ogłoszenia.",
  },
  edit: {
    pageTitle: "Edytuj ogłoszenie",
    pageDescription: "Zaktualizuj dane, zdjęcia i cenę auta w katalogu Cars.",
    backToDetails: "Wróć do szczegółów",
  },
  seller: {
    eyebrow: "EstateOS™Car",
    title: "Ogłoszenia samochodowe",
  },
  favorites: {
    add: "Dodaj do ulubionych",
    remove: "Usuń z ulubionych",
  },
};

const en: CarsDictionary = {
  common: {
    cancel: "Cancel",
    loading: "Loading...",
    choose: "Choose →",
    optional: "Optional",
    poland: "Poland",
    automaticTransmission: "Automatic",
    suvBody: "SUV",
    priceOnRequest: "Price on request",
    login: "Sign in",
    networkError: "Network error while saving the listing.",
    saveFailed: "Could not save the listing.",
    managementPanel: "Management panel",
    myListings: "My listings",
    carsCatalog: "Cars catalog",
    edit: "Edit",
    viewListing: "View listing",
    chooseField: "Choose {field}",
    retry: "Try again",
  },
  sort: {
    newest: "Newest",
    priceAsc: "Price: low to high",
    priceDesc: "Price: high to low",
    yearDesc: "Newest model year",
    mileageAsc: "Lowest mileage",
  },
  entry: {
    heroTitle: "How do you want to add your car?",
    heroDescription:
      "Choose how to enter registration document data. You can fill the form without signing in — you'll create an account when you publish.",
    privacyEyebrow: "Our edge",
    privacyTitle: "VIN privacy and full history for buyers",
    privacyBody: "After entering VIN, plate number and first registration date you can",
    privacyBodyRestrict: "restrict these details",
    privacyBodyHistory:
      "— only the first characters appear publicly. Buyers can still run a full CEPIK history check without exposing your sensitive data.",
    restrictSwitchLabel: "Restrict vehicle data (VIN, plate, first registration)",
    restrictSwitchDescription:
      "Example: WBA*** instead of full VIN on the listing — shop history stays complete for buyers.",
    restrictHint: "You can toggle restriction anytime in the form before publishing.",
    methodScanTitle: "Scan with camera",
    methodScanDescription:
      "Frame the back of the registration card — we'll read the Aztec code and fill make, model and VIN.",
    methodScanBadge: "Fastest",
    methodUploadTitle: "Upload document photo",
    methodUploadDescription: "Already have a photo? Upload JPG, PNG or HEIC — we'll read the Aztec code.",
    methodCaptureTitle: "Take a photo and process",
    methodCaptureDescription: "Capture the back of the card with your phone or webcam — instant decode.",
    methodManualTitle: "Fill in manually",
    methodManualDescription: "No document handy? Go to the form and enter details at your own pace.",
    methodManualBadge: "Form",
    methodOtomotoTitle: "Import from Otomoto",
    methodOtomotoDescription:
      "Already listed on Otomoto? Paste the link — we'll move photos, description and specs into the form.",
    methodOtomotoBadge: "Quick start",
    methodDocTitle: "Scan registration document",
    methodDocDescription:
      "Read the Aztec code from the back of the card — we'll fill make, model and VIN. Choose live scan, upload or a new photo.",
    methodDocBadge: "From document",
    docModeLabel: "How do you want to read the code?",
    docModeLiveTitle: "Live scan",
    docModeLiveDescription: "Frame the back of the card with the camera — we'll decode automatically.",
    docModeUploadTitle: "Upload photo",
    docModeUploadDescription: "Pick a JPG, PNG or HEIC from your gallery.",
    docModeCaptureTitle: "Take a photo",
    docModeCaptureDescription: "Capture a new photo of the card back — we'll process it right away.",
    docContinue: "Continue with document",
    manualLink: "I'd rather fill the form manually",
    hasAccount: "Already have an account?",
    signIn: "Sign in",
    changeEntryMethod: "← Change entry method",
  },
  form: {
    guestBanner:
      "You can complete the form without signing in. When you tap Publish you'll create an account — the listing goes live and you'll get inquiry notifications.",
    scanLoaded: "Registration data loaded.",
    scanCheckCatalog: "Check the catalog and complete your listing.",
    otomotoLoaded: "Otomoto data loaded.",
    otomotoCheckForm: "Review the form and fill any missing fields before publishing.",
    contentEyebrow: "Listing content",
    contentTitle: "Title and description",
    contentDescription:
      "Add the title and description at the end. The AI assistant writes the description once vehicle details, price, location and photos are complete.",
    titleLabel: "Listing title",
    titlePlaceholder: "e.g. BMW X5 xDrive30d M Sport",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Describe condition, service history, equipment...",
    aiAssistantBtn: "AI assistant",
    aiGenerating: "Generating description…",
    aiMissingPrefix: "Fill in the missing fields before generating a description:",
    aiGenFailed: "Could not generate the AI description. Please try again in a moment.",
    offerEyebrow: "Offer",
    offerTitle: "Price and mileage",
    offerDescription: "Enter current mileage and sale price in PLN.",
    mileageLabel: "Mileage (km)",
    priceLabel: "Price (PLN)",
    footerCreate: "Ready? Publish to the Cars catalog.",
    footerEdit: "Save changes to your listing.",
    publish: "Publish Cars listing",
    publishing: "Publishing...",
    saveChanges: "Save changes",
    successTitle: "Listing published and visible in the Cars catalog.",
    successBody: "You can edit photos and details anytime — inquiry notifications go to your account.",
    successCongrats: "Congratulations!",
    successCtaCatalog: "Back to Cars catalog",
    errTitlePrice: "Fill in title, make, model, city and a valid price.",
    errMapCity: "Set the city on the map — drag the map or pick from search.",
    errFuel: "Select fuel type from the catalog.",
    errPhotos: "Add at least one photo of the car.",
  },
  catalogFields: {
    eyebrow: "Vehicle catalog",
    title: "Make, model and specs",
    description: "Pick the vehicle type first — then make and model from the matching Otomoto catalog.",
    vehicleTypeLabel: "Vehicle type",
    modelFreePlaceholder: "e.g. R 450, Actros 1845",
    notApplicable: "N/A",
    yearLabel: "Model year",
    yearPlaceholder: "Select year",
    makeLabel: "Make",
    modelLabel: "Model",
    generationLabel: "Generation",
    fuelLabel: "Fuel type",
    powerLabel: "Engine power",
    capacityLabel: "Engine capacity (cc)",
    doorsLabel: "Number of doors",
    gearboxLabel: "Transmission",
    bodyLabel: "Body type",
    colorLabel: "Exterior color",
    colorPlaceholder: "Select color",
    trimLabel: "Trim / equipment",
    trimPlaceholder: "Optional — select after gearbox",
    catalogHint: "After make and model we pre-fill fuel, power and gearbox when available.",
    yearRequiredHint: "Select model year to narrow engine and trim options.",
  },
  docs: {
    eyebrow: "Vehicle documents",
    title: "VIN, registration and verification",
    description: "Registration data plus CEPIK/UFG checks. Buyers see history without full data if you enable restriction.",
    vinLabel: "VIN number",
    vinPlaceholder: "17 characters",
    registrationLabel: "Registration number",
    registrationPlaceholder: "e.g. WW 12345",
    firstRegLabel: "First registration date",
    firstRegPlaceholder: "DD.MM.YYYY",
    insuranceLabel: "Insurance valid until",
    insurancePlaceholder: "DD.MM.YYYY",
    restrictLabel: "Restrict data on public listing",
    restrictDescription: "Only partial VIN and plate shown on cards and detail page.",
    loginBanner: "Sign in to run CEPIK history and insurance checks before publishing.",
    fillHintTitle: "Complete registration document details",
    fillHintBody:
      "Otomoto encrypts VIN and plate — they can't be imported from the link. Scan the Aztec code or type the details below.",
    scanCta: "Scan document code",
    manualCta: "I'll type manually",
    otomotoPrivacyNote:
      "After filling, you can restrict public data — buyers can still check history and insurance.",
    fillFromVinCta: "Fill form from VIN",
    fillingFromVin: "Fetching CEPIK data…",
    fillFromVinHint:
      "After entering VIN, plate and first registration date we fill make, model, year and engine — same as after scanning the document.",
    errFillFromVin: "Could not fill the form from VIN.",
    verifyNeedsLogin: "Sign in at publish to run CEPIK/OC — your form data stays saved.",
    checkHistory: "Check CEPIK history",
    checkingHistory: "Loading history...",
    checkInsurance: "Check insurance validity",
    checkingInsurance: "Checking insurance...",
    autoChecking: "Auto-checking insurance...",
    historyReady: "History report ready below.",
    errHistory: "Could not load history.",
    errInsurance: "Could not check insurance.",
    errOc: "Insurance check error.",
  },
  scan: {
    title: "Scan registration document",
    subtitle: "Place the Aztec code in the center frame — card back.",
    skip: "Fill manually",
    uploadInstead: "Upload photo instead of camera",
    decoding: "Decoding…",
    errDecode: "Could not read the document.",
    errAztec: "Could not read Aztec code — align the card and try again.",
    errCamera: "Could not start the camera.",
    errReadDoc: "Could not read the document.",
    phaseStarting: "Starting camera…",
    phasePosition: "Frame the card back — Aztec code on the right",
    phaseSearching: "Looking for Aztec code…",
    phaseHold: "Code detected — hold steady…",
    phaseDecoding: "Reading document data…",
    phaseSuccess: "Done!",
    missingTitle: "title",
    missingDescription: "description",
    missingMileage: "mileage",
    missingPrice: "price",
    missingCity: "city",
    missingImages: "photos",
    missingBannerPrefix: "Still needed:",
    retry: "Try again",
    autoScanHint: "Hold the card back in frame — we capture the code automatically.",
    cameraDesktopHint: "On desktop, allow camera access in the browser address bar.",
  },
  photos: {
    eyebrow: "Gallery",
    title: "Car photos",
    description: "The first photo is the cover. You can add photos before signing in.",
    mainBadge: "Main",
    addPhotos: "Add photos",
    dragHint: "Drag to reorder",
    guestHint: "Photos are stored locally until you publish.",
    uploadError: "Photo upload failed.",
    networkUploadError: "Network error while uploading photo.",
    errorBadge: "Error",
    photosCount: "{n} photos",
    requiredHint: "Add at least one car photo.",
  },
  map: {
    eyebrow: "Location",
    title: "City on map",
    description: "Drag the map or search — buyers see approximate location.",
    cityLabel: "City",
    searchPlaceholder: "Enter city...",
    gpsButton: "My location",
    gpsDenied: "Location access denied.",
    gpsUnsupported: "Geolocation is not supported.",
    mapHint: "Drag the map to set the pin in the sale city.",
    countryLabel: "Country",
    mapTokenMissing: "Map token missing — set NEXT_PUBLIC_MAPBOX_TOKEN.",
    resolvingCity: "Resolving city from pin…",
    pinCoords: "Pin: {lat}, {lng}{country}",
    searching: "Searching…",
    gpsFailed: "Could not get GPS location.",
    gpsLocating: "GPS…",
  },
  catalog: {
    heroTitle: "Professional car catalog",
    heroDescription: "One EstateOS account, Home/Car switch and inquiries via EstateOS Contact.",
    statsFavorites: "{n} favorites of {total} saved",
    statsMine: "{n} of your listings",
    statsAll: "{n} active listings in catalog",
    addListing: "Add listing",
    findListing: "Find",
    otomotoImportTitle: "Already listed on Otomoto?",
    otomotoImportBody:
      "Paste the link — move photos, description and full specs into the EstateOS™Car form in one step.",
    otomotoImportPlaceholder: "https://www.otomoto.pl/osobowe/oferta/…",
    otomotoImportCta: "Import",
    otomotoImportLoading: "Fetching…",
    tabFavorites: "Favorites",
    tabMine: "My cars",
    tabAll: "Full catalog",
    loginMineBanner: "Sign in to see your car listings.",
    goLogin: "Go to sign in",
    favoritesEmpty: "No favorite cars yet. Tap the heart on a listing to save it here.",
    filtersEyebrow: "Search parameters",
    filtersTitle: "Find a car",
    clearFilters: "Clear filters",
    searchLabel: "Search",
    searchPlaceholder: "BMW, Warsaw, diesel...",
    vehicleTypeFilterLabel: "Vehicle type",
    allVehicleTypes: "All types",
    typeCar: "Car",
    typeMotorcycle: "Motorcycle",
    typeVan: "Van",
    typeTruck: "Truck",
        makeLabel: "Make",
    allMakes: "All makes",
    modelLabel: "Series / model",
    allModels: "All series",
    pickMakeFirst: "Select make first",
    generationLabel: "Generation",
    allGenerations: "All generations",
    pickModelFirst: "Select series first",
    fuelLabel: "Fuel",
    allFuels: "All",
    sortLabel: "Sort",
    maxPriceLabel: "Max price (PLN)",
    maxPricePlaceholder: "e.g. 300 000",
    resultsLoading: "Loading...",
    resultsCount: "{filtered} of {total} listings",
    loadingOffers: "Loading car listings...",
    noResults: "No listings match your filters.",
    featuredBadge: "Featured",
  },
  detail: {
    description: "Description",
    aboutListing: "About this listing",
    specs: "Specifications",
    year: "Year",
    mileage: "Mileage",
    fuel: "Fuel",
    transmission: "Transmission",
    body: "Body",
    color: "Color",
    power: "Power",
    capacity: "Capacity",
    doors: "Doors",
    city: "Location",
    sellerProfile: "Seller profile",
    backToCatalog: "Back to catalog",
    price: "Price",
    aboutBody:
      "Listing published in EstateOS™Car — one ecosystem with EstateOS™Home. Inquiries go directly to the seller via EstateOS Contact.",
    generation: "Generation",
    trim: "Trim",
    version: "Version",
  },
  inquiry: {
    title: "Inquire about this car",
    description: "Your message goes directly to the seller via EstateOS Contact.",
    nameLabel: "Full name",
    phoneLabel: "Phone",
    phoneOptional: "optional",
    viewingLabel: "Preferred viewing time",
    viewingAsap: "As soon as possible",
    viewingWeek: "This week",
    viewingNextWeek: "Next week",
    viewingWeekend: "On the weekend",
    viewingQuestionOnly: "Question only — no viewing",
    messageLabel: "Your message",
    messagePlaceholder: "What would you like to know about the car?",
    defaultMessage:
      "Hello, I am interested in the listing \"{title}\". Please let me know about availability and viewing options.",
    submit: "Send inquiry",
    submitting: "Sending...",
    success: "Inquiry sent. The seller will reply via EstateOS Contact.",
    successTitle: "Inquiry sent",
    successBody: "The seller will receive your message in EstateOS Contact. Redirecting you to chat shortly.",
    loginRequired: "Sign in to send an inquiry.",
    noSeller: "Inquiries will be available once a seller is assigned to this listing.",
    footerNote: "By sending an inquiry you contact the seller via EstateOS Contact. One account — Home and Car.",
    submitFailed: "Could not send inquiry.",
  },
  checks: {
    title: "Vehicle verification",
    description: "Check CEPIK history and OC (UFG) insurance based on listing data.",
    restrictedNote: " The seller restricted full VIN, plate and first registration data.",
    loginBanner: "History and insurance checks require sign-in.",
    vin: "VIN",
    registration: "Registration",
    firstRegistration: "First registration",
    historyNeedsData: "Full CEPIK history needs VIN, plate and first registration from the seller.",
    checkHistory: "Check CEPIK history",
    checkingHistory: "Loading history...",
    checkInsurance: "Check insurance validity",
    checkingInsurance: "Checking insurance...",
    closeModal: "Close",
    historyModalTitle: "Vehicle history",
    errHistory: "History check error.",
    errInsurance: "Insurance check error.",
  },
  owner: {
    edit: "Edit listing",
    delete: "Delete listing",
    deleting: "Deleting...",
    confirmDelete: "Delete this car listing? This cannot be undone.",
    deleteFailed: "Could not delete the listing.",
    deleteNetworkError: "Network error while deleting.",
  },
  edit: {
    pageTitle: "Edit listing",
    pageDescription: "Update details, photos and price in the Cars catalog.",
    backToDetails: "Back to details",
  },
  seller: {
    eyebrow: "EstateOS™Car",
    title: "Car listings",
  },
  favorites: {
    add: "Add to favorites",
    remove: "Remove from favorites",
  },
};

const uk: CarsDictionary = {
  common: {
    cancel: "Скасувати",
    loading: "Завантаження...",
    choose: "Обрати →",
    optional: "Необов'язково",
    poland: "Польща",
    automaticTransmission: "Автоматична",
    suvBody: "SUV",
    priceOnRequest: "Ціна за запитом",
    login: "Увійти",
    networkError: "Помилка мережі під час збереження оголошення.",
    saveFailed: "Не вдалося зберегти оголошення.",
    managementPanel: "Панель керування",
    myListings: "Мої оголошення",
    carsCatalog: "Каталог Cars",
    edit: "Редагувати",
    viewListing: "Переглянути оголошення",
    chooseField: "Оберіть {field}",
    retry: "Спробувати знову",
  },
  sort: {
    newest: "Найновіші",
    priceAsc: "Ціна за зростанням",
    priceDesc: "Ціна за спаданням",
    yearDesc: "Найновіший рік",
    mileageAsc: "Найменший пробіг",
  },
  entry: {
    heroTitle: "Як додати авто?",
    heroDescription:
      "Оберіть спосіб введення даних зі свідоцтва реєстрації. Форму можна заповнити без входу — акаунт створите при публікації.",
    privacyEyebrow: "Наша перевага",
    privacyTitle: "Приватність VIN і повна історія для покупця",
    privacyBody: "Після введення VIN, номера реєстрації та дати першої реєстрації ви можете",
    privacyBodyRestrict: "обмежити ці дані",
    privacyBodyHistory:
      "— у публічному оголошенні видно лише перші символи. Покупець одним кліком перевірить історію CEPIK без розкриття ваших даних.",
    restrictSwitchLabel: "Обмежити дані авто (VIN, реєстрація, перша реєстрація)",
    restrictSwitchDescription:
      "Приклад: WBA*** замість повного VIN — історія в магазині залишається повною для покупця.",
    restrictHint: "У формі можна ввімкнути або вимкнути обмеження перед публікацією.",
    methodScanTitle: "Сканувати камерою",
    methodScanDescription:
      "Наведіть задню сторону свідоцтва — код Aztec зчитаємо автоматично та заповнимо марку, модель і VIN.",
    methodScanBadge: "Найшвидше",
    methodUploadTitle: "Завантажити фото свідоцтва",
    methodUploadDescription: "Є фото в галереї? Завантажте JPG, PNG або HEIC — зчитаємо код Aztec.",
    methodCaptureTitle: "Зробити фото й обробити",
    methodCaptureDescription: "Зробіть фото задньої сторони свідоцтва — код зчитається одразу.",
    methodManualTitle: "Заповню вручну",
    methodManualDescription: "Немає свідоцтва? Перейдіть до форми та введіть дані у своєму темпі.",
    methodManualBadge: "Форма",
    methodOtomotoTitle: "Імпорт з Otomoto",
    methodOtomotoDescription:
      "Вже є оголошення на Otomoto? Вставте посилання — перенесемо фото, опис і специфікацію у форму.",
    methodOtomotoBadge: "Швидкий старт",
    methodDocTitle: "Сканувати свідоцтво",
    methodDocDescription:
      "Зчитаємо код Aztec зі звороту свідоцтва — заповнимо марку, модель і VIN. Оберіть живе сканування, завантаження або нове фото.",
    methodDocBadge: "Зі свідоцтва",
    docModeLabel: "Як зчитати код?",
    docModeLiveTitle: "Скан наживо",
    docModeLiveDescription: "Наведіть камеру на зворот свідоцтва — код зчитаємо автоматично.",
    docModeUploadTitle: "Завантажити фото",
    docModeUploadDescription: "Оберіть JPG, PNG або HEIC з галереї.",
    docModeCaptureTitle: "Зробити фото",
    docModeCaptureDescription: "Зробіть нове фото звороту свідоцтва — обробимо одразу.",
    docContinue: "Продовжити зі свідоцтвом",
    manualLink: "Краще заповню форму вручну",
    hasAccount: "Вже маєте акаунт?",
    signIn: "Увійти",
    changeEntryMethod: "← Змінити спосіб додавання",
  },
  form: {
    guestBanner:
      "Форму можна заповнити без входу. Після «Опублікувати» створите акаунт — оголошення з'явиться в каталозі, а запити надійдуть на ваш акаунт.",
    scanLoaded: "Дані зі свідоцтва завантажено.",
    scanCheckCatalog: "Перевірте каталог і доповніть оголошення.",
    otomotoLoaded: "Дані з Otomoto завантажено.",
    otomotoCheckForm: "Перевірте форму та доповніть відсутні поля перед публікацією.",
    contentEyebrow: "Зміст оголошення",
    contentTitle: "Заголовок і опис",
    contentDescription:
      "Заголовок і опис додайте в кінці. AI-асистент напише опис автоматично, коли заповните дані авто, ціну, локацію та фото.",
    titleLabel: "Заголовок оголошення",
    titlePlaceholder: "напр. BMW X5 xDrive30d M Sport",
    descriptionLabel: "Опис",
    descriptionPlaceholder: "Опишіть стан, сервісну історію, комплектацію...",
    aiAssistantBtn: "AI-асистент",
    aiGenerating: "Генерація опису…",
    aiMissingPrefix: "Заповніть відсутні дані перед генерацією опису:",
    aiGenFailed: "Не вдалося згенерувати опис AI. Спробуйте ще раз за хвилину.",
    offerEyebrow: "Пропозиція",
    offerTitle: "Ціна і пробіг",
    offerDescription: "Вкажіть актуальний пробіг і ціну продажу в PLN.",
    mileageLabel: "Пробіг (км)",
    priceLabel: "Ціна (PLN)",
    footerCreate: "Готово? Опублікуйте в каталозі Cars.",
    footerEdit: "Збережіть зміни в оголошенні.",
    publish: "Опублікувати оголошення Cars",
    publishing: "Публікація...",
    saveChanges: "Зберегти зміни",
    successTitle: "Оголошення опубліковано та видиме в каталозі Cars.",
    successBody: "Редагуйте фото й дані будь-коли — сповіщення про запити надійдуть на акаунт.",
    successCongrats: "Вітаємо!",
    successCtaCatalog: "Повернутися до каталогу Cars",
    errTitlePrice: "Заповніть заголовок, марку, модель, місто та коректну ціну.",
    errMapCity: "Встановіть місто на карті — перетягніть карту або оберіть з пошуку.",
    errFuel: "Оберіть тип палива з каталогу.",
    errPhotos: "Додайте щонайменше одне фото авто.",
  },
  catalogFields: {
    eyebrow: "Каталог авто",
    title: "Марка, модель і параметри",
    description: "Спочатку оберіть тип транспорту — потім марку й модель з відповідного каталогу Otomoto.",
    vehicleTypeLabel: "Тип транспорту",
    modelFreePlaceholder: "напр. R 450, Actros 1845",
    notApplicable: "Не застосовується",
    yearLabel: "Рік випуску",
    yearPlaceholder: "Оберіть рік",
    makeLabel: "Марка",
    modelLabel: "Модель",
    generationLabel: "Покоління",
    fuelLabel: "Тип палива",
    powerLabel: "Потужність двигуна",
    capacityLabel: "Об'єм двигуна (см³)",
    doorsLabel: "Кількість дверей",
    gearboxLabel: "Коробка передач",
    bodyLabel: "Кузов",
    colorLabel: "Колір кузова",
    colorPlaceholder: "Оберіть колір",
    trimLabel: "Версія / комплектація",
    trimPlaceholder: "Необов'язково — після коробки",
    catalogHint: "Після марки та моделі заповнимо паливо, потужність і КПП, якщо є в каталозі.",
    yearRequiredHint: "Вкажіть рік, щоб звузити доступні двигуни та комплектації.",
  },
  docs: {
    eyebrow: "Документи авто",
    title: "VIN, реєстрація та перевірка",
    description: "Дані зі свідоцтва та перевірка CEPIK/UFG. Покупець бачить історію без повних даних, якщо увімкнено обмеження.",
    vinLabel: "Номер VIN",
    vinPlaceholder: "17 символів",
    registrationLabel: "Номер реєстрації",
    registrationPlaceholder: "напр. WW 12345",
    firstRegLabel: "Дата першої реєстрації",
    firstRegPlaceholder: "ДД.ММ.РРРР",
    insuranceLabel: "Страховка дійсна до",
    insurancePlaceholder: "ДД.ММ.РРРР",
    restrictLabel: "Обмежити дані в публічному оголошенні",
    restrictDescription: "У списку та картці видно лише фрагменти VIN і номера.",
    loginBanner: "Увійдіть, щоб перевірити історію CEPIK і OC перед публікацією.",
    fillHintTitle: "Заповніть дані зі свідоцтва",
    fillHintBody:
      "Otomoto шифрує VIN і номер — їх не можна імпортувати з посилання. Відскануйте код Aztec або введіть дані нижче.",
    scanCta: "Сканувати код зі свідоцтва",
    manualCta: "Введу вручну",
    otomotoPrivacyNote:
      "Після заповнення можна обмежити дані в оголошенні — покупець все одно перевірить історію та OC.",
    fillFromVinCta: "Заповнити форму з VIN",
    fillingFromVin: "Отримую дані з CEPIK…",
    fillFromVinHint:
      "Після введення VIN, номера та дати першої реєстрації заповнимо марку, модель, рік і двигун — як після скану свідоцтва.",
    errFillFromVin: "Не вдалося заповнити форму з VIN.",
    verifyNeedsLogin: "Щоб запустити CEPIK/OC, увійдіть при публікації — дані форми збережуться.",
    checkHistory: "Перевірити історію CEPIK",
    checkingHistory: "Завантаження історії...",
    checkInsurance: "Перевірити дійсність OC",
    checkingInsurance: "Перевірка OC...",
    autoChecking: "Автоматична перевірка OC...",
    historyReady: "Звіт історії готовий нижче.",
    errHistory: "Не вдалося завантажити історію.",
    errInsurance: "Не вдалося перевірити страховку.",
    errOc: "Помилка перевірки OC.",
  },
  scan: {
    title: "Скан свідоцтва реєстрації",
    subtitle: "Розмістіть код Aztec у рамці по центру — зворот свідоцтва.",
    skip: "Заповню вручну",
    uploadInstead: "Завантажити фото замість камери",
    decoding: "Зчитування…",
    errDecode: "Не вдалося зчитати свідоцтво.",
    errAztec: "Не вдалося зчитати код Aztec — вирівняйте свідоцтво та спробуйте знову.",
    errCamera: "Не вдалося запустити камеру.",
    errReadDoc: "Не вдалося зчитати свідоцтво.",
    phaseStarting: "Запуск камери…",
    phasePosition: "Наведіть зад свідоцтва — код Aztec праворуч у рамці",
    phaseSearching: "Шукаю код Aztec…",
    phaseHold: "Код виявлено — тримайте нерухомо…",
    phaseDecoding: "Зчитую дані зі свідоцтва…",
    phaseSuccess: "Готово!",
    missingTitle: "заголовок",
    missingDescription: "опис",
    missingMileage: "пробіг",
    missingPrice: "ціну",
    missingCity: "місто",
    missingImages: "фото",
    missingBannerPrefix: "Ще потрібно:",
    retry: "Спробувати знову",
    autoScanHint: "Прикладіть зад свідоцтва — код зчитаємо автоматично.",
    cameraDesktopHint: "На комп'ютері дозвольте камеру в адресному рядку браузера.",
  },
  photos: {
    eyebrow: "Галерея",
    title: "Фото авто",
    description: "Перше фото — обкладинка. Можна додати фото до входу в акаунт.",
    mainBadge: "Головне",
    addPhotos: "Додати фото",
    dragHint: "Перетягніть, щоб змінити порядок",
    guestHint: "Фото зберігаються локально до публікації.",
    uploadError: "Не вдалося завантажити фото.",
    networkUploadError: "Помилка мережі під час завантаження фото.",
    errorBadge: "Помилка",
    photosCount: "{n} фото",
    requiredHint: "Додайте принаймні одне фото авто.",
  },
  map: {
    eyebrow: "Локація",
    title: "Місто на карті",
    description: "Перетягніть карту або шукайте — покупець бачить приблизне місце.",
    cityLabel: "Місто",
    searchPlaceholder: "Введіть місто...",
    gpsButton: "Моє місцезнаходження",
    gpsDenied: "Немає доступу до геолокації.",
    gpsUnsupported: "Геолокація не підтримується.",
    mapHint: "Перетягніть карту, щоб встановити маркер у місті продажу.",
    countryLabel: "Країна",
    mapTokenMissing: "Немає токена карти — встановіть NEXT_PUBLIC_MAPBOX_TOKEN.",
    resolvingCity: "Визначаю місто за маркером…",
    pinCoords: "Маркер: {lat}, {lng}{country}",
    searching: "Шукаю…",
    gpsFailed: "Не вдалося отримати GPS.",
    gpsLocating: "GPS…",
  },
  catalog: {
    heroTitle: "Професійний каталог автомобілів",
    heroDescription: "Один акаунт EstateOS, перемикання Home/Car і запити через EstateOS Contact.",
    statsFavorites: "{n} обраних з {total} збережених",
    statsMine: "{n} ваших оголошень",
    statsAll: "{n} активних оголошень у каталозі",
    addListing: "Додати оголошення",
    findListing: "Знайти",
    otomotoImportTitle: "Маєте оголошення на Otomoto?",
    otomotoImportBody:
      "Вставте посилання — за мить перенесете фото, опис і всю специфікацію у форму EstateOS™Car.",
    otomotoImportPlaceholder: "https://www.otomoto.pl/osobowe/oferta/…",
    otomotoImportCta: "Перенести",
    otomotoImportLoading: "Завантажую…",
    tabFavorites: "Обране",
    tabMine: "Мої авто",
    tabAll: "Весь каталог",
    loginMineBanner: "Увійдіть, щоб побачити свої оголошення авто.",
    goLogin: "Перейти до входу",
    favoritesEmpty: "Ще немає обраних авто. Натисніть серце на картці оголошення.",
    filtersEyebrow: "Параметри пошуку",
    filtersTitle: "Знайти автомобіль",
    clearFilters: "Очистити фільтри",
    searchLabel: "Пошук",
    searchPlaceholder: "BMW, Варшава, дизель...",
    vehicleTypeFilterLabel: "Тип транспорту",
    allVehicleTypes: "Усі типи",
    typeCar: "Легковий",
    typeMotorcycle: "Мотоцикл",
    typeVan: "Фургон",
    typeTruck: "Вантажівка",
        makeLabel: "Марка",
    allMakes: "Усі марки",
    modelLabel: "Серія / модель",
    allModels: "Усі серії",
    pickMakeFirst: "Спочатку оберіть марку",
    generationLabel: "Покоління",
    allGenerations: "Усі покоління",
    pickModelFirst: "Спочатку оберіть серію",
    fuelLabel: "Паливо",
    allFuels: "Усі",
    sortLabel: "Сортування",
    maxPriceLabel: "Макс. ціна (PLN)",
    maxPricePlaceholder: "напр. 300 000",
    resultsLoading: "Завантаження...",
    resultsCount: "{filtered} з {total} оголошень",
    loadingOffers: "Завантаження оголошень авто...",
    noResults: "Немає оголошень за вашими фільтрами.",
    featuredBadge: "Виділене",
  },
  detail: {
    description: "Опис",
    aboutListing: "Про оголошення",
    specs: "Параметри",
    year: "Рік",
    mileage: "Пробіг",
    fuel: "Паливо",
    transmission: "Коробка",
    body: "Кузов",
    color: "Колір",
    power: "Потужність",
    capacity: "Об'єм",
    doors: "Двері",
    city: "Локація",
    sellerProfile: "Профіль продавця",
    backToCatalog: "Назад до каталогу",
    price: "Ціна",
    aboutBody:
      "Оголошення в модулі EstateOS™Car — одна екосистема з EstateOS™Home. Запити надходять продавцю через EstateOS Contact.",
    generation: "Покоління",
    trim: "Комплектація",
    version: "Версія",
  },
  inquiry: {
    title: "Запит про авто",
    description: "Повідомлення надійде продавцю через EstateOS Contact.",
    nameLabel: "Ім'я та прізвище",
    phoneLabel: "Телефон",
    phoneOptional: "необов'язково",
    viewingLabel: "Бажаний час огляду",
    viewingAsap: "Якомога швидше",
    viewingWeek: "Цього тижня",
    viewingNextWeek: "Наступного тижня",
    viewingWeekend: "У вихідні",
    viewingQuestionOnly: "Лише питання — без огляду",
    messageLabel: "Ваше повідомлення",
    messagePlaceholder: "Що хочете дізнатися про авто?",
    defaultMessage:
      "Добрий день, мене цікавить оголошення «{title}». Будь ласка, повідомте про доступність і можливість огляду.",
    submit: "Надіслати запит",
    submitting: "Надсилання...",
    success: "Запит надіслано. Продавець відповість через EstateOS Contact.",
    successTitle: "Запит надіслано",
    successBody: "Продавець отримає повідомлення в EstateOS Contact. Незабаром перенаправимо вас до чату.",
    loginRequired: "Увійдіть, щоб надіслати запит.",
    noSeller: "Запити будуть доступні після призначення продавця до цього оголошення.",
    footerNote: "Надсилаючи запит, ви зв'язуєтесь із продавцем через EstateOS Contact. Один акаунт — Home і Car.",
    submitFailed: "Не вдалося надіслати запит.",
  },
  checks: {
    title: "Верифікація авто",
    description: "Перевірте історію CEPIK і дійсність OC (UFG) за даними оголошення.",
    restrictedNote: " Продавець обмежив повні дані VIN, реєстрації та першої реєстрації.",
    loginBanner: "Перевірка історії та OC потребує входу.",
    vin: "VIN",
    registration: "Реєстрація",
    firstRegistration: "Перша реєстрація",
    historyNeedsData: "Повна історія CEPIK потребує VIN, номера та дати першої реєстрації від продавця.",
    checkHistory: "Перевірити історію CEPIK",
    checkingHistory: "Завантаження історії...",
    checkInsurance: "Перевірити дійсність OC",
    checkingInsurance: "Перевірка OC...",
    closeModal: "Закрити",
    historyModalTitle: "Історія авто",
    errHistory: "Помилка перевірки історії.",
    errInsurance: "Помилка перевірки страховки.",
  },
  owner: {
    edit: "Редагувати оголошення",
    delete: "Видалити оголошення",
    deleting: "Видалення...",
    confirmDelete: "Видалити це оголошення авто? Цю дію не скасувати.",
    deleteFailed: "Не вдалося видалити оголошення.",
    deleteNetworkError: "Помилка мережі під час видалення.",
  },
  edit: {
    pageTitle: "Редагувати оголошення",
    pageDescription: "Оновіть дані, фото та ціну в каталозі Cars.",
    backToDetails: "Назад до деталей",
  },
  seller: {
    eyebrow: "EstateOS™Car",
    title: "Оголошення авто",
  },
  favorites: {
    add: "Додати до обраного",
    remove: "Прибрати з обраного",
  },
};

const records: Record<Locale, CarsDictionary> = { pl, en, uk };

export function getCarsDictionary(locale: Locale): CarsDictionary {
  return records[locale] ?? records.pl;
}

export function getCarSortOptions(locale: Locale) {
  const c = getCarsDictionary(locale);
  return [
    { key: "newest" as const, label: c.sort.newest },
    { key: "price-asc" as const, label: c.sort.priceAsc },
    { key: "price-desc" as const, label: c.sort.priceDesc },
    { key: "year-desc" as const, label: c.sort.yearDesc },
    { key: "mileage-asc" as const, label: c.sort.mileageAsc },
  ];
}

export function formatCarPriceLocalized(price: number, locale: Locale): string {
  if (!Number.isFinite(price) || price <= 0) {
    return getCarsDictionary(locale).common.priceOnRequest;
  }
  return `${new Intl.NumberFormat(numberFormatLocale(locale)).format(price)} PLN`;
}

export function formatCarMileageLocalized(km: number, locale: Locale): string {
  if (!Number.isFinite(km) || km < 0) return "—";
  return `${new Intl.NumberFormat(numberFormatLocale(locale)).format(km)} km`;
}

export function fmtCars(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}
