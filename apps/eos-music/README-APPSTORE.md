# EOS™ Music — checklist App Store Connect

Aplikacja jest **klientem odtwarzacza** dla biblioteki użytkownika na serwerze Nostalgie™ Legacy. Nie jest sklepem z piracką muzyką — wymaga konta i odtwarza utwory dodane przez użytkownika (playlisty / pobrania).

## Przed wysłaniem

### 1. Metadane App Store Connect

| Pole | Wartość sugerowana |
|------|-------------------|
| **Nazwa** | EOS™ Music |
| **Podtytuł** | Twoja muzyka z Nostalgie |
| **Kategoria** | Muzyka |
| **Secondary** | Rozrywka |
| **Wiek** | 12+ (streaming) |
| **Copyright** | © 2026 Marian Romanienko |

### 2. Opis (PL)

> EOS™ Music to oficjalny odtwarzacz muzyki dla graczy Nostalgie™ Legacy. Zaloguj się kontem z gry, słuchaj playlist zapisanych na serwerze, przeglądaj katalog i steruj odtwarzaniem z ekranu blokady oraz CarPlay/słuchawek.
>
> Wymaga aktywnego konta Nostalgie™ Legacy.

### 3. App Review — notatka dla recenzenta

```
Test account:
Login: [UTWÓRZ KONTO TESTOWE BEZ PRAWDZIWYCH DANYCH]
Password: [HASŁO]

Aplikacja loguje się do backendu https://lineage.mycloudnas.com
Endpoint: POST /admin_pro/api/movies/proxy/api/auth/login

Po zalogowaniu: zakładka Biblioteka → wybierz playlistę → odtwórz utwór.
Zakładka Szukaj → wyszukaj wykonawcę → odtwórz z albumu.

Aplikacja odtwarza wyłącznie muzykę z biblioteki użytkownika
(przygotowaną przez serwis Nostalgie). Wymaga konta — brak anonimowego dostępu.
```

### 4. Polityka prywatności

- URL w App Store Connect: `https://lineage.mycloudnas.com/privacy` (upewnij się, że strona istnieje)
- Aplikacja zbiera: login (auth), token JWT w Keychain
- Brak reklam, brak śledzenia third-party (brak SDK analytics w v1)

### 5. Uprawnienia (Info.plist)

| Klucz | Status |
|-------|--------|
| `UIBackgroundModes` → `audio` | ✅ jest |
| `ITSAppUsesNonExemptEncryption` = false | ✅ jest |
| Brak zbędnych Usage Description | ✅ |

### 6. Ikona

- Dodaj **1024×1024** PNG do `Resources/Assets.xcassets/AppIcon.appiconset/`
- Bez przezroczystości, bez zaokrąglonych rogów (Apple zaokrągli samo)

### 7. Zrzuty ekranu

Minimum wymagane przez Apple:
- iPhone 6.7" (1290×2796)
- iPhone 6.5" lub 6.1"

Pokaż: logowanie, biblioteka, player, wyszukiwarkę.

### 8. Ryzyko odrzucenia — jak uniknąć

| Ryzyko | Mitygacja |
|--------|-----------|
| „Pobieranie pirackiej muzyki” | Opis: odtwarzacz biblioteki użytkownika; wymaga konta; brak publicznego torrentu |
| Brak konta testowego | Daj recenzentowi login/hasło w App Review Notes |
| Broken login | Przetestuj login na produkcji przed submit |
| Background audio crash | Test: odtwórz → zablokuj ekran → steruj z Lock Screen |
| Guideline 5.2.3 (Apple Music) | Nie używaj logo Apple Music w ikonie; katalog to metadane iTunes API |

### 9. Export Compliance

W App Store Connect: **Does your app use encryption?** → **No** (standardowe HTTPS tylko).

### 10. Podpis

- Distribution certificate + App Store provisioning profile dla `pl.nostalgie.eosmusic`
- Archive → Validate → Distribute App

## Po publikacji

- Monitoruj crash reports w Xcode Organizer
- Token JWT wygasa po ~30 dniach — użytkownik loguje się ponownie
