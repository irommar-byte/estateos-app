# Backend — opóźnione zużycie Pakiet Plus (IAP)

**Pełny model publikacji (30 dni, per `offerId`, pierwsza darmowa):** zobacz `BACKEND_OFFER_PUBLICATION_MODEL.md`.

Aplikacja mobilna (build ≥ 24) wysyła przy zakupie z kreatora oferty:

## `POST /api/mobile/v1/iap/verify`

Dodatkowe pola (iOS/Android):

```json
{
  "deferPublicationConsume": true,
  "publicationIntent": "NEW_OFFER",
  "targetOfferId": 123
}
```

`targetOfferId` — opcjonalnie przy reaktywacji; przy nowej ofercie consume przy `POST /offers` po utworzeniu `id`.

**Oczekiwane zachowanie:**

1. Zweryfikuj transakcję z Apple/Google (jak dotąd).
2. **Nie** zwiększaj `extraListings` / nie zużywaj slotu publikacji.
3. Zapisz powiązanie `transactionId` → status `DEFERRED` (lub równoważne).
4. Odpowiedź:

```json
{
  "success": true,
  "verified": true,
  "publicationConsumeDeferred": true,
  "extraListings": 0
}
```

Jeśli backend ignoruje flagę (stara wersja), mobile nadal działa, ale slot może zostać naliczony przy verify — wtedy użytkownik nie traci zakupu przy błędzie publish, tylko ma dodatkowy slot w profilu.

## `POST /api/mobile/v1/offers`

Przy pierwszej publikacji po zakupie z defer:

```json
{
  "consumePlusPublication": true,
  "iapTransactionId": "<transactionId z App Store>"
}
```

**Oczekiwane zachowanie:**

1. Atomowo: utwórz ofertę + zużyj zapisany kredyt IAP po `iapTransactionId` (idempotencja).
2. Przy błędzie walidacji / DB rollback — **nie** zużywaj kredytu.

## Przywracanie zakończonej oferty (Profil)

Bez zmian: `PATCH` oferty z `consumePlusPublication: true` (zużycie przy reaktywacji).
