export const addOffer = {
  stepBlockDefault: 'Заполните обязательные поля на этом шаге.',
  stepBlockPrefix: 'Заполните: {{fields}}.',

  meter: {
    ofMax: '{{current}} / {{max}} {{unit}}',
    ofMin: '{{current}} / {{min}} мин. {{unit}}',
    count: '{{current}} {{unit}}',
  },

  validation: {
    step1: {
      transaction: { label: 'Цель листинга', action: 'Выберите «Продажа» или «Аренда».' },
      propertyType: { label: 'Тип недвижимости', action: 'Выберите квартиру, дом, участок или коммерческое помещение.' },
      condition: { label: 'Состояние отделки', action: 'Выбирайте: готово к заселению, под ремонт или стандарт застройщика.' },
    },
    step2: {
      map: { label: 'Значок карты', action: 'Переместите карту или найдите адрес — булавка должна отмечать местоположение.' },
      locality: {
        label: 'Местность',
        actionPl: 'Дождитесь геокодирования или выберите город и район.',
        actionIntl: 'Установите булавку — название населенного пункта заполнится с карты.',
      },
      street: { label: 'Улица и номер дома', action: 'Введите номер улицы (минимум {{min}} символов, например Main St 12).' },
      streetApprox: {
        label: 'Название улицы (приблизительное местоположение)',
        action: 'Введите название улицы без номера (мин. {{min}} символов).',
      },
      streetIntl: { label: 'Адрес или пин-код', action: 'Введите улицу или оставьте только метку с подтвержденным местоположением.' },
    },
    step3: {
      plotArea: { label: 'Площадь участка', action: 'Введите размер участка в м² (больше 0).' },
      housePlotArea: {
        label: 'Размер участка (дом)',
        action: 'Выберите размер участка в м² (больше 0).',
      },
      area: { label: 'Площадь пола', action: 'Введите полезную площадь в м².' },
      rooms: { label: 'Количество комнат', action: 'Выберите количество комнат.', actionNeedArea: 'Сначала введите площадь пола.' },
      floor: {
        label: 'Пол',
        actionNeedArea: 'Сначала введите площадь пола.',
        actionNeedRooms: 'Сначала выберите количество комнат.',
        action: 'Выберите этаж (например, Первый или 3).',
      },
      year: { label: 'Год постройки', action: 'Выберите год постройки из списка.' },
    },
    step4: {
      priceSell: { label: 'Общая стоимость', action: 'Введите цену продажи (больше 0).' },
      priceRent: { label: 'Ежемесячная аренда', action: 'Введите ежемесячную арендную плату (больше 0).' },
    },
    step5: {
      photos: { label: 'Листинг фотографий', action: 'Добавьте минимум {{min}} фото — используйте «Открыть галерею».' },
      title: {
        label: 'Название листинга',
        actionShort: 'Введите еще {{count}} {{unit}}.',
        actionLong: 'Сократите заголовок до {{max}} символов.',
      },
      description: {
        label: 'Описание (рекомендуется)',
        action: 'Добавьте описание — не менее {{min}} символов (можно использовать «Создать с помощью AI»).',
      },
    },
  },

  fieldHint: {
    shortenBy: 'Сократить на {{count}} {{unit}}',
    missingChars: 'Требуется еще {{count}} {{unit}} (мин. {{min}})',
  },

  stepper: {
    title: 'ШАГ {{current}} ИЗ {{total}}',
    canProceed: 'Вы можете продолжить',
    completeStep: 'Завершите этот шаг',
    alerts: {
      stepByStep: {
        title: 'Идите шаг за шагом',
        message: 'Вы можете только перейти к следующему шагу.',
      },
      completeData: {
        title: 'Заполните детали',
      },
    },
  },

  common: {
    yes: 'Да',
    no: 'Нет',
    none: 'Никто',
    groundFloor: 'Первый этаж',
    notSpecified: 'Не указан',
    pickerEmpty: '‒',
    cancel: 'Отмена',
    settings: 'Настройки',
    super: 'Большой',
    alerts: {
      authError: {
        title: 'Ошибка авторизации',
        message: 'Войдите еще раз, чтобы опубликовать свое объявление.',
      },
      completeOffer: {
        title: 'Заполните свое объявление',
        fixData: 'Исправить детали',
      },
      validation: {
        title: 'Валидация',
        landRegistryFormat: 'Неверный формат номера земельного кадастра. Используйте шаблон: WA4N/00012345/6.',
      },
      store: {
        title: 'Магазин',
      },
      error: {
        title: 'Ошибка',
      },
      verificationRequired: {
        title: 'Требуется проверка',
        message:
          'To publish a listing you must first verify: {{missing}}.\n\nGo to Profile → Edit details and complete SMS and email verification.',
        missingPhone: 'номер телефона',
        missingEmail: 'Адрес электронной почты',
        goToProfile: 'Перейти в профиль',
      },
    },
  },

  step1: {
    headerPrefix: 'Добавлять',
    headerSuffix: 'листинг',
    sections: {
      transaction: 'С чего начать?',
      propertyType: 'Что вы предлагаете?',
      condition: 'В каком он состоянии?',
    },
    tapTip: {
      title: 'Коснитесь плитки, чтобы выбрать',
      subtitle: 'Выберите Продажа или Аренда — следующие поля появятся автоматически.',
    },
    optionTapHint: 'Нажмите, чтобы выбрать',
    transaction: {
      sell: 'Распродажа',
      rent: 'Арендовать',
    },
    propertyType: {
      flat: 'Квартира',
      house: 'Дом',
      plot: 'Сюжет',
      premises: 'Коммерческая единица',
    },
    condition: {
      ready: 'Готов к заселению',
      renovation: 'Отремонтировать',
      developer: 'Стандарт разработчика',
    },
    footerHint:
      'Тип сделки, вид недвижимости и состояние отделки влияют на карточку объявления и подбор в радарах и фильтрах. Указывайте фактическое состояние — так меньше недопонимания при первом контакте.',
  },

  step2: {
    header: 'Расположение',
    sections: {
      searchAddress: 'Поиск адреса',
      locality: 'МЕСТНОСТЬ',
      country: 'СТРАНА',
      city: 'ГОРОД',
      district: 'РАЙОН',
    },
    placeholders: {
      street: 'например Главная улица, 12',
    },
    streetBuildingHint: 'Добавьте номер здания (например, Main St, 12).',
    localityHint:
      'Подставляется с карты и адреса (геокодирование). Переместите булавку или введите улицу с номером, чтобы изменить название.',
    countryHint:
      'Определяется по карте (например, Польша, Украина). Переместите булавку в нужную страну, если название неверно.',
    exactLocation: {
      label: 'Точное местоположение',
      on: 'ВКЛ: покупатели видят название улицы + номер (например, «Реймонта 12») и точную отметку на карте.',
      off: 'ВЫКЛ: покупатели видят только название улицы (например, «Реймонта», без номера) и площадь около 200 м².',
    },
    mapTip: {
      title: 'Переместите карту, чтобы разместить булавку',
      subtitle: 'Сведите пальцы для увеличения. Булавка должна отмечать точную точку свойства.',
    },
    myLocation: {
      a11y: 'Моё местоположение',
    },
    footerHint: {
      poland:
        'The pin on the map must match the actual property location. In Poland you can refine city and district from the list — the address should match the pin. Outside major agglomerations the locality name comes from geocoding.',
      international:
        'Location outside Poland: city and locality come only from the map and address (geocoding). The Polish city list does not apply — set the pin and enter the exact address with number.',
    },
    confirm: {
      title: 'Подтвердить местоположение',
      subtitle: 'Убедитесь, что булавка отмечает правильное место в списке.',
      labels: {
        cityDistrict: 'Город и район',
        country: 'Страна',
        address: 'Адрес',
      },
      buttons: {
        edit: 'Редактировать',
        confirm: 'Подтверждать',
      },
      fallbacks: {
        localityUnknown: 'Местоположение не определено',
        noExactAddress: 'Нет точного адреса',
      },
    },
    alerts: {
      missingNumber: {
        title: 'Отсутствует номер',
        message: 'Пожалуйста, введите полный адрес с номером, например. Главная улица 12.',
      },
      addressNotFound: {
        title: 'Не найдено',
        message: 'Система не смогла найти этот адрес на карте.',
      },
      districtNotFound: {
        title: 'Район не найден',
        message: 'Не удалось найти: {{district}}, {{city}}.',
      },
      locationDenied: {
        title: 'Нет доступа к геолокации',
        message: 'Включите геолокацию в настройках телефона, чтобы вернуться к своей позиции на карте.',
      },
      locationFailed: {
        title: 'Не удалось определить местоположение',
        message: 'Попробуйте снова через минуту или установите булавку вручную на карте.',
      },
    },
  },

  step3: {
    header: 'Параметры',
    sections: {
      area: 'Площадь пола',
      plotArea: 'Площадь участка',
      housePlotArea: 'Размер участка',
      details: 'Подробности',
      amenities: 'Удобства (по желанию)',
      heating: 'Обогрев',
      landRegistry: 'Проверка документов (по желанию)',
    },
    hints: {
      plotArea: 'Укажите общую площадь участка в квадратных метрах.',
      housePlotArea: 'Укажите площадь участка у частного дома (м²).',
    },
    placeholders: {
      area: '0',
      plotArea: 'например 1200',
      housePlotArea: 'например 850',
      apartmentNumber: 'Номер устройства',
      landRegistryNumber: 'Номер земельного кадастра (например, WA4N/00012345/6)',
    },
    pickers: {
      rooms: 'КОМНАТЫ',
      floor: 'ЭТАЖ',
      year: 'ГОД',
    },
    wheelHint: 'Листайте пальцем',
    heating: {
      none: 'Не указан',
      district: 'Централизованное отопление',
      gas: 'Газ',
      electric: 'Электрический',
      heatPump: 'Тепловой насос',
      coalPellet: 'Уголь/пеллеты',
      other: 'Другой',
    },
    furnished: 'Меблированный',
    amenities: {
      balcony: 'Балкон/терраса',
      parking: 'Гараж / парковка',
      storage: 'Склад/подвал',
      elevator: 'Лифт',
      garden: 'Сад',
      twoLevel: 'Двухуровневый',
    },
    landRegistry: {
      courtPrefix: 'Компетентный суд:',
      validFormat: 'Формат земельной книги действителен. Данные используются только для проверки.',
      invalidFormat: 'Неверный формат земельного кадастра. Используйте шаблон: WA4N/00012345/6.',
      privacy:
        'Document data is private and used solely to verify legal status (e.g. confirming the property is checked and free of encumbrances), which increases listing credibility and buyer interest. This data is not published and will never be disclosed without your explicit consent.',
    },
    footerHint: {
      withLandRegistry:
        'Floor area and technical details affect comparability with other listings and financial estimates in the next step. Fill fields in order — new sections unlock when previous ones are complete. For a plot, area alone is enough (no typical unit amenities).',
      withoutLandRegistry:
        'Floor area and technical details affect comparability with other listings. Land registry (KW) verification is not used for properties outside Poland — it applies only to the Polish register.',
    },
  },

  step4: {
    header: 'Финансы',
    sections: {
      priceRent: 'Ежемесячная арендная плата — валюта листинга',
      priceSell: 'Общая цена — валюта листинга',
      deposit: 'Депозит',
      adminFee: 'ТСЖ / административный сбор',
    },
    placeholders: {
      amount: '0',
    },
    analytics: {
      pricePerSqm: 'Цена за м²',
      marketStatus: {
        bargain: 'BARGAIN',
        market: 'НА РЫНКЕ',
        overpriced: 'ВЫШЕ РЫНКА',
      },
      diffFromAverage: '{{sign}}{{percent}}% относительно среднего',
      emptyHint: 'Введите площадь помещения на шаге 3 и цену, чтобы просмотреть и скорректировать анализ рынка.',
      estimatedRoi: 'Расчетная рентабельность инвестиций',
    },
    commission: {
      badge: 'Агент EstateOS™',
      titleDefault: 'Ваша комиссия',
      titleZero: 'Листинг без комиссии',
      subtitleZero:
        'Buyers pay no commission on this listing. A “No commission” note will appear on the listing — it attracts attention and builds trust.',
      subtitleDefaultPrefix: 'Цена листинга остается неизменной. Покупатели увидят примечание о том, что',
      subtitleDefaultSuffix:
        'of the price is your commission — paid to you directly after the transaction closes.',
      subtitleVatNote:
        'The amount is GROSS (includes VAT) — buyers do not pay any additional tax or fees.',
      addDefault: 'Комиссия {{percent}}',
      addZero: 'Без комиссии',
      label: 'Комиссия',
      stepHint: 'шаг {{step}}',
      amountLabelBuyer: 'для покупателя',
      amountLabelFromPrice: 'листинговой цены',
      amountZero: 'БЕЗ КОМИССИИ',
      amountEmpty: '— злотых',
      amountHintZero: 'Покупатель не платит комиссию.',
      amountHintDefault: 'Ваша комиссия за транзакцию.',
      warnRange:
        'Commission must be 0% (no commission) or within {{min}}–{{max}}.',
    },
    footerHint:
      'Amounts should be clear to buyers or tenants (including admin fee on sale listings when applicable). Price per m² and comparison to a simplified average are for orientation only — not expert valuation or full market analysis.',
  },

  step5: {
    header: 'Медиа и описание',
    capacity: {
      photos: 'Загруженные фотографии',
      diskSpace: 'Место для хранения',
      suffixPhotos: 'шт.',
      suffixMb: 'MB',
      estimatedSizeHint: '{{count}} {{filesLabel}} приблизительный размер до полного измерения.',
      estimatedSizeFileOne: 'файл имеет',
      estimatedSizeFileMany: 'файлы имеют',
    },
    sections: {
      photoGrid: 'Сетка фотографий',
      title: 'Название листинга',
      floorPlan: 'План этажа',
      description: 'Описание листинга',
    },
    coverBadge: 'COVER',
    gallery: {
      open: 'Открыть галерею',
      addMore: 'Добавить больше фотографий',
      sizing: 'Вычисление пространства (предварительная конвертация)...',
    },
    titlePlaceholder: 'например Роскошная квартира с видом на горизонт',
    floorPlan: {
      upload: 'Загрузить план этажа',
    },
    ai: {
      generate: 'Генерируйте с помощью ИИ',
      generating: 'Анализ...',
      descriptionPlaceholder:
        'Let AI analyze your property and create the ideal description, or enter it manually...',
      intros: [
        'Step into a space that redefines luxury and comfort.',
        'A rare market opportunity. A property that captures attention instantly.',
        'A place designed for those who value urban living.',
        'Harmony, calm, and refined design — for the most discerning buyers.',
      ],
      poi: [
        'Within 500 meters you will find renowned schools and a modern complex.',
        'Just a 3-minute walk to major transport hubs.',
        'The surroundings embody city life: cafés and restaurants.',
        'For active lifestyles: bike paths, fitness clubs, and proximity to the river.',
      ],
      marketOccasion: [
        'This listing offers strong value — price-to-area ratio is highly competitive.',
        'Comparative analysis suggests attractive pricing versus similar nearby listings.',
        'In this local segment it is one of the most interesting price points currently on the market.',
      ],
      marketFair: [
        'The price aligns with the market and recent transactions for similar properties.',
        'Pricing is balanced and fits local ranges well.',
        'A stable, market-rate offer — no artificial markup, with consistent quality.',
      ],
      marketPremium: [
        'Positioned as exclusive — the higher price reflects standard, location, and potential.',
        'Premium segment: above-average pricing reflects quality and property profile.',
        'A property for premium buyers seeking quality beyond the market average.',
      ],
      marketHeader: {
        bargain: 'BARGAIN',
        premium: 'EXCLUSIVE',
        fair: 'РЫНОЧНАЯ ЦЕНА',
      },
      poiCandidates: [
        '🚇 Public transport within easy reach (bus/tram) — daily commutes are quick and predictable.',
        '🛍 Nearby services: shops, bakeries, pharmacies, and dining.',
        '🌿 Recreational areas nearby — ideal for walks, running, or cycling after work.',
        '☕ The location supports convenient living — cafés, restaurants, and daily infrastructure close by.',
        '🚗 Easy access to main routes makes getting around the city and beyond simple.',
        '🏫 Family infrastructure (schools/kindergartens) is reachable in a short time.',
      ],
      poiWarsaw: [
        '🚇 Depending on the district, metro stations remain within practical public transport reach.',
        '🍔 The area includes well-known dining brands and drive-through locations.',
      ],
      poiPin: '📍Адрес был установлен с помощью метки на карте, что повышает точность соответствия потребностям местных покупателей.',
      propertyType: {
        house: 'дом',
        plot: 'сюжет',
        flat: 'квартира',
      },
      condition: {
        ready: 'готов к заселению',
        renovation: 'с возможностью реновации',
        developer: 'в стандарте разработчика',
      },
      transaction: {
        rent: 'арендовать',
        sell: 'распродажа',
      },
      locationFallback: 'выбранная местность',
      amenities: {
        balcony: 'Балкон/терраса',
        parking: 'Гараж / парковка',
        storage: 'Камера хранения / шкафчик',
        elevator: 'Лифт',
        garden: 'Сад',
        furnished: 'Меблированный интерьер',
        none: 'На данном этапе дополнительные удобства не выбраны.',
      },
      sections: {
        neighborhood: '✧ РАЙОНЫ ✧',
        market: '✧ АНАЛИЗ РЫНКА ✧',
        amenities: '✧ УДОБСТВА ✧',
        parameters: '✧ ОСНОВНЫЕ ПАРАМЕТРЫ ✧',
      },
      bullets: {
        transaction: '🔁 Тип транзакции:',
        propertyType: '🏷 Тип недвижимости:',
        area: '📐Площадь:',
        plotArea: '🌿Площадь участка:',
        rooms: '🛏Номера:',
        floor: '🏢 Этаж:',
        totalFloors: '🏙 Этажи здания:',
        yearBuilt: '🗓 Год постройки:',
        price: '💰Цена:',
        pricePerSqm: '📊 Цена за м²:',
        adminFee: '💶 Административный сбор:',
        deposit: '🔐 Депозит:',
        condition: '🧱Состояние:',
        heating: '🔥Отопление:',
        location: '📍Местоположение:',
        address: '🧭Адрес:',
        apartmentNumber: '🔢 Номер объекта:',
        locationMode: '🛰 Режим локации:',
      },
      locationMode: {
        exact: 'Точный (точный штифт)',
        approximate: 'Приблизительно (частная зона)',
      },
      conditionLabels: {
        ready: 'Готов к заселению',
        renovation: 'Отремонтировать',
        developer: 'Стандарт разработчика',
      },
      propertyTypeLabels: {
        house: 'Дом',
        plot: 'Сюжет',
        premises: 'Коммерческая единица',
        flat: 'Квартира',
      },
      transactionLabels: {
        sell: 'Распродажа',
        rent: 'Арендовать',
      },
      marketSpread: '📌 Цена объявления/средняя местная цена: {{offerPrice}} против {{avgPrice}} злотых/м² ({{sign}}{{percent}}%)',
      bodyTemplate:
        '{{intro}}\n\nWe present an exceptional {{propertyType}} for {{transaction}}, located in the heart of: {{location}}. The property is {{condition}}, making it a highly attractive offer.\n\n{{neighborhoodSection}}\n{{randomPoi}}\n{{enrichedPoi}}\n\n{{marketSection}}\n{{marketHeader}}\n{{marketNarrative}}{{marketSpread}}\n\n{{amenitiesSection}}\n{{amenitiesText}}\n\n{{parametersSection}}{{bullets}}\n\nContact us to arrange a private viewing.',
    },
    footerHint:
      'The first photo is the cover on lists — drag thumbnails to reorder. Use good light and clear framing; a floor plan builds trust in the layout. The description complements form data and should reflect the actual property (including when using AI suggestions).',
    alerts: {
      photoAccess: {
        title: 'Доступ к фотографиям',
        message:
          'To add photos to your listing, allow EstateOS access to your photo library (Settings → EstateOS → Photos).',
      },
      photoLimit: {
        title: 'Лимит фотографий',
        message: 'Достигнут максимальный лимит в 20 фотографий.',
      },
      storageLimit: {
        title: 'Лимит хранения',
      },
      storagePickerBudget:
        'This photo set is too large at this stage (upload limit {{uploadMb}} MB).\nLarge HEIC files are converted on device first — remove some photos or add them one at a time.\n(The {{reserveMb}} MB reserve is for conversion only and does not increase the server upload limit.)',
      storageUploadCap:
        'After conversion (e.g. HEIC→JPEG) the set exceeds the {{uploadMb}} MB upload limit.\nRemove some photos or choose smaller files.',
      addPhotosFailed: {
        title: 'Не удалось добавить фотографии',
        message: 'Проверьте доступ к библиотеке фотографий и повторите попытку.',
      },
      floorPlanFailed: {
        title: 'Не удалось загрузить план этажа.',
        message: 'Проверьте доступ к фотографиям и повторите попытку.',
      },
    },
  },

  step6: {
    noPhotos: 'В объявлении нет фотографий',
    rentLabel: 'Ежемесячная арендная плата (всего)',
    depositLabel: 'Депозит {{amount}} PLN',
    adminFeeLabel: 'Административный сбор ~ {{amount}} PLN',
    commissionSummary: {
      label: 'Комиссия:',
      zero: 'без комиссии (0%)',
      amountUnderOne: '< 1 злотых',
    },
    transactionPill: {
      rent: 'RENT',
      sell: 'SALE',
    },
    location: {
      label: 'Расположение',
      publicAddress: 'Публичное обращение',
      hiddenApprox: 'Скрытый (площадь ~200 м2)',
      hiddenWithArea: '{{street}} · номер скрыт (площадь ~200 м²)',
    },
    mapPreview: {
      title: 'ПРОСМОТР КАРТЫ',
      markerTitle: 'Местоположение листинга',
      exactCaption: 'Точная точка — вид в перспективе (3D-здания)',
      approximateCaption:
        'Area ~{{radius}} m · center shifted randomly (building lies somewhere inside the circle)',
    },
    commission: {
      badge: 'Агент EstateOS™',
      titleDefault: 'Ваша комиссия',
      titleZero: 'Листинг без комиссии',
      subtitleZeroPrefix: 'Покупатели',
      subtitleZeroHighlight: 'не платить комиссию',
      subtitleZeroSuffix:
        'on this listing. A “No commission” note will appear on the listing — it builds trust and attracts attention.',
      subtitleDefaultPrefix: 'Цена листинга остается неизменной. Покупатели увидят примечание о том, что',
      subtitleDefaultSuffix:
        'of the price is your commission — paid directly to the agent after the transaction closes.',
      subtitleVatNote:
        'The amount is GROSS (includes VAT) — buyers do not pay any additional tax or fees.',
    },
    sections: {
      parameters: 'ПАРАМЕТРЫ НЕДВИЖИМОСТИ',
      media: 'МЕДИА И МАТЕРИАЛЫ',
      amenities: 'AMENITIES',
      description: 'AI / ТАМОЖЕННОЕ ОПИСАНИЕ',
    },
    badges: {
      type: 'Тип',
      area: 'Площадь пола',
      rooms: 'Номера',
      roomsValue: '{{count}} р.м.',
      floor: 'Пол',
      yearBuilt: 'Год постройки',
      adminFee: 'Административный сбор',
      heating: 'Обогрев',
      furnished: 'Меблированный',
      totalFloors: 'Полы здания',
      plot: 'Сюжет',
      condition: 'Состояние',
    },
    propertyType: {
      flat: 'Квартира',
      house: 'Дом',
      plot: 'Сюжет',
      premises: 'Коммерческая единица',
      fallback: 'Свойство',
    },
    condition: {
      ready: 'Готов к заселению',
      renovation: 'Отремонтировать',
      developer: 'Стандарт разработчика',
    },
    amenities: {
      balcony: 'Балкон/терраса',
      parking: 'Стоянка',
      storage: 'Склад/подвал',
      elevator: 'Лифт',
      garden: 'Сад',
      twoLevel: 'Двухуровневый',
      furnished: 'Меблированный',
    },
    mediaSummary: 'Фотографии: {{photos}} · План этажа: {{floorPlan}} · Видео: {{video}}',
    mediaYes: 'да',
    mediaNo: 'нет',
    validationHint: 'На шаге {{steps}} отсутствуют данные — нажмите кнопку, чтобы вернуться и завершить его.',
    plusCreditHint: 'У вас есть бонус Plus — при публикации будет использован 1 кредит (без комиссии за второй магазин).',
    couponPublishHint:
      'У вас {{count}} купон(ов) на публикацию — после «Опубликовать» выберите купон (например, именинный), чтобы не тратить кредит Plus.',
    publicationChoice: {
      title: 'Как опубликовать объявление?',
      subtitle: 'Используйте бонусный купон на публикацию или оплатите кредитом Pakiet Plus.',
      couponPriorityHint:
        'Есть активные купоны — по умолчанию выбран первый. Выберите купон, чтобы не тратить кредит Plus.',
      couponsSection: 'Бонусные купоны',
      couponsEmpty: 'Нет активных купонов на публикацию.',
      plusSection: 'Пакет Plus',
      plusCreditTitle: 'Использовать кредит Plus',
      plusCreditSubtitle: 'На счёте: {{count}} публикаций',
      buyPlusTitle: 'Купить Pakiet Plus',
      buyPlusSubtitle: 'Оплатить одну публикацию в App Store (~{{price}})',
      publish: 'Опубликовать',
    },
    publish: {
      publishing: 'Издательский...',
      publish: 'Публикация в экосистеме',
      completeData: 'Полная информация о листинге',
      editData: 'Вернитесь и отредактируйте',
      creating: 'Создание записи в базе данных...',
      convertingPhoto: 'Конвертирование фотографии {{current}} (HEIC ➜ JPG)...',
      uploadingPhoto: 'Загружаю фотографию {{current}} из {{total}}...',
      convertingFloorPlan: 'Конвертация плана этажа (HEIC ➜ JPG)...',
      uploadingFloorPlan: 'Загрузка плана этажа...',
    },
    defaultTitle: {
      flatRest: 'Квартира — {{locality}}',
      propertyRest: 'Недвижимость — {{locality}}',
      flatCity: 'Квартира в {{city}}',
      propertyCity: 'Недвижимость в {{city}}',
      defaultCity: 'Варшава',
      defaultCountry: 'Польша',
      defaultDistrict: 'Средместье',
    },
    alerts: {
      agentCommission: {
        title: 'Агентская комиссия',
      },
      congratulations: {
        title: 'Поздравляем! 🎉',
        messageDefault:
          'Your listing was added successfully. After a quick review it will appear on the radar.',
        messageWithLegal:
          'Your listing was added successfully, and the land registry number with unit was sent for admin verification. After moderation it will appear on the radar.',
      },
      publishError: {
        plusPaidRetry:
          '\n\nPublication fee was accepted, but the listing did not go live — tap “Publish to ecosystem” again (no second charge).',
        archived:
          '\n\nWe automatically withdrew the incomplete listing — you can safely try again.',
        archiveFailed:
          '\n\nCould not automatically withdraw the failed listing (ID: {{id}}). Contact support to remove the duplicate.',
        connectionFallback: 'Возникла проблема с подключением.',
        serverError: 'Ошибка сервера при публикации объявления',
        uploadRejected: 'Отклонено сервером',
        uploadUnknown: 'Неизвестная ошибка загрузки',
        floorPlanUnknown: 'Неизвестная ошибка плана этажа',
        photoError: 'Фото {{index}}: {{message}}',
        floorPlanError: 'План этажа: {{message}}',
      },
    },
  },
};
