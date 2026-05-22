# Backend — promocyjne okienka (Profil)

Mobile pokazuje w **Profil** dwie sekcje:

**Kupony bonusowe** (stos kart, przesuwanie w prawo w kółko, w lewo — ukrycie):
1. **Kupon powitalny** — jeden na nowe konto (`templateId: welcome_free_listing`, `kind: welcome_coupon`); mobile nadaje lokalnie po rejestracji, backend powinien to samo przy `POST /api/register` lub pierwszym logowaniu
2. Karty od administratora (np. kupon urodzinowy)

**Pakiet Plus** (osobny panel — licznik kredytów, Kup Pakiet Plus, Przywróć zakupy)

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
  "title": "Darmowe Ogłoszenie",
  "subtitle": "Kupon urodzinowy od EstateOS",
  "meta": "Jedna bezpłatna publikacja",
  "accentColor": "#FF9F0A",
  "iconName": "gift",
  "templateId": "birthday_free_listing",
  "grantsFreeListing": true,
  "pillLabel": "Urodziny",
  "expiresAt": "2026-06-30T00:00:00.000Z"
}
```

`templateId: "birthday_free_listing"` — kupon urodzinowy (wygląd jak darmowe ogłoszenie, badge „Urodziny”).
Backend powinien ustawić użytkownikowi jednorazowe `allowedFreeFirst` (lub równoważny grant) i po publikacji oznaczyć `couponUsed: true` w rekordzie karty.

Response: `{ "success": true, "card": { ... } }`

Przy braku endpointu mobile zapisuje kartę lokalnie (AsyncStorage) — tylko na tym urządzeniu (dev).

## Publikacja oferty (Add Offer → Opublikuj)

Przed publikacją mobile zbiera kupony z `purpose: publication` i pokazuje sheet wyboru.

`POST /api/mobile/v1/offers` z `publication`:

```json
{
  "kind": "FREE_FIRST",
  "bonusCouponId": "promo_12",
  "bonusCouponKind": "birthday_coupon"
}
```

lub `kind: "PLUS_CREDIT", "consumePlusPublication": true` albo `PLUS_PAID` + `iapTransactionId`.

**Ważne (POST /offers przy `activateOnCreate`):** serwer musi respektować `body.publication.kind` / `bonusCouponId`, a nie wybierać `PLUS_CREDIT` tylko dlatego, że user ma `extraListings > 0`. Patch: `deploy/plus-credit-fix/offers-route.ts` (`activationKind` z `publication` przed domyślnym kredytem Plus).

Po sukcesie mobile oznacza `couponUsed: true` dla kuponów admina (lokalnie / PATCH API).

## Powiadomienie push o nowym kuponie

Po `POST .../promo-cards` mobile woła (opcjonalnie):

`POST /api/mobile/v1/admin/users/:userId/promo-cards/notify`

```json
{
  "cardId": "promo_12",
  "title": "Darmowe Ogłoszenie",
  "subtitle": "Kupon urodzinowy od EstateOS",
  "templateId": "birthday_free_listing",
  "kind": "birthday_coupon"
}
```

Backend powinien wysłać Expo push z `data.target: "profile_bonus_coupons"`, `deeplink: "estateos://profil/kupony-bonusowe"`.

Bez endpointu: aplikacja odbiorcy przy wejściu / powrocie na pierwszy plan wykrywa nowy kupon i pokazuje **lokalne** powiadomienie (expo-notifications).
