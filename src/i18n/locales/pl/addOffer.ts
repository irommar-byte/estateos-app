export const addOffer = {
  stepBlockDefault: 'Uzupełnij wymagane pola w bieżącym kroku.',
  stepBlockPrefix: 'Uzupełnij: {{fields}}.',

  meter: {
    ofMax: '{{current}} / {{max}} {{unit}}',
    ofMin: '{{current}} / {{min}} min. {{unit}}',
    count: '{{current}} {{unit}}',
  },

  validation: {
    step1: {
      transaction: { label: 'Cel ogłoszenia', action: 'Wybierz Sprzedaż lub Wynajem.' },
      propertyType: { label: 'Typ nieruchomości', action: 'Wybierz mieszkanie, dom, działkę lub lokal.' },
      condition: { label: 'Stan wykończenia', action: 'Wybierz stan: gotowe, do remontu lub deweloperski.' },
    },
    step2: {
      map: { label: 'Pinezka na mapie', action: 'Przesuń mapę lub wyszukaj adres — pinezka musi wskazać lokalizację.' },
      locality: {
        label: 'Miejscowość',
        actionPl: 'Poczekaj na geokodowanie lub wybierz miasto i dzielnicę.',
        actionIntl: 'Ustaw pinezkę — nazwa miejscowości uzupełni się z mapy.',
      },
      street: { label: 'Ulica z numerem budynku', action: 'Wpisz ulicę z numerem (min. {{min}} znaki, np. Wolska 56).' },
      streetApprox: {
        label: 'Nazwa ulicy (lokalizacja przybliżona)',
        action: 'Wpisz nazwę ulicy bez numeru (min. {{min}} znaki).',
      },
      streetIntl: { label: 'Adres lub pinezka', action: 'Wpisz ulicę albo zostaw samą pinezkę z ustaloną miejscowością.' },
    },
    step3: {
      plotArea: { label: 'Powierzchnia działki', action: 'Podaj metraż działki w m² (wartość większa od 0).' },
      housePlotArea: {
        label: 'Metraż działki (dom)',
        action: 'Wybierz metraż działki w m² (wartość większa od 0).',
      },
      area: { label: 'Metraż', action: 'Wpisz powierzchnię użytkową w m².' },
      rooms: { label: 'Liczba pokoi', action: 'Wybierz liczbę pokoi.', actionNeedArea: 'Najpierw uzupełnij metraż.' },
      floor: {
        label: 'Piętro',
        actionNeedArea: 'Najpierw uzupełnij metraż.',
        actionNeedRooms: 'Najpierw wybierz liczbę pokoi.',
        action: 'Wybierz piętro (np. Parter lub 3).',
      },
      year: { label: 'Rok budowy', action: 'Wybierz rok budowy z listy.' },
    },
    step4: {
      priceSell: { label: 'Cena całkowita', action: 'Wpisz cenę sprzedaży (większą od 0).' },
      priceRent: { label: 'Czynsz najmu', action: 'Wpisz miesięczny czynsz (większy od 0).' },
    },
    step5: {
      photos: { label: 'Zdjęcia oferty', action: 'Dodaj minimum {{min}} zdjęcie — użyj „Otwórz galerię”.' },
      title: {
        label: 'Tytuł oferty',
        actionShort: 'Wpisz jeszcze {{count}} {{unit}}.',
        actionLong: 'Skróć tytuł do {{max}} znaków.',
      },
      description: {
        label: 'Opis (zalecany)',
        action: 'Dodaj opis — minimum {{min}} znaków (możesz użyć „Stwórz profesjonalny opis”).',
      },
    },
  },

  fieldHint: {
    shortenBy: 'Skróć o {{count}} {{unit}}',
    missingChars: 'Brakuje {{count}} {{unit}} (min. {{min}})',
  },

  stepper: {
    title: 'KROK {{current}} Z {{total}}',
    canProceed: 'Możesz iść dalej',
    completeStep: 'Uzupełnij ten krok',
    alerts: {
      stepByStep: {
        title: 'Przejdź krok po kroku',
        message: 'Możesz przejść tylko do kolejnego kroku.',
      },
      completeData: {
        title: 'Uzupełnij dane',
      },
    },
  },

  common: {
    yes: 'Tak',
    no: 'Nie',
    none: 'Brak',
    groundFloor: 'Parter',
    notSpecified: 'Nie podano',
    pickerEmpty: '‒',
    cancel: 'Anuluj',
    close: 'Zamknij',
    settings: 'Ustawienia',
    super: 'Super',
    alerts: {
      authError: {
        title: 'Błąd autoryzacji',
        message: 'Zaloguj się ponownie, aby opublikować ofertę.',
      },
      completeOffer: {
        title: 'Uzupełnij ofertę',
        fixData: 'Popraw dane',
      },
      validation: {
        title: 'Walidacja',
        landRegistryFormat: 'Numer księgi wieczystej ma niepoprawny format. Użyj wzoru: WA4N/00012345/6',
      },
      store: {
        title: 'Sklep',
      },
      error: {
        title: 'Błąd',
      },
      verificationRequired: {
        title: 'Weryfikacja wymagana',
        message:
          'Aby opublikować ofertę musisz najpierw potwierdzić: {{missing}}.\n\nPrzejdź do Profilu → Edytuj dane i dokończ weryfikację SMS-em oraz kodem z e-maila.',
        missingPhone: 'numer telefonu',
        missingEmail: 'adres e-mail',
        goToProfile: 'Przejdź do profilu',
      },
    },
  },

  step1: {
    headerPrefix: 'Dodaj ',
    headerSuffix: 'ofertę',
    sections: {
      transaction: 'Od czego zaczynamy?',
      propertyType: 'Co oferujesz?',
      condition: 'W jakim jest stanie?',
    },
    tapTip: {
      title: 'Dotknij kafelka, aby wybrać',
      subtitle: 'Zaznacz „Sprzedaż” lub „Wynajem” — kolejne pola pojawią się automatycznie.',
    },
    optionTapHint: 'Dotknij, aby wybrać',
    transaction: {
      sell: 'Sprzedaż',
      rent: 'Wynajem',
    },
    propertyType: {
      flat: 'Mieszkanie',
      house: 'Dom',
      plot: 'Działka',
      premises: 'Lokal',
    },
    condition: {
      ready: 'Gotowe',
      renovation: 'Do remontu',
      developer: 'Deweloperski',
    },
    footerHint:
      'Transakcja, typ nieruchomości i stan techniczny wpływają na prezentację oferty oraz dopasowanie w radarach i filtrach. Wybierz wartości zgodne ze stanem faktycznym — zminimalizujesz ryzyko nieporozumień już przy pierwszym kontakcie zainteresowanych.',
  },

  step2: {
    header: 'Lokalizacja',
    sections: {
      searchAddress: 'Wyszukaj adres',
      locality: 'MIEJSCEWOŚĆ',
      country: 'PAŃSTWO',
      city: 'MIASTO',
      district: 'DZIELNICA',
    },
    placeholders: {
      street: 'np. Wolska 56',
    },
    streetBuildingHint: 'Dodaj numer budynku (np. Wolska 56)',
    localityHint:
      'Ustalana z mapy i adresu (geokodowanie). Przesuń pinezkę lub wpisz adres z numerem, aby zmienić nazwę.',
    countryHint:
      'Wykrywane z mapy (np. Polska, Ukraina). Przesuń pinezkę na właściwy kraj, jeśli nazwa jest niepoprawna.',
    exactLocation: {
      label: 'Dokładna lokalizacja',
      on: 'WŁ.: kupujący widzi nazwę ulicy + numer (np. „Reymonta 12") oraz precyzyjny pin na mapie.',
      off: 'WYŁ.: kupujący widzi tylko nazwę ulicy (np. „Reymonta", bez numeru) i przybliżony obszar ~200 m.',
    },
    mapTip: {
      title: 'Przesuń mapę, by ustawić pinezkę',
      subtitle: 'Szczypcami przybliżysz. Pinezka musi wskazywać dokładny punkt nieruchomości.',
    },
    myLocation: {
      a11y: 'Moja lokalizacja',
    },
    footerHint: {
      poland:
        'Najważniejsza jest zgodność pinezki na mapie z faktycznym miejscem nieruchomości. W Polsce możesz doprecyzować miasto i dzielnicę z listy — adres powinien odpowiadać pinezce. Poza głównymi aglomeracjami nazwa miejscowości pochodzi z geokodowania.',
      international:
        'Lokalizacja poza Polską: miasto i miejscowość wynikają wyłącznie z mapy i adresu (geokodowanie). Lista polskich miast nie dotyczy tej oferty — ustaw pinezkę i podaj dokładny adres z numerem.',
    },
    confirm: {
      title: 'Potwierdź lokalizację',
      subtitle: 'Upewnij się, że pinezka wskazuje właściwe miejsce oferty.',
      labels: {
        cityDistrict: 'Miasto i dzielnica',
        country: 'Państwo',
        address: 'Adres',
      },
      buttons: {
        edit: 'Popraw',
        confirm: 'Zatwierdź',
      },
      fallbacks: {
        localityUnknown: 'Miejscowość nieustalona',
        noExactAddress: 'Brak dokładnego adresu',
      },
    },
    alerts: {
      missingNumber: {
        title: 'Brak numeru',
        message: "Proszę podać dokładny adres z numerem, np. 'Wolska 56'.",
      },
      addressNotFound: {
        title: 'Nie znaleziono',
        message: 'System nie mógł odnaleźć tego adresu na mapie.',
      },
      districtNotFound: {
        title: 'Nie znaleziono dzielnicy',
        message: 'Nie udało się zlokalizować: {{district}}, {{city}}.',
      },
      locationDenied: {
        title: 'Brak dostępu do lokalizacji',
        message: 'Włącz lokalizację w ustawieniach telefonu, aby wrócić do swojej pozycji na mapie.',
      },
      locationFailed: {
        title: 'Nie udało się ustalić lokalizacji',
        message: 'Spróbuj ponownie za chwilę lub ustaw pinezkę ręcznie na mapie.',
      },
    },
  },

  step3: {
    header: 'Parametry',
    sections: {
      area: 'Metraż',
      plotArea: 'Powierzchnia działki',
      housePlotArea: 'Metraż działki',
      details: 'Szczegóły',
      amenities: 'Udogodnienia (Opcjonalne)',
      heating: 'Ogrzewanie',
      landRegistry: 'Weryfikacja dokumentów (opcjonalnie)',
    },
    hints: {
      plotArea: 'Podaj metraż całej działki w metrach kwadratowych.',
      housePlotArea: 'Podaj metraż działki przy domu jednorodzinnym (w m²).',
    },
    placeholders: {
      area: '0',
      plotArea: 'np. 1200',
      housePlotArea: 'np. 850',
      apartmentNumber: 'Numer mieszkania',
      landRegistryNumber: 'Numer księgi wieczystej (np. WA4N/00012345/6)',
    },
    pickers: {
      rooms: 'POKOJE',
      floor: 'PIĘTRO',
      year: 'ROK',
    },
    wheelHint: 'Przesuń palcem',
    heating: {
      none: 'Nie podano',
      district: 'Miejskie',
      gas: 'Gazowe',
      electric: 'Elektryczne',
      heatPump: 'Pompa Ciepła',
      coalPellet: 'Węglowe / Pellet',
      other: 'Inne',
    },
    furnished: 'Umeblowane',
    amenities: {
      balcony: 'Balkon / Taras',
      parking: 'Garaż / Parking',
      storage: 'Piwnica / Komórka',
      elevator: 'Winda',
      garden: 'Ogródek',
      twoLevel: 'Dwupoziomowe',
    },
    landRegistry: {
      courtPrefix: 'Właściwy sąd:',
      validFormat: 'Format KW poprawny. Dane trafiają wyłącznie do procesu weryfikacji.',
      invalidFormat: 'Nieprawidłowy format KW. Użyj wzoru: WA4N/00012345/6',
      privacy:
        'Dane dokumentowe są prywatne i służą wyłącznie do weryfikacji stanu prawnego nieruchomości (np. potwierdzenie: nieruchomość sprawdzona, bez zadłużeń), co zwiększa wiarygodność oferty i szansę na zainteresowanie klientów. Te dane nie są publikowane i nigdy nie zostaną ujawnione bez Twojej wyraźnej zgody.',
    },
    footerHint: {
      withLandRegistry:
        'Metraż i dane techniczne wpływają na porównywalność z innymi ogłoszeniami oraz na szacunki finansowe w następnym kroku. Uzupełniaj pola po kolei — kolejne sekcje odblokują się, gdy poprzednie są spójne. Dla działki wystarczy powierzchnia (bez udogodnień typowych dla lokalu).',
      withoutLandRegistry:
        'Metraż i dane techniczne wpływają na porównywalność z innymi ogłoszeniami. Dla nieruchomości poza Polską nie stosujemy weryfikacji księgi wieczystej (KW) — dotyczy wyłącznie polskiego rejestru.',
    },
  },

  step4: {
    header: 'Finanse',
    sections: {
      priceRent: 'Czynsz najmu — waluta oferty',
      priceSell: 'Cena całkowita — waluta oferty',
      deposit: 'Kaucja',
      adminFee: 'Czynsz Admin.',
      rentAdditionalFees: 'Opłaty dodatkowe (czynsz)',
    },
    rentPriceHint:
      'To miesięczny czynsz najmu za sam lokal — bez opłat administracyjnych. Opłaty dodatkowe (wspólnota, media itd.) wybierzesz poniżej.',
    rentAdditionalFeesNone: 'Brak',
    rentAdditionalFeesHint:
      'Czynsz do wspólnoty / administracji — osobno od kwoty najmu. Wybierz z listy lub zostaw „Brak”, jeśli najemca dowie się na spotkaniu.',
    placeholders: {
      amount: '0',
    },
    analytics: {
      pricePerSqm: 'Cena za m²',
      marketStatus: {
        bargain: 'OKAZJA',
        market: 'W RYNKU',
        overpriced: 'ZAWYŻONA',
      },
      diffFromAverage: '{{sign}}{{percent}}% od średniej',
      emptyHint: 'Wpisz metraż w Kroku 3 oraz cenę, aby zobaczyć i regulować analizę rynkową.',
      estimatedRoi: 'Szacowane ROI',
    },
    commission: {
      badge: 'EstateOS™ Agent',
      titleDefault: 'Twoja prowizja',
      titleZero: 'Oferta bez prowizji',
      subtitleZero:
        'Kupujący nie płaci prowizji od tej oferty. Adnotacja „Bez prowizji” pojawi się na ogłoszeniu — przyciąga uwagę i buduje zaufanie.',
      subtitleDefaultPrefix:
        'Cena ofertowa to ostateczna kwota brutto. Kupujący po transakcji z tej kwoty wypłaci Tobie',
      subtitleDefaultSuffix:
        'jako prowizję — bezpośrednio poza platformą.',
      subtitleVatNote:
        'Prowizja jest brutto (z VAT). Kupujący nie dopłaca nic ponad cenę ofertową i uzgodnioną kwotę prowizji.',
      dualInputHint: 'Wpisz prowizję procentowo albo kwotowo — oba pola synchronizują się ze sobą.',
      addDefault: 'Prowizja {{percent}}',
      addZero: 'Bez prowizji',
      label: 'Procent prowizji',
      stepHint: 'krok {{step}}',
      amountLabelBuyer: 'dla kupującego',
      amountLabelFromPrice: 'Kwota z ceny ({{currency}})',
      amountZero: 'BEZ PROWIZJI',
      amountEmpty: '—',
      amountHintZero: 'Kupujący nie płaci prowizji.',
      amountHintDefault: 'Kwota liczona od ceny brutto widocznej w ogłoszeniu.',
      amountSyncPercent: 'Odpowiada {{percent}} ceny ofertowej.',
      warnMinOnly: 'Prowizja: 0% (bez prowizji) albo co najmniej {{min}} ceny ofertowej brutto.',
    },
    footerHint:
      'Kwoty mają być jednoznaczne dla strony kupującej lub najemnej (w tym przy sprzedaży: czynsz administracyjny, jeśli dotyczy). Wskaźnik ceny za m² i porównanie do uproszczonej średniej służą orientacji — nie stanowią wyceny eksperckiej ani pełnej analizy rynku.',
  },

  step5: {
    header: 'Media i Opis',
    capacity: {
      photos: 'Wgrane Zdjęcia',
      diskSpace: 'Przestrzeń Dysku',
      suffixPhotos: 'Szt.',
      suffixMb: 'MB',
      estimatedSizeHint: '{{count}} {{filesLabel}} rozmiar szacunkowy do czasu pełnego pomiaru.',
      estimatedSizeFileOne: 'plik ma',
      estimatedSizeFileMany: 'pliki mają',
    },
    sections: {
      addPhotos: 'Dodaj zdjęcia',
      photoGrid: 'Siatka Zdjęć',
      title: 'Tytuł oferty',
      floorPlan: 'Plan Nieruchomości',
      description: 'Opis oferty',
    },
    coverBadge: 'OKŁADKA',
    gallery: {
      lead: 'Pierwsze zdjęcie to okładka ogłoszenia. Przeciągnij za kropki, aby zmienić kolejność.',
      addLabel: 'Dodaj',
      open: 'Otwórz galerię',
      addMore: 'Dodaj kolejne zdjęcia',
      sizing: 'Liczenie miejsca (konwersja podglądowa)...',
    },
    proSession: {
      cta: 'Zamów profesjonalną sesję zdjęciową',
      eyebrow: 'EstateOS Studio',
      title: 'Profesjonalna sesja zdjęciowa',
      subtitle:
        'Fotograf, opis i całe ogłoszenie od początku do końca — Ty tylko otwierasz drzwi. Zobacz przykładowe realizacje poniżej.',
      examplesTitle: 'Zobacz przykładowe oferty',
      examples: {
        studioBadge: 'Sesja EstateOS',
        viewOffer: 'Zobacz ofertę',
        ownerName: 'EstateOS Studio',
        previewBanner: 'Przykładowa realizacja sesji',
        previewBannerSub: 'To demo pokazuje, jak wygląda kompletne ogłoszenie po profesjonalnej sesji zdjęciowej EstateOS.',
        previewFooter: 'To przykład — kontakt i negocjacje są wyłączone. Zamów taką sesję w kreatorze oferty.',
        previewOfferId: 'Przykład EstateOS Studio · oferta demonstracyjna',
        warsaw: {
          country: 'Polska',
          title: 'Luksusowy penthouse z widokiem na Wisłę',
          location: 'Mokotów, Warszawa',
          price: '2 450 000 zł',
          area: '98 m²',
          rooms: '3 pokoje',
          transaction: 'Sprzedaż',
          teaser: 'Jasne wnętrza, taras panoramiczny i profesjonalna oprawa zdjęć pod ogłoszenia premium.',
          description:
            'Wyjątkowy penthouse na Mokotowie z panoramicznym widokiem na Wisłę i centrum Warszawy. Salon z podwójną wysokością, trzy sypialnie, garderoba oraz taras idealny na zdjęcia o złotej godzinie. W ofercie: 14 zdjęć HDR, plan 2D z LiDAR, spacer 3D i opis AI Premium — gotowe pod publikację w kilka minut.',
          badge1: '14 zdjęć HDR',
          badge2: 'Plan 2D + LiDAR',
          badge3: 'Opis AI Premium',
        },
        berlin: {
          country: 'Niemcy',
          title: 'Altbau-loft z tarasem w Prenzlauer Berg',
          location: 'Prenzlauer Berg, Berlin',
          price: '890 000 €',
          area: '112 m²',
          rooms: '4 pokoje',
          transaction: 'Sprzedaż',
          teaser: 'Wysokie sufity, industrialny charakter i kompletna sesja pod międzynarodową publikację.',
          description:
            'Charakterystyczny berliński Altbau z oryginalnymi detalami, wysokimi sufitami i tarasem na dachu. Cztery pokoje, otwarta kuchnia i naturalne światło przez cały dzień. Sesja obejmuje 18 ujęć, plan 3D, wideo spacer oraz opisy w języku niemieckim i angielskim — idealne pod rynek międzynarodowy.',
          badge1: '18 zdjęć złota godzina',
          badge2: 'Plan 3D + spacer',
          badge3: 'Opis DE/EN',
        },
        kyiv: {
          country: 'Ukraina',
          title: 'Premium apartament z panoramą Dniepru',
          location: 'Peczersk, Kijów',
          price: '185 000 $',
          area: '86 m²',
          rooms: '2 pokoje',
          transaction: 'Sprzedaż',
          teaser: 'Nowoczesne wykończenie, widok na rzekę i pełna produkcja ogłoszenia od A do Z.',
          description:
            'Nowoczesny apartament w Peczersku z panoramicznym widokiem na Dniepr i historyczne centrum Kijowa. Dwa pokoje, designerska łazienka i przestronny balkon. Pakiet sesji: 12 zdjęć HDR, plan 2D, opisy w PL/UK/EN oraz gotowy układ pod portale nieruchomości.',
          badge1: '12 zdjęć HDR',
          badge2: 'Plan 2D',
          badge3: 'Opis PL/UK/EN',
        },
      },
      priceLabel: 'Koszt usługi',
      priceHint: 'Fotograf na terenie Warszawy — 199 zł (płatność na miejscu po sesji).',
      proBenefit: 'Klienci z pakietem Pro mogą zamówić za darmo jedną sesję na konto.',
      proFreeActive: 'Masz pakiet Pro — jedna sesja na Twoje konto jest gratis.',
      becomePro: 'Zostań Pro',
      steps: {
        pickDay: 'Wybierz dzień',
        pickHour: 'Wybierz godzinę',
        confirm: 'Potwierdź termin',
        progress: 'Krok {{step}} z 3',
      },
      selectedLabel: 'Wybrany termin',
      selectedAt: '{{date}} o {{hour}}',
      noteLabel: 'Uwagi dla fotografa (opcjonalnie)',
      notePlaceholder: 'np. kod domofonu, parking od tyłu budynku…',
      submit: 'Zaproponuj termin',
      next: 'Dalej',
      successTitle: 'Propozycja wysłana!',
      successBody:
        'Administrator otrzymał Twoją propozycję terminu {{label}}. Po akceptacji dostaniesz powiadomienie z potwierdzeniem.',
      confirmedTitle: 'Sesja zdjęciowa potwierdzona',
      confirmedBody: 'Termin {{label}} jest umówiony. Poniżej odliczanie do wizyty fotografa.',
      countdownLabel: 'DO SESJI ZDJĘCIOWEJ POZOSTAŁO',
      manageInProfile: 'Negocjację terminu prowadzisz w Profil → Twoje nieruchomości → Sesje zdjęciowe.',
      openPhotoSessions: 'Otwórz sesje zdjęciowe',
      activePendingTitle: 'Masz aktywną rezerwację sesji',
      activePendingHint: 'Administrator rozpatruje Twój termin. Śledź status i odpowiadaj w Profilu.',
      activeCounterTitle: 'Administrator zaproponował inny termin',
      activeCounterHint: 'Zaakceptuj, odrzuć lub zaproponuj kontrofertę w Profilu.',
      errors: {
        submitFailed: 'Nie udało się wysłać propozycji. Spróbuj ponownie.',
        loginRequired: 'Zaloguj się, aby zaproponować termin sesji zdjęciowej.',
        pickDateTime: 'Wybierz dzień i godzinę sesji.',
        network: 'Błąd połączenia. Sprawdź internet i spróbuj ponownie.',
        serviceUnavailable:
          'Usługa rezerwacji sesji nie jest jeszcze dostępna na serwerze. Spróbuj ponownie za chwilę lub skontaktuj się z supportem.',
      },
      loginBanner: 'Zaloguj się, aby wysłać propozycję terminu do EstateOS Studio.',
    },
    titlePlaceholder: 'np. Luksusowy apartament z widokiem na skyline',
    floorPlan: {
      upload: 'Wgraj rzut poziomy',
      sectionLead: 'Osobny dział planu — zeskanuj pomieszczenia LiDAR albo wgraj gotowy rzut.',
      scan: 'Zeskanuj mieszkanie (LiDAR)',
      scanBadge: 'iPhone Pro',
      scanHint: 'Natywny skan Apple RoomPlan — plan 2D i spacer 3D w ofercie.',
      scanned: 'Plan ze skanu LiDAR',
      open3d: 'Spacer 3D',
    },
    roomScan: {
      brand: 'EstateOS Room Scan',
      hint: 'Idź wzdłuż ścian — dodaj kolejne pokoje, potem zakończ skan.',
      cancel: 'Anuluj',
      addRoom: 'Kolejny pokój',
      finish: 'Zakończ skan',
      previewTitle: 'Twój plan mieszkania',
      previewSubtitle: 'Sprawdź układ pokoi. Po zatwierdzeniu plan 2D i model 3D trafią do oferty.',
      rooms: 'Pokoje',
      area: 'Metraż',
      ceiling: 'Wysokość',
      ceilingShort: 'H {{height}} m',
      compassHint: 'N — góra planu',
      detectedObjects: 'Wykryte meble i AGD',
      ready: 'Gotowy',
      rescan: 'Skanuj ponownie',
      usePlan: 'Użyj tego planu',
      exportPdf: 'Eksportuj PDF',
      open3d: 'Spacer 3D',
      processing: 'Przygotowuję plan i spacer 3D…',
      errors: {
        exportMissing: 'Skan nie zwrócił plików. Spróbuj ponownie.',
        noWalls: 'Nie wykryto ścian — oświetl pomieszczenie i powtórz skan.',
        scanFailed: 'Skan nie powiódł się. Sprawdź oświetlenie i spróbuj ponownie.',
        previewFailed: 'Nie udało się wygenerować podglądu planu.',
        pdfFailed: 'Nie udało się wyeksportować PDF.',
        walkthroughUnavailable: 'Nie udało się otworzyć spaceru 3D. Zbuduj aplikację ponownie i spróbuj jeszcze raz.',
      },
      roomTypes: {
        livingRoom: 'Salon',
        bedroom: 'Sypialnia',
        bathroom: 'Łazienka',
        kitchen: 'Kuchnia',
        diningRoom: 'Jadalnia',
        office: 'Gabinet',
        hallway: 'Przedpokój',
        closet: 'Garderoba',
        laundry: 'Pralnia',
        garage: 'Garaż',
        balcony: 'Balkon',
        unspecified: 'Pomieszczenie',
      },
      objects: {
        storage: 'Szafa / regał',
        refrigerator: 'Lodówka',
        stove: 'Kuchenka',
        bed: 'Łóżko',
        sink: 'Zlew',
        washerDryer: 'Pralka',
        toilet: 'Toaleta',
        bathtub: 'Wanna',
        oven: 'Piekarnik',
        dishwasher: 'Zmywarka',
        table: 'Stół',
        sofa: 'Sofa',
        chair: 'Krzesło',
        fireplace: 'Kominek',
        television: 'Telewizor',
        stairs: 'Schody',
        unknown: 'Obiekt',
      },
      roomCountOne: '{{count}} pokój',
      roomCountFew: '{{count}} pokoje',
      roomCountMany: '{{count}} pokoi',
      export: {
        brand: 'ESTATEOS ROOM SCAN',
        defaultTitle: 'Plan mieszkania',
        footer: 'estateos.pl · skan LiDAR',
        pdfDialogTitle: 'Plan mieszkania PDF',
      },
    },
    ai: {
      generate: 'Szablon AI',
      generateGpt: 'Opis GPT Mini',
      createProfessional: 'Stwórz profesjonalny opis',
      manualLabel: 'Napisz opis ręcznie',
      manualHint: 'Możesz od razu wpisać własny tekst — AI nie jest wymagane.',
      detailsNotesLabel: 'Opcjonalnie: notatki do AI',
      detailsNotesPlaceholder:
        'Np. garaż w cenie, świeży remont łazienki, blisko szkoły, cicha okolica…',
      generating: 'Analizuję...',
      generatingGpt: 'Tworzę profesjonalny opis…',
      gptRequiresLogin: 'Zaloguj się, aby wygenerować opis AI.',
      gptErrorTitle: 'Generowanie opisu',
      gptInsufficientData:
        'Uzupełnij typ nieruchomości, lokalizację (pinezkę) i parametry w poprzednich krokach — albo dopisz notatki powyżej.',
      descriptionPlaceholder:
        'Wpisz opis oferty własnymi słowami…',
      intros: [
        'Przekrocz próg przestrzeni, która redefiniuje pojęcie luksusu i komfortu.',
        'Rzadka okazja na rynku. Nieruchomość, która natychmiast przykuwa uwagę.',
        'Oto miejsce stworzone z myślą o osobach ceniących miejski styl życia.',
        'Harmonia, spokój i doskonały design. Ta propozycja zadowoli najbardziej wymagających.',
      ],
      poi: [
        'W promieniu 500 metrów znajdziesz renomowane szkoły i nowoczesny kompleks.',
        'Zaledwie 3 minuty spacerem do głównych węzłów komunikacyjnych.',
        'Otoczenie to kwintesencja wielkomiejskiego życia: kawiarnie i restauracje.',
        'Dla aktywnych: ścieżki rowerowe, kluby fitness i bliskość rzeki.',
      ],
      marketOccasion: [
        'To propozycja o charakterze okazji rynkowej — relacja ceny do metrażu wypada bardzo konkurencyjnie.',
        'Analiza porównawcza wskazuje na atrakcyjną wycenę względem podobnych ofert w najbliższej okolicy.',
        'W tym segmencie lokalnym to jedna z ciekawszych ofert cenowych dostępnych obecnie na rynku.',
      ],
      marketFair: [
        'Cena pozostaje na poziomie rynkowym, spójnym z aktualnymi transakcjami dla podobnych nieruchomości.',
        'Wycena jest wyważona i dobrze wpisuje się w lokalne widełki cenowe.',
        'To stabilna, rynkowa propozycja — bez sztucznego zawyżenia, z zachowaniem jakości oferty.',
      ],
      marketPremium: [
        'Oferta pozycjonowana jest jako ekskluzywna — wyższa cena odzwierciedla standard, lokalizację i potencjał.',
        'To segment premium: wycena ponad średnią rynkową wynika z jakości i profilu nieruchomości.',
        'Nieruchomość celuje w klienta premium, który szuka jakości ponad przeciętność rynkową.',
      ],
      marketHeader: {
        bargain: 'OKAZJA',
        premium: 'EKSKLUZYWNA',
        fair: 'CENA RYNKOWA',
      },
      poiCandidates: [
        '🚇 Komunikacja miejska w wygodnym zasięgu (autobus/tramwaj) — codzienne dojazdy są szybkie i przewidywalne.',
        '🛍 W pobliżu dostępne są punkty usługowe: sklepy, piekarnie, apteki i strefa gastronomiczna.',
        '🌿 W otoczeniu znajdziesz tereny rekreacyjne idealne na spacer, bieganie lub rower po pracy.',
        '☕ Lokalizacja wspiera wygodny styl życia — kawiarnie, restauracje i codzienna infrastruktura są pod ręką.',
        '🚗 Dogodny wyjazd na główne trasy ułatwia poruszanie się po mieście i poza nim.',
        '🏫 Rodzinna infrastruktura (szkoły/przedszkola) jest osiągalna w krótkim czasie.',
      ],
      poiWarsaw: [
        'Ⓜ️ W zależności od dzielnicy stacje metra pozostają w praktycznym zasięgu komunikacji miejskiej.',
        '🍔 W okolicy nie brakuje rozpoznawalnych marek gastronomicznych oraz punktów typu drive.',
      ],
      poiPin: '📍 Adres został wskazany pinezką na mapie, co zwiększa precyzję dopasowania względem lokalnych potrzeb klienta.',
      propertyType: {
        house: 'dom',
        plot: 'działkę',
        flat: 'apartament',
      },
      condition: {
        ready: 'gotowy do wprowadzenia',
        renovation: 'z potencjałem do remontu',
        developer: 'w stanie deweloperskim',
      },
      transaction: {
        rent: 'wynajem',
        sell: 'sprzedaż',
      },
      locationFallback: 'wybranej miejscowości',
      amenities: {
        balcony: 'Balkon / taras',
        parking: 'Garaż / parking',
        storage: 'Piwnica / komórka lokatorska',
        elevator: 'Winda',
        garden: 'Ogródek',
        furnished: 'Umeblowane wnętrze',
        none: 'Brak dodatkowych udogodnień zaznaczonych na tym etapie.',
      },
      sections: {
        neighborhood: '✧ ANALIZA OKOLICY ✧',
        market: '✧ ANALIZA RYNKU ✧',
        amenities: '✧ UDOGODNIENIA ✧',
        parameters: '✧ KLUCZOWE PARAMETRY ✧',
      },
      bullets: {
        transaction: '🔁 Typ transakcji:',
        propertyType: '🏷 Typ nieruchomości:',
        area: '📐 Powierzchnia:',
        plotArea: '🌿 Powierzchnia działki:',
        rooms: '🛏 Pokoje:',
        floor: '🏢 Piętro:',
        totalFloors: '🏙 Liczba pięter w budynku:',
        yearBuilt: '🗓 Rok budowy:',
        price: '💰 Cena:',
        pricePerSqm: '📊 Cena za m²:',
        adminFee: '💶 Czynsz adm.:',
        deposit: '🔐 Kaucja:',
        condition: '🧱 Stan:',
        heating: '🔥 Ogrzewanie:',
        location: '📍 Lokalizacja:',
        address: '🧭 Adres:',
        apartmentNumber: '🔢 Numer lokalu:',
        locationMode: '🛰 Tryb lokalizacji:',
      },
      locationMode: {
        exact: 'Dokładna (pin precyzyjny)',
        approximate: 'Przybliżona (obszar prywatności)',
      },
      conditionLabels: {
        ready: 'Gotowe do wprowadzenia',
        renovation: 'Do remontu',
        developer: 'Stan deweloperski',
      },
      propertyTypeLabels: {
        house: 'Dom',
        plot: 'Działka',
        premises: 'Lokal',
        flat: 'Mieszkanie',
      },
      transactionLabels: {
        sell: 'Sprzedaż',
        rent: 'Wynajem',
      },
      marketSpread: '📌 Cena ofertowa / średnia lokalna: {{offerPrice}} vs {{avgPrice}} PLN/m² ({{sign}}{{percent}}%)',
      bodyTemplate:
        '{{intro}}\n\nPrezentujemy wyjątkowy {{propertyType}} na {{transaction}}, zlokalizowany w sercu: {{location}}. Nieruchomość jest {{condition}}, co czyni ją niezwykle atrakcyjną ofertą.\n\n{{neighborhoodSection}}\n{{randomPoi}}\n{{enrichedPoi}}\n\n{{marketSection}}\n{{marketHeader}}\n{{marketNarrative}}{{marketSpread}}\n\n{{amenitiesSection}}\n{{amenitiesText}}\n\n{{parametersSection}}{{bullets}}\n\nZapraszamy do kontaktu w celu umówienia prywatnej prezentacji.',
    },
    footerHint:
      'Pierwsze zdjęcie jest okładką na listach — kolejność zmienisz, przeciągając miniatury. Staraj się o dobre światło i czytelne kadry; plan rzutu zwiększa zaufanie do układu lokalu. Opis uzupełnia dane z formularza i powinien odzwierciedlać rzeczywisty stan nieruchomości (także gdy korzystasz z podpowiedzi AI).',
    alerts: {
      photoAccess: {
        title: 'Dostęp do zdjęć',
        message:
          'Aby dodać zdjęcia do oferty, zezwól EstateOS na dostęp do biblioteki zdjęć (Ustawienia → EstateOS → Zdjęcia).',
      },
      photoLimit: {
        title: 'Limit zdjęć',
        message: 'Osiągnięto maksymalny limit 20 zdjęć.',
      },
      storageLimit: {
        title: 'Limit miejsca',
      },
      storagePickerBudget:
        'Zestaw zdjęć jest zbyt duży na tym etapie (limit wysyłki {{uploadMb}} MB).\nDuże pliki HEIC są najpierw konwertowane na urządzeniu — usuń kilka zdjęć z listy lub dodawaj je pojedynczo.\n(Rezerwa {{reserveMb}} MB służy tylko konwersji, nie zwiększa limitu na serwerze.)',
      storageUploadCap:
        'Po konwersji (np. HEIC→JPEG) zestaw przekracza limit wysyłki {{uploadMb}} MB.\nUsuń część zdjęć z listy lub wybierz mniejsze pliki.',
      addPhotosFailed: {
        title: 'Nie udało się dodać zdjęć',
        message: 'Sprawdź dostęp do biblioteki zdjęć i spróbuj ponownie.',
      },
      floorPlanFailed: {
        title: 'Nie udało się wgrać planu',
        message: 'Sprawdź dostęp do zdjęć i spróbuj ponownie.',
      },
    },
  },

  step6: {
    noPhotos: 'Brak zdjęć w ofercie',
    rentLabel: 'Czynsz najmu (miesięcznie)',
    depositLabel: 'Kaucja {{amount}} PLN',
    rentAdditionalFeesLabel: '+ {{amount}} PLN opłaty dodatkowe (czynsz)',
    adminFeeLabel: 'Czynsz administracyjny ~ {{amount}} PLN',
    commissionSummary: {
      label: 'Prowizja:',
      zero: 'bez prowizji (0%)',
      amountUnderOne: '< 1 PLN',
    },
    transactionPill: {
      rent: 'WYNAJEM',
      sell: 'SPRZEDAŻ',
    },
    location: {
      label: 'Lokalizacja',
      publicAddress: 'Adres publiczny',
      hiddenApprox: 'Ukryty (obszar ~200 m)',
      hiddenWithArea: '{{street}} · numer ukryty (obszar ~200 m)',
    },
    mapPreview: {
      title: 'PODGLĄD MAPY',
      markerTitle: 'Lokalizacja oferty',
      exactCaption: 'Dokładny punkt — widok z perspektywy (budynki 3D)',
      approximateCaption:
        'Obszar ~{{radius}} m · środek przesunięty losowo (budynek leży gdzieś wewnątrz okręgu)',
    },
    commission: {
      badge: 'EstateOS™ Agent',
      titleDefault: 'Twoja prowizja',
      titleZero: 'Oferta bez prowizji',
      subtitleZeroPrefix: 'Kupujący',
      subtitleZeroHighlight: 'nie płaci prowizji',
      subtitleZeroSuffix:
        'na tej ofercie. Adnotacja „Bez prowizji” pojawi się przy ogłoszeniu — buduje zaufanie i przyciąga uwagę.',
      subtitleDefaultPrefix:
        'Cena ofertowa to ostateczna kwota brutto. Kupujący po transakcji z tej kwoty wypłaci agentowi',
      subtitleDefaultSuffix:
        'jako prowizję — bezpośrednio (maks. 10% ceny ofertowej).',
      subtitleVatNote:
        'Prowizja jest brutto (z VAT). Kupujący nie dopłaca nic ponad cenę ofertową i uzgodnioną kwotę prowizji.',
    },
    sections: {
      parameters: 'PARAMETRY NIERUCHOMOŚCI',
      media: 'MEDIA I MATERIAŁY',
      amenities: 'UDOGODNIENIA',
      description: 'OPIS AI / WŁASNY',
    },
    badges: {
      type: 'Typ',
      area: 'Powierzchnia',
      rooms: 'Pokoje',
      roomsValue: '{{count}} pok.',
      floor: 'Piętro',
      yearBuilt: 'Rok budowy',
      adminFee: 'Czynsz admin.',
      heating: 'Ogrzewanie',
      furnished: 'Umeblowanie',
      totalFloors: 'Kondygnacje w bud.',
      plot: 'Działka',
      condition: 'Stan',
    },
    propertyType: {
      flat: 'Mieszkanie',
      house: 'Dom',
      plot: 'Działka',
      premises: 'Lokal',
      fallback: 'Nieruchomość',
    },
    condition: {
      ready: 'Gotowe',
      renovation: 'Do remontu',
      developer: 'Deweloperski',
    },
    amenities: {
      balcony: 'Balkon / taras',
      parking: 'Parking',
      storage: 'Komórka / piwnica',
      elevator: 'Winda',
      garden: 'Ogródek',
      twoLevel: 'Dwupoziomowe',
      furnished: 'Umeblowane',
    },
    mediaSummary: 'Zdjęcia: {{photos}} · Plan rzutu: {{floorPlan}} · Wideo: {{video}}',
    mediaYes: 'tak',
    mediaNo: 'nie',
    validationHint: 'Brakuje danych w kroku {{steps}} — dotknij przycisku, aby przejść do uzupełnienia.',
    plusCreditHint: 'Masz Pakiet Plus na koncie — publikacja zużyje 1 kredyt (bez drugiej opłaty w sklepie).',
    couponPublishHint:
      'Masz {{count}} kuponów na publikację — po „Opublikuj” wybierz kupon (np. urodzinowy), żeby nie zużywać kredytu Plus.',
    publicationChoice: {
      title: 'Jak opublikować ofertę?',
      subtitle:
        'Możesz wykorzystać kupon bonusowy na publikację albo opłacić wystawienie kredytem Pakietu Plus.',
      couponPriorityHint:
        'Masz aktywne kupony — domyślnie zaznaczony jest pierwszy. Wybierz kupon, żeby nie zużyć kredytu Plus.',
      couponsSection: 'Kupony bonusowe',
      couponsEmpty: 'Brak aktywnych kuponów na publikację.',
      plusSection: 'Pakiet Plus',
      plusCreditTitle: 'Użyj kredytu Plus',
      plusCreditSubtitle: 'Na koncie: {{count}} publikacji do wykorzystania',
      buyPlusTitle: 'Kup Pakiet Plus',
      buyPlusSubtitle: 'Opłać jedno wystawienie w App Store (~{{price}})',
      publish: 'Opublikuj ofertę',
    },
    publish: {
      publishing: 'Publikowanie...',
      publish: 'Opublikuj w Ekosystemie',
      completeData: 'Uzupełnij dane oferty',
      editData: 'Wróć i popraw dane',
      creating: 'Tworzenie oferty w bazie...',
      convertingPhoto: 'Konwersja zdjęcia {{current}} (HEIC ➜ JPG)...',
      uploadingPhoto: 'Wysyłanie zdjęcia {{current}} z {{total}}...',
      convertingFloorPlan: 'Konwersja rzutu (HEIC ➜ JPG)...',
      uploadingFloorPlan: 'Wysyłanie rzutu nieruchomości...',
      uploadingFloorPlan3d: 'Wysyłanie spaceru 3D…',
    },
    defaultTitle: {
      flatRest: 'Mieszkanie — {{locality}}',
      propertyRest: 'Nieruchomość — {{locality}}',
      flatCity: 'Mieszkanie w {{city}}',
      propertyCity: 'Nieruchomość w {{city}}',
      defaultCity: 'Warszawie',
      defaultCountry: 'Polska',
      defaultDistrict: 'Śródmieście',
    },
    alerts: {
      agentCommission: {
        title: 'Prowizja agenta',
      },
      congratulations: {
        title: 'Gratulacje! 🎉',
        messageDefault:
          'Oferta została pomyślnie dodana. Po szybkiej weryfikacji będzie widoczna na radarze.',
        messageWithLegal:
          'Oferta została pomyślnie dodana, a numer KW wraz z lokalem został wysłany do weryfikacji administratora. Ogłoszenie po moderacji będzie widoczne na radarze.',
      },
      publishError: {
        plusPaidRetry:
          '\n\nOpłata za wystawienie została przyjęta, ale ogłoszenie nie trafiło na rynek — naciśnij „Opublikuj w Ekosystemie” ponownie (bez drugiej opłaty).',
        archived:
          '\n\nNieukończoną ofertę wycofaliśmy automatycznie — możesz bezpiecznie spróbować ponownie.',
        archiveFailed:
          '\n\nNie udało się automatycznie wycofać oferty z błędem publikacji (ID: {{id}}). Napisz do pomocy, żeby usunęli duplikat.',
        connectionFallback: 'Wystąpił problem z połączeniem.',
        serverError: 'Błąd serwera przy wystawianiu ogłoszenia na rynek',
        uploadRejected: 'Odrzucone przez serwer',
        uploadUnknown: 'Nieznany błąd uploadu',
        floorPlanUnknown: 'Nieznany błąd rzutu',
        photoError: 'Zdjęcie {{index}}: {{message}}',
        floorPlanError: 'Rzut: {{message}}',
      },
    },
  },
};
