import type { LegalDocumentContent, LegalLocale } from '@/content/legal/types';

const LOCALE_LINKS: Record<LegalLocale, { label: string; href: string }[]> = {
  pl: [
    { label: 'English', href: '/polityka-prywatnosci/en' },
    { label: 'Українська', href: '/polityka-prywatnosci/uk' },
  ],
  en: [
    { label: 'Polski', href: '/polityka-prywatnosci' },
    { label: 'Українська', href: '/polityka-prywatnosci/uk' },
  ],
  uk: [
    { label: 'Polski', href: '/polityka-prywatnosci' },
    { label: 'English', href: '/polityka-prywatnosci/en' },
  ],
};

const RELATED_TERMS: Record<LegalLocale, { label: string; href: string }[]> = {
  pl: [
    { label: 'Regulamin (PL)', href: '/regulamin' },
    { label: 'Terms of Service (EN)', href: '/regulamin/en' },
    { label: 'Умови користування (UK)', href: '/regulamin/uk' },
  ],
  en: [
    { label: 'Terms of Service (EN)', href: '/regulamin/en' },
    { label: 'Regulamin (PL)', href: '/regulamin' },
    { label: 'Умови користування (UK)', href: '/regulamin/uk' },
  ],
  uk: [
    { label: 'Умови користування (UK)', href: '/regulamin/uk' },
    { label: 'Regulamin (PL)', href: '/regulamin' },
    { label: 'Terms of Service (EN)', href: '/regulamin/en' },
  ],
};

