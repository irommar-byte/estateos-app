# Backend — pełna historia wyszukiwań użytkownika (radar + mapa)

## Cel

Mobile zapisuje **każde** wyszukiwanie / kalibrację. Admin w **Karcie Użytkownika** widzi:
- ile razy dany zestaw parametrów był używany,
- częstotliwość miast / transakcji / typów,
- **prawdopodobieństwo profilu kupującego** (heurystyka po stronie app).

## Mobile — zapis zdarzeń

`POST` (fire-and-forget), Bearer token użytkownika:

- `/api/radar/search-history`
- `/api/mobile/v1/radar/search-history` (fallback)

### Body

```json
{
  "userId": 123,
  "source": "radar_calibration",
  "savedAt": "2026-05-21T12:00:00.000Z",
  "filters": {
    "transactionType": "SELL",
    "propertyType": "FLAT",
    "city": "Warszawa",
    "selectedDistricts": ["Mokotów"],
    "maxPrice": 1200000,
    "minArea": 45,
    "minYear": 2005,
    "requireBalcony": true,
    "pushNotifications": true,
    "minMatchThreshold": 78,
    "lat": 52.23,
    "lng": 21.01,
    "radius": 8.5
  },
  "mapBounds": { "lat": 52.23, "lng": 21.01, "radius": 8.5 }
}
```

`source`: `radar_calibration` | `advanced_search` | `favorites_calibration`

Przy `advanced_search` mogą być też `minPrice`, `maxArea`, `minRooms`, `locationMode`.

## Backend — model (propozycja)

Tabela `RadarSearchEvent` (lub `UserSearchHistory`):

| Kolumna | Typ |
|---------|-----|
| id | PK |
| userId | FK |
| source | string |
| savedAt | datetime |
| filtersJson | JSON (kanoniczny kształt jak POST preferences) |
| mapBoundsJson | JSON nullable |

Indeks: `(userId, savedAt DESC)`.

**Nie deduplikować** — każde zdarzenie = osobny wiersz (mobile liczy `5×` po fingerprint).

## Admin — odczyt

W `GET /api/mobile/v1/admin/users/:userId` (i opcjonalnie `buyer-profile`) dołączyć:

```json
{
  "radarSearchHistory": [
    {
      "savedAt": "2026-05-21T11:00:00Z",
      "source": "radar_calibration",
      "filters": { "city": "Warszawa", "selectedDistricts": ["Mokotów"], ... }
    }
  ]
}
```

Limit np. ostatnie **200** zdarzeń lub 12 miesięcy.

Można też zwracać agregaty (opcjonalnie):

```json
{
  "searchHistoryStats": {
    "totalEvents": 42,
    "topPatterns": [{ "count": 8, "filters": { ... } }]
  }
}
```

Mobile samo agreguje z tablicy `radarSearchHistory` — backend może tylko zwracać surową listę.

## Wiadomość do agenta backend (kopiuj-wklej)

> Mobile wysyła każdą kalibrację radaru i wyszukiwanie zaawansowane na mapie jako `POST /api/radar/search-history` (body: userId, source, savedAt, filters, mapBounds). Proszę zapisywać każde zdarzenie osobno (bez nadpisywania). W `GET /api/mobile/v1/admin/users/:userId` zwrócić tablicę `radarSearchHistory` (ostatnie N rekordów, filters w camelCase jak shapeRadarPreference). Admin karta pokazuje częstotliwość i prawdopodobieństwo profilu kupującego — bez tej tablicy widać tylko bieżące ustawienia.
