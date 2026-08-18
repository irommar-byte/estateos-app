# EOS™ Music — iOS

Natywny odtwarzacz muzyki dla biblioteki Nostalgie™ Legacy (ten sam backend co www i Apple TV).

## Wymagania

- Xcode 15+
- iOS 17+
- Konto gracza Nostalgie™ Legacy (login + hasło)
- Team Apple Developer (do podpisu i App Store)

## Otwarcie projektu

```bash
cd apps/eos-music
python3 generate_xcode_project.py   # jeśli dodajesz pliki Swift
open EOSMusic.xcodeproj
```

1. Wybierz target **EOSMusic** → **Signing & Capabilities**
2. Ustaw **Team** (MARIAN ROMANIENKO / Twój team)
3. Bundle ID: `pl.nostalgie.eosmusic`
4. W **Background Modes** włącz **Audio, AirPlay, and Picture in Picture** (Info.plist już ma `audio`)

## Funkcje

- Logowanie JWT (Keychain, opcjonalne „Zapamiętaj mnie”)
- Biblioteka playlist / folderów z serwera
- Odtwarzanie streamów MP3 (pobrane utwory + przygotowanie na żądanie)
- Lock screen + sterowanie z słuchawek (Now Playing)
- Wyszukiwarka katalogu (wykonawca → albumy → utwory)
- Import playlisty Apple Music (link)
- Mini player + pełnoekranowy player

## App Store

Szczegółowa checklista: [README-APPSTORE.md](./README-APPSTORE.md)

## API

Produkcja: `https://lineage.mycloudnas.com/admin_pro/api/movies/proxy`

Ten sam endpoint co aplikacja tvOS i panel www.
