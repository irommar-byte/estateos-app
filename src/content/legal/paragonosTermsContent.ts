import type { LegalDocumentContent } from '@/content/legal/types';
import { PARAGONOS_PATHS, PARAGONOS_URLS } from '@/lib/paragonOsLegal';

const RELATED_PL = [
  { label: 'Polityka prywatności ParagonOS™', href: PARAGONOS_PATHS.privacyPl },
  { label: 'Wsparcie', href: PARAGONOS_PATHS.supportPl },
];

const RELATED_EN = [
  { label: 'ParagonOS™ Privacy Policy', href: PARAGONOS_PATHS.privacyEn },
  { label: 'Support', href: PARAGONOS_PATHS.supportEn },
];

const PL: LegalDocumentContent = {
  locale: 'pl',
  metaTitle: 'Regulamin ParagonOS™',
  metaDescription:
    'Regulamin korzystania z aplikacji iOS ParagonOS™ — kaucje, paragony i karty lojalnościowe. Dokument dotyczy wyłącznie tej aplikacji.',
  canonical: PARAGONOS_URLS.termsPl,
  title: 'Regulamin korzystania z ParagonOS™',
  updatedLabel: 'Obowiązuje od:',
  updated: '12 września 2026 r.',
  intro:
    'Niniejszy Regulamin określa zasady korzystania z **aplikacji mobilnej ParagonOS™ na iOS** („Aplikacja”). Dokument **nie stanowi** regulaminu serwisu nieruchomości EstateOS™. Korzystanie z Aplikacji oznacza akceptację Regulaminu oraz [Polityki prywatności ParagonOS™](/paragonos/polityka-prywatnosci). Jeśli nie akceptujesz tych warunków, nie instaluj i nie używaj Aplikacji.',
  sections: [
    {
      title: '§1. Definicje',
      paragraphs: ['Na potrzeby Regulaminu:'],
      bullets: [
        '**Aplikacja / ParagonOS™** — oprogramowanie na iPhone’a (identyfikator `pl.paragonos.app`) służące do przechowywania kwitków kaucyjnych, paragonów i kart lojalnościowych;',
        '**Operator** — podmiot świadczący Aplikację; kontakt: kontakt@estateos.pl;',
        '**Użytkownik** — osoba, która instaluje lub używa Aplikacji;',
        '**Treści** — dane wprowadzone lub zeskanowane przez Użytkownika, w tym zdjęcia, numery kodów i notatki.',
      ],
    },
    {
      title: '§2. Charakter usługi',
      paragraphs: [
        'Aplikacja jest **osobistym portfelem dokumentów Użytkownika**. Nie jest kasą sklepu, oficjalną aplikacją sieci handlowej, instytucją płatniczą ani pośrednikiem kaucji. Nie wypłaca środków i nie gwarantuje przyjęcia kodu z ekranu przez urządzenie sklepu.',
        'Aplikacja nie wymaga konta u Operatora. Logowanie, jeśli występuje, to mechanizmy Apple (Apple ID, iCloud) po stronie Użytkownika.',
      ],
    },
    {
      title: '§3. Oznaczenia sieci handlowych',
      paragraphs: [
        'Nazwy, kolory i logotypy sieci (m.in. sklepów spożywczych, stacji paliw, aptek) służą wyłącznie do **identyfikacji Treści Użytkownika** (jego kwitka, paragonu lub karty). ParagonOS™ **nie jest powiązany**, sponsorowany ani zatwierdzony przez te sieci, o ile nie wskazano inaczej na piśmie.',
        'Użytkownik oświadcza, że skanuje i przechowuje wyłącznie dokumenty i karty, do których ma prawo (własne lub udostępnione mu w gospodarstwie domowym za zgodą uprawnionego).',
      ],
    },
    {
      title: '§4. Obowiązki Użytkownika',
      paragraphs: ['Użytkownik zobowiązuje się:'],
      bullets: [
        'podawać dane zgodne z prawdą przy korekcie skanu;',
        'nie używać Aplikacji do oszustwa, podrobionych kodów ani podszywania się pod cudze karty;',
        'przestrzegać regulaminów sklepów i zasad programu kaucyjnego / lojalnościowego;',
        'nie zakłócać działania Aplikacji i nie obchodzić zabezpieczeń.',
      ],
    },
    {
      title: '§5. Skanowanie i kody przy kasie',
      paragraphs: [
        'Rozpoznawanie sieci, kwoty, daty i kodu ma charakter pomocniczy. Przed zapisem Użytkownik powinien sprawdzić dane. **Operator nie gwarantuje**, że kasa, butelkomat lub inny czytnik przyjmie kod wyświetlony na ekranie albo w Apple Wallet.',
        'Odpowiedzialność za okazanie właściwego dokumentu przy kasie spoczywa na Użytkowniku.',
      ],
    },
    {
      title: '§6. Mapa punktów zwrotu',
      paragraphs: [
        'Mapa ma charakter informacyjny. Dane pochodzą m.in. z MapaKaucji.pl i OpenStreetMap; mogą być niekompletne lub nieaktualne. Godziny otwarcia i to, czy automat działa, należy potwierdzić na miejscu. Korzystanie z mapy OSM podlega licencji i zasadom OpenStreetMap.',
      ],
    },
    {
      title: '§7. Apple Wallet i iCloud',
      paragraphs: [
        'Dodanie karty do Apple Wallet podlega regulaminom Apple. Usunięcie passu z Wallet nie zawsze usuwa kartę z Aplikacji i odwrotnie.',
        'Synchronizacja i udostępnianie rodzinie zależą od iCloud Użytkownika. Operator nie odpowiada za limity, awarie ani polityki Apple.',
      ],
    },
    {
      title: '§8. Własność intelektualna',
      paragraphs: [
        'Aplikacja, nazwa ParagonOS™, znaki słowne i oprawa graficzna Aplikacji (z wyłączeniem znaków osób trzecich) należą do Operatora lub licencjodawców. Użytkownik otrzymuje niewyłączną, nieprzenoszalną licencję na korzystanie z Aplikacji na własnym urządzeniu, zgodnie z regulaminem App Store.',
        'Treści wprowadzone przez Użytkownika pozostają jego własnością. Użytkownik udziela Operatorowi licencji wyłącznie w zakresie niezbędnym do świadczenia Aplikacji na jego urządzeniu (w praktyce: przetwarzanie lokalne / iCloud Użytkownika, bez publikacji Treści przez Operatora).',
      ],
    },
    {
      title: '§9. Odpowiedzialność',
      paragraphs: [
        'Aplikacja jest dostarczana „tak jak jest”. W najszerszym zakresie dopuszczalnym prawem Operator nie odpowiada za utratę kaucji, odmowę skanowania przez kasę, błędy OCR, nieaktualną mapę ani utratę danych wskutek usunięcia Aplikacji, resetu urządzenia lub iCloud.',
        'Wobec konsumentów z EOG nie wyłącza się odpowiedzialności, której nie można wyłączyć (m.in. za szkodę na osobie oraz za winę umyślną).',
      ],
    },
    {
      title: '§10. Konsumenci, reklamacje, prawo właściwe',
      paragraphs: [
        'Reklamacje dotyczące Aplikacji należy kierować na kontakt@estateos.pl z dopiskiem „ParagonOS” w tytule, opisem problemu i — jeśli to możliwe — modelem iPhone’a oraz wersją Aplikacji. Operator odpowiada bez zbędnej zwłoki, nie później niż w terminach wynikających z przepisów o prawach konsumenta, o ile mają zastosowanie.',
        'Spory podlegają prawu polskiemu, z zastrzeżeniem bezwzględnie wiążących przepisów ochronnych państwa zwykłego pobytu konsumenta. Konsumenci mogą korzystać z platformy ODR UE: https://ec.europa.eu/consumers/odr.',
      ],
    },
    {
      title: '§11. Zmiany Regulaminu',
      paragraphs: [
        'Operator może zmienić Regulamin z przyczyn prawnych, technicznych lub produktowych. Nowa wersja zostanie opublikowana pod tym samym adresem URL. Dalsze korzystanie z Aplikacji po dacie wejścia w życie oznacza akceptację, o ile prawo nie wymaga innej formy.',
      ],
    },
    {
      title: '§12. Język i postanowienia końcowe',
      paragraphs: [
        'Wersja polska i angielska są publikowane dla wygody. Przy rozbieżnościach pierwszeństwo ma wersja polska, o ile bezwzględnie obowiązujące prawo nie stanowi inaczej.',
        'Jeżeli którekolwiek postanowienie okaże się nieważne, pozostałe zachowują moc.',
      ],
    },
  ],
  relatedLinks: RELATED_PL,
  localeLinks: [{ label: 'English', href: PARAGONOS_PATHS.termsEn }],
};

