import type { LegalDocumentContent, LegalLocale } from '@/content/legal/types';

const LOCALE_LINKS: Record<LegalLocale, { label: string; href: string }[]> = {
  pl: [
    { label: 'English', href: '/regulamin/en' },
    { label: 'Українська', href: '/regulamin/uk' },
  ],
  en: [
    { label: 'Polski', href: '/regulamin' },
    { label: 'Українська', href: '/regulamin/uk' },
  ],
  uk: [
    { label: 'Polski', href: '/regulamin' },
    { label: 'English', href: '/regulamin/en' },
  ],
};

const RELATED_PRIVACY: Record<LegalLocale, { label: string; href: string }[]> = {
  pl: [
    { label: 'Polityka prywatności (PL)', href: '/polityka-prywatnosci' },
    { label: 'Privacy Policy (EN)', href: '/polityka-prywatnosci/en' },
    { label: 'Політика конфіденційності (UK)', href: '/polityka-prywatnosci/uk' },
  ],
  en: [
    { label: 'Privacy Policy (EN)', href: '/polityka-prywatnosci/en' },
    { label: 'Polityka prywatności (PL)', href: '/polityka-prywatnosci' },
    { label: 'Політика конфіденційності (UK)', href: '/polityka-prywatnosci/uk' },
  ],
  uk: [
    { label: 'Політика конфіденційності (UK)', href: '/polityka-prywatnosci/uk' },
    { label: 'Polityka prywatności (PL)', href: '/polityka-prywatnosci' },
    { label: 'Privacy Policy (EN)', href: '/polityka-prywatnosci/en' },
  ],
};

