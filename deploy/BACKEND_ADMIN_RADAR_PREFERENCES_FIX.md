# Backend — radar w Karcie Użytkownika (admin)

## Status (wdrożone na produkcji)

Backend zwraca pełny `radarPreference` w `GET /api/mobile/v1/admin/users/:userId` i na liście adminów (`shapeRadarPreference`, camelCase, `selectedDistricts` z kolumny `districts`). Działa też `GET /api/radar/preferences?userId=…` i opcjonalnie `GET .../radar-preferences`.

Mobile (ProfileScreen): czyta `user.radarPreference` z detail; dodatkowy fetch tylko gdy detail nie ma pól; baner pomarańczowy tylko gdy push ON i brak parametrów po merge.

---

## Problem (historycznie — mobile)

1. Użytkownik kalibruje radar w aplikacji → mobile wysyła **`POST /api/radar/preferences`** z pełnym body (patrz niżej).
2. Admin otwiera **Kartę Użytkownika** → mobile woła **`GET /api/mobile/v1/admin/users/:userId`**.
3. W odpowiedzi **brak pełnego `radarPreference`** (często tylko `pushNotifications` / `minMatchThreshold`, bez `city`, `minYear`, `selectedDistricts` itd.) **albo pole w ogóle puste**.
4. Karta pokazuje „Brak preferencji” mimo że radar u użytkownika działa.

Dodatkowo **`GET /api/radar/preferences?userId=…`** zwraca **405** — nie ma odczytu preferencji dla admina.

## Co mobile wysyła przy zapisie (źródło prawdy)

`POST /api/radar/preferences` — body z `buildCanonicalRadarPreferencesDto`:

```json
{
  "userId": 123,
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
  "pushNotifications": true,
  "minMatchThreshold": 78,
  "lat": 52.2297,
  "lng": 21.0122,
  "radius": 8.5
}
```

Te same pola muszą wracać w admin detail.

## Wymagana poprawka (minimum)

W **`GET /api/mobile/v1/admin/users/:userId`** (oraz opcjonalnie w liście `GET .../admin/users`) dołączyć relację z tabeli preferencji radaru:

```json
{
  "success": true,
  "user": {
    "id": 123,
    "name": "...",
    "radarPreference": {
      "transactionType": "SELL",
      "propertyType": "FLAT",
      "city": "Warszawa",
      "selectedDistricts": ["Mokotów"],
      "maxPrice": 1200000,
      "minArea": 45,
      "minYear": 2005,
      "requireBalcony": true,
      "requireGarden": false,
      "requireElevator": false,
      "requireParking": true,
      "requireFurnished": false,
      "pushNotifications": true,
      "minMatchThreshold": 78,
      "lat": 52.2297,
      "lng": 21.0122,
      "radius": 8.5,
      "updatedAt": "2026-05-21T10:00:00.000Z"
    }
  }
}
```

### Prisma (przykład)

```ts
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    radarPreference: true, // lub radarPreferences: { take: 1, orderBy: { updatedAt: 'desc' } }
    offers: { ... },
  },
});
// Zmapować rekord RadarPreference → pole radarPreference w JSON (camelCase jak wyżej)
```

Upewnij się, że **`POST /api/radar/preferences`** zapisuje wszystkie pola z body (nie tylko `pushNotifications`).

## Opcjonalnie (mobile już próbuje tych URL)

- `GET /api/mobile/v1/admin/users/:userId/radar-preferences` → `{ success, radarPreference: { ... } }`
- lub `GET /api/radar/preferences?userId=:id` z tokenem admina (obecnie 405)

## Test akceptacji

1. Zaloguj się jako user, ustaw radar: miasto, dzielnice, rok budowy, cena, próg.
2. Admin → Użytkownicy → Karta użytkownika.
3. Sekcja **Radar — ustawienia** musi pokazać te same wartości co w kalibracji.

## Wiadomość do skopiowania (agent backend)

> Radar zapisuje się poprawnie przez `POST /api/radar/preferences`, ale `GET /api/mobile/v1/admin/users/:userId` nie zwraca pełnego obiektu `radarPreference` (brak city, minYear, selectedDistricts, maxPrice itd.). Karta admina w mobile nie może pokazać profilu kupującego. Proszę w admin user detail zrobić `include: { radarPreference: true }` i zmapować wszystkie kolumny z tabeli preferencji (jak w body POST powyżej). Alternatywnie dodać `GET /api/mobile/v1/admin/users/:userId/radar-preferences`. Bez tego front tylko widzi „Radar ON” bez parametrów.
