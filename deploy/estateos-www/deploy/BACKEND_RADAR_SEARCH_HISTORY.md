# Historia wyszukiwań radaru (admin Karta Użytkownika)

Mobile wysyła zdarzenia wyszukiwania/kalibracji radaru. Backend zapisuje **jeden wiersz na zdarzenie** i zwraca ostatnie **N** rekordów w karcie admina.

## Endpointy

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/api/radar/search-history` | Zapis jednego zdarzenia |
| `GET` | `/api/mobile/v1/admin/users/:userId` | Pole `radarSearchHistory` (domyślnie 50 wpisów) |
| `GET` | `/api/mobile/v1/admin/users/:userId/radar-search-history` | Tylko historia (`?limit=50`, max 200) |

## POST `/api/radar/search-history`

**Auth:** Bearer JWT użytkownika (`userId` = własne id) lub token **ADMIN** (dowolny `userId`).

**Body (źródło prawdy — parity z filtrem radaru w mobile):**

```json
{
  "userId": 123,
  "eventType": "RADAR_SEARCH",
  "transactionType": "SELL",
  "propertyType": "FLAT",
  "city": "Warszawa",
  "selectedDistricts": ["Mokotów", "Śródmieście"],
  "maxPrice": 1200000,
  "minArea": 45,
  "minYear": 2005,
  "requireBalcony": true,
  "requireGarden": false,
  "requireElevator": false,
  "requireParking": true,
  "requireFurnished": false,
  "matchCount": 12,
  "lat": 52.2297,
  "lng": 21.0122,
  "radius": 8.5,
  "query": "opcjonalny opis",
  "source": "mobile",
  "searchedAt": "2026-05-21T10:00:00.000Z"
}
```

**Aliasy:** `districts` → `selectedDistricts`, `resultsCount` / `count` → `matchCount`, `at` / `timestamp` → `searchedAt`, `queryText` → `query`.

**Odpowiedź:**

```json
{
  "success": true,
  "entry": { "id": 1, "eventType": "RADAR_SEARCH", "city": "Warszawa", "selectedDistricts": ["Mokotów"], "matchCount": 12, "searchedAt": "..." },
  "radarSearchHistoryEntry": { }
}
```

## GET admin user detail

`GET /api/mobile/v1/admin/users/:userId?radarHistoryLimit=50`

```json
{
  "success": true,
  "user": {
    "id": 123,
    "radarPreference": { },
    "radarSearchHistory": [
      {
        "id": 1,
        "eventType": "RADAR_SEARCH",
        "transactionType": "SELL",
        "propertyType": "FLAT",
        "city": "Warszawa",
        "selectedDistricts": ["Mokotów"],
        "maxPrice": 1200000,
        "minArea": 45,
        "minYear": 2005,
        "matchCount": 12,
        "searchedAt": "2026-05-21T10:00:00.000Z"
      }
    ]
  }
}
```

Alias: `radar_search_history` (snake_case).

## Baza (Prisma)

Model: `RadarSearchHistory` — `userId`, filtry, `matchCount`, `searchedAt`, `source`, `eventType`.

Po wdrożeniu kodu:

```bash
cd /home/rommar/estateos
npx prisma generate
npx prisma db push
npm run build
pm2 restart nieruchomosci
```

## Test akceptacji

1. User w apce wykonuje wyszukiwanie radaru (mobile POST z pełnym body).
2. Admin → Użytkownicy → Karta użytkownika.
3. Sekcja historii pokazuje ostatnie zdarzenia z tymi samymi parametrami co wysłane w POST.

## Implementacja

- `prisma/schema.prisma` — model `RadarSearchHistory`
- `src/app/api/radar/search-history/route.ts` — POST
- `src/lib/radarSearchHistoryShape.ts` — mapowanie JSON
- `src/lib/radarSearchHistoryService.ts` — odczyt ostatnich N
- `src/app/api/mobile/v1/admin/users/[userId]/route.ts` — `radarSearchHistory` w detail