const PL: LegalDocumentContent = {
  locale: 'pl',
  metaTitle: 'Polityka prywatności | EstateOS™',
  metaDescription:
    'Polityka prywatności EstateOS™ — jak przetwarzamy dane osobowe w mapie, ogłoszeniach, Radarze, CRM, płatnościach i aplikacji mobilnej.',
  canonical: 'https://estateos.pl/polityka-prywatnosci',
  title: 'Polityka prywatności EstateOS™',
  updatedLabel: 'Ostatnia aktualizacja:',
  updated: '26 czerwca 2026 r.',
  intro:
    'Niniejsza Polityka prywatności opisuje, w jaki sposób **EstateOS™** („my”, „nas”, „Administrator”) przetwarza dane osobowe podczas korzystania ze strony estateos.pl, aplikacji mobilnej oraz powiązanych usług (łącznie: „Usługi”). Korzystając z Usług, akceptujesz niniejszą Politykę. Jeśli się nie zgadzasz, nie korzystaj z Usług.',
  sections: [
    {
      title: '1. Administrator danych i kontakt',
      paragraphs: [
        'Administratorem danych osobowych zbieranych za pośrednictwem Usług jest podmiot prowadzący serwis EstateOS™. W sprawach prywatności i realizacji praw: privacy@estateos.pl. W sprawach ogólnych: kontakt@estateos.pl.',
        'Jeżeli powołamy inspektora ochrony danych (IOD), jego dane kontaktowe zostaną opublikowane w tej Polityce.',
      ],
    },
    {
      title: '2. Zakres Usług objętych Polityką',
      paragraphs: ['Polityka obejmuje przetwarzanie danych w związku z:'],
      bullets: [
        'mapą i wyszukiwaniem ofert nieruchomości;',
        'publikacją i zarządzaniem ogłoszeniami;',
        'Radarem Inwestycji, alertami i narzędziami analitycznymi;',
        'CRM biura, planami partnerskimi i importem z portali (/dolacz);',
        'Open House, wiadomościami i kontaktem między użytkownikami;',
        'weryfikacją kont, moderacją i panelem administracyjnym;',
        'subskrypcjami (Investor Pro, plany Partner), płatnościami Stripe oraz zakupami w aplikacji (IAP);',
        'powiadomieniami push, e-mail i analityką produktową.',
      ],
    },
    {
      title: '3. Kategorie przetwarzanych danych',
      paragraphs: ['W zależności od sposobu korzystania z Usług możemy przetwarzać:'],
      bullets: [
        '**Dane identyfikacyjne i kontaktowe** — imię i nazwisko, adres e-mail, numer telefonu, dane firmy/biura (nazwa, NIP, adres), identyfikatory konta.',
        '**Dane uwierzytelniające** — hasła (w formie zahashowanej), tokeny sesji, klucze Passkey, identyfikatory urządzeń i tokeny push.',
        '**Treści użytkownika** — opisy ogłoszeń, zdjęcia, metadane nieruchomości, wiadomości, profile agentów i biur, materiały importowane z portali.',
        '**Dane lokalizacyjne** — współrzędne GPS lub przybliżona lokalizacja urządzenia przy korzystaniu z mapy, „Zlokalizuj mnie” lub funkcji opartych na położeniu, zgodnie z ustawieniami urządzenia i zgodą.',
        '**Dane transakcyjne** — informacje o planach, subskrypcjach, identyfikatory płatności Stripe lub sklepów aplikacji (bez przechowywania pełnych numerów kart po stronie EstateOS, o ile nie wskazano inaczej).',
        '**Dane techniczne i analityczne** — adres IP, typ przeglądarki/urządzenia, system operacyjny, logi diagnostyczne, zdarzenia w aplikacji, pliki cookies i podobne technologie.',
        '**Dane moderacyjne** — zgłoszenia naruszeń, historia decyzji moderacyjnych, status PENDING ofert, wyniki weryfikacji.',
      ],
    },
    {
      title: '4. Cele i podstawy prawne przetwarzania (RODO)',
      paragraphs: ['Przetwarzamy dane osobowe w następujących celach:'],
      bullets: [
        '**Świadczenie Usług i wykonanie umowy** (art. 6 ust. 1 lit. b RODO) — rejestracja, logowanie, publikacja ogłoszeń, CRM, Radar, wiadomości, Open House.',
        '**Prawnie uzasadniony interes** (art. 6 ust. 1 lit. f RODO) — bezpieczeństwo, zapobieganie nadużyciom, moderacja, dochodzenie roszczeń, analityka produktowa w rozsądnym zakresie, utrzymanie i rozwój Platformy.',
        '**Zgoda** (art. 6 ust. 1 lit. a RODO) — opcjonalna lokalizacja, niektóre powiadomienia marketingowe, opcjonalne cookies analityczne, jeśli wymagane.',
        '**Obowiązek prawny** (art. 6 ust. 1 lit. c RODO) — rozliczenia podatkowe, odpowiedzi organom, przechowywanie danych księgowych.',
        'Możesz wnieść sprzeciw wobec przetwarzania opartego na prawnie uzasadnionym interesie — patrz sekcja o prawach.',
      ],
    },
    {
      title: '5. Pliki cookies i technologie podobne',
      paragraphs: [
        'Strona internetowa może używać plików cookies i podobnych technologii w celu utrzymania sesji, zapamiętania preferencji językowych, zapewnienia bezpieczeństwa oraz — za Twoją zgodą, jeśli wymagana — analityki ruchu.',
        'Możesz zarządzać cookies w ustawieniach przeglądarki. Wyłączenie niezbędnych cookies może ograniczyć działanie niektórych funkcji.',
        'Aplikacja mobilna może używać lokalnego magazynu urządzenia i identyfikatorów systemowych zgodnie z politykami Apple i Google.',
      ],
    },
    {
      title: '6. Lokalizacja i dane geoprzestrzenne',
      paragraphs: [
        'Dane lokalizacyjne mogą być przetwarzane, gdy korzystasz z mapy, wyszukiwania w pobliżu, kalibracji Radaru lub innych funkcji opartych na położeniu. Precyzyjna lokalizacja jest zbierana tylko za Twoją zgodą w ustawieniach urządzenia lub przeglądarki.',
        'Współrzędne nieruchomości w ogłoszeniach pochodzą z danych podanych przez publikującego i mogą być widoczne dla innych użytkowników zgodnie z ustawieniami oferty.',
      ],
    },
    {
      title: '7. Udostępnianie danych',
      paragraphs: ['Możemy udostępniać dane osobowe:'],
      bullets: [
        '**Podmiotom przetwarzającym** — hosting, e-mail, analityka, wsparcie techniczne, Stripe (płatności online), dostawcy map (np. Mapbox), infrastruktura push — na podstawie umów powierzenia i środków bezpieczeństwa.',
        '**Innym użytkownikom** — gdy publikujesz ogłoszenie, profil agenta/biura, wysyłasz wiadomość lub organizujesz Open House.',
        '**Organom publicznym** — gdy wymaga tego prawo lub jest to konieczne do ochrony praw i bezpieczeństwa.',
        '**Następcom prawnym** — w przypadku reorganizacji, przy zachowaniu gwarancji zgodnych z RODO.',
        'Nie sprzedajemy Twoich danych osobowych.',
      ],
    },
    {
      title: '8. Przekazywanie danych poza EOG',
      paragraphs: [
        'Niektórzy dostawcy (np. infrastruktura chmurowa, Apple, Google, Stripe) mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym. W takich przypadkach stosujemy odpowiednie zabezpieczenia przewidziane RODO, np. standardowe klauzule umowne Komisji Europejskiej.',
      ],
    },
    {
      title: '9. Okres przechowywania danych',
      paragraphs: [
        'Dane przechowujemy tak długo, jak jest to konieczne do świadczenia Usług, realizacji umowy, wypełnienia obowiązków prawnych oraz obrony przed roszczeniami.',
        'Po usunięciu konta dane mogą być anonimizowane lub usuwane z opóźnieniem technicznym i prawnym (np. kopie zapasowe, rozliczenia, moderacja). Ogłoszenia mogą być zarchiwizowane w celach dowodowych przez ograniczony czas.',
      ],
    },
    {
      title: '10. Bezpieczeństwo danych',
      paragraphs: [
        'Stosujemy środki techniczne i organizacyjne mające na celu ochronę danych, w tym szyfrowanie transmisji (HTTPS), kontrolę dostępu, hashowanie haseł i monitoring bezpieczeństwa. Żadna metoda transmisji lub przechowywania nie jest w pełni bezpieczna.',
      ],
    },
    {
      title: '11. Twoje prawa (RODO)',
      paragraphs: [
        'Jeżeli przetwarzanie podlega RODO, przysługują Ci m.in. prawa: dostępu, sprostowania, usunięcia („prawo do bycia zapomnianym”), ograniczenia przetwarzania, przenoszenia danych, sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie oraz wycofania zgody w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania przed wycofaniem).',
        'Aby skorzystać z praw, napisz na privacy@estateos.pl. Odpowiemy bez zbędnej zwłoki, nie później niż w terminach wynikających z RODO.',
        'Masz prawo wnieść skargę do organu nadzorczego — w Polsce: Prezes Urzędu Ochrony Danych Osobowych (UODO), ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl.',
      ],
    },
    {
      title: '12. Dzieci',
      paragraphs: [
        'Usługi nie są skierowane do dzieci poniżej wieku wymagającego zgody rodzica na przetwarzanie danych w Twoim regionie. Świadomie nie zbieramy danych takich osób.',
      ],
    },
    {
      title: '13. Usługi stron trzecich',
      paragraphs: [
        'Usługi mogą zawierać linki lub integracje z podmiotami trzecimi (portale ogłoszeniowe, mapy, sklepy aplikacji). Ich przetwarzanie danych regulują własne polityki.',
        'Płatności mobilne i dystrybucja aplikacji mogą podlegać politykom Apple App Store i Google Play. Stripe przetwarza dane płatnicze zgodnie ze swoją polityką prywatności.',
      ],
    },
    {
      title: '14. Zmiany Polityki',
      paragraphs: [
        'Możemy aktualizować niniejszą Politykę. Zaktualizowaną wersję opublikujemy na tej stronie wraz z datą „Ostatnia aktualizacja”. O istotnych zmianach poinformujemy w sposób odpowiedni do Usług.',
      ],
    },
    {
      title: '15. Kontakt',
      paragraphs: [
        'Pytania dotyczące prywatności i danych osobowych: privacy@estateos.pl. Reklamacje ogólne: kontakt@estateos.pl.',
      ],
    },
  ],
  relatedLinks: RELATED_TERMS.pl,
  localeLinks: LOCALE_LINKS.pl,
};