const PL: LegalDocumentContent = {
  locale: 'pl',
  metaTitle: 'Regulamin | EstateOS™',
  metaDescription:
    'Regulamin korzystania z platformy EstateOS™ — mapa, ogłoszenia, Radar, CRM, plany partnerskie, moderacja i kontakt.',
  canonical: 'https://estateos.pl/regulamin',
  title: 'Regulamin Serwisu EstateOS™',
  updatedLabel: 'Obowiązuje od:',
  updated: '26 czerwca 2026 r.',
  intro:
    'Niniejszy Regulamin określa zasady korzystania z serwisu internetowego estateos.pl, aplikacji mobilnej EstateOS™ oraz powiązanych usług (łącznie: „Platforma” lub „Serwis”). Korzystanie z Platformy oznacza akceptację postanowień Regulaminu oraz [Polityki prywatności](/polityka-prywatnosci). Jeśli nie akceptujesz tych warunków, nie korzystaj z Serwisu.',
  sections: [
    {
      title: '§1. Postanowienia ogólne i definicje',
      paragraphs: [
        'Administratorem Platformy jest podmiot prowadzący serwis EstateOS™ (dalej: „Administrator”). W sprawach operacyjnych i reklamacyjnych kontakt: kontakt@estateos.pl.',
        'Platforma stanowi środowisko technologiczne umożliwiające przeglądanie i publikowanie ogłoszeń nieruchomości, komunikację między użytkownikami, korzystanie z narzędzi analitycznych (w tym Radaru Inwestycji), funkcji CRM dla biur nieruchomości oraz innych funkcji opisanych w Serwisie.',
        'Administrator nie jest stroną umów cywilnoprawnych zawieranych między użytkownikami w związku z transakcjami dotyczącymi nieruchomości, chyba że wyraźnie wskazano inaczej w odrębnej umowie.',
      ],
      bullets: [
        '**Użytkownik** — osoba fizyczna, prawna lub jednostka organizacyjna korzystająca z Platformy.',
        '**Konto** — indywidualny profil użytkownika w Serwisie.',
        '**Ogłoszenie / Oferta** — treść dotycząca nieruchomości opublikowana lub przechowywana w Platformie.',
        '**Treści użytkownika (UGC)** — wszelkie dane, teksty, zdjęcia, wiadomości i materiały przesyłane przez użytkowników.',
        '**Plan partnerski / subskrypcja** — płatne lub bezpłatne pakiety funkcji (np. Investor Pro, plany Partner dla biur).',
      ],
    },
    {
      title: '§2. Zakres usług Platformy',
      paragraphs: [
        'W zależności od roli użytkownika i dostępnych planów, Platforma może obejmować m.in.:',
      ],
      bullets: [
        'interaktywną mapę ofert i wyszukiwanie nieruchomości;',
        'katalog ogłoszeń, ulubione, powiadomienia i profile publikujących;',
        'Radar Inwestycji — narzędzia wyszukiwania, alertów i analizy rynku;',
        'publikację ogłoszeń przez właścicieli, agentów i biura nieruchomości;',
        'CRM biura — zarządzanie zespołem, leadami, kredytami publikacji i statusem partnera;',
        'import profilu i ofert z portali zewnętrznych (np. ścieżka /dolacz);',
        'Open House — planowanie i promowanie dni otwartych;',
        'wiadomości i kontakt między użytkownikami;',
        'Deal Room i programy partnerskie;',
        'weryfikację kont, moderację treści i panel administracyjny.',
        'Administrator może rozwijać, modyfikować lub wycofywać funkcje z zachowaniem obowiązującego prawa oraz z odpowiednim wyprzedzeniem w przypadku istotnych zmian płatnych planów.',
      ],
    },
    {
      title: '§3. Typy użytkowników',
      paragraphs: [
        'Platforma obsługuje różne role użytkowników, w tym:',
      ],
      bullets: [
        '**Kupujący / najemcy** — przeglądanie ofert, Radar, ulubione, kontakt z publikującymi.',
        '**Właściciele / sprzedający** — dodawanie i zarządzanie własnymi ogłoszeniami.',
        '**Agenci** — publikacja w imieniu biura lub właściciela, obsługa leadów.',
        '**Biura nieruchomości (agencje)** — CRM, zespół, plany partnerskie, dystrybucja kredytów publikacji.',
        '**Inwestorzy** — rozszerzone funkcje Radaru i planów PRO.',
        'Rola użytkownika wynika z danych podanych przy rejestracji, ustawień konta oraz aktywnych planów. Użytkownik zobowiązany jest do korzystania z funkcji zgodnie z faktycznym statusem i uprawnieniami.',
      ],
    },
    {
      title: '§4. Rejestracja, konto i bezpieczeństwo',
      paragraphs: [
        'Założenie Konta wymaga podania prawdziwych i aktualnych danych w zakresie wymaganym przez Serwis. Użytkownik ponosi odpowiedzialność za działania wykonane z użyciem swojego Konta.',
        'Użytkownik zobowiązany jest do zachowania poufności danych logowania, haseł, kodów jednorazowych i kluczy dostępu (w tym Passkey). W przypadku podejrzenia nieautoryzowanego dostępu należy niezwłocznie zmienić dane dostępu i poinformować Administratora: kontakt@estateos.pl.',
        'Administrator może odmówić rejestracji, zawiesić lub usunąć Konto w przypadku naruszenia Regulaminu, podejrzenia nadużycia, obowiązku prawnego lub w celu ochrony innych użytkowników.',
        'Jedno Konto jest przypisane do jednej osoby fizycznej, chyba że Serwis wyraźnie przewiduje konto organizacyjne biura z wieloma użytkownikami w ramach CRM.',
      ],
    },
    {
      title: '§5. Subskrypcje, płatności i rozliczenia',
      paragraphs: [
        'Wybrane funkcje Platformy są dostępne w ramach płatnych planów (np. Investor Pro, pakiety Partner dla biur) lub bezpłatnych limitów promocyjnych. Aktualny zakres planów, ceny i limity publikacji są prezentowane w Serwisie w chwili zakupu.',
        'Płatności online na stronie internetowej mogą być realizowane za pośrednictwem Stripe lub innego dostawcy płatności wskazanego w procesie zakupu. Płatności w aplikacji mobilnej mogą być realizowane przez sklepy Apple App Store lub Google Play (zakupy w aplikacji — IAP), zgodnie z regulaminami tych platform.',
        'Subskrypcje odnawialne są automatycznie przedłużane do momentu anulowania przez użytkownika zgodnie z zasadami danego kanału płatności (konto Stripe, ustawienia App Store / Google Play lub panel w Serwisie, jeśli dostępny).',
        'Administrator nie gwarantuje stałości cen i zakresu planów; zmiany cen dla nowych zakupów nie wpływają na już opłacony okres rozliczeniowy, o ile prawo lub regulamin sklepu nie stanowi inaczej.',
        'Reklamacje dotyczące rozliczeń należy kierować na kontakt@estateos.pl, podając identyfikator transakcji, datę i opis problemu.',
      ],
    },
    {
      title: '§6. Publikacja ogłoszeń i treści użytkowników',
      paragraphs: [
        'Publikując Ogłoszenie lub inne Treści użytkownika, użytkownik oświadcza, że posiada prawo do ich publikacji oraz że treści są zgodne z prawem i niniejszym Regulaminem.',
        'Użytkownik udziela Administratorowi niewyłącznej, nieodpłatnej licencji na przechowywanie, wyświetlanie, techniczne przetwarzanie i udostępnianie Treści w zakresie niezbędnym do świadczenia usług Platformy (w tym na mapie, w aplikacji mobilnej, w podglądach linków i materiałach promocyjnych Serwisu).',
        'Nowe lub istotnie zmienione Ogłoszenia mogą otrzymać status **PENDING** (oczekujące) do czasu weryfikacji lub moderacji. Administrator może odmówić publikacji lub wycofać Ogłoszenie bez podania przyczyny w przypadku naruszenia Regulaminu lub przepisów prawa.',
        'Użytkownik ponosi pełną odpowiedzialność za treść Ogłoszeń, w tym za dokładność danych o nieruchomości, cenę, lokalizację, zdjęcia i dane kontaktowe.',
      ],
    },
    {
      title: '§7. Moderacja, weryfikacja i zgłoszenia',
      paragraphs: [
        'Administrator stosuje środki moderacji w celu zapewnienia bezpieczeństwa, jakości rynku i zgodności z prawem. Moderacja może obejmować automatyczne filtry, przegląd manualny, weryfikację tożsamości lub statusu biura oraz blokadę funkcji.',
        'Użytkownicy mogą zgłaszać naruszenia Regulaminu za pomocą mechanizmów dostępnych w Serwisie (np. zgłoszenie ogłoszenia, kontakt z obsługą). Administrator rozpatruje zgłoszenia w rozsądnym terminie, jednak nie gwarantuje usunięcia treści w określonym czasie.',
        'Decyzje moderacyjne mogą obejmować: odmowę publikacji, ukrycie Ogłoszenia, ograniczenie widoczności, wstrzymanie wiadomości, degradację planu, czasowe lub trwałe zawieszenie Konta.',
      ],
    },
    {
      title: '§8. Treści zabronione',
      paragraphs: ['Zabronione jest publikowanie lub przesyłanie Treści, które:'],
      bullets: [
        'naruszają prawo polskie, unijne lub międzynarodowe;',
        'są wprowadzające w błąd, fałszywe lub podszywające się pod inne osoby lub podmioty;',
        'naruszają dobra osobiste, prawa autorskie, znaki towarowe lub tajemnicę przedsiębiorstwa;',
        'zawierają treści dyskryminujące, nawołujące do nienawiści, obsceniczne lub szkodliwe;',
        'promują oszustwa, phishing, spam lub nieautoryzowane programy partnerskie;',
        'ujawniają dane osobowe osób trzecich bez podstawy prawnej;',
        'dotyczą nieruchomości, do których użytkownik nie ma uprawnień do reprezentacji.',
      ],
    },
    {
      title: '§9. Własność intelektualna',
      paragraphs: [
        'Oznaczenia EstateOS™, layout Platformy, oprogramowanie, bazy danych, grafiki interfejsu i inne elementy Serwisu podlegają ochronie prawnej Administratora lub jego licencjodawców. Użytkownik nie nabywa żadnych praw własnościowych do Platformy.',
        'Kopiowanie, dekompilacja, scraping masowy, tworzenie utworów zależnych lub komercyjne wykorzystanie danych Platformy bez pisemnej zgody Administratora jest zabronione, z wyjątkiem dozwolonego użytku osobistego i udostępniania linków do Ogłoszeń.',
      ],
    },
    {
      title: '§10. Odpowiedzialność i ograniczenia',
      paragraphs: [
        'Platforma jest świadczona w modelu „tak jak jest” (as is), w granicach dopuszczalnych przez prawo. Administrator dokłada starań, aby Serwis był dostępny i bezpieczny, jednak nie gwarantuje nieprzerwanego działania ani braku błędów.',
        'Administrator nie ponosi odpowiedzialności za treść Ogłoszeń, zachowanie użytkowników, przebieg negocjacji, umowy między użytkownikami ani szkody wynikłe z transakcji dotyczących nieruchomości.',
        'W zakresie dopuszczalnym przez prawo odpowiedzialność Administratora wobec użytkownika będącego konsumentem lub przedsiębiorcą na prawach konsumenta jest ograniczona do rzeczywistych strat bezpośrednich, z wyłączeniem utraconych korzyści, chyba że przepisy bezwzględnie stanowią inaczej.',
        'Postanowienia niniejszego paragrafu nie wyłączają odpowiedzialności, której wyłączyć nie można na mocy bezwzględnie obowiązujących przepisów.',
      ],
    },
    {
      title: '§11. Rozwiązanie umowy i usunięcie konta',
      paragraphs: [
        'Użytkownik może w każdej chwili zaprzestać korzystania z Platformy i — jeśli Serwis udostępnia taką funkcję — złożyć wniosek o usunięcie Konta. Usunięcie Konta może wymagać zakończenia aktywnych subskrypcji zgodnie z zasadami dostawcy płatności.',
        'Administrator może zawiesić lub usunąć Konto w przypadku rażącego lub powtarzającego się naruszenia Regulaminu, zaleceń organów lub w celu ochrony bezpieczeństwa Platformy.',
        'Po usunięciu Konta dane mogą być przechowywane przez okres wymagany prawem lub niezbędny do obrony roszczeń — zgodnie z [Polityką prywatności](/polityka-prywatnosci).',
      ],
    },
    {
      title: '§12. Reklamacje i kontakt',
      paragraphs: [
        'Reklamacje dotyczące działania Platformy, moderacji lub rozliczeń można kierować na adres kontakt@estateos.pl, podając dane Konta i opis sprawy. Administrator odpowiada w rozsądnym terminie, nie dłuższym niż wynika to z obowiązujących przepisów o konsumentach, jeśli mają zastosowanie.',
        'Konsumenci mogą skorzystać z pozasądowych sposobów rozpatrywania sporów, w tym platformy ODR UE: https://ec.europa.eu/consumers/odr.',
      ],
    },
    {
      title: '§13. Zmiany Regulaminu',
      paragraphs: [
        'Administrator może zmieniać Regulamin z przyczyn prawnych, organizacyjnych, technicznych lub produktowych. O istotnych zmianach użytkownicy zostaną poinformowani w sposób odpowiedni do Serwisu (np. komunikat w aplikacji, e-mail lub banner na stronie).',
        'Dalsze korzystanie z Platformy po wejściu w życie zmian oznacza akceptację nowego Regulaminu, o ile prawo nie wymaga wyraźnej zgody lub umożliwia odstąpienie.',
      ],
    },
    {
      title: '§14. Postanowienia końcowe',
      paragraphs: [
        'W sprawach nieuregulowanych Regulaminem zastosowanie mają przepisy prawa polskiego, w szczególności Kodeksu cywilnego oraz ustawy o prawach konsumenta, o ile użytkownik jest konsumentem.',
        'Jeżeli którekolwiek postanowienie Regulaminu okaże się nieważne, pozostałe zachowują moc. Wersje językowe Regulaminu w PL, EN i UK mają charakter informacyjny; w razie rozbieżności pierwszeństwo ma wersja polska, o ile prawo nie stanowi inaczej.',
      ],
    },
  ],
  relatedLinks: RELATED_PRIVACY.pl,
  localeLinks: LOCALE_LINKS.pl,
};

