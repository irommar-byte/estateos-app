import type { LegalDocumentContent } from '@/content/legal/types';
import { PARAGONOS_PATHS, PARAGONOS_URLS } from '@/lib/paragonOsLegal';

const RELATED_PL = [
  { label: 'Regulamin ParagonOS™', href: PARAGONOS_PATHS.termsPl },
  { label: 'Wsparcie', href: PARAGONOS_PATHS.supportPl },
];

const RELATED_EN = [
  { label: 'ParagonOS™ Terms of Use', href: PARAGONOS_PATHS.termsEn },
  { label: 'Support', href: PARAGONOS_PATHS.supportEn },
];

const PL: LegalDocumentContent = {
  locale: 'pl',
  metaTitle: 'Polityka prywatności ParagonOS™',
  metaDescription:
    'Polityka prywatności aplikacji iOS ParagonOS™ — kaucje, paragony i karty lojalnościowe. Dokument dotyczy wyłącznie tej aplikacji.',
  canonical: PARAGONOS_URLS.privacyPl,
  title: 'Polityka prywatności ParagonOS™',
  updatedLabel: 'Ostatnia aktualizacja:',
  updated: '12 września 2026 r.',
  intro:
    'Niniejsza Polityka prywatności opisuje, w jaki sposób przetwarzane są dane osobowe w **aplikacji mobilnej ParagonOS™ na iOS** (bundle `pl.paragonos.app`, dalej: „Aplikacja”). Dokument **nie dotyczy** serwisu nieruchomości EstateOS™ ani innych produktów. Korzystając z Aplikacji, akceptujesz tę Politykę. Jeśli się nie zgadzasz, nie korzystaj z Aplikacji.',
  sections: [
    {
      title: '1. Administrator danych i kontakt',
      paragraphs: [
        'Administratorem danych osobowych przetwarzanych w związku z Aplikacją jest operator ParagonOS™. W sprawach prywatności, realizacji praw wynikających z RODO oraz skarg: kontakt@estateos.pl.',
        'Adres e-mail kontakt@estateos.pl jest skrzynką operatora Aplikacji. Korespondencję dotyczącą ParagonOS™ oznacz w tytule: „ParagonOS”.',
      ],
    },
    {
      title: '2. Zakres — wyłącznie ParagonOS™',
      paragraphs: [
        'Polityka obejmuje wyłącznie Aplikację: portfel kwitków kaucyjnych z butelkomatów, paragonów fiskalnych oraz kart lojalnościowych, w tym mapę punktów zwrotu, przypomnienia o terminach, udostępnianie rodzinie przez iCloud oraz opcjonalne dodanie karty do Apple Wallet.',
        'Ogłoszenia nieruchomości, konta na estateos.pl, CRM, płatności portalowe i inne funkcje EstateOS™ są regulowane odrębnymi dokumentami i **nie wchodzą** w zakres tej Polityki.',
      ],
    },
    {
      title: '3. Charakter przetwarzania',
      paragraphs: [
        'Aplikacja **nie prowadzi własnego serwera kont** i nie wymaga rejestracji loginem ani hasłem u operatora. Tożsamość użytkownika stanowi Apple ID (konto Apple na urządzeniu).',
        'Treści, które tworzysz (zdjęcia skanów, odczyt OCR, numery kodów, kwoty, daty, notatki, wyświetlana nazwa), są zapisywane **na urządzeniu**. Gdy włączysz iCloud, mogą być synchronizowane w Twojej **prywatnej** chmurze Apple (CloudKit, kontener `iCloud.pl.paragonos.app`). Operator Aplikacji nie ma dostępu do treści prywatnej bazy CloudKit użytkownika.',
      ],
    },
    {
      title: '4. Kategorie danych',
      paragraphs: ['W zależności od tego, z których funkcji korzystasz, mogą być przetwarzane:'],
      bullets: [
        '**Treści użytkownika** — zdjęcia kwitków, paragonów i kart; tekst OCR; numery kodów kreskowych i QR; kwoty i daty; notatki; przypisanie do sieci handlowej wybranej przez Ciebie.',
        '**Imię lub wyświetlana nazwa** — jeśli ją podasz, m.in. przy udostępnianiu rodzinie.',
        '**Dane lokalizacyjne** — przybliżona lub dokładna lokalizacja urządzenia, wyłącznie gdy wyrazisz zgodę systemową i otworzysz mapę punktów zwrotu kaucji. Lokalizacja służy do sortowania wyników na urządzeniu.',
        '**Identyfikatory Apple / iCloud** — w zakresie niezbędnym do synchronizacji i udostępniania (CKShare) po Twojej decyzji.',
        '**Dane techniczne urządzenia** — w zakresie wynikającym z działania iOS (np. uprawnienia kamery, zdjęć, powiadomień, Face ID wyłącznie lokalnie).',
      ],
    },
    {
      title: '5. Cele i podstawy prawne (RODO)',
      paragraphs: ['Dane przetwarzamy w następujących celach:'],
      bullets: [
        'świadczenie Aplikacji (zapis i wyświetlanie kaucji, paragonów i kart, kody przy kasie, przypomnienia) — art. 6 ust. 1 lit. b RODO (wykonanie umowy o korzystanie z Aplikacji) oraz lit. f (prawnie uzasadniony interes: poprawne działanie funkcji, które włączasz);',
        'lokalizacja na mapie punktów zwrotu — art. 6 ust. 1 lit. a RODO (zgoda systemowa iOS, którą możesz wycofać w Ustawieniach iPhone’a);',
        'synchronizacja i udostępnianie rodzinie przez iCloud — art. 6 ust. 1 lit. b oraz lit. a (Twoje świadome włączenie iCloud / zaproszenie);',
        'dodanie karty do Apple Wallet — art. 6 ust. 1 lit. b, na Twoje żądanie, za pośrednictwem PassKit na urządzeniu;',
        'odpowiedź na zgłoszenie na kontakt@estateos.pl — art. 6 ust. 1 lit. c (obowiązki prawne, w tym RODO) oraz lit. f;',
        'ustalenie, dochodzenie lub obrona roszczeń — art. 6 ust. 1 lit. f RODO.',
      ],
    },
    {
      title: '6. Aparat, zdjęcia i Face ID',
      paragraphs: [
        'Aparat i biblioteka zdjęć służą wyłącznie do skanowania kwitka, paragonu lub karty lojalnościowej albo wczytania zdjęcia, gdy skaner na żywo jest niedostępny. Nie używamy ich do profilowania reklamowego.',
        'Face ID / Touch ID — jeśli włączysz blokadę Aplikacji — działa **wyłącznie na urządzeniu**. Danych biometrycznych nie wysyłamy i nie zapisujemy poza mechanizmami Apple na iPhonie.',
      ],
    },
    {
      title: '7. Lokalizacja i mapa punktów zwrotu',
      paragraphs: [
        'Mapa butelkomatów i sklepów z kaucją korzysta z publicznych zbiorów: MapaKaucji.pl (pobierany jest katalog punktów, bez wysyłania Twojego adresu zamieszkania) oraz OpenStreetMap / Overpass API. Przy zapytaniu do Overpass przekazywany jest **obszar mapy (bounding box)** aktualnego widoku, a nie nazwa ulicy.',
        'Możesz odmówić zgody na lokalizację; Aplikacja nadal działa bez mapy „w pobliżu”.',
      ],
    },
    {
      title: '8. Apple Wallet (PassKit)',
      paragraphs: [
        'Jeśli wybierzesz „Dodaj do Apple Wallet”, karta lojalnościowa jest składana i podpisywana na urządzeniu, a następnie przekazywana do systemowego Wallet przez PassKit. Operator nie prowadzi własnego serwera passów użytkowników i nie otrzymuje kopii Twojej karty w celu hostowania jej poza Aplikacją i Twoim iCloud.',
      ],
    },
    {
      title: '9. Powiadomienia',
      paragraphs: [
        'Przypomnienia o końcu ważności kaucji, gwarancji lub zwrotu są planowane lokalnie na urządzeniu (powiadomienia iOS), po Twojej zgodzie. Nie budujemy na ich podstawie profilu reklamowego.',
      ],
    },
    {
      title: '10. Rodzina (iCloud)',
      paragraphs: [
        'Udostępnianie kaucji, paragonów i kart osobom zaproszonym odbywa się przez mechanizmy Apple (CloudKit Share). Widzą je wyłącznie osoby, które przyjmą zaproszenie. Operator nie moderuje treści rodzinnych i nie ma do nich wglądu.',
      ],
    },
    {
      title: '11. Odbiorcy i podmioty przetwarzające',
      paragraphs: ['Odbiorcami danych — w zakresie niezbędnym do działania funkcji, które włączasz — mogą być:'],
      bullets: [
        '**Apple** — system iOS, iCloud / CloudKit, powiadomienia, PassKit / Apple Wallet, App Store, zgodnie z politykami Apple;',
        '**OpenStreetMap / Overpass** — zapytanie o punkty na obszarze mapy;',
        '**MapaKaucji.pl** — publiczny katalog automatów (bez Twojego profilu).',
      ],
    },
    {
      title: '12. Przekazanie poza EOG',
      paragraphs: [
        'Apple może przetwarzać dane w państwach poza Europejskim Obszarem Gospodarczym na zasadach określonych przez Apple (w tym standardowe klauzule umowne). Korzystając z iCloud, Apple Wallet lub App Store, akceptujesz również zasady Apple.',
      ],
    },
    {
      title: '13. Okres przechowywania',
      paragraphs: [
        'Dane w Aplikacji przechowujesz, dopóki ich nie usuniesz lub nie odinstalujesz Aplikacji. Dane w iCloud — zgodnie z ustawieniami Twojego Apple ID. Korespondencję na kontakt@estateos.pl przechowujemy przez okres niezbędny do obsługi sprawy oraz wynikający z przedawnienia roszczeń lub obowiązków prawnych.',
      ],
    },
    {
      title: '14. Twoje prawa',
      paragraphs: [
        'Przysługuje Ci prawo dostępu, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, sprzeciwu oraz cofnięcia zgody (gdy przetwarzanie opiera się na zgodzie), a także skargi do Prezesa UODO (uodo.gov.pl).',
        'Treści w Aplikacji usuwasz bezpośrednio na urządzeniu (np. usunięcie karty, paragonu, kaucji) albo odinstalowując Aplikację i wyłączając iCloud dla ParagonOS™. W pozostałych sprawach napisz na kontakt@estateos.pl, podając w tytule „ParagonOS”.',
      ],
    },
    {
      title: '15. Dzieci',
      paragraphs: [
        'Aplikacja nie jest przeznaczona dla dzieci poniżej 13. roku życia i nie uczestniczy w programie Apple „Made for Kids”. Nie zbieramy świadomie danych dzieci.',
      ],
    },
    {
      title: '16. Brak śledzenia i reklam',
      paragraphs: [
        'Nie sprzedajemy danych osobowych. Nie wykorzystujemy ich do reklam behawioralnych. Nie stosujemy App Tracking Transparency, ponieważ nie śledzimy Cię między aplikacjami i stronami internetowymi w rozumieniu wytycznych Apple.',
      ],
    },
    {
      title: '17. Zmiany Polityki',
      paragraphs: [
        'Zaktualizowaną wersję publikujemy pod tym samym adresem URL z nową datą. Istotne zmiany ogłosimy w Aplikacji albo na stronie wsparcia, o ile będzie to proporcjonalne.',
      ],
    },
    {
      title: '18. Kontakt',
      paragraphs: [
        'Pytania o prywatność ParagonOS™: kontakt@estateos.pl (tytuł: „ParagonOS — prywatność”).',
      ],
    },
  ],
  relatedLinks: RELATED_PL,
  localeLinks: [{ label: 'English', href: PARAGONOS_PATHS.privacyEn }],
};

