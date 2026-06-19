import type { Locale } from "@/i18n/config";

export type HelpSection = {
  id: string;
  icon: "map" | "store" | "user" | "radar" | "heart" | "plus" | "deal" | "shield" | "phone";
  title: string;
  summary: string;
  bullets: string[];
  links?: { label: string; href: string }[];
};

export type PlatformHelpContent = {
  modalTitle: string;
  modalSubtitle: string;
  tocLabel: string;
  sections: HelpSection[];
};

const PL: PlatformHelpContent = {
  modalTitle: "Centrum pomocy EstateOS™",
  modalSubtitle:
    "Przewodnik po platformie — od mapy i rynku, przez konto i Radar Inwestycji, po publikację ogłoszeń i Deal Room.",
  tocLabel: "Spis treści",
  sections: [
    {
      id: "start",
      icon: "user",
      title: "Zacznij tutaj — jedno konto, dwa światy",
      summary:
        "EstateOS™ łączy stronę estateos.pl i aplikację mobilną. To ten sam rynek ofert, to samo logowanie i te same ulubione — możesz szukać na mapie, kalibrować Radar i wystawiać nieruchomość z telefonu lub przeglądarki.",
      bullets: [
        "Załóż konto lub zaloguj się — dostępny jest też Passkey (logowanie biometryczne w aplikacji).",
        "Kupujący: mapa, ulubione, Radar Inwestycji w Moje konto.",
        "Sprzedający: Dodaj swoją ofertę → publikacja → zarządzanie w Moje ogłoszenia.",
        "Partner / inwestor PRO: rozszerzony Radar, Deal Room i statusy Elite.",
      ],
      links: [
        { label: "Zaloguj się", href: "/login" },
        { label: "Szukaj na mapie", href: "/odkryj-mape" },
      ],
    },
    {
      id: "map",
      icon: "map",
      title: "Odkryj mapę — eksploracja bez formularzy",
      summary:
        "Mapa to pełnoekranowy widok Mapbox. Nie wybierasz miasta z listy — przesuwasz globus, przybliżasz region i klikasz pinezki. Kolory mówią, jaki to typ transakcji.",
      bullets: [
        "Na sprzedaż (zielone pinezki) / Na wynajem (niebieskie) — przełącznik u góry ekranu.",
        "Suwak maks. ceny filtruje oferty na żywo — zbyt drogie znikają z mapy.",
        "Zlokalizuj mnie — mapa płynnie przenosi Cię do Twojej okolicy (wymaga zgody na lokalizację w przeglądarce).",
        "Pomarańczowa pinezka = oferta Deal Room (program partnerski).",
        "Kliknięcie pinezki: po zalogowaniu otwiera kartę oferty; gość zobaczy prośbę o logowanie.",
      ],
      links: [{ label: "Otwórz mapę", href: "/odkryj-mape" }],
    },
    {
      id: "market",
      icon: "store",
      title: "Rynek nieruchomości — katalog ogłoszeń",
      summary:
        "Lista wszystkich aktywnych ofert w formie kart. To ten sam zbiór co na mapie, wygodny do przeglądania z filtrem wizualnym i szybkiego porównania.",
      bullets: [
        "Serduszko na karcie dodaje ofertę do Ulubionych (wymaga konta).",
        "Kliknięcie karty prowadzi do szczegółów: zdjęcia, cena, lokalizacja, profil wystawcy.",
        "Oferty mogą być w fazie „przed premierą na rynku” — pełny adres i galeria widoczne wcześniej dla PRO i właściciela.",
      ],
      links: [{ label: "Przeglądaj rynek", href: "/oferty" }],
    },
    {
      id: "account",
      icon: "user",
      title: "Moje konto (CRM) — centrum zarządzania",
      summary:
        "Po zalogowaniu wchodzisz w panel z zakładkami. To odpowiednik aplikacji mobilnej: Radar, Twoje ogłoszenia, Ulubione, Planowanie i Transakcje.",
      bullets: [
        "Radar inwestycji — ustawiasz lokalizację (mapa lub miasto), metraż, budżet, sprzedaż/wynajem; system pokazuje dopasowania.",
        "Kalibruj radar — ten sam ritual co w aplikacji; zapis trafia na serwer i synchronizuje się z mobile.",
        "Moje ogłoszenia — statusy aktywne / oczekujące / zakończone, odnowienia, statystyki.",
        "Ulubione — lista ofert oznaczonych serduszkiem (zsynchronizowana z kontem).",
        "Planowanie — kalendarz spotkań i wizyt.",
        "Transakcje — Deal Roomy (prywatne pokoje negocjacyjne).",
      ],
      links: [{ label: "Moje konto", href: "/moje-konto" }],
    },
    {
      id: "radar",
      icon: "radar",
      title: "Radar Inwestycji — jak działa dopasowanie",
      summary:
        "Radar nie wysyła spamu — przelicza rynek według Twoich kryteriów i pokazuje wynik w zakładce Radar. W wersji PRO możesz skanować obszar na mapie lub wiele dzielnic.",
      bullets: [
        "Ustaw próg dopasowania (%) — wyższy = mniej, ale trafniejsze oferty.",
        "Tryb MAP: narysuj obszar na mapie (jak w aplikacji).",
        "Tryb miasto + dzielnice: wybór z katalogu lokalizacji.",
        "Po zapisie preferencji wyniki odświeżają się automatycznie.",
        "Radar PRO / Podwójny skan — dla partnerów i inwestorów PRO (badge w profilu).",
      ],
    },
    {
      id: "favorites",
      icon: "heart",
      title: "Ulubione — obserwacja ofert",
      summary:
        "Serduszko na mapie, w katalogu lub na stronie oferty zapisuje ID w Twoim koncie. Lista jest w zakładce Ulubione w Moje konto.",
      bullets: [
        "Działa na WWW i w aplikacji po zalogowaniu tym samym użytkownikiem.",
        "Usunięcie: ponowne kliknięcie serduszka lub ikona na karcie w Ulubionych.",
        "Powiadomienia o zmianach ceny/statusu — w aplikacji mobilnej (ustawienia push).",
      ],
    },
    {
      id: "listing",
      icon: "plus",
      title: "Dodaj swoją ofertę — publikacja krok po kroku",
      summary:
        "Kreator prowadzi przez lokalizację, parametry, finanse, media i podsumowanie. Oferta po wysłaniu przechodzi weryfikację i pojawia się na mapie oraz rynku.",
      bullets: [
        "Lokalizacja na mapie + adres — dokładność wpływa na Radar i prywatność (tryb przybliżony).",
        "Cena w PLN lub EUR; wynajem: czynsz, kaucja, opłaty.",
        "Zdjęcia i plan — minimum jakości podnosi zaufanie kupujących.",
        "Statusy: aktywna, oczekująca, zakończona/archiwum — zarządzasz w Moje ogłoszenia.",
        "Odnowienie publikacji — po wygaśnięciu możesz przedłużyć (płatność Stripe, jeśli włączona).",
      ],
      links: [{ label: "Dodaj ofertę", href: "/dodaj-oferte" }],
    },
    {
      id: "offer-detail",
      icon: "shield",
      title: "Strona oferty — negocjacje i zaufanie",
      summary:
        "Karta pojedynczej nieruchomości: galeria, parametry, weryfikacja dokumentów, profil wystawcy i akcje (spotkanie, oferta cenowa — zależnie od uprawnień).",
      bullets: [
        "Badge weryfikacji: zweryfikowana / w toku / brak pełnej weryfikacji dokumentów.",
        "Profil wystawcy — kliknij, aby zobaczyć oceny i historię.",
        "Udostępnij link — wygodne przekazanie oferty inwestorowi.",
        "Zgłoś treść — mechanizm moderacji (Report).",
      ],
    },
    {
      id: "deals",
      icon: "deal",
      title: "Deal Room i transakcje",
      summary:
        "Deal Room to zamknięte pokoje dla stron transakcji: wiadomości, propozycje cenowe, dokumenty. Partnerzy mają priorytetowy dostęp do segmentu Deal Room na mapie.",
      bullets: [
        "Zakładka Transakcje w Moje konto — lista aktywnych pokoi.",
        "Powiadomienia o nowych wiadomościach i ofertach w pokoju.",
        "Nie zastępuje umowy prawnej — wspiera proces, decyzje podejmujesz z doradcą.",
      ],
    },
    {
      id: "mobile",
      icon: "phone",
      title: "Aplikacja mobilna a strona WWW",
      summary:
        "Aplikacja EstateOS (iOS/Android) oferuje ten sam rdzeń: Radar na mapie, ulubione, dodawanie oferty, push. Preferencje Radaru i ulubione synchronizują się z serwerem po zalogowaniu.",
      bullets: [
        "Passkey — najszybsze logowanie na telefonie.",
        "Radar na żywo z kalendarzem spotkań w jednym flow.",
        "Strona WWW lepsza do szerokiego monitora i kreatora ogłoszeń z wieloma zdjęciami.",
      ],
    },
    {
      id: "faq",
      icon: "shield",
      title: "Najczęstsze pytania",
      summary: "Szybkie odpowiedzi — jeśli czegoś brakuje, napisz przez Kontakt w stopce.",
      bullets: [
        "Nie widzę mapy? — sprawdź połączenie, odśwież stronę; na serwerze musi być skonfigurowany token Mapbox.",
        "Nie mogę dodać oferty? — musisz być zalogowany; uzupełnij wymagane pola w kreatorze.",
        "Radar pusty? — otwórz Kalibruj radar i zapisz kryteria; poczekaj chwilę na przeliczenie.",
        "Konto PRO? — sekcja EstateOS Elite / cennik; badge PRO w profilu.",
        "Pomoc techniczna: kontakt@estateos.pl przez formularz Kontakt.",
      ],
      links: [{ label: "Regulamin", href: "/regulamin" }, { label: "Prywatność", href: "/polityka-prywatnosci" }],
    },
  ],
};