const EN: LegalDocumentContent = {
  locale: 'en',
  metaTitle: 'Terms of Service | EstateOS™',
  metaDescription:
    'Terms of Service for the EstateOS™ platform — map, listings, Radar, CRM, partner plans, moderation, and contact.',
  canonical: 'https://estateos.pl/regulamin/en',
  title: 'Terms of Service — EstateOS™',
  updatedLabel: 'Effective from:',
  updated: '26 June 2026',
  intro:
    'These Terms of Service govern your use of the estateos.pl website, the EstateOS™ mobile application, and related services (together, the “Platform” or “Service”). By using the Platform, you accept these Terms and our [Privacy Policy](/polityka-prywatnosci/en). If you do not agree, do not use the Service.',
  sections: [
    {
      title: '1. General provisions and definitions',
      paragraphs: [
        'The Platform is operated by the entity running EstateOS™ (the “Operator”). For operational and complaint matters: kontakt@estateos.pl.',
        'The Platform is a technology environment for browsing and publishing property listings, user communication, market analysis tools (including Investment Radar), real-estate agency CRM, and other features described in the Service.',
        'Unless expressly stated otherwise in a separate agreement, the Operator is not a party to civil-law contracts between users regarding property transactions.',
      ],
      bullets: [
        '**User** — a natural person, legal entity, or organizational unit using the Platform.',
        '**Account** — an individual user profile in the Service.',
        '**Listing / Offer** — property-related content published or stored on the Platform.',
        '**User content (UGC)** — any data, text, photos, messages, and materials submitted by users.',
        '**Partner plan / subscription** — paid or free feature packages (e.g. Investor Pro, Partner plans for agencies).',
      ],
    },
    {
      title: '2. Scope of Platform services',
      paragraphs: ['Depending on user role and available plans, the Platform may include:'],
      bullets: [
        'interactive property map and search;',
        'listing catalog, favorites, notifications, and publisher profiles;',
        'Investment Radar — search, alerts, and market analysis tools;',
        'listing publication by owners, agents, and agencies;',
        'agency CRM — team management, leads, publication credits, and partner status;',
        'profile and listing import from external portals (e.g. /dolacz onboarding);',
        'Open House — scheduling and promotion of open viewing days;',
        'messaging and contact between users;',
        'Deal Room and partner programs;',
        'account verification, content moderation, and administrative tools.',
        'The Operator may develop, modify, or discontinue features in compliance with applicable law and with reasonable notice for material changes to paid plans.',
      ],
    },
    {
      title: '3. User types',
      paragraphs: ['The Platform supports different user roles, including:'],
      bullets: [
        '**Buyers / tenants** — browsing listings, Radar, favorites, contacting publishers.',
        '**Owners / sellers** — adding and managing their own listings.',
        '**Agents** — publishing on behalf of an agency or owner, handling leads.',
        '**Real-estate agencies** — CRM, team, partner plans, publication credit distribution.',
        '**Investors** — extended Radar and PRO plan features.',
        'Your role follows registration data, account settings, and active plans. You must use features consistent with your actual status and permissions.',
      ],
    },
    {
      title: '4. Registration, account, and security',
      paragraphs: [
        'Creating an Account requires accurate and current information as required by the Service. You are responsible for actions performed through your Account.',
        'You must keep login credentials, passwords, one-time codes, and access keys (including Passkeys) confidential. If you suspect unauthorized access, change your credentials immediately and notify the Operator at kontakt@estateos.pl.',
        'The Operator may refuse registration, suspend, or delete an Account in case of Terms violations, suspected abuse, legal obligation, or to protect other users.',
        'One Account belongs to one natural person unless the Service explicitly provides an organizational agency account with multiple CRM users.',
      ],
    },
    {
      title: '5. Subscriptions, payments, and billing',
      paragraphs: [
        'Selected Platform features are available under paid plans (e.g. Investor Pro, Partner packages for agencies) or free promotional limits. Current plan scope, prices, and publication limits are shown at purchase.',
        'Online payments on the website may be processed via Stripe or another payment provider indicated at checkout. Mobile app payments may be processed through the Apple App Store or Google Play (in-app purchases — IAP) under those platforms’ terms.',
        'Renewable subscriptions auto-renew until cancelled through the relevant payment channel (Stripe account, App Store / Google Play settings, or in-Service panel where available).',
        'The Operator does not guarantee fixed prices or plan scope; price changes for new purchases do not affect an already paid billing period unless law or store terms require otherwise.',
        'Billing complaints should be sent to kontakt@estateos.pl with transaction ID, date, and issue description.',
      ],
    },
    {
      title: '6. Listing publication and user content',
      paragraphs: [
        'By publishing a Listing or other user content, you represent that you have the right to publish it and that it complies with law and these Terms.',
        'You grant the Operator a non-exclusive, royalty-free license to store, display, technically process, and share content as necessary to provide Platform services (including on the map, in the mobile app, link previews, and Service promotional materials).',
        'New or materially changed Listings may receive **PENDING** status until verification or moderation. The Operator may refuse publication or remove a Listing without stating a reason if the Terms or law are violated.',
        'You are fully responsible for Listing content, including accuracy of property data, price, location, photos, and contact details.',
      ],
    },
    {
      title: '7. Moderation, verification, and reports',
      paragraphs: [
        'The Operator applies moderation measures to ensure safety, market quality, and legal compliance. Moderation may include automated filters, manual review, identity or agency status verification, and feature restrictions.',
        'Users may report Terms violations through in-Service mechanisms (e.g. report listing, support contact). The Operator reviews reports within a reasonable time but does not guarantee removal within a specific deadline.',
        'Moderation decisions may include: publication refusal, listing hiding, visibility limits, message holds, plan downgrade, temporary or permanent Account suspension.',
      ],
    },
    {
      title: '8. Prohibited content',
      paragraphs: ['You must not publish or transmit content that:'],
      bullets: [
        'violates Polish, EU, or international law;',
        'is misleading, false, or impersonates others;',
        'infringes personality rights, copyright, trademarks, or trade secrets;',
        'is discriminatory, hateful, obscene, or harmful;',
        'promotes fraud, phishing, spam, or unauthorized partner schemes;',
        'discloses third-party personal data without legal basis;',
        'concerns property you are not authorized to represent.',
      ],
    },
    {
      title: '9. Intellectual property',
      paragraphs: [
        'EstateOS™ branding, Platform layout, software, databases, interface graphics, and other Service elements are protected by the Operator or its licensors. Users acquire no ownership rights in the Platform.',
        'Copying, decompiling, mass scraping, creating derivative works, or commercial use of Platform data without written Operator consent is prohibited, except for permitted personal use and sharing links to Listings.',
      ],
    },
    {
      title: '10. Liability and limitations',
      paragraphs: [
        'The Platform is provided “as is” to the extent permitted by law. The Operator strives for availability and security but does not guarantee uninterrupted operation or error-free service.',
        'The Operator is not liable for Listing content, user conduct, negotiation outcomes, contracts between users, or damages from property transactions.',
        'To the extent permitted by law, the Operator’s liability to a consumer or consumer-equivalent user is limited to direct actual losses, excluding lost profits, unless mandatory law provides otherwise.',
        'This section does not exclude liability that cannot be excluded under mandatory provisions.',
      ],
    },
    {
      title: '11. Termination and account deletion',
      paragraphs: [
        'You may stop using the Platform at any time and — where available — request Account deletion. Deletion may require ending active subscriptions per payment provider rules.',
        'The Operator may suspend or delete an Account for serious or repeated Terms violations, authority requirements, or Platform safety.',
        'After deletion, data may be retained as required by law or necessary to defend claims — see our [Privacy Policy](/polityka-prywatnosci/en).',
      ],
    },
    {
      title: '12. Complaints and contact',
      paragraphs: [
        'Complaints about the Platform, moderation, or billing may be sent to kontakt@estateos.pl with Account details and issue description. The Operator responds within a reasonable time, not exceeding consumer-law deadlines where applicable.',
        'Consumers may use out-of-court dispute resolution, including the EU ODR platform: https://ec.europa.eu/consumers/odr.',
      ],
    },
    {
      title: '13. Changes to these Terms',
      paragraphs: [
        'The Operator may change these Terms for legal, organizational, technical, or product reasons. Material changes will be communicated appropriately (e.g. in-app notice, email, or site banner).',
        'Continued use after changes take effect constitutes acceptance unless law requires express consent or allows withdrawal.',
      ],
    },
    {
      title: '14. Final provisions',
      paragraphs: [
        'Matters not covered by these Terms are governed by Polish law, including the Civil Code and consumer protection law where applicable.',
        'PL, EN, and UK language versions are provided for convenience; in case of discrepancy, the Polish version prevails unless law requires otherwise.',
      ],
    },
  ],
  relatedLinks: RELATED_PRIVACY.en,
  localeLinks: LOCALE_LINKS.en,
};

