import type { LegalDocumentContent } from '@/content/legal/types';
import { GALLERYOS_CONTACT_EMAIL, GALLERYOS_PATHS, GALLERYOS_PHONE_DISPLAY, GALLERYOS_URLS } from '@/lib/galleryOsLegal';

const RELATED_PL = [
  { label: 'Regulamin GalleryOS™', href: GALLERYOS_PATHS.termsPl },
  { label: 'Wsparcie', href: GALLERYOS_PATHS.supportPl },
];

const RELATED_EN = [
  { label: 'GalleryOS™ Terms of Use', href: GALLERYOS_PATHS.termsEn },
  { label: 'Support', href: GALLERYOS_PATHS.supportEn },
];

const PL: LegalDocumentContent = {
  locale: 'pl',
  metaTitle: 'Polityka prywatności GalleryOS™',
  metaDescription:
    'Polityka prywatności aplikacji GalleryOS™ na iPhone’a, iPada i Apple TV. Zdjęcia zostają na urządzeniu i na serwerze wybranym przez użytkownika.',
  canonical: GALLERYOS_URLS.privacyPl,
  title: 'Polityka prywatności GalleryOS™',
  updatedLabel: 'Ostatnia aktualizacja:',
  updated: '20 października 2026 r.',
  intro:
    'Niniejsza Polityka prywatności opisuje przetwarzanie danych osobowych w **aplikacjach GalleryOS™ na iOS oraz tvOS** (identyfikatory pl.galleryos.app i pl.galleryos.app.tv, dalej łącznie: „Aplikacja”). Dokument **nie dotyczy** serwisu nieruchomości EstateOS™ ani aplikacji ParagonOS™. Korzystając z Aplikacji, akceptujesz tę Politykę. Jeśli się nie zgadzasz, nie korzystaj z Aplikacji.',
  sections: [
    {
      title: '1. Administrator i kontakt',
      paragraphs: [
        `Administratorem danych osobowych przetwarzanych w związku z Aplikacją jest **Marian Romanienko**, prowadzący GalleryOS™. Kontakt w sprawach prywatności i praw z RODO: ${GALLERYOS_CONTACT_EMAIL} oraz telefon ${GALLERYOS_PHONE_DISPLAY}.`,
        'W tytule wiadomości wpisz „GalleryOS”. Ta skrzynka i ten numer służą Aplikacji, a nie ogłoszeniom nieruchomości na estateos.pl.',
      ],
    },
    {
      title: '2. Zakres',
      paragraphs: [
        'Polityka obejmuje bibliotekę zdjęć i filmów w Aplikacji, kopię na miejsce wybrane przez Ciebie (serwer NAS, WebDAV, dysk albo to urządzenie), mapę zdjęć, album ukryty, Apple TV oraz płatności w App Store.',
        'Ogłoszenia, konta i płatności portalu EstateOS™ są regulowane odrębnymi dokumentami i **nie wchodzą** w zakres tej Polityki.',
      ],
    },
    {
      title: '3. Czego administrator nie otrzymuje',
      paragraphs: [
        'Aplikacja **nie ma własnego serwera kont** i nie wymaga rejestracji loginem ani hasłem u administratora. Tożsamością jest Apple ID zalogowane na urządzeniu.',
        'Administrator **nie otrzymuje** Twojej biblioteki zdjęć i filmów, haseł do serwera NAS ani danych Face ID. Zdjęcia i filmy zostają na urządzeniu oraz — jeśli włączysz kopię — na **serwerze albo dysku, który sam wskażesz**. Hasło do tego miejsca jest zapisywane w Twoim pęku kluczy iCloud, a nie na serwerze administratora.',
      ],
    },
    {
      title: '4. Gdzie dane powstają',
      paragraphs: ['W zależności od funkcji, którą włączysz, dane są przetwarzane w tych miejscach:'],
      bullets: [
        '**Na urządzeniu** — podgląd biblioteki Zdjęć, sortowanie, album ukryty, Face ID.',
        '**Na Twoim serwerze lub dysku** — oryginały, miniatury i katalog biblioteki, gdy włączysz kopię zapasową. To Ty jesteś administratorem tego miejsca.',
        '**W Twoim iCloud** — profil połączenia (adres, udział, login, bez hasła w treści profilu), znacznik okresu próbnego i stanu opłacenia oraz, gdy zaprosisz kogoś, metadane albumu przez CloudKit (iCloud.pl.galleryos.app). Hasło NAS jest w pęku kluczy iCloud.',
        '**U Apple** — App Store i płatności (StoreKit). Numer karty zna Apple, nie administrator Aplikacji.',
      ],
    },
    {
      title: '5. Kategorie danych',
      paragraphs: ['Aplikacja może przetwarzać, wyłącznie po Twojej stronie albo po stronie Apple:'],
      bullets: [
        '**Zdjęcia i filmy** z biblioteki systemowej, w tym datę wykonania.',
        '**Lokalizację zapisaną w zdjęciu** (współrzędne z aparatu), żeby pokazać kadr na mapie. Aplikacja nie śledzi na bieżąco pozycji telefonu w tle w celu reklamy.',
        '**Dane połączenia z Twoim serwerem** — adres, port, nazwa udziału, login. Hasło tylko w pęku kluczy iCloud.',
        '**Identyfikator Apple ID / iCloud** w zakresie, w jakim Apple go używa do iCloud, CloudKit i zakupów.',
        '**Dane korespondencji**, jeśli napiszesz na adres wsparcia albo zadzwonisz pod podany numer.',
      ],
    },
    {
      title: '6. Cele i podstawy (RODO)',
      paragraphs: ['Gdy administrator w ogóle przetwarza dane (przede wszystkim korespondencję), dzieje się to w celach:'],
      bullets: [
        'odpowiedź na zgłoszenie i obsługa Aplikacji — art. 6 ust. 1 lit. b oraz lit. f RODO;',
        'obowiązki prawne, w tym rozliczenie żądania z RODO — art. 6 ust. 1 lit. c;',
        'ustalenie lub obrona roszczeń — art. 6 ust. 1 lit. f.',
      ],
    },
    {
      title: '7. Zdjęcia, mapa i Face ID',
      paragraphs: [
        'Dostęp do biblioteki Zdjęć służy wyświetleniu Twojej galerii i — jeśli włączysz kopię — wysłaniu plików na wskazany przez Ciebie serwer. Możesz odmówić dostępu w Ustawieniach iOS.',
        'Mapa korzysta ze współrzędnych zapisanych w zdjęciach. Zdjęcie bez lokalizacji nie pojawia się na mapie. Zrzut ekranu zwykle nie ma współrzędnych, bo iPhone ich tam nie zapisuje.',
        'Face ID przy albumie ukrytym działa wyłącznie na urządzeniu. Administrator nie otrzymuje danych biometrycznych.',
      ],
    },
    {
      title: '8. Apple TV i zaproszenie',
      paragraphs: [
        'Apple TV z tym samym Apple ID odczytuje profil połączenia i stan opłacenia z Twojego iCloud, żeby otworzyć tę samą bibliotekę. Hasło serwera nie jest publikowane osobie trzeciej.',
        'Gdy udostępnisz album, zaproszenie trafia na Apple ID wskazanej osoby przez CloudKit. Ta osoba nie dostaje hasła do Twojego NAS. Oryginały zostają na Twoim serwerze.',
      ],
    },
    {
      title: '9. Płatności',
      paragraphs: [
        'Zakupy obsługuje Apple (StoreKit). Administrator nie otrzymuje numeru karty ani pełnych danych płatności. Apple może przekazać administratorowi informację, czy na danym Apple ID jest aktywny plan, w zakresie niezbędnym do otwarcia Aplikacji.',
      ],
    },
    {
      title: '10. Odbiorcy',
      paragraphs: ['W zakresie funkcji, które włączysz, odbiorcami mogą być:'],
      bullets: [
        '**Apple** — iOS, tvOS, iCloud, CloudKit, App Store i StoreKit, na zasadach Apple;',
        '**Twój serwer lub dysk** — miejsce, które sam konfigurujesz. Administrator Aplikacji nie jest jego operatorem, chyba że jest to jednocześnie Twój własny sprzęt i to Ty nim zarządzasz.',
      ],
    },
    {
      title: '11. Przekazanie poza EOG',
      paragraphs: [
        'Apple może przetwarzać dane poza Europejskim Obszarem Gospodarczym na zasadach opisanych przez Apple, w tym ze standardowymi klauzulami umownymi. Korzystanie z iCloud i App Store oznacza także akceptację zasad Apple.',
      ],
    },
    {
      title: '12. Okres przechowywania',
      paragraphs: [
        'Pliki na urządzeniu i na Twoim serwerze usuwasz Ty. Odinstalowanie Aplikacji nie kasuje kopii, która już jest na serwerze. Profil w iCloud usuniesz, wyłączając iCloud dla GalleryOS™ albo czyszcząc dane aplikacji w ustawieniach Apple ID.',
        'Korespondencję wsparcia przechowujemy przez czas obsługi sprawy oraz przedawnienia roszczeń.',
      ],
    },
    {
      title: '13. Twoje prawa',
      paragraphs: [
        'Masz prawo dostępu, sprostowania, usunięcia, ograniczenia, przenoszenia, sprzeciwu i cofnięcia zgody, a także skargi do Prezesa UODO (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).',
        `W sprawach, którymi dysponuje administrator, napisz na ${GALLERYOS_CONTACT_EMAIL} albo zadzwoń pod ${GALLERYOS_PHONE_DISPLAY}. Treści na własnym serwerze usuwasz na tym serwerze.`,
      ],
    },
    {
      title: '14. Dzieci',
      paragraphs: [
        'Aplikacja nie jest skierowana do dzieci poniżej 13. roku życia i nie jest w programie Apple „Made for Kids”. Nie zbieramy świadomie danych dzieci.',
      ],
    },
    {
      title: '15. Brak sprzedaży danych i brak śledzenia',
      paragraphs: [
        'Nie sprzedajemy danych osobowych i nie używamy ich do reklam behawioralnych. Nie stosujemy śledzenia między aplikacjami i witrynami w rozumieniu App Tracking Transparency. Etykieta prywatności w App Store („dane nie są zbierane”) oznacza, że **administrator nie gromadzi biblioteki na własnym serwerze**.',
      ],
    },
    {
      title: '16. Zmiany',
      paragraphs: [
        'Nowa wersja pojawi się pod tym samym adresem, z nową datą. Istotną zmianę pokażemy w Aplikacji, gdy będzie to proporcjonalne.',
      ],
    },
  ],
  relatedLinks: RELATED_PL,
  localeLinks: [{ label: 'English', href: GALLERYOS_PATHS.privacyEn }],
};

