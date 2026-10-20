import type { LegalDocumentContent } from '@/content/legal/types';
import { GALLERYOS_CONTACT_EMAIL, GALLERYOS_PATHS, GALLERYOS_PHONE_DISPLAY, GALLERYOS_URLS } from '@/lib/galleryOsLegal';

const RELATED_PL = [
  { label: 'Polityka prywatności GalleryOS™', href: GALLERYOS_PATHS.privacyPl },
  { label: 'Wsparcie', href: GALLERYOS_PATHS.supportPl },
];

const RELATED_EN = [
  { label: 'GalleryOS™ Privacy Policy', href: GALLERYOS_PATHS.privacyEn },
  { label: 'Support', href: GALLERYOS_PATHS.supportEn },
];

const PL: LegalDocumentContent = {
  locale: 'pl',
  metaTitle: 'Regulamin GalleryOS™',
  metaDescription:
    'Regulamin aplikacji GalleryOS™ na iPhone’a, iPada i Apple TV. Trzy dni próbne, potem plan roczny, miesięczny albo zakup na stałe.',
  canonical: GALLERYOS_URLS.termsPl,
  title: 'Regulamin korzystania z GalleryOS™',
  updatedLabel: 'Obowiązuje od:',
  updated: '20 października 2026 r.',
  intro:
    'Niniejszy Regulamin określa zasady korzystania z **aplikacji GalleryOS™ na iOS i tvOS** („Aplikacja”). Nie jest regulaminem portalu nieruchomości EstateOS™. Instalacja lub dalsze używanie Aplikacji oznacza akceptację Regulaminu i [Polityki prywatności GalleryOS™](/galleryos/polityka-prywatnosci). Jeśli nie akceptujesz tych warunków, nie używaj Aplikacji.',
  sections: [
    {
      title: '§1. Definicje',
      paragraphs: ['Na potrzeby Regulaminu:'],
      bullets: [
        '**Aplikacja / GalleryOS™** — oprogramowanie na iPhone’a, iPada (pl.galleryos.app) i Apple TV (pl.galleryos.app.tv) do przeglądania zdjęć i filmów oraz kopii na miejsce wybrane przez Użytkownika;',
        `**Operator** — Marian Romanienko; kontakt: ${GALLERYOS_CONTACT_EMAIL}, tel. ${GALLERYOS_PHONE_DISPLAY};`,
        '**Użytkownik** — osoba, która instaluje lub używa Aplikacji;',
        '**Miejsce kopii** — serwer NAS, WebDAV, dysk albo samo urządzenie, które Użytkownik wskaże;',
        '**Plan** — dostęp płatny: abonament miesięczny, abonament roczny albo zakup jednorazowy.',
      ],
    },
    {
      title: '§2. Czym jest usługa',
      paragraphs: [
        'Aplikacja jest **galerią Użytkownika**. Nie jest dyskiem w chmurze Operatora i nie sprzedaje miejsca na cudzym serwerze. Pliki zostają na urządzeniu oraz, jeśli Użytkownik włączy kopię, na jego własnym miejscu kopii.',
        'Konto GalleryOS nie istnieje. Tożsamością jest Apple ID na urządzeniu. iPhone i Apple TV z tym samym Apple ID korzystają z jednej biblioteki.',
      ],
    },
    {
      title: '§3. Trzy dni i płatność',
      paragraphs: [
        'Przez **trzy dni** od pierwszego uruchomienia na danym Apple ID Aplikacja i Apple TV są otwarte w całości. Okres jest zapisany w iCloud tego Apple ID i nie zaczyna się od nowa po usunięciu i ponownej instalacji.',
        'Po trzech dniach, a także po rezygnacji z abonamentu, GalleryOS na iPhonie, iPadzie i Apple TV jest zamknięty do czasu aktywnego Planu. Zdjęcia na telefonie i pliki już wysłane na miejsce kopii **zostają**. Aplikacja ich nie kasuje i nie blokuje systemowej aplikacji Zdjęcia.',
        'Ceny widoczne w App Store w Polsce w chwili publikacji tego Regulaminu to: **9,99 zł miesięcznie**, **99,99 zł rocznie** oraz **299,99 zł jednorazowo**. Apple ustala progi cenowe; jeśli dany próg nie istnieje, obowiązuje najbliższa cena pokazana w sklepie przed zakupem. Plan roczny jest ofertą główną. Zakup jednorazowy obejmuje Chmurę rodzinną, gdy Apple ją włączy dla tego produktu.',
        'Płatność przyjmuje Apple. Operator nie widzi numeru karty. Zwrot zakupu w App Store odbywa się według zasad Apple oraz bezwzględnie obowiązujących przepisów o prawach konsumenta. Rozpoczęcie korzystania z treści cyfrowej przed upływem 14 dni, na wyraźne żądanie Użytkownika, może ograniczyć prawo odstąpienia w zakresie dopuszczonym przez ustawę o prawach konsumenta.',
      ],
    },
    {
      title: '§4. Miejsce kopii',
      paragraphs: [
        'Użytkownik podaje adres, udział i login swojego serwera oraz hasło. Hasło trafia do pęku kluczy iCloud, nie na serwer Operatora. Użytkownik odpowiada za legalność dostępu do tego serwera i za jego zabezpieczenie.',
        'Biblioteka na serwerze QNAP jest zapisywana w udziale wskazanym w Aplikacji (domyślnie Public, folder GalleryOS). Operator nie przegląda cudzych serwerów.',
      ],
    },
    {
      title: '§5. Obowiązki Użytkownika',
      paragraphs: ['Użytkownik:'],
      bullets: [
        'kopiuje tylko zdjęcia i filmy, do których ma prawo;',
        'nie używa Aplikacji do treści bezprawnych;',
        'nie obchodzi opłaty, okresu próbnego ani blokady Apple TV;',
        'zachowuje poufność danych logowania do własnego serwera.',
      ],
    },
    {
      title: '§6. Apple TV i zaproszenia',
      paragraphs: [
        'Apple TV nie jest sprzedawane osobno. Otwiera bibliotekę tylko wtedy, gdy na tym Apple ID trwa okres próbny albo jest opłacony Plan. Sprawdzenie odbywa się przy uruchomieniu telewizora.',
        'Zaproszenie do albumu idzie na Apple ID drugiej osoby. Nie obejmuje hasła do serwera. Oryginały zostają u właściciela.',
      ],
    },
    {
      title: '§7. Własność',
      paragraphs: [
        'Aplikacja, nazwa GalleryOS™ i oprawa graficzna należą do Operatora lub licencjodawców. Użytkownik dostaje niewyłączną licencję na używanie Aplikacji na swoich urządzeniach, zgodnie z regulaminem App Store.',
        'Zdjęcia i filmy Użytkownika pozostają jego własnością. Operator nie dostaje licencji na ich publikację.',
      ],
    },
    {
      title: '§8. Odpowiedzialność',
      paragraphs: [
        'Aplikacja jest dostarczana „tak jak jest”, w granicach prawa. Operator nie odpowiada za awarię serwera Użytkownika, brak miejsca na dysku, błędną konfigurację DDNS, utratę hasła ani za działanie iCloud i App Store.',
        'Wobec konsumenta z EOG nie wyłącza się odpowiedzialności, której prawo nie pozwala wyłączyć, w tym za szkodę na osobie i za winę umyślną.',
      ],
    },
    {
      title: '§9. Reklamacje i prawo',
      paragraphs: [
        `Reklamację wyślij na ${GALLERYOS_CONTACT_EMAIL} z dopiskiem „GalleryOS” albo zadzwoń pod ${GALLERYOS_PHONE_DISPLAY}. Podaj model urządzenia i wersję Aplikacji. Odpowiedź nastąpi bez zbędnej zwłoki, nie później niż w terminie wynikającym z przepisów o prawach konsumenta, gdy mają zastosowanie.`,
        'Prawo właściwe to prawo polskie, z zachowaniem bezwzględnych przepisów państwa pobytu konsumenta. Konsumenci mogą skorzystać z platformy ODR: https://ec.europa.eu/consumers/odr.',
      ],
    },
    {
      title: '§10. Zmiany i postanowienia końcowe',
      paragraphs: [
        'Operator może zmienić Regulamin z przyczyn prawnych, technicznych albo cenowych. Nowa wersja ukaże się pod tym samym adresem. Dalsze korzystanie po dacie wejścia w życie oznacza akceptację, o ile prawo nie wymaga innej formy.',
        'Wersja polska i angielska są publikowane równolegle. Przy rozbieżności pierwszeństwo ma wersja polska, chyba że bezwzględne prawo stanowi inaczej. Nieważność jednego punktu nie unieważnia pozostałych.',
      ],
    },
  ],
  relatedLinks: RELATED_PL,
  localeLinks: [{ label: 'English', href: GALLERYOS_PATHS.termsEn }],
};

