# Backend — promocyjne okienka (Profil)

Mobile pokazuje interaktywny stos kart w **Profil → Zakupy i sklep**:
1. Darmowe ogłoszenie (zawsze pierwsze)
2. Karty od administratora (opcjonalnie)
3. Pakiet Plus

## API

### Użytkownik

`GET /api/mobile/v1/me/promo-cards`  
`GET /api/mobile/v1/users/:userId/promo-cards` (dla właściciela konta)

```json
{
  "cards": [
    {
      "id": "promo_12",
      "title": "-20% na Pakiet Plus",
      "subtitle": "Tylko dla Ciebie",
      "meta": "Ważne do 30.06.2026",
      "accentColor": "#AF52DE",
      "iconName": "sparkles",
      "createdAt": "2026-05-22T08:00:00.000Z"
    }
  ]
}
```

### Admin

`POST /api/mobile/v1/admin/users/:userId/promo-cards`

Body:

```json
{
  "title": "Oferta specjalna",
  "subtitle": "Krótki opis",
  "meta": "Warunki / termin",
  "accentColor": "#AF52DE",
  "iconName": "sparkles",
  "expiresAt": "2026-06-30T00:00:00.000Z"
}
```

Response: `{ "success": true, "card": { ... } }`

Przy braku endpointu mobile zapisuje kartę lokalnie (AsyncStorage) — tylko na tym urządzeniu (dev).