const EN: LegalDocumentContent = {
  locale: 'en',
  metaTitle: 'Privacy Policy | EstateOS™',
  metaDescription:
    'EstateOS™ Privacy Policy — how we process personal data across map, listings, Radar, CRM, payments, and the mobile app.',
  canonical: 'https://estateos.pl/polityka-prywatnosci/en',
  title: 'Privacy Policy — EstateOS™',
  updatedLabel: 'Last updated:',
  updated: '26 June 2026',
  intro:
    'This Privacy Policy describes how **EstateOS™** (“we”, “us”, “our”) processes personal information when you use the estateos.pl website, mobile applications, and related services (together, the “Services”). By using the Services, you agree to this Privacy Policy. If you do not agree, please do not use the Services.',
  sections: [
    {
      title: '1. Data controller and contact',
      paragraphs: [
        'The data controller for personal information collected through the Services is the operator of EstateOS™. For privacy and rights requests: privacy@estateos.pl. General inquiries: kontakt@estateos.pl.',
        'If we appoint a Data Protection Officer (DPO), contact details will be published in this Policy.',
      ],
    },
    {
      title: '2. Services covered by this Policy',
      paragraphs: ['This Policy covers data processing related to:'],
      bullets: [
        'property map and listing search;',
        'listing publication and management;',
        'Investment Radar, alerts, and analytics tools;',
        'agency CRM, partner plans, and portal import (/dolacz);',
        'Open House, messaging, and user-to-user contact;',
        'account verification, moderation, and admin tools;',
        'subscriptions (Investor Pro, Partner plans), Stripe payments, and in-app purchases (IAP);',
        'push notifications, email, and product analytics.',
      ],
    },
    {
      title: '3. Categories of personal information',
      paragraphs: ['Depending on how you use the Services, we may process:'],
      bullets: [
        '**Identifiers and contact data** — name, email, phone number, company/agency details (name, tax ID, address), account IDs.',
        '**Authentication data** — passwords (hashed), session tokens, Passkeys, device identifiers, push tokens.',
        '**User content** — listing descriptions, photos, property metadata, messages, agent/agency profiles, portal-imported materials.',
        '**Location data** — GPS or approximate device location when using the map, “Locate me”, or location-based features, per device settings and consent.',
        '**Transaction data** — plan/subscription info, Stripe or app store payment identifiers (we do not store full card numbers on EstateOS unless stated otherwise).',
        '**Technical and analytics data** — IP address, browser/device type, OS, diagnostic logs, in-app events, cookies and similar technologies.',
        '**Moderation data** — abuse reports, moderation history, PENDING listing status, verification outcomes.',
      ],
    },
    {
      title: '4. Purposes and legal bases (GDPR)',
      paragraphs: ['We process personal information to:'],
      bullets: [
        '**Provide Services and perform our contract** (Art. 6(1)(b) GDPR) — registration, login, listings, CRM, Radar, messaging, Open House.',
        '**Legitimate interests** (Art. 6(1)(f) GDPR) — security, abuse prevention, moderation, claims, reasonable product analytics, Platform maintenance and development.',
        '**Consent** (Art. 6(1)(a) GDPR) — optional location, certain marketing notifications, optional analytics cookies where required.',
        '**Legal obligation** (Art. 6(1)(c) GDPR) — tax/accounting, responses to authorities, mandatory record-keeping.',
        'You may object to processing based on legitimate interests — see Your rights.',
      ],
    },
    {
      title: '5. Cookies and similar technologies',
      paragraphs: [
        'The website may use cookies and similar technologies for session management, language preferences, security, and — with your consent where required — traffic analytics.',
        'You can manage cookies in browser settings. Disabling essential cookies may limit some features.',
        'The mobile app may use on-device storage and system identifiers per Apple and Google policies.',
      ],
    },
    {
      title: '6. Location and geospatial data',
      paragraphs: [
        'Location data may be processed when you use the map, nearby search, Radar calibration, or other location-based features. Precise location is collected only with your consent in device or browser settings.',
        'Property coordinates in listings come from publisher-submitted data and may be visible to other users per listing settings.',
      ],
    },
    {
      title: '7. Sharing of personal information',
      paragraphs: ['We may share personal information with:'],
      bullets: [
        '**Processors** — hosting, email, analytics, support, Stripe (online payments), map providers (e.g. Mapbox), push infrastructure — under data processing agreements and safeguards.',
        '**Other users** — when you publish a listing, agent/agency profile, send messages, or organize Open House.',
        '**Public authorities** — when required by law or necessary to protect rights and safety.',
        '**Legal successors** — in case of reorganization, with GDPR-consistent guarantees.',
        'We do not sell your personal information.',
      ],
    },
    {
      title: '8. International transfers',
      paragraphs: [
        'Some providers (e.g. cloud infrastructure, Apple, Google, Stripe) may process data outside the EEA. We use appropriate GDPR safeguards such as EU Standard Contractual Clauses.',
      ],
    },
    {
      title: '9. Retention',
      paragraphs: [
        'We retain data as long as necessary to provide Services, perform contracts, meet legal obligations, and defend claims.',
        'After account deletion, data may be anonymized or removed with technical and legal delay (e.g. backups, billing, moderation). Listings may be archived for evidence for a limited time.',
      ],
    },
    {
      title: '10. Security',
      paragraphs: [
        'We implement technical and organizational measures including HTTPS encryption, access controls, password hashing, and security monitoring. No transmission or storage method is fully secure.',
      ],
    },
    {
      title: '11. Your rights (GDPR)',
      paragraphs: [
        'Where GDPR applies, you may have rights of access, rectification, erasure, restriction, portability, objection to legitimate-interest processing, and withdrawal of consent at any time (without affecting prior lawful processing).',
        'To exercise rights, contact privacy@estateos.pl. We respond without undue delay within GDPR timelines.',
        'You may lodge a complaint with a supervisory authority — in Poland: President of the Personal Data Protection Office (UODO), ul. Stawki 2, 00-193 Warsaw, uodo.gov.pl.',
      ],
    },
    {
      title: '12. Children',
      paragraphs: [
        'The Services are not directed to children below the age requiring parental consent for data processing in your region. We do not knowingly collect such data.',
      ],
    },
    {
      title: '13. Third-party services',
      paragraphs: [
        'The Services may include links or integrations with third parties (listing portals, maps, app stores). Their processing is governed by their own policies.',
        'Mobile payments and app distribution may be subject to Apple App Store and Google Play policies. Stripe processes payment data under its privacy policy.',
      ],
    },
    {
      title: '14. Changes',
      paragraphs: [
        'We may update this Privacy Policy. We will post the updated version on this page with the “Last updated” date. Material changes will be communicated appropriately.',
      ],
    },
    {
      title: '15. Contact',
      paragraphs: [
        'Privacy questions: privacy@estateos.pl. General complaints: kontakt@estateos.pl.',
      ],
    },
  ],
  relatedLinks: RELATED_TERMS.en,
  localeLinks: LOCALE_LINKS.en,
};

