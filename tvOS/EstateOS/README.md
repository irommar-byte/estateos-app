# EstateOS tvOS

Natywny klient Apple TV dla **EstateOS™ Home** (nieruchomości) i **EstateOS™ Car** (samochody) — showroom w stylu Netflix pod Siri Remote.

## Co jest w aplikacji

- Przełącznik **Home / Car** — jeden produkt, dwa katalogi
- **Hero** na górze showroomu + poziome rails (24h, polecane, filtry, premium / EV)
- **Immersyjny przegląd** (← →) dla nieruchomości i samochodów
- **Szukaj** z chipami filtrów
- **Ulubione**: Home (sync API po zalogowaniu) · Car (lokalnie na Apple TV)
- **Szczegóły** full-bleed + galeria + QR handoff na iPhone/WWW
- Logowanie hasłem lub **pairing z iPhone** (Passkey / login)
- **Top Shelf**: sekcje nieruchomości 24h + samochody

## Generowanie projektu Xcode

```bash
cd tvOS/EstateOS
python3 generate_xcode_project.py
open EstateOS.xcodeproj
```

Target: Apple TV · Bundle ID `pl.estateos.app (shared with iOS · Universal Purchase)` · Deployment tvOS 17+

## Deep linki

- `estateos://browse24h?id=123&immersive=1` — immersyjny przegląd oferty
- `estateos://offer/123` — szczegóły nieruchomości
- `estateos://car?id=456` — szczegóły samochodu

## API

- Produkcja: `https://estateos.pl`
- Oferty: `/api/mobile/v1/offers`, `/api/offers`
- Auta: `/api/cars`, `/api/cars/{id}`
- Auth: `/api/mobile/v1/auth/login`, TV pair `/api/mobile/v1/tv/pair/*`
