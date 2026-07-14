export const addOffer = {
  stepBlockDefault: 'Complete the required fields in this step.',
  stepBlockPrefix: 'Complete: {{fields}}.',

  meter: {
    ofMax: '{{current}} / {{max}} {{unit}}',
    ofMin: '{{current}} / {{min}} min. {{unit}}',
    count: '{{current}} {{unit}}',
  },

  validation: {
    step1: {
      transaction: { label: 'Listing goal', action: 'Choose Sale or Rent.' },
      propertyType: { label: 'Property type', action: 'Choose apartment, house, plot, or commercial unit.' },
      condition: { label: 'Finish condition', action: 'Choose: move-in ready, to renovate, or developer standard.' },
    },
    step2: {
      map: { label: 'Map pin', action: 'Move the map or search for an address — the pin must mark the location.' },
      locality: {
        label: 'Locality',
        actionPl: 'Wait for geocoding or select city and district.',
        actionIntl: 'Set the pin — the locality name will fill in from the map.',
      },
      street: { label: 'Street and building number', action: 'Enter street with number (min. {{min}} characters, e.g. Main St 12).' },
      streetApprox: {
        label: 'Street name (approximate location)',
        action: 'Enter street name without number (min. {{min}} characters).',
      },
      streetIntl: { label: 'Address or pin', action: 'Enter a street or keep only the pin with a confirmed locality.' },
    },
    step3: {
      plotArea: { label: 'Plot area', action: 'Enter plot size in m² (greater than 0).' },
      housePlotArea: {
        label: 'Plot size (house)',
        action: 'Select plot size in m² (greater than 0).',
      },
      area: { label: 'Floor area', action: 'Enter usable area in m².' },
      rooms: { label: 'Number of rooms', action: 'Select number of rooms.', actionNeedArea: 'Enter floor area first.' },
      floor: {
        label: 'Floor',
        actionNeedArea: 'Enter floor area first.',
        actionNeedRooms: 'Select number of rooms first.',
        action: 'Select floor (e.g. Ground or 3).',
      },
      year: { label: 'Year built', action: 'Select year built from the list.' },
    },
    step4: {
      priceSell: { label: 'Total price', action: 'Enter sale price (greater than 0).' },
      priceRent: { label: 'Monthly rent', action: 'Enter monthly rent (greater than 0).' },
    },
    step5: {
      photos: { label: 'Listing photos', action: 'Add at least {{min}} photo — use “Open gallery”.' },
      title: {
        label: 'Listing title',
        actionShort: 'Enter {{count}} more {{unit}}.',
        actionLong: 'Shorten the title to {{max}} characters.',
      },
      description: {
        label: 'Description (recommended)',
        action: 'Add a description — at least {{min}} characters (use “GPT Mini description” or “Template AI”).',
      },
    },
  },

  fieldHint: {
    shortenBy: 'Shorten by {{count}} {{unit}}',
    missingChars: '{{count}} more {{unit}} needed (min. {{min}})',
  },

  stepper: {
    title: 'STEP {{current}} OF {{total}}',
    canProceed: 'You can continue',
    completeStep: 'Complete this step',
    alerts: {
      stepByStep: {
        title: 'Go step by step',
        message: 'You can only move to the next step.',
      },
      completeData: {
        title: 'Complete the details',
      },
    },
  },

  common: {
    yes: 'Yes',
    no: 'No',
    none: 'None',
    groundFloor: 'Ground floor',
    notSpecified: 'Not specified',
    pickerEmpty: '‒',
    cancel: 'Cancel',
    close: 'Close',
    settings: 'Settings',
    super: 'Great',
    alerts: {
      authError: {
        title: 'Authorization error',
        message: 'Sign in again to publish your listing.',
      },
      completeOffer: {
        title: 'Complete your listing',
        fixData: 'Fix details',
      },
      validation: {
        title: 'Validation',
        landRegistryFormat: 'Land registry number format is invalid. Use the pattern: WA4N/00012345/6',
      },
      store: {
        title: 'Store',
      },
      error: {
        title: 'Error',
      },
      verificationRequired: {
        title: 'Verification required',
        message:
          'To publish a listing you must first verify: {{missing}}.\n\nGo to Profile → Edit details and complete SMS and email verification.',
        missingPhone: 'phone number',
        missingEmail: 'email address',
        goToProfile: 'Go to profile',
      },
    },
  },

  step1: {
    headerPrefix: 'Add ',
    headerSuffix: 'listing',
    sections: {
      transaction: 'Where do we start?',
      propertyType: 'What are you offering?',
      condition: 'What condition is it in?',
    },
    tapTip: {
      title: 'Tap a tile to choose',
      subtitle: 'Select Sale or Rent — the next fields will appear automatically.',
    },
    optionTapHint: 'Tap to select',
    transaction: {
      sell: 'Sale',
      rent: 'Rent',
    },
    propertyType: {
      flat: 'Apartment',
      house: 'House',
      plot: 'Plot',
      premises: 'Commercial unit',
    },
    condition: {
      ready: 'Move-in ready',
      renovation: 'To renovate',
      developer: 'Developer standard',
    },
    footerHint:
      'Transaction type, property type, and finish condition affect how your listing appears and how it matches in radars and filters. Choose values that reflect the actual state — it reduces misunderstandings at first contact.',
  },

  step2: {
    header: 'Location',
    sections: {
      searchAddress: 'Search address',
      locality: 'LOCALITY',
      country: 'COUNTRY',
      city: 'CITY',
      district: 'DISTRICT',
    },
    placeholders: {
      street: 'e.g. Main St 12',
    },
    streetBuildingHint: 'Add a building number (e.g. Main St 12)',
    localityHint:
      'Set from the map and address (geocoding). Move the pin or enter a street with number to change the name.',
    countryHint:
      'Detected from the map (e.g. Poland, Ukraine). Move the pin to the correct country if the name is wrong.',
    exactLocation: {
      label: 'Exact location',
      on: 'ON: buyers see street name + number (e.g. “Reymonta 12”) and a precise map pin.',
      off: 'OFF: buyers see only the street name (e.g. “Reymonta”, no number) and an approximate ~200 m area.',
    },
    mapTip: {
      title: 'Move the map to place the pin',
      subtitle: 'Pinch to zoom in. The pin must mark the exact property point.',
    },
    myLocation: {
      a11y: 'My location',
    },
    footerHint: {
      poland:
        'The pin on the map must match the actual property location. In Poland you can refine city and district from the list — the address should match the pin. Outside major agglomerations the locality name comes from geocoding.',
      international:
        'Location outside Poland: city and locality come only from the map and address (geocoding). The Polish city list does not apply — set the pin and enter the exact address with number.',
    },
    confirm: {
      title: 'Confirm location',
      subtitle: 'Make sure the pin marks the correct listing location.',
      labels: {
        cityDistrict: 'City and district',
        country: 'Country',
        address: 'Address',
      },
      buttons: {
        edit: 'Edit',
        confirm: 'Confirm',
      },
      fallbacks: {
        localityUnknown: 'Locality not determined',
        noExactAddress: 'No exact address',
      },
    },
    alerts: {
      missingNumber: {
        title: 'Missing number',
        message: 'Please enter the full address with number, e.g. Main St 12.',
      },
      addressNotFound: {
        title: 'Not found',
        message: 'The system could not find this address on the map.',
      },
      districtNotFound: {
        title: 'District not found',
        message: 'Could not locate: {{district}}, {{city}}.',
      },
      locationDenied: {
        title: 'Location access denied',
        message: 'Enable location in your phone settings to return to your position on the map.',
      },
      locationFailed: {
        title: 'Could not determine location',
        message: 'Try again in a moment or place the pin manually on the map.',
      },
    },
  },

  step3: {
    header: 'Parameters',
    sections: {
      area: 'Floor area',
      plotArea: 'Plot area',
      housePlotArea: 'Plot size',
      details: 'Details',
      amenities: 'Amenities (optional)',
      heating: 'Heating',
      landRegistry: 'Document verification (optional)',
    },
    hints: {
      plotArea: 'Enter the total plot size in square meters.',
      housePlotArea: 'Plot size for a detached house (m²).',
    },
    placeholders: {
      area: '0',
      plotArea: 'e.g. 1200',
      housePlotArea: 'e.g. 850',
      apartmentNumber: 'Unit number',
      landRegistryNumber: 'Land registry number (e.g. WA4N/00012345/6)',
    },
    pickers: {
      rooms: 'ROOMS',
      floor: 'FLOOR',
      year: 'YEAR',
    },
    wheelHint: 'Scroll with finger',
    heating: {
      none: 'Not specified',
      district: 'District heating',
      gas: 'Gas',
      electric: 'Electric',
      heatPump: 'Heat pump',
      coalPellet: 'Coal / pellet',
      other: 'Other',
    },
    furnished: 'Furnished',
    amenities: {
      balcony: 'Balcony / terrace',
      parking: 'Garage / parking',
      storage: 'Storage / cellar',
      elevator: 'Elevator',
      garden: 'Garden',
      twoLevel: 'Two-level',
    },
    landRegistry: {
      courtPrefix: 'Competent court:',
      validFormat: 'Land registry format is valid. Data is used only for verification.',
      invalidFormat: 'Invalid land registry format. Use the pattern: WA4N/00012345/6',
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
    header: 'Finances',
    sections: {
      priceRent: 'Monthly rent — listing currency',
      priceSell: 'Total price — listing currency',
      deposit: 'Deposit',
      adminFee: 'HOA / admin fee',
    },
    placeholders: {
      amount: '0',
    },
    analytics: {
      pricePerSqm: 'Price per m²',
      marketStatus: {
        bargain: 'BARGAIN',
        market: 'AT MARKET',
        overpriced: 'ABOVE MARKET',
      },
      diffFromAverage: '{{sign}}{{percent}}% vs average',
      emptyHint: 'Enter floor area in Step 3 and price to view and adjust market analysis.',
      estimatedRoi: 'Estimated ROI',
    },
    commission: {
      badge: 'EstateOS™ Agent',
      titleDefault: 'Your commission',
      titleZero: 'No-commission listing',
      subtitleZero:
        'Buyers pay no commission on this listing. A “No commission” note will appear on the listing — it attracts attention and builds trust.',
      subtitleDefaultPrefix: 'The listing price stays unchanged. Buyers will see a note that',
      subtitleDefaultSuffix:
        'of the price is your commission — paid to you directly after the transaction closes.',
      subtitleVatNote:
        'The amount is GROSS (includes VAT) — buyers do not pay any additional tax or fees.',
      addDefault: 'Commission {{percent}}',
      addZero: 'No commission',
      label: 'Commission',
      stepHint: 'step {{step}}',
      amountLabelBuyer: 'for buyer',
      amountLabelFromPrice: 'of listing price',
      amountZero: 'NO COMMISSION',
      amountEmpty: '— PLN',
      amountHintZero: 'Buyer pays no commission.',
      amountHintDefault: 'Your fee from the transaction.',
      warnRange:
        'Commission must be 0% (no commission) or within {{min}}–{{max}}.',
    },
    footerHint:
      'Amounts should be clear to buyers or tenants (including admin fee on sale listings when applicable). Price per m² and comparison to a simplified average are for orientation only — not expert valuation or full market analysis.',
  },

  step5: {
    header: 'Media & description',
    capacity: {
      photos: 'Uploaded photos',
      diskSpace: 'Storage space',
      suffixPhotos: 'pcs',
      suffixMb: 'MB',
      estimatedSizeHint: '{{count}} {{filesLabel}} estimated size until fully measured.',
      estimatedSizeFileOne: 'file has',
      estimatedSizeFileMany: 'files have',
    },
    sections: {
      addPhotos: 'Add photos',
      photoGrid: 'Photo grid',
      title: 'Listing title',
      floorPlan: 'Floor plan',
      description: 'Listing description',
    },
    coverBadge: 'COVER',
    gallery: {
      lead: 'The first photo is the listing cover. Use arrows to reorder.',
      addLabel: 'Add',
      open: 'Open gallery',
      addMore: 'Add more photos',
      sizing: 'Calculating space (preview conversion)...',
    },
    proSession: {
      cta: 'Professional photo session',
      eyebrow: 'EstateOS Studio',
      title: 'Professional photo session',
      subtitle:
        'Photographer, copy and full listing from start to finish — you just open the door. See sample listings below.',
      examplesTitle: 'See sample listings',
      examples: {
        studioBadge: 'EstateOS Session',
        viewOffer: 'View listing',
        ownerName: 'EstateOS Studio',
        previewBanner: 'Sample session showcase',
        previewBannerSub: 'This demo shows what a complete listing looks like after a professional EstateOS photo session.',
        previewFooter: 'This is a sample — contact and negotiation are disabled. Book a session in the offer wizard.',
        previewOfferId: 'EstateOS Studio sample · demo listing',
        warsaw: {
          country: 'Poland',
          title: 'Luxury penthouse with Vistula view',
          location: 'Mokotów, Warsaw',
          price: 'PLN 2,450,000',
          area: '98 m²',
          rooms: '3 rooms',
          transaction: 'Sale',
          teaser: 'Bright interiors, panoramic terrace and premium photo production ready for ads.',
          description:
            'An exceptional Mokotów penthouse with panoramic views of the Vistula and Warsaw skyline. Double-height living room, three bedrooms, walk-in closet and a terrace perfect for golden-hour shots. Includes 14 HDR photos, 2D LiDAR plan, 3D walkthrough and premium AI copy — ready to publish in minutes.',
          badge1: '14 HDR photos',
          badge2: '2D plan + LiDAR',
          badge3: 'Premium AI copy',
        },
        berlin: {
          country: 'Germany',
          title: 'Altbau loft with terrace in Prenzlauer Berg',
          location: 'Prenzlauer Berg, Berlin',
          price: '€890,000',
          area: '112 m²',
          rooms: '4 rooms',
          transaction: 'Sale',
          teaser: 'High ceilings, industrial charm and a full shoot for international listing launch.',
          description:
            'A classic Berlin Altbau with original details, soaring ceilings and a rooftop terrace. Four rooms, open kitchen and natural light all day. The session includes 18 photos, 3D plan, video walkthrough and DE/EN copy — built for international buyers.',
          badge1: '18 golden-hour photos',
          badge2: '3D plan + walkthrough',
          badge3: 'DE/EN copy',
        },
        kyiv: {
          country: 'Ukraine',
          title: 'Premium apartment with Dnipro panorama',
          location: 'Pechersk, Kyiv',
          price: '$185,000',
          area: '86 m²',
          rooms: '2 rooms',
          transaction: 'Sale',
          teaser: 'Modern finish, river view and complete listing production from start to finish.',
          description:
            'A modern Pechersk apartment with panoramic Dnipro views and historic Kyiv in the background. Two rooms, designer bathroom and a spacious balcony. Session package: 12 HDR photos, 2D plan, PL/UK/EN copy and portal-ready layout.',
          badge1: '12 HDR photos',
          badge2: '2D floor plan',
          badge3: 'PL/UK/EN copy',
        },
      },
      priceLabel: 'Service price',
      priceHint: '199 PLN — cash on site after the session.',
      proBenefit: 'Pro package customers can order one free session per account.',
      proFreeActive: 'You have Pro — one session on your account is free.',
      becomePro: 'Become Pro',
      steps: {
        pickDay: 'Pick a day',
        pickHour: 'Pick a time',
        confirm: 'Confirm slot',
        progress: 'Step {{step}} of 3',
      },
      selectedLabel: 'Selected slot',
      selectedAt: '{{date}} at {{hour}}',
      noteLabel: 'Notes for photographer (optional)',
      notePlaceholder: 'e.g. door code, parking at the back…',
      submit: 'Propose time slot',
      next: 'Next',
      successTitle: 'Proposal sent!',
      successBody:
        'The administrator received your proposed slot {{label}}. You will get a notification once it is confirmed.',
      confirmedTitle: 'Photo session confirmed',
      confirmedBody: 'Your slot {{label}} is booked. Countdown to the photographer visit below.',
      countdownLabel: 'TIME UNTIL PHOTO SESSION',
      manageInProfile: 'Manage the session schedule in Profile → Your properties → Photo sessions.',
      openPhotoSessions: 'Open photo sessions',
      activePendingTitle: 'You have an active session booking',
      activePendingHint: 'The administrator is reviewing your slot. Track status and reply in Profile.',
      activeCounterTitle: 'The administrator proposed a different slot',
      activeCounterHint: 'Accept, decline, or counter in Profile.',
      errors: {
        submitFailed: 'Could not send the proposal. Please try again.',
        loginRequired: 'Sign in to propose a photo session time.',
        pickDateTime: 'Pick a day and time for the session.',
        network: 'Connection error. Check your internet and try again.',
        serviceUnavailable:
          'Session booking is not available on the server yet. Try again shortly or contact support.',
      },
      loginBanner: 'Sign in to send your proposed session time to EstateOS Studio.',
    },
    titlePlaceholder: 'e.g. Luxury apartment with skyline view',
    floorPlan: {
      upload: 'Upload floor plan',
      scan: 'Scan apartment (LiDAR)',
      scanBadge: 'iPhone Pro',
      scanHint: 'Native Apple RoomPlan scan — 2D plan and 3D walkthrough in your listing.',
      scanned: 'LiDAR scanned plan',
      open3d: '3D walkthrough',
    },
    roomScan: {
      brand: 'EstateOS Room Scan',
      hint: 'Walk along walls — add rooms, then finish the scan.',
      cancel: 'Cancel',
      addRoom: 'Add room',
      finish: 'Finish scan',
      previewTitle: 'Your floor plan',
      previewSubtitle: 'Review room layout. After confirming, 2D plan and 3D model go to your listing.',
      rooms: 'Rooms',
      area: 'Area',
      ready: 'Ready',
      rescan: 'Scan again',
      usePlan: 'Use this plan',
      exportPdf: 'Export PDF',
      open3d: '3D walkthrough',
      processing: 'Preparing plan and 3D walkthrough…',
      errors: {
        exportMissing: 'Scan did not return files. Try again.',
        noWalls: 'No walls detected — improve lighting and scan again.',
        scanFailed: 'Scan failed. Check lighting and try again.',
        previewFailed: 'Could not generate plan preview.',
        pdfFailed: 'Could not export PDF.',
        walkthroughUnavailable: 'Could not open the 3D walkthrough. Rebuild the app and try again.',
      },
      roomTypes: {
        livingRoom: 'Living room',
        bedroom: 'Bedroom',
        bathroom: 'Bathroom',
        kitchen: 'Kitchen',
        diningRoom: 'Dining room',
        office: 'Office',
        hallway: 'Hallway',
        closet: 'Closet',
        laundry: 'Laundry',
        garage: 'Garage',
        balcony: 'Balcony',
        unspecified: 'Room',
      },
      roomCountOne: '{{count}} room',
      roomCountFew: '{{count}} rooms',
      roomCountMany: '{{count}} rooms',
      export: {
        brand: 'ESTATEOS ROOM SCAN',
        defaultTitle: 'Floor plan',
        footer: 'estateos.pl · LiDAR scan',
        pdfDialogTitle: 'Floor plan PDF',
      },
    },
    ai: {
      generate: 'Template AI',
      generateGpt: 'GPT Mini description',
      generating: 'Analyzing...',
      generatingGpt: 'GPT is analyzing the area…',
      gptRequiresLogin: 'Sign in to generate a GPT description.',
      gptErrorTitle: 'Description generation',
      gptInsufficientData:
        'Complete property type, location (map pin), and parameters in earlier steps.',
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
        fair: 'MARKET PRICE',
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
      poiPin: '📍 The address was set with a map pin, improving match precision for local buyer needs.',
      propertyType: {
        house: 'house',
        plot: 'plot',
        flat: 'apartment',
      },
      condition: {
        ready: 'ready to move in',
        renovation: 'with renovation potential',
        developer: 'in developer standard',
      },
      transaction: {
        rent: 'rent',
        sell: 'sale',
      },
      locationFallback: 'the selected locality',
      amenities: {
        balcony: 'Balcony / terrace',
        parking: 'Garage / parking',
        storage: 'Storage / locker',
        elevator: 'Elevator',
        garden: 'Garden',
        furnished: 'Furnished interior',
        none: 'No additional amenities selected at this stage.',
      },
      sections: {
        neighborhood: '✧ NEIGHBORHOOD ✧',
        market: '✧ MARKET ANALYSIS ✧',
        amenities: '✧ AMENITIES ✧',
        parameters: '✧ KEY PARAMETERS ✧',
      },
      bullets: {
        transaction: '🔁 Transaction type:',
        propertyType: '🏷 Property type:',
        area: '📐 Floor area:',
        plotArea: '🌿 Plot area:',
        rooms: '🛏 Rooms:',
        floor: '🏢 Floor:',
        totalFloors: '🏙 Building floors:',
        yearBuilt: '🗓 Year built:',
        price: '💰 Price:',
        pricePerSqm: '📊 Price per m²:',
        adminFee: '💶 Admin fee:',
        deposit: '🔐 Deposit:',
        condition: '🧱 Condition:',
        heating: '🔥 Heating:',
        location: '📍 Location:',
        address: '🧭 Address:',
        apartmentNumber: '🔢 Unit number:',
        locationMode: '🛰 Location mode:',
      },
      locationMode: {
        exact: 'Exact (precise pin)',
        approximate: 'Approximate (privacy area)',
      },
      conditionLabels: {
        ready: 'Move-in ready',
        renovation: 'To renovate',
        developer: 'Developer standard',
      },
      propertyTypeLabels: {
        house: 'House',
        plot: 'Plot',
        premises: 'Commercial unit',
        flat: 'Apartment',
      },
      transactionLabels: {
        sell: 'Sale',
        rent: 'Rent',
      },
      marketSpread: '📌 Listing price / local average: {{offerPrice}} vs {{avgPrice}} PLN/m² ({{sign}}{{percent}}%)',
      bodyTemplate:
        '{{intro}}\n\nWe present an exceptional {{propertyType}} for {{transaction}}, located in the heart of: {{location}}. The property is {{condition}}, making it a highly attractive offer.\n\n{{neighborhoodSection}}\n{{randomPoi}}\n{{enrichedPoi}}\n\n{{marketSection}}\n{{marketHeader}}\n{{marketNarrative}}{{marketSpread}}\n\n{{amenitiesSection}}\n{{amenitiesText}}\n\n{{parametersSection}}{{bullets}}\n\nContact us to arrange a private viewing.',
    },
    footerHint:
      'The first photo is the cover on lists — drag thumbnails to reorder. Use good light and clear framing; a floor plan builds trust in the layout. The description complements form data and should reflect the actual property (including when using AI suggestions).',
    alerts: {
      photoAccess: {
        title: 'Photo access',
        message:
          'To add photos to your listing, allow EstateOS access to your photo library (Settings → EstateOS → Photos).',
      },
      photoLimit: {
        title: 'Photo limit',
        message: 'Maximum limit of 20 photos reached.',
      },
      storageLimit: {
        title: 'Storage limit',
      },
      storagePickerBudget:
        'This photo set is too large at this stage (upload limit {{uploadMb}} MB).\nLarge HEIC files are converted on device first — remove some photos or add them one at a time.\n(The {{reserveMb}} MB reserve is for conversion only and does not increase the server upload limit.)',
      storageUploadCap:
        'After conversion (e.g. HEIC→JPEG) the set exceeds the {{uploadMb}} MB upload limit.\nRemove some photos or choose smaller files.',
      addPhotosFailed: {
        title: 'Could not add photos',
        message: 'Check photo library access and try again.',
      },
      floorPlanFailed: {
        title: 'Could not upload floor plan',
        message: 'Check photo access and try again.',
      },
    },
  },

  step6: {
    noPhotos: 'No photos in listing',
    rentLabel: 'Monthly rent (total)',
    depositLabel: 'Deposit {{amount}} PLN',
    adminFeeLabel: 'Admin fee ~ {{amount}} PLN',
    commissionSummary: {
      label: 'Commission:',
      zero: 'no commission (0%)',
      amountUnderOne: '< 1 PLN',
    },
    transactionPill: {
      rent: 'RENT',
      sell: 'SALE',
    },
    location: {
      label: 'Location',
      publicAddress: 'Public address',
      hiddenApprox: 'Hidden (~200 m area)',
      hiddenWithArea: '{{street}} · number hidden (~200 m area)',
    },
    mapPreview: {
      title: 'MAP PREVIEW',
      markerTitle: 'Listing location',
      exactCaption: 'Exact point — perspective view (3D buildings)',
      approximateCaption:
        'Area ~{{radius}} m · center shifted randomly (building lies somewhere inside the circle)',
    },
    commission: {
      badge: 'EstateOS™ Agent',
      titleDefault: 'Your commission',
      titleZero: 'No-commission listing',
      subtitleZeroPrefix: 'Buyers',
      subtitleZeroHighlight: 'pay no commission',
      subtitleZeroSuffix:
        'on this listing. A “No commission” note will appear on the listing — it builds trust and attracts attention.',
      subtitleDefaultPrefix: 'The listing price stays unchanged. Buyers will see a note that',
      subtitleDefaultSuffix:
        'of the price is your commission — paid directly to the agent after the transaction closes.',
      subtitleVatNote:
        'The amount is GROSS (includes VAT) — buyers do not pay any additional tax or fees.',
    },
    sections: {
      parameters: 'PROPERTY PARAMETERS',
      media: 'MEDIA & MATERIALS',
      amenities: 'AMENITIES',
      description: 'AI / CUSTOM DESCRIPTION',
    },
    badges: {
      type: 'Type',
      area: 'Floor area',
      rooms: 'Rooms',
      roomsValue: '{{count}} rm.',
      floor: 'Floor',
      yearBuilt: 'Year built',
      adminFee: 'Admin fee',
      heating: 'Heating',
      furnished: 'Furnished',
      totalFloors: 'Building floors',
      plot: 'Plot',
      condition: 'Condition',
    },
    propertyType: {
      flat: 'Apartment',
      house: 'House',
      plot: 'Plot',
      premises: 'Commercial unit',
      fallback: 'Property',
    },
    condition: {
      ready: 'Move-in ready',
      renovation: 'To renovate',
      developer: 'Developer standard',
    },
    amenities: {
      balcony: 'Balcony / terrace',
      parking: 'Parking',
      storage: 'Storage / cellar',
      elevator: 'Elevator',
      garden: 'Garden',
      twoLevel: 'Two-level',
      furnished: 'Furnished',
    },
    mediaSummary: 'Photos: {{photos}} · Floor plan: {{floorPlan}} · Video: {{video}}',
    mediaYes: 'yes',
    mediaNo: 'no',
    validationHint: 'Missing data in step {{steps}} — tap the button to go back and complete it.',
    plusCreditHint: 'You have Plus credit — publishing will use 1 credit (no second store charge).',
    couponPublishHint:
      'You have {{count}} publication coupon(s) — after “Publish”, pick a coupon (e.g. birthday) so Plus credit is not used.',
    publicationChoice: {
      title: 'How do you want to publish?',
      subtitle: 'Use a bonus coupon for publication or pay with a Plus Package credit.',
      couponPriorityHint:
        'You have active coupons — the first one is selected by default. Pick a coupon to keep your Plus credit.',
      couponsSection: 'Bonus coupons',
      couponsEmpty: 'No active publication coupons.',
      plusSection: 'Plus Package',
      plusCreditTitle: 'Use Plus credit',
      plusCreditSubtitle: 'On account: {{count}} publications available',
      buyPlusTitle: 'Buy Plus Package',
      buyPlusSubtitle: 'Pay for one listing in the App Store (~{{price}})',
      publish: 'Publish listing',
    },
    publish: {
      publishing: 'Publishing...',
      publish: 'Publish to ecosystem',
      completeData: 'Complete listing details',
      editData: 'Go back and edit',
      creating: 'Creating listing in database...',
      convertingPhoto: 'Converting photo {{current}} (HEIC ➜ JPG)...',
      uploadingPhoto: 'Uploading photo {{current}} of {{total}}...',
      convertingFloorPlan: 'Converting floor plan (HEIC ➜ JPG)...',
      uploadingFloorPlan: 'Uploading floor plan...',
      uploadingFloorPlan3d: 'Uploading 3D walkthrough…',
    },
    defaultTitle: {
      flatRest: 'Apartment — {{locality}}',
      propertyRest: 'Property — {{locality}}',
      flatCity: 'Apartment in {{city}}',
      propertyCity: 'Property in {{city}}',
      defaultCity: 'Warsaw',
      defaultCountry: 'Poland',
      defaultDistrict: 'Śródmieście',
    },
    alerts: {
      agentCommission: {
        title: 'Agent commission',
      },
      congratulations: {
        title: 'Congratulations! 🎉',
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
        connectionFallback: 'A connection problem occurred.',
        serverError: 'Server error while publishing the listing',
        uploadRejected: 'Rejected by server',
        uploadUnknown: 'Unknown upload error',
        floorPlanUnknown: 'Unknown floor plan error',
        photoError: 'Photo {{index}}: {{message}}',
        floorPlanError: 'Floor plan: {{message}}',
      },
    },
  },
};