const EN: PlatformHelpContent = {
  modalTitle: "EstateOS™ Help Center",
  modalSubtitle:
    "A guided tour of the platform — map and market, account and Investment Radar, listings, favorites, and Deal Rooms.",
  tocLabel: "Contents",
  sections: [
    {
      id: "start",
      icon: "user",
      title: "Start here — one account, two surfaces",
      summary:
        "EstateOS™ connects estateos.pl and the mobile app. Same listings, same login, same favorites — search on the map, calibrate Radar, and publish property from phone or browser.",
      bullets: [
        "Create an account or sign in — Passkey (biometric) is available in the app.",
        "Buyers: map, favorites, Investment Radar in My account.",
        "Sellers: Add your listing → publish → manage under My listings.",
        "Partners / PRO investors: extended Radar, Deal Rooms, Elite badges.",
      ],
      links: [
        { label: "Sign in", href: "/login" },
        { label: "Search on the map", href: "/odkryj-mape" },
      ],
    },
    {
      id: "map",
      icon: "map",
      title: "Discover the map — explore without forms",
      summary:
        "The map is a full-screen Mapbox view. Pan the globe, zoom in, and tap pins — no city dropdowns. Colors indicate transaction type.",
      bullets: [
        "For sale (green) / For rent (blue) — toggle at the top.",
        "Max price slider hides offers above your budget in real time.",
        "Locate me — cinematic fly-to your area (browser location permission).",
        "Orange pin = Deal Room (partner program).",
        "Tap a pin: signed-in users open the listing; guests are prompted to log in.",
      ],
      links: [{ label: "Open map", href: "/odkryj-mape" }],
    },
    {
      id: "market",
      icon: "store",
      title: "Market — listing catalog",
      summary:
        "All active listings as cards — the same dataset as the map, optimized for browsing and comparison.",
      bullets: [
        "Heart icon saves to Favorites (account required).",
        "Open a card for photos, price, location, and advertiser profile.",
        "Some listings have a pre-market window — full details early for PRO and owners.",
      ],
      links: [{ label: "Browse market", href: "/oferty" }],
    },
    {
      id: "account",
      icon: "user",
      title: "My account (CRM) — your control center",
      summary:
        "After sign-in you get tabs mirroring the mobile app: Radar, My listings, Favorites, Planning, and Transactions.",
      bullets: [
        "Investment Radar — location, size, budget, sale/rent; matches appear in the Radar tab.",
        "Calibrate radar — same ritual as mobile; saves to the server and syncs.",
        "My listings — active / pending / completed, renewals, stats.",
        "Favorites — heart-saved listings synced to your account.",
        "Planning — appointment calendar.",
        "Transactions — Deal Rooms for negotiations.",
      ],
      links: [{ label: "My account", href: "/moje-konto" }],
    },
    {
      id: "radar",
      icon: "radar",
      title: "Investment Radar — how matching works",
      summary:
        "Radar recalculates the market from your criteria — no spam, just matches in the Radar tab. PRO supports map areas and multiple districts.",
      bullets: [
        "Match threshold (%) — higher means fewer but sharper results.",
        "MAP mode: draw an area on the map.",
        "City + districts mode: pick from the location catalog.",
        "Saving preferences refreshes matches automatically.",
        "Radar PRO / dual scan — for partners and PRO investors.",
      ],
    },
    {
      id: "favorites",
      icon: "heart",
      title: "Favorites — watchlist",
      summary:
        "Hearts on the map, market, or listing page save to your account. The list lives under Favorites in My account.",
      bullets: [
        "Works on web and mobile for the same signed-in user.",
        "Remove via heart again or from the Favorites tab.",
        "Price/status push alerts — mobile app notification settings.",
      ],
    },
    {
      id: "listing",
      icon: "plus",
      title: "Add your listing — step-by-step",
      summary:
        "The wizard covers location, specs, finance, media, and summary. After submit, review runs and the listing appears on map and market.",
      bullets: [
        "Map pin + address — accuracy affects Radar and privacy modes.",
        "Price in PLN or EUR; rent: deposit and fees.",
        "Photos and floor plan build trust.",
        "Statuses: active, pending, archived — managed under My listings.",
        "Renewal after expiry when payments are enabled.",
      ],
      links: [{ label: "Add listing", href: "/dodaj-oferte" }],
    },
    {
      id: "offer-detail",
      icon: "shield",
      title: "Listing page — trust and actions",
      summary:
        "Single property view: gallery, specs, verification badge, advertiser profile, and actions (viewing, bid — by role).",
      bullets: [
        "Verification: verified / pending / not fully verified.",
        "Advertiser profile — ratings and history.",
        "Share link for investors.",
        "Report flow for moderation.",
      ],
    },
    {
      id: "deals",
      icon: "deal",
      title: "Deal Rooms and transactions",
      summary:
        "Deal Rooms are private spaces for messages, price offers, and documents. Partners get orange Deal Room pins on the map.",
      bullets: [
        "Transactions tab lists active rooms.",
        "Notifications for new messages and bids.",
        "Supports the process — not a substitute for legal advice.",
      ],
    },
    {
      id: "mobile",
      icon: "phone",
      title: "Mobile app vs website",
      summary:
        "The EstateOS app (iOS/Android) shares the same core: map Radar, favorites, add listing, push. Radar prefs and favorites sync when signed in.",
      bullets: [
        "Passkey for fastest sign-in on phone.",
        "Live Radar with appointments in one flow.",
        "Website suits large screens and multi-photo listing creation.",
      ],
    },
    {
      id: "faq",
      icon: "shield",
      title: "Quick FAQ",
      summary: "Short answers — if something is missing, use Contact in the footer.",
      bullets: [
        "Map blank? — refresh; server needs a valid Mapbox token.",
        "Cannot publish? — sign in and complete required wizard fields.",
        "Empty Radar? — calibrate and save criteria; wait for recalculation.",
        "PRO account? — Elite / pricing section; PRO badge on profile.",
        "Support: kontakt@estateos.pl via the Contact form.",
      ],
      links: [{ label: "Terms", href: "/regulamin" }, { label: "Privacy", href: "/polityka-prywatnosci" }],
    },
  ],
};

export function getPlatformHelp(locale: Locale): PlatformHelpContent {
  return locale === "pl" ? PL : EN;
}