const EN: LegalDocumentContent = {
  locale: 'en',
  metaTitle: 'GalleryOS™ Privacy Policy',
  metaDescription:
    'Privacy Policy for GalleryOS™ on iPhone, iPad and Apple TV. Photos stay on your device and on the server you choose.',
  canonical: GALLERYOS_URLS.privacyEn,
  title: 'GalleryOS™ Privacy Policy',
  updatedLabel: 'Last updated:',
  updated: '20 October 2026',
  intro:
    'This Privacy Policy describes personal-data processing in the **GalleryOS™ apps for iOS and tvOS** (bundle IDs pl.galleryos.app and pl.galleryos.app.tv, together the “App”). It does **not** apply to the EstateOS™ real-estate service or to ParagonOS™. By using the App you accept this Policy. If you do not agree, do not use the App.',
  sections: [
    {
      title: '1. Controller and contact',
      paragraphs: [
        `The controller is **Marian Romanienko**, operating GalleryOS™. Privacy and GDPR requests: ${GALLERYOS_CONTACT_EMAIL} and phone ${GALLERYOS_PHONE_DISPLAY}.`,
        'Please put “GalleryOS” in the subject. This inbox is for the App, not for property listings on estateos.pl.',
      ],
    },
    {
      title: '2. Scope',
      paragraphs: [
        'This Policy covers the photo and video library in the App, backup to a place you choose (NAS, WebDAV, a disk, or this device), the photo map, the hidden album, Apple TV, and App Store purchases.',
        'EstateOS™ listings, accounts and portal payments are covered by separate documents and are **outside** this Policy.',
      ],
    },
    {
      title: '3. What the controller does not receive',
      paragraphs: [
        'The App has **no account server of its own** and does not ask you to register with a username and password. Your identity is the Apple ID signed in on the device.',
        'The controller **does not receive** your photo and video library, your NAS password, or Face ID data. Photos and videos stay on the device and, if you turn backup on, on the **server or disk you choose**. The password for that place is stored in your iCloud Keychain, not on the controller’s server.',
      ],
    },
    {
      title: '4. Where data lives',
      paragraphs: ['Depending on the features you turn on, data is processed:'],
      bullets: [
        '**On the device** — the Photos library view, sorting, the hidden album, and Face ID.',
        '**On your server or disk** — originals, thumbnails and the library catalogue, when you enable backup. You are the controller of that place.',
        '**In your iCloud** — the connection profile (address, share, username; the password is not written into the profile text), the trial and entitlement flag, and, if you invite someone, album metadata via CloudKit (iCloud.pl.galleryos.app). The NAS password stays in iCloud Keychain.',
        '**At Apple** — the App Store and payments (StoreKit). Apple, not the App operator, holds the card number.',
      ],
    },
    {
      title: '5. Categories',
      paragraphs: ['The App may process, only on your side or Apple’s side:'],
      bullets: [
        '**Photos and videos** from the system library, including capture dates.',
        '**Location stored inside a photo**, so the picture can appear on the map. The App does not track the phone’s live position in the background for advertising.',
        '**Connection details for your server** — address, port, share name, username. The password stays in iCloud Keychain.',
        '**Apple ID / iCloud identifiers** to the extent Apple uses them for iCloud, CloudKit and purchases.',
        '**Correspondence**, if you email support or call the published number.',
      ],
    },
    {
      title: '6. Purposes and legal bases',
      paragraphs: ['Where the controller processes data at all (mainly correspondence), the purposes are:'],
      bullets: [
        'answering a request and operating the App — GDPR Art. 6(1)(b) and (f);',
        'legal duties, including a GDPR request — Art. 6(1)(c);',
        'establishing or defending claims — Art. 6(1)(f).',
      ],
    },
    {
      title: '7. Photos, the map and Face ID',
      paragraphs: [
        'Photo library access is used to show your gallery and, if you enable backup, to send files to the server you name. You can refuse access in iOS Settings.',
        'The map uses coordinates already stored in photos. A photo without a location does not appear on the map. A screenshot usually has none, because iPhone does not write coordinates into it.',
        'Face ID for the hidden album runs only on the device. The controller does not receive biometric data.',
      ],
    },
    {
      title: '8. Apple TV and invitations',
      paragraphs: [
        'An Apple TV on the same Apple ID reads the connection profile and the paid status from your iCloud so it can open the same library. The server password is not given to a third party.',
        'When you share an album, the invitation goes to that person’s Apple ID through CloudKit. They do not receive your NAS password. Originals stay on your server.',
      ],
    },
    {
      title: '9. Payments',
      paragraphs: [
        'Purchases are handled by Apple (StoreKit). The controller does not receive the card number or full payment details. Apple may tell the controller whether an Apple ID has an active plan, only as far as needed to unlock the App.',
      ],
    },
    {
      title: '10. Recipients',
      paragraphs: ['For features you turn on, recipients may include:'],
      bullets: [
        '**Apple** — iOS, tvOS, iCloud, CloudKit, the App Store and StoreKit, under Apple’s terms;',
        '**Your server or disk** — the place you configure. The App operator does not run it, unless it is your own equipment and you administer it.',
      ],
    },
    {
      title: '11. Transfers outside the EEA',
      paragraphs: [
        'Apple may process data outside the European Economic Area under Apple’s terms, including standard contractual clauses. Using iCloud and the App Store also means accepting Apple’s terms.',
      ],
    },
    {
      title: '12. Retention',
      paragraphs: [
        'You delete files on the device and on your server. Uninstalling the App does not delete a copy that is already on the server. You can remove the iCloud profile by turning iCloud off for GalleryOS™ or clearing the app’s iCloud data.',
        'Support correspondence is kept for as long as the matter and limitation periods require.',
      ],
    },
    {
      title: '13. Your rights',
      paragraphs: [
        'You have the rights of access, rectification, erasure, restriction, portability and objection, and to withdraw consent, and you may complain to the Polish supervisory authority (President of UODO, ul. Stawki 2, 00-193 Warsaw, uodo.gov.pl).',
        `For matters the controller actually holds, email ${GALLERYOS_CONTACT_EMAIL} or call ${GALLERYOS_PHONE_DISPLAY}. Content on your own server is deleted there.`,
      ],
    },
    {
      title: '14. Children',
      paragraphs: [
        'The App is not directed at children under 13 and is not in Apple’s “Made for Kids” program. We do not knowingly collect children’s data.',
      ],
    },
    {
      title: '15. No sale and no tracking',
      paragraphs: [
        'We do not sell personal data and we do not use it for behavioural advertising. We do not track you across apps and websites under App Tracking Transparency. The App Store label “Data Not Collected” means the **controller does not store your library on his own server**.',
      ],
    },
    {
      title: '16. Changes',
      paragraphs: [
        'A new version will appear at the same address with a new date. A material change will be shown in the App where that is proportionate.',
      ],
    },
  ],
  relatedLinks: RELATED_EN,
  localeLinks: [{ label: 'Polski', href: GALLERYOS_PATHS.privacyPl }],
};

export function getGalleryOsPrivacyContent(locale: 'pl' | 'en'): LegalDocumentContent {
  return locale === 'en' ? EN : PL;
}