const UK: LegalDocumentContent = {
  locale: 'uk',
  metaTitle: 'Політика конфіденційності | EstateOS™',
  metaDescription:
    'Політика конфіденційності EstateOS™ — як ми обробляємо персональні дані на карті, в оголошеннях, Radar, CRM, платежах і мобільному застосунку.',
  canonical: 'https://estateos.pl/polityka-prywatnosci/uk',
  title: 'Політика конфіденційності EstateOS™',
  updatedLabel: 'Останнє оновлення:',
  updated: '26 червня 2026 р.',
  intro:
    'Ця Політика конфіденційності описує, як **EstateOS™** («ми», «нас», «Адміністратор») обробляє персональні дані під час використання вебсайту estateos.pl, мобільних застосунків та пов’язаних послуг (разом — «Послуги»). Користуючись Послугами, ви погоджуєтесь із цією Політикою. Якщо ви не погоджуєтесь, не користуйтеся Послугами.',
  sections: [
    {
      title: '1. Адміністратор даних і контакт',
      paragraphs: [
        'Адміністратором персональних даних, зібраних через Послуги, є суб’єкт, що керує EstateOS™. З питань конфіденційності та реалізації прав: privacy@estateos.pl. Загальні звернення: kontakt@estateos.pl.',
        'Якщо ми призначимо уповноваженого з захисту даних (DPO), контактні дані буде опубліковано в цій Політиці.',
      ],
    },
    {
      title: '2. Послуги, які охоплює Політика',
      paragraphs: ['Політика охоплює обробку даних у зв’язку з:'],
      bullets: [
        'картою та пошуком пропозицій нерухомості;',
        'публікацією та керуванням оголошеннями;',
        'Інвестиційним Radar, сповіщеннями та аналітикою;',
        'CRM агентства, партнерськими планами та імпортом із порталів (/dolacz);',
        'Open House, повідомленнями та контактом між користувачами;',
        'верифікацією облікових записів, модерацією та адмінінструментами;',
        'підписками (Investor Pro, плани Partner), платежами Stripe та покупками в застосунку (IAP);',
        'push-сповіщеннями, e-mail та продуктовою аналітикою.',
      ],
    },
    {
      title: '3. Категорії оброблюваних даних',
      paragraphs: ['Залежно від способу використання Послуг ми можемо обробляти:'],
      bullets: [
        '**Ідентифікаційні та контактні дані** — ім’я, e-mail, телефон, дані компанії/агентства (назва, податковий номер, адреса), ідентифікатори облікового запису.',
        '**Дані автентифікації** — паролі (у хешованому вигляді), токени сесії, Passkey, ідентифікатори пристроїв, push-токени.',
        '**Контент користувача** — описи оголошень, фото, метадані нерухомості, повідомлення, профілі агентів/агентств, матеріали з імпорту порталів.',
        '**Дані локації** — GPS або приблизне місцезнаходження пристрою під час використання карти, «Знайти мене» або функцій на основі локації, відповідно до налаштувань і згоди.',
        '**Транзакційні дані** — інформація про плани/підписки, ідентифікатори платежів Stripe або магазинів застосунків (ми не зберігаємо повні номери карток на EstateOS, якщо не зазначено інше).',
        '**Технічні та аналітичні дані** — IP-адреса, тип браузера/пристрою, ОС, діагностичні журнали, події в застосунку, cookies та подібні технології.',
        '**Дані модерації** — скарги на порушення, історія модерації, статус PENDING оголошень, результати верифікації.',
      ],
    },
    {
      title: '4. Цілі та правові підстави (GDPR)',
      paragraphs: ['Ми обробляємо персональні дані для:'],
      bullets: [
        '**Надання Послуг і виконання договору** (ст. 6(1)(b) GDPR) — реєстрація, вхід, оголошення, CRM, Radar, повідомлення, Open House.',
        '**Законного інтересу** (ст. 6(1)(f) GDPR) — безпека, запобігання зловживанням, модерація, захист претензій, розумна продуктова аналітика, підтримка та розвиток Платформи.',
        '**Згоди** (ст. 6(1)(a) GDPR) — опційна локація, окремі маркетингові сповіщення, опційні аналітичні cookies, якщо потрібно.',
        '**Правового обов’язку** (ст. 6(1)(c) GDPR) — податковий/бухгалтерський облік, відповіді органам, обов’язкове зберігання.',
        'Ви можете заперечити проти обробки на підставі законного інтересу — див. Ваші права.',
      ],
    },
    {
      title: '5. Файли cookies та подібні технології',
      paragraphs: [
        'Вебсайт може використовувати cookies для сесії, мовних налаштувань, безпеки та — за вашою згодою, якщо потрібно — аналітики трафіку.',
        'Ви можете керувати cookies у налаштуваннях браузера. Вимкнення необхідних cookies може обмежити функції.',
        'Мобільний застосунок може використовувати локальне сховище та системні ідентифікатори відповідно до політик Apple і Google.',
      ],
    },
    {
      title: '6. Локація та геопросторові дані',
      paragraphs: [
        'Дані локації можуть оброблятися під час використання карти, пошуку поблизу, калібрування Radar або інших функцій на основі місцезнаходження. Точна локація збирається лише за вашою згодою в налаштуваннях пристрою або браузера.',
        'Координати нерухомості в оголошеннях надаються видавцем і можуть бути видимі іншим користувачам відповідно до налаштувань пропозиції.',
      ],
    },
    {
      title: '7. Поширення даних',
      paragraphs: ['Ми можемо поширювати персональні дані:'],
      bullets: [
        '**Процесорам** — хостинг, e-mail, аналітика, підтримка, Stripe (онлайн-платежі), постачальники карт (наприклад, Mapbox), push-інфраструктура — на підставі договорів обробки та заходів безпеки.',
        '**Іншим користувачам** — коли ви публікуєте оголошення, профіль агента/агентства, надсилаєте повідомлення або організовуєте Open House.',
        '**Державним органам** — коли цього вимагає закон або необхідно для захисту прав і безпеки.',
        '**Правонаступникам** — у разі реорганізації, із гарантіями відповідно до GDPR.',
        'Ми не продаємо ваші персональні дані.',
      ],
    },
    {
      title: '8. Міжнародні передачі',
      paragraphs: [
        'Деякі постачальники (наприклад, хмарна інфраструктура, Apple, Google, Stripe) можуть обробляти дані за межами ЄЕЗ. Ми застосовуємо належні гарантії GDPR, зокрема стандартні договірні положення ЄС.',
      ],
    },
    {
      title: '9. Строк зберігання',
      paragraphs: [
        'Ми зберігаємо дані стільки, скільки необхідно для надання Послуг, виконання договору, дотримання закону та захисту від претензій.',
        'Після видалення облікового запису дані можуть бути анонімізовані або видалені з технічною та правовою затримкою (наприклад, резервні копії, розрахунки, модерація). Оголошення можуть архівуватися для доказових цілей обмежений час.',
      ],
    },
    {
      title: '10. Безпека даних',
      paragraphs: [
        'Ми впроваджуємо технічні та організаційні заходи, зокрема шифрування HTTPS, контроль доступу, хешування паролів і моніторинг безпеки. Жоден метод передачі чи зберігання не є повністю безпечним.',
      ],
    },
    {
      title: '11. Ваші права (GDPR)',
      paragraphs: [
        'Якщо застосовується GDPR, ви маєте права на доступ, виправлення, видалення, обмеження обробки, переносимість, заперечення проти обробки на підставі законного інтересу та відкликання згоди в будь-який час (без впливу на законність попередньої обробки).',
        'Для реалізації прав звертайтеся на privacy@estateos.pl. Ми відповідаємо без невиправданої затримки в межах строків GDPR.',
        'Ви можете подати скаргу до наглядового органу — у Польщі: Голова Управління із захисту персональних даних (UODO), ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl.',
      ],
    },
    {
      title: '12. Діти',
      paragraphs: [
        'Послуги не спрямовані на дітей молодше віку, з якого потрібна згода батьків на обробку даних у вашому регіоні. Ми свідомо не збираємо такі дані.',
      ],
    },
    {
      title: '13. Сторонні сервіси',
      paragraphs: [
        'Послуги можуть містити посилання або інтеграції з третіми сторонами (портали оголошень, карти, магазини застосунків). Їхня обробка регулюється власними політиками.',
        'Мобільні платежі та дистрибуція застосунків можуть підпадати під політики Apple App Store і Google Play. Stripe обробляє платіжні дані відповідно до своєї політики конфіденційності.',
      ],
    },
    {
      title: '14. Зміни Політики',
      paragraphs: [
        'Ми можемо оновлювати цю Політику. Оновлену версію буде опубліковано на цій сторінці з датою «Останнє оновлення». Про суттєві зміни повідомимо належним чином.',
      ],
    },
    {
      title: '15. Контакт',
      paragraphs: [
        'Питання щодо конфіденційності: privacy@estateos.pl. Загальні скарги: kontakt@estateos.pl.',
      ],
    },
  ],
  relatedLinks: RELATED_TERMS.uk,
  localeLinks: LOCALE_LINKS.uk,
};

const BY_LOCALE: Record<LegalLocale, LegalDocumentContent> = { pl: PL, en: EN, uk: UK };

export function getPrivacyContent(locale: LegalLocale): LegalDocumentContent {
  return BY_LOCALE[locale];
}