const EN: LegalDocumentContent = {
  locale: 'en',
  metaTitle: 'ParagonOS™ Terms of Use',
  metaDescription:
    'Terms of Use for the ParagonOS™ iOS app — bottle-return tickets, receipts and loyalty cards. This document applies only to that app.',
  canonical: PARAGONOS_URLS.termsEn,
  title: 'ParagonOS™ Terms of Use',
  updatedLabel: 'Effective:',
  updated: '12 September 2026',
  intro:
    'These Terms govern use of the **ParagonOS™ iOS application** (the “App”). They are **not** the terms of the EstateOS™ real-estate service. Using the App means you accept these Terms and the [ParagonOS™ Privacy Policy](/paragonos/privacy). If you do not agree, do not install or use the App.',
  sections: [
    {
      title: '§1. Definitions',
      paragraphs: ['In these Terms:'],
      bullets: [
        '**App / ParagonOS™** — the iPhone software (bundle ID `pl.paragonos.app`) for storing bottle-return tickets, receipts and loyalty cards;',
        '**Operator** — the provider of the App; contact: kontakt@estateos.pl;',
        '**User** — anyone who installs or uses the App;',
        '**Content** — data the User enters or scans, including photos, code numbers and notes.',
      ],
    },
    {
      title: '§2. Nature of the service',
      paragraphs: [
        'The App is a **personal document wallet**. It is not a shop till, an official retailer app, a payment institution or a deposit intermediary. It does not pay out money and does not guarantee that a shop scanner will accept a code from the screen.',
        'The App does not require an account with the Operator. Any sign-in is Apple’s (Apple ID, iCloud) on the User’s side.',
      ],
    },
    {
      title: '§3. Retailer brands',
      paragraphs: [
        'Retailer names, colours and logos are used only to **identify the User’s own Content** (their ticket, receipt or card). ParagonOS™ is **not affiliated with, sponsored by or endorsed by** those retailers unless stated otherwise in writing.',
        'The User represents that they scan and store only documents and cards they are entitled to use (their own, or household cards with the rightholder’s permission).',
      ],
    },
    {
      title: '§4. User obligations',
      paragraphs: ['The User agrees to:'],
      bullets: [
        'correct scan results so they remain accurate;',
        'not use the App for fraud, forged codes or another person’s cards;',
        'comply with shop rules and the relevant deposit / loyalty programme;',
        'not disrupt the App or circumvent its safeguards.',
      ],
    },
    {
      title: '§5. Scanning and till codes',
      paragraphs: [
        'Recognition of retailer, amount, date and code is assistive only. The User should check data before saving. **The Operator does not warrant** that a till, reverse-vending machine or other reader will accept a code shown on screen or in Apple Wallet.',
        'The User remains responsible for presenting the correct document at the till.',
      ],
    },
    {
      title: '§6. Return-point map',
      paragraphs: [
        'The map is informational. Data comes among others from MapaKaucji.pl and OpenStreetMap and may be incomplete or out of date. Confirm opening hours and whether a machine works on site. Use of OSM is subject to OpenStreetMap licences and terms.',
      ],
    },
    {
      title: '§7. Apple Wallet and iCloud',
      paragraphs: [
        'Adding a card to Apple Wallet is subject to Apple’s terms. Removing a pass from Wallet does not always delete the card in the App, and vice versa.',
        'Sync and family sharing depend on the User’s iCloud. The Operator is not responsible for Apple’s limits, outages or policies.',
      ],
    },
    {
      title: '§8. Intellectual property',
      paragraphs: [
        'The App, the ParagonOS™ name and the App’s own artwork (excluding third-party marks) belong to the Operator or licensors. The User receives a non-exclusive, non-transferable licence to use the App on their device, subject to the App Store terms.',
        'Content the User enters remains theirs. The User grants the Operator a licence only as needed to provide the App on that device (in practice: on-device / the User’s iCloud processing, without the Operator publishing the Content).',
      ],
    },
    {
      title: '§9. Liability',
      paragraphs: [
        'The App is provided “as is”. To the fullest extent permitted by law, the Operator is not liable for lost deposits, a till refusing a scan, OCR errors, an outdated map, or data loss after uninstalling the App, resetting the device or iCloud issues.',
        'For EEA consumers, liability that cannot be excluded remains (including for death or personal injury and for wilful misconduct).',
      ],
    },
    {
      title: '§10. Consumers, complaints, governing law',
      paragraphs: [
        'Complaints about the App should be sent to kontakt@estateos.pl with “ParagonOS” in the subject, a description of the issue and, if possible, iPhone model and App version. The Operator responds without undue delay and within consumer-law deadlines where they apply.',
        'Disputes are governed by Polish law, without prejudice to mandatory consumer protections of the User’s habitual residence. Consumers may use the EU ODR platform: https://ec.europa.eu/consumers/odr.',
      ],
    },
    {
      title: '§11. Changes',
      paragraphs: [
        'The Operator may change these Terms for legal, technical or product reasons. The new version will be published at the same URL. Continued use after the effective date means acceptance, unless the law requires otherwise.',
      ],
    },
    {
      title: '§12. Language and miscellaneous',
      paragraphs: [
        'Polish and English versions are provided for convenience. If they conflict, the Polish version prevails, unless mandatory law says otherwise.',
        'If any provision is invalid, the remaining provisions stay in force.',
      ],
    },
  ],
  relatedLinks: RELATED_EN,
  localeLinks: [{ label: 'Polski', href: PARAGONOS_PATHS.termsPl }],
};

export function getParagonOsTermsContent(locale: 'pl' | 'en'): LegalDocumentContent {
  return locale === 'en' ? EN : PL;
}