const EN: LegalDocumentContent = {
  locale: 'en',
  metaTitle: 'GalleryOS™ Terms of Use',
  metaDescription:
    'Terms of Use for GalleryOS™ on iPhone, iPad and Apple TV. A three-day trial, then a yearly plan, a monthly plan, or a one-time purchase.',
  canonical: GALLERYOS_URLS.termsEn,
  title: 'GalleryOS™ Terms of Use',
  updatedLabel: 'Effective:',
  updated: '20 October 2026',
  intro:
    'These Terms govern use of the **GalleryOS™ apps for iOS and tvOS** (the “App”). They are not the terms of the EstateOS™ property portal. Installing or continuing to use the App means you accept these Terms and the [GalleryOS™ Privacy Policy](/galleryos/privacy). If you do not accept them, do not use the App.',
  sections: [
    {
      title: '§1. Definitions',
      paragraphs: ['In these Terms:'],
      bullets: [
        '**App / GalleryOS™** — the software for iPhone and iPad (pl.galleryos.app) and Apple TV (pl.galleryos.app.tv) used to view photos and videos and to copy them to a place the user chooses;',
        `**Operator** — Marian Romanienko; contact: ${GALLERYOS_CONTACT_EMAIL}, tel. ${GALLERYOS_PHONE_DISPLAY};`,
        '**User** — a person who installs or uses the App;',
        '**Backup place** — a NAS, WebDAV server, disk, or the device itself, as named by the User;',
        '**Plan** — paid access: a monthly subscription, a yearly subscription, or a one-time purchase.',
      ],
    },
    {
      title: '§2. The service',
      paragraphs: [
        'The App is **the User’s gallery**. It is not the Operator’s cloud disk and it does not sell space on someone else’s server. Files stay on the device and, if the User turns backup on, on the User’s own backup place.',
        'There is no GalleryOS account. Identity is the Apple ID on the device. An iPhone and an Apple TV on the same Apple ID use one library.',
      ],
    },
    {
      title: '§3. Three days and payment',
      paragraphs: [
        'For **three days** from the first launch on a given Apple ID, the App and Apple TV are fully open. The period is stored in that Apple ID’s iCloud and does not restart after uninstall and reinstall.',
        'After three days, and after a subscription ends, GalleryOS on iPhone, iPad and Apple TV stays closed until a Plan is active. Photos on the phone and files already sent to the backup place **remain**. The App does not delete them and does not block the system Photos app.',
        'Prices shown on the Polish App Store when these Terms are published are **PLN 9.99 per month**, **PLN 99.99 per year** and **PLN 299.99 once**. Apple sets price tiers; if an exact amount is not a tier, the price shown in the store before purchase applies. The yearly plan is the primary offer. The one-time purchase includes Family Sharing when Apple enables it for that product.',
        'Apple takes payment. The Operator does not see the card number. App Store refunds follow Apple’s rules and mandatory consumer-protection law. Starting to use digital content before 14 days have passed, at the User’s express request, may limit the right of withdrawal to the extent allowed by consumer law.',
      ],
    },
    {
      title: '§4. The backup place',
      paragraphs: [
        'The User supplies the address, share and username of their server, and the password. The password goes to iCloud Keychain, not to the Operator’s server. The User is responsible for lawful access to that server and for securing it.',
        'On a QNAP the library is written to the share named in the App (by default Public, folder GalleryOS). The Operator does not browse other people’s servers.',
      ],
    },
    {
      title: '§5. User duties',
      paragraphs: ['The User:'],
      bullets: [
        'copies only photos and videos they have the right to copy;',
        'does not use the App for unlawful content;',
        'does not bypass payment, the trial, or the Apple TV lock;',
        'keeps their own server credentials confidential.',
      ],
    },
    {
      title: '§6. Apple TV and invitations',
      paragraphs: [
        'Apple TV is not sold separately. It opens the library only while the trial is running or a Plan is paid on that Apple ID. The check runs when the television starts.',
        'An album invitation goes to another person’s Apple ID. It does not include the server password. Originals stay with the owner.',
      ],
    },
    {
      title: '§7. Ownership',
      paragraphs: [
        'The App, the name GalleryOS™ and its visual design belong to the Operator or licensors. The User receives a non-exclusive licence to use the App on their devices, under the App Store terms.',
        'The User’s photos and videos remain the User’s. The Operator receives no licence to publish them.',
      ],
    },
    {
      title: '§8. Liability',
      paragraphs: [
        'The App is provided “as is”, within the limits of the law. The Operator is not liable for the User’s server failing, a full disk, a wrong DDNS setup, a lost password, or for iCloud and the App Store.',
        'For an EEA consumer, liability that the law does not allow to be excluded is not excluded, including liability for personal injury and for intentional fault.',
      ],
    },
    {
      title: '§9. Complaints and law',
      paragraphs: [
        `Send a complaint to ${GALLERYOS_CONTACT_EMAIL} with “GalleryOS” in the subject, or call ${GALLERYOS_PHONE_DISPLAY}. Include the device model and the App version. A reply will follow without undue delay, and no later than the period required by consumer law where it applies.`,
        'Polish law applies, without prejudice to mandatory rules of the consumer’s country of residence. Consumers may use the EU ODR platform: https://ec.europa.eu/consumers/odr.',
      ],
    },
    {
      title: '§10. Changes and final terms',
      paragraphs: [
        'The Operator may change these Terms for legal, technical or pricing reasons. The new version will appear at the same address. Continued use after the effective date means acceptance, unless the law requires another form.',
        'The Polish and English versions are published together. If they differ, the Polish version prevails unless mandatory law says otherwise. If one clause is invalid, the others remain in force.',
      ],
    },
  ],
  relatedLinks: RELATED_EN,
  localeLinks: [{ label: 'Polski', href: GALLERYOS_PATHS.termsPl }],
};

export function getGalleryOsTermsContent(locale: 'pl' | 'en'): LegalDocumentContent {
  return locale === 'en' ? EN : PL;
}
