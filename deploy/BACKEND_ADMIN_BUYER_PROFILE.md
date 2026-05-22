# Admin — profil kupującego (Karta Użytkownika)

Aplikacja mobilna (`AdminUserProfileModal`) wyświetla profil poszukiwań na podstawie:

1. `GET /api/mobile/v1/admin/users/:userId` — pola `radarPreference`, `radarSearchHistory` (opcjonalnie)
2. `GET /api/mobile/v1/admin/users/:userId/buyer-profile` — opcjonalny rozszerzony payload

## Zalecany shape `user` (detail)

```json
{
  "success": true,
  "user": {
    "id": 123,
    "radarPreference": {
      "transactionType": "SELL",
      "propertyType": "FLAT",
      "city": "Warszawa",
      "selectedDistricts": ["Mokotów"],
      "maxPrice": 1200000,
      "minArea": 45,
      "minYear": 2000,
      "requireBalcony": true,
      "pushNotifications": true,
      "minMatchThreshold": 78,
      "lat": 52.22,
      "lng": 21.01,
      "radius": 8
    },
    "radarSearchHistory": [
      {
        "savedAt": "2026-05-10T12:00:00Z",
        "filters": { "transactionType": "SELL", "city": "Kraków", "maxPrice": 900000, "propertyType": "FLAT" }
      }
    ]
  }
}
```

## Opcjonalny endpoint `buyer-profile`

`GET /api/mobile/v1/admin/users/:userId/buyer-profile`

```json
{
  "success": true,
  "buyerProfile": {
    "radarPreference": { },
    "radarSearchHistory": [ ],
    "advancedSearchHistory": [ ]
  }
}
```

Historia: mobile wysyła każde wyszukiwanie przez `POST /api/radar/search-history` (patrz `deploy/BACKEND_RADAR_SEARCH_HISTORY.md`). Admin detail musi zwracać tablicę `radarSearchHistory` — mobile liczy częstotliwość (`5×`) i prawdopodobieństwo profilu.