const UK: LegalDocumentContent = {
  locale: 'uk',
  metaTitle: 'Умови користування | EstateOS™',
  metaDescription:
    'Умови користування платформою EstateOS™ — карта, оголошення, Radar, CRM, партнерські плани, модерація та контакт.',
  canonical: 'https://estateos.pl/regulamin/uk',
  title: 'Умови користування сервісом EstateOS™',
  updatedLabel: 'Діє з:',
  updated: '26 червня 2026 р.',
  intro:
    'Ці Умови користування визначають правила використання вебсайту estateos.pl, мобільного застосунку EstateOS™ та пов’язаних послуг (разом — «Платформа» або «Сервіс»). Користуючись Платформою, ви приймаєте ці Умови та нашу [Політику конфіденційності](/polityka-prywatnosci/uk). Якщо ви не погоджуєтесь, не користуйтеся Сервісом.',
  sections: [
    {
      title: '§1. Загальні положення та визначення',
      paragraphs: [
        'Адміністратором Платформи є суб’єкт, що керує сервісом EstateOS™ (далі — «Адміністратор»). З операційних питань і скарг: kontakt@estateos.pl.',
        'Платформа є технологічним середовищем для перегляду та публікації оголошень про нерухомість, спілкування між користувачами, аналітичних інструментів (зокрема Інвестиційного Radar), CRM для агентств нерухомості та інших функцій, описаних у Сервісі.',
        'Адміністратор не є стороною цивільно-правових договорів між користувачами щодо угод з нерухомістю, якщо інше прямо не передбачено окремою угодою.',
      ],
      bullets: [
        '**Користувач** — фізична або юридична особа, що користується Платформою.',
        '**Обліковий запис** — індивідуальний профіль користувача в Сервісі.',
        '**Оголошення / Пропозиція** — контент про нерухомість, опублікований або збережений на Платформі.',
        '**Контент користувача (UGC)** — будь-які дані, тексти, фото, повідомлення та матеріали, надіслані користувачами.',
        '**Партнерський план / підписка** — платні або безкоштовні пакети функцій (наприклад, Investor Pro, Partner для агентств).',
      ],
    },
    {
      title: '§2. Обсяг послуг Платформи',
      paragraphs: ['Залежно від ролі користувача та доступних планів Платформа може включати:'],
      bullets: [
        'інтерактивну карту пропозицій і пошук нерухомості;',
        'каталог оголошень, обране, сповіщення та профілі видавців;',
        'Інвестиційний Radar — пошук, сповіщення та аналіз ринку;',
        'публікацію оголошень власниками, агентами та агентствами;',
        'CRM агентства — управління командою, лідами, кредитами публікацій і статусом партнера;',
        'імпорт профілю та оголошень із зовнішніх порталів (наприклад, шлях /dolacz);',
        'Open House — планування та просування днів відкритих дверей;',
        'повідомлення та контакт між користувачами;',
        'Deal Room і партнерські програми;',
        'верифікацію облікових записів, модерацію контенту та адміністративні інструменти.',
        'Адміністратор може розвивати, змінювати або припиняти функції відповідно до закону та з належним попередженням у разі суттєвих змін платних планів.',
      ],
    },
    {
      title: '§3. Типи користувачів',
      paragraphs: ['Платформа підтримує різні ролі користувачів, зокрема:'],
      bullets: [
        '**Покупці / орендарі** — перегляд пропозицій, Radar, обране, контакт із видавцями.',
        '**Власники / продавці** — додавання та керування власними оголошеннями.',
        '**Агенти** — публікація від імені агентства або власника, обробка лідів.',
        '**Агентства нерухомості** — CRM, команда, партнерські плани, розподіл кредитів публікацій.',
        '**Інвестори** — розширені функції Radar і планів PRO.',
        'Роль визначається даними реєстрації, налаштуваннями облікового запису та активними планами. Користувач зобов’язаний користуватися функціями відповідно до свого фактичного статусу та повноважень.',
      ],
    },
    {
      title: '§4. Реєстрація, обліковий запис і безпека',
      paragraphs: [
        'Створення Облікового запису вимагає достовірних і актуальних даних у обсязі, передбаченому Сервісом. Користувач несе відповідальність за дії, виконані через свій Обліковий запис.',
        'Користувач зобов’язаний зберігати конфіденційність даних входу, паролів, одноразових кодів і ключів доступу (зокрема Passkey). У разі підозри на несанкціонований доступ негайно змініть дані доступу та повідомте Адміністратора: kontakt@estateos.pl.',
        'Адміністратор може відмовити в реєстрації, призупинити або видалити Обліковий запис у разі порушення Умов, підозри на зловживання, правової вимоги або для захисту інших користувачів.',
        'Один Обліковий запис належить одній фізичній особі, якщо Сервіс прямо не передбачає організаційний обліковий запис агентства з кількома користувачами CRM.',
      ],
    },
    {
      title: '§5. Підписки, платежі та розрахунки',
      paragraphs: [
        'Окремі функції Платформи доступні в рамках платних планів (наприклад, Investor Pro, пакети Partner для агентств) або безкоштовних промо-лімітів. Актуальний обсяг планів, ціни та ліміти публікацій показуються під час покупки.',
        'Онлайн-платежі на вебсайті можуть здійснюватися через Stripe або іншого платіжного провайдера, зазначеного під час оформлення. Платежі в мобільному застосунку можуть здійснюватися через Apple App Store або Google Play (покупки в застосунку — IAP) відповідно до правил цих платформ.',
        'Підписки з автопродовженням поновлюються до скасування користувачем відповідно до правил каналу оплати (обліковий запис Stripe, налаштування App Store / Google Play або панель у Сервісі, якщо доступна).',
        'Адміністратор не гарантує незмінність цін і обсягу планів; зміни цін для нових покупок не впливають на вже оплачений розрахунковий період, якщо закон або правила магазину не передбачають інше.',
        'Скарги щодо розрахунків надсилайте на kontakt@estateos.pl із ідентифікатором транзакції, датою та описом проблеми.',
      ],
    },
    {
      title: '§6. Публікація оголошень і контент користувача',
      paragraphs: [
        'Публікуючи Оголошення або інший контент, користувач підтверджує право на публікацію та відповідність закону й цим Умовам.',
        'Користувач надає Адміністратору невиключну безоплатну ліцензію на зберігання, відображення, технічну обробку та поширення контенту в обсязі, необхідному для надання послуг Платформи (зокрема на карті, у мобільному застосунку, у попередніх переглядах посилань і промоматеріалах Сервісу).',
        'Нові або суттєво змінені Оголошення можуть отримати статус **PENDING** (очікує) до верифікації або модерації. Адміністратор може відмовити в публікації або зняти Оголошення без зазначення причини у разі порушення Умов або закону.',
        'Користувач несе повну відповідальність за зміст Оголошень, зокрема за точність даних про нерухомість, ціну, локацію, фото та контактні дані.',
      ],
    },
    {
      title: '§7. Модерація, верифікація та скарги',
      paragraphs: [
        'Адміністратор застосовує заходи модерації для забезпечення безпеки, якості ринку та дотримання закону. Модерація може включати автоматичні фільтри, ручну перевірку, верифікацію особи або статусу агентства та обмеження функцій.',
        'Користувачі можуть повідомляти про порушення Умов через механізми в Сервісі (наприклад, скарга на оголошення, звернення до підтримки). Адміністратор розглядає скарги в розумний строк, але не гарантує видалення в конкретний термін.',
        'Рішення модерації можуть включати: відмову в публікації, приховування Оголошення, обмеження видимості, утримання повідомлень, пониження плану, тимчасове або постійне призупинення Облікового запису.',
      ],
    },
    {
      title: '§8. Заборонений контент',
      paragraphs: ['Заборонено публікувати або передавати контент, який:'],
      bullets: [
        'порушує польське, європейське або міжнародне право;',
        'є оманливим, неправдивим або видає себе за інших осіб чи суб’єктів;',
        'порушує особисті немайнові права, авторське право, торговельні марки або комерційну таємницю;',
        'містить дискримінаційний, мову ворожнечі, непристойний або шкідливий зміст;',
        'просуває шахрайство, фішинг, спам або несанкціоновані партнерські схеми;',
        'розкриває персональні дані третіх осіб без правової підстави;',
        'стосується нерухомості, яку користувач не уповноважений представляти.',
      ],
    },
    {
      title: '§9. Інтелектуальна власність',
      paragraphs: [
        'Позначення EstateOS™, оформлення Платформи, програмне забезпечення, бази даних, графіка інтерфейсу та інші елементи Сервісу охороняються Адміністратором або його ліцензіарами. Користувач не набуває прав власності на Платформу.',
        'Копіювання, декомпіляція, масовий скрапінг, створення похідних творів або комерційне використання даних Платформи без письмової згоди Адміністратора заборонені, за винятком дозволеного особистого використання та поширення посилань на Оголошення.',
      ],
    },
    {
      title: '§10. Відповідальність та обмеження',
      paragraphs: [
        'Платформа надається «як є» в межах, дозволених законом. Адміністратор докладає зусиль для доступності та безпеки, але не гарантує безперебійної роботи чи відсутності помилок.',
        'Адміністратор не відповідає за зміст Оголошень, поведінку користувачів, перебіг переговорів, договори між користувачами чи збитки від угод з нерухомістю.',
        'У межах, дозволених законом, відповідальність Адміністратора перед споживачем або користувачем із правами споживача обмежується прямими фактичними збитками без втраченої вигоди, якщо імперативні норми не передбачають інше.',
        'Положення цього розділу не виключають відповідальність, яку не можна виключити імперативними нормами.',
      ],
    },
    {
      title: '§11. Припинення договору та видалення облікового запису',
      paragraphs: [
        'Користувач може припинити користування Платформою в будь-який час і — якщо Сервіс надає таку функцію — подати запит на видалення Облікового запису. Видалення може вимагати завершення активних підписок відповідно до правил платіжного провайдера.',
        'Адміністратор може призупинити або видалити Обліковий запис у разі грубого або повторного порушення Умов, вимог органів або для захисту безпеки Платформи.',
        'Після видалення дані можуть зберігатися протягом строку, вимагаємого законом або необхідного для захисту претензій — згідно з [Політикою конфіденційності](/polityka-prywatnosci/uk).',
      ],
    },
    {
      title: '§12. Скарги та контакт',
      paragraphs: [
        'Скарги щодо роботи Платформи, модерації або розрахунків надсилайте на kontakt@estateos.pl із даними Облікового запису та описом справи. Адміністратор відповідає в розумний строк, не довший за строки, передбачені законом про захист споживачів, якщо вони застосовні.',
        'Споживачі можуть скористатися позасудовим вирішенням спорів, зокрема платформою ODR ЄС: https://ec.europa.eu/consumers/odr.',
      ],
    },
    {
      title: '§13. Зміни Умов',
      paragraphs: [
        'Адміністратор може змінювати Умови з правових, організаційних, технічних або продуктових причин. Про суттєві зміни користувачів буде повідомлено належним чином (наприклад, повідомлення в застосунку, e-mail або банер на сайті).',
        'Подальше користування після набрання чинності змін означає прийняття нових Умов, якщо закон не вимагає явної згоди або не надає права відмови.',
      ],
    },
    {
      title: '§14. Заключні положення',
      paragraphs: [
        'Питання, не врегульовані цими Умовами, регулюються польським правом, зокрема Цивільним кодексом і законом про права споживачів, якщо користувач є споживачем.',
        'Версії PL, EN та UK надаються для зручності; у разі розбіжностей перевага має польська версія, якщо закон не передбачає інше.',
      ],
    },
  ],
  relatedLinks: RELATED_PRIVACY.uk,
  localeLinks: LOCALE_LINKS.uk,
};

const BY_LOCALE: Record<LegalLocale, LegalDocumentContent> = { pl: PL, en: EN, uk: UK };

export function getTermsContent(locale: LegalLocale): LegalDocumentContent {
  return BY_LOCALE[locale];
}
