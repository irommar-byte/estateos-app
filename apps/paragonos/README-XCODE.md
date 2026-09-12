# ParagonOS™ — iOS

Cyfrowy portfel papierowych kwitków z butelkomatów. Osobna aplikacja (nie EstateOS).

## Wymagania

- Xcode 16+
- iOS 18+
- Team Apple Developer `NW3YW69KL9`
- iCloud (opcjonalnie — sync i portfel rodzinny)

## Otwarcie projektu

```bash
cd apps/paragonos
python3 generate_xcode_project.py   # po dodaniu plików Swift
open ParagonOS.xcodeproj
```

1. Target **ParagonOS** → Signing & Capabilities
2. Team: MARIAN ROMANIENKO
3. Bundle ID: `pl.paragonos.app`
4. Włącz **iCloud** z CloudKit i kontenerem `iCloud.pl.paragonos.app` (entitlements już są)

Display name: **ParagonOS™**

## Funkcje v1

- Skan VisionKit / zdjęcie + OCR i kod kreskowy
- Korekta przed zapisem
- Portfel, historia, statusy aktywny / wykorzystany / przeterminowany
- Zasady Biedronka, Lidl, Kaufland i innych sieci
- Ekran kasy (kod albo zdjęcie)
- Przypomnienia 7 dni / 1 dzień / w dniu
- iCloud (SwiftData) + zaproszenie rodziny (CKShare)
- Skrót Siri: „Skanuj kwitek”

Skaner na żywo działa na urządzeniu, nie w Simulatorze — tam użyj Zdjęć.

## Prywatność

Kwitki zostają na telefonie i w iCloud użytkownika. Brak własnego serwera logowania.