const EN: LegalDocumentContent = {
  locale: 'en',
  metaTitle: 'ParagonOS™ Privacy Policy',
  metaDescription:
    'Privacy Policy for the ParagonOS™ iOS app — bottle-return tickets, receipts and loyalty cards. This document applies only to that app.',
  canonical: PARAGONOS_URLS.privacyEn,
  title: 'ParagonOS™ Privacy Policy',
  updatedLabel: 'Last updated:',
  updated: '12 September 2026',
  intro:
    'This Privacy Policy explains how personal data is processed in the **ParagonOS™ iOS application** (bundle ID `pl.paragonos.app`, the “App”). It **does not** apply to the EstateOS™ real-estate service or any other product. By using the App, you accept this Policy. If you do not agree, do not use the App.',
  sections: [
    {
      title: '1. Controller and contact',
      paragraphs: [
        'The data controller for personal data processed in connection with the App is the operator of ParagonOS™. For privacy, GDPR rights requests and complaints: kontakt@estateos.pl.',
        'kontakt@estateos.pl is the operator’s inbox. Please put “ParagonOS” in the subject line.',
      ],
    },
    {
      title: '2. Scope — ParagonOS™ only',
      paragraphs: [
        'This Policy covers only the App: a wallet for bottle-return tickets, fiscal receipts and loyalty cards, including a map of return points, deadline reminders, optional family sharing via iCloud, and optional add-to-Apple-Wallet.',
        'Property listings, estateos.pl accounts, CRM, portal payments and other EstateOS™ features are governed by separate documents and are **outside** this Policy.',
      ],
    },
    {
      title: '3. How processing works',
      paragraphs: [
        'The App **does not operate its own account server** and does not require a login or password with the operator. Your identity is your Apple ID on the device.',
        'Content you create (scan photos, OCR text, barcode/QR payloads, amounts, dates, notes, display name) is stored **on device**. If you enable iCloud, it may sync in **your** private Apple cloud (CloudKit, container `iCloud.pl.paragonos.app`). The App operator cannot read the contents of your private CloudKit database.',
      ],
    },
    {
      title: '4. Categories of data',
      paragraphs: ['Depending on the features you use, we may process:'],
      bullets: [
        '**User content** — photos of tickets, receipts and cards; OCR text; barcode and QR values; amounts and dates; notes; the retailer you assign.',
        '**Name / display name** — if you provide one, including for family sharing.',
        '**Location data** — approximate or precise device location only if you grant the iOS permission and open the bottle-return map. Location is used on-device to sort nearby results.',
        '**Apple / iCloud identifiers** — as needed for sync and sharing (CKShare) after you opt in.',
        '**Device technical data** — as required by iOS (camera, photos, notifications, Face ID locally only).',
      ],
    },
    {
      title: '5. Purposes and legal bases (GDPR)',
      paragraphs: ['We process data to:'],
      bullets: [
        'provide the App (store and display tickets, receipts and cards, till codes, reminders) — GDPR Art. 6(1)(b) (performance of the contract to use the App) and Art. 6(1)(f) (legitimate interest in running features you enable);',
        'show nearby return points — Art. 6(1)(a) (iOS system permission, which you can withdraw in iPhone Settings);',
        'sync and share with family via iCloud — Art. 6(1)(b) and Art. 6(1)(a) (your decision to enable iCloud / send an invite);',
        'add a card to Apple Wallet — Art. 6(1)(b), at your request, via PassKit on the device;',
        'answer mail to kontakt@estateos.pl — Art. 6(1)(c) (legal duties, including GDPR) and Art. 6(1)(f);',
        'establish, exercise or defend legal claims — Art. 6(1)(f).',
      ],
    },
    {
      title: '6. Camera, photos and Face ID',
      paragraphs: [
        'The camera and photo library are used only to scan a ticket, receipt or loyalty card, or to import a photo when live scanning is unavailable. They are not used for advertising profiles.',
        'Face ID / Touch ID — if you enable the in-app lock — runs **only on the device**. Biometric data is not sent to us or stored outside Apple’s on-device mechanisms.',
      ],
    },
    {
      title: '7. Location and return-point map',
      paragraphs: [
        'The map uses public datasets: MapaKaucji.pl (a catalogue of machines is downloaded; your home address is not sent) and OpenStreetMap / Overpass API. Overpass receives a **map bounding box** for the current view, not a street address.',
        'You may refuse location permission; the App still works without “nearby” map results.',
      ],
    },
    {
      title: '8. Apple Wallet (PassKit)',
      paragraphs: [
        'If you choose Add to Apple Wallet, the loyalty pass is assembled and signed on the device and handed to system Wallet via PassKit. The operator does not run a user-pass hosting server and does not receive a copy of your card in order to host it outside the App and your iCloud.',
      ],
    },
    {
      title: '9. Notifications',
      paragraphs: [
        'Reminders about ticket expiry, warranty or returns are scheduled locally on the device (iOS notifications) after you allow them. They are not used to build an advertising profile.',
      ],
    },
    {
      title: '10. Family (iCloud)',
      paragraphs: [
        'Sharing tickets, receipts and cards with invited people uses Apple CloudKit Share. Only people who accept the invite can see that content. The operator does not moderate family content and cannot view it.',
      ],
    },
    {
      title: '11. Recipients',
      paragraphs: ['Recipients — only as needed for features you enable — may include:'],
      bullets: [
        '**Apple** — iOS, iCloud / CloudKit, notifications, PassKit / Apple Wallet, the App Store, under Apple’s policies;',
        '**OpenStreetMap / Overpass** — a query for points in the map area;',
        '**MapaKaucji.pl** — a public machine catalogue (not your profile).',
      ],
    },
    {
      title: '12. Transfers outside the EEA',
      paragraphs: [
        'Apple may process data outside the European Economic Area under Apple’s terms (including standard contractual clauses). Using iCloud, Apple Wallet or the App Store also means Apple’s rules apply.',
      ],
    },
    {
      title: '13. Retention',
      paragraphs: [
        'Data in the App remains until you delete it or uninstall the App. iCloud data follows your Apple ID settings. Mail to kontakt@estateos.pl is kept as needed to handle the request and for limitation periods or legal duties.',
      ],
    },
    {
      title: '14. Your rights',
      paragraphs: [
        'You have the rights of access, rectification, erasure, restriction, portability, objection and withdrawal of consent (where processing is based on consent), and the right to lodge a complaint with the President of the Polish DPA (uodo.gov.pl) or another competent supervisory authority.',
        'Delete in-app content on the device (for example a card, receipt or ticket), or uninstall the App and turn off iCloud for ParagonOS™. For other requests write to kontakt@estateos.pl with subject “ParagonOS”.',
      ],
    },
    {
      title: '15. Children',
      paragraphs: [
        'The App is not directed at children under 13 and is not in Apple’s Made for Kids programme. We do not knowingly collect children’s data.',
      ],
    },
    {
      title: '16. No tracking or ads',
      paragraphs: [
        'We do not sell personal data. We do not use it for behavioural advertising. We do not use App Tracking Transparency because we do not track you across apps and websites as defined by Apple.',
      ],
    },
    {
      title: '17. Changes',
      paragraphs: [
        'An updated version will be published at the same URL with a new date. Material changes will be announced in the App or on the support page where proportionate.',
      ],
    },
    {
      title: '18. Contact',
      paragraphs: [
        'Privacy questions about ParagonOS™: kontakt@estateos.pl (subject: “ParagonOS — privacy”).',
      ],
    },
  ],
  relatedLinks: RELATED_EN,
  localeLinks: [{ label: 'Polski', href: PARAGONOS_PATHS.privacyPl }],
};

export function getParagonOsPrivacyContent(locale: 'pl' | 'en'): LegalDocumentContent {
  return locale === 'en' ? EN : PL;
}
