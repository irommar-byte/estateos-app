# NOSTALGIE™ MOVIES — Apple TV (tvOS)

Natywna aplikacja SwiftUI dla Apple TV. Łączy się z tym samym backendem co panel gracza (`lineage.mycloudnas.com`).

**Bundle ID:** `pl.nostalgie.movies`  
**Projekt:** `tvOS/NostalgieMovies/NostalgieMovies.xcodeproj`

---

## Krok 1 — Xcode: platforma tvOS

Jeśli build mówi *„tvOS is not installed”*:

1. Otwórz **Xcode → Settings → Components** (lub Platforms).
2. Pobierz **tvOS 26.x** (SDK + Simulator Apple TV).
3. Zrestartuj Xcode.

---

## Krok 2 — Otwórz projekt

```bash
open /Users/marian/apple-style-app/tvOS/NostalgieMovies/NostalgieMovies.xcodeproj
```

Albo: **File → Open** i wybierz powyższą ścieżkę.

---

## Krok 3 — Signing (jak w EstateOS)

1. W nawigatorze kliknij niebieski projekt **NostalgieMovies**.
2. Target **NostalgieMovies** → **Signing & Capabilities**.
3. **Team:** ten sam co `pl.estateos.app` (Twoje Apple Developer).
4. **Bundle Identifier:** `pl.nostalgie.movies` (zostaw domyślne).
5. Zaznacz **Automatically manage signing**.

---

## Krok 4 — App Store Connect (nowa aplikacja)

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → +**.
2. **New App** → Platform: **tvOS**.
3. Name: **NOSTALGIE Movies** (lub jak wolisz).
4. Bundle ID: wybierz **`pl.nostalgie.movies`** (utwórz w [Certificates, Identifiers](https://developer.apple.com/account/resources/identifiers/list) jeśli brak).
5. SKU: np. `nostalgie-movies-tvos`.

---

## Krok 5 — Ikona Apple TV

1. W Xcode: `NostalgieMovies/Resources/Assets.xcassets` → **App Icon & Top Shelf Image**.
2. Dodaj warstwy ikony (1280×768 i Top Shelf 2320×720 — możesz zacząć od jednego PNG z logo Nostalgie).
3. Tymczasowo Xcode zbuduje apkę z pustą ikoną — to OK na TestFlight wewnętrzny.

---

## Krok 6 — Uruchom na symulatorze

1. Górny pasek: scheme **NostalgieMovies**.
2. Urządzenie: **Apple TV 4K (3rd generation)** (symulator).
3. **⌘R** (Run).

Powinieneś zobaczyć ekran logowania. Użyj **loginu i hasła z Nostalgie Legacy** (to samo co na `panel.php`).

---

## Krok 7 — Prawdziwe Apple TV (TestFlight)

1. Podłącz Apple TV do Maca (USB-C) **albo** użyj **Archive → Distribute → TestFlight**.
2. **Product → Archive** (scheme: Any Apple TV Device / Release).
3. **Distribute App → App Store Connect → Upload**.
4. W App Store Connect → **TestFlight** → dodaj siebie jako testera.
5. Na Apple TV: zainstaluj aplikację **TestFlight** ze sklepu, zaakceptuj zaproszenie.

---

## Krok 8 — Backend (już wdrożony po `deploy.sh`)

API dla aplikacji TV:

| Endpoint | Opis |
|----------|------|
| `POST /api/auth/login` | `{ "login", "password" }` → JWT |
| `GET /api/auth/me` | Bearer token |
| `GET /api/favorites` | Ulubione konta |
| `POST /api/search` | Wyszukiwanie |
| `POST /api/preview` | Start streamu HLS |
| `GET /api/play-token/:jobId` | Token odtwarzania |

Base URL: `https://lineage.mycloudnas.com/admin_pro/api/movies/proxy`

Po deployu backendu:

```bash
bash /Users/marian/apple-style-app/deploy/lineage-movies/deploy.sh
```

---

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---------|-------------|
| „Niepoprawny login” | Konto musi działać na `lineage.mycloudnas.com/login.php` |
| „unauthorized” po logowaniu | Sprawdź deploy auth API; token JWT wymaga `MOVIES_JWT_SECRET` na VPS |
| TVP płatne — brak obrazu | Zaimportuj cookies w panelu www (Konta portali) — sesja jest na koncie |
| Build failed — brak tvOS SDK | Krok 1 powyżej |

---

## Struktura kodu

```
NostalgieMovies/
├── NostalgieMoviesApp.swift    # @main
├── App/AppModel.swift          # sesja, logowanie
├── Core/                       # modele, Keychain
├── Services/MoviesAPIClient.swift
├── Views/                      # Login, Ulubione, Szukaj, Player
└── Theme/NostalgieTheme.swift
```

---

## Następne wersje (opcjonalnie)

- Dodawanie/usuwanie ulubionych z pilota (♥)
- Top Shelf z ostatnimi ulubionymi
- Siri Remote swipe gestures
- tvOS 18 native search integration
