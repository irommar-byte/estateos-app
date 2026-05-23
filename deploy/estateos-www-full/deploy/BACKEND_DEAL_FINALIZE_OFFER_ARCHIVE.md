# Finalizacja deala → archiwum oferty

## Problem

Po `POST /api/mobile/v1/deals/{dealId}/actions` z `BID_RESPOND` + `ACCEPT` od **właściciela** (seller) deal w UI jest zamknięty, ale powiązana oferta (`deal.offerId`) zostaje `ACTIVE` w `GET /api/mobile/v1/offers?includeAll=true`.

Dodatkowo aplikacja wysyła `PATCH /api/mobile/v1/offers/{offerId}` — ten endpoint wcześniej **nie istniał** (tylko GET).

## Wymaganie (MUST)

Przy udanej **finalnej akceptacji właściciela** w jednej transakcji DB:

| Encja | Pola |
|-------|------|
| `Deal` | `status` → `FINALIZED`, `finalizedAt`, `acceptedBidId` (cena z bid → `finalPrice` w odpowiedzi API) |
| `Offer` | `status` → `SOLD` (lub `ARCHIVED`), `expiresAt` w przeszłości — brak w Radarze / feedzie publicznym |

## Zachowanie backendu (po poprawce)

1. **`BID_RESPOND` + `ACCEPT` gdy `actorId === sellerId`** — akceptacja bidu + `finalizeDealWithOfferArchive` w jednej transakcji.
2. **`BID_RESPOND` + `ACCEPT` gdy `actorId === buyerId`** — tylko `AGREED` (cena uzgodniona; właściciel domyka osobno).
3. **`DEAL_FINALIZE`** — właściciel zamyka deal już w stanie `AGREED` + `acceptedBidId` (drugi krok po akceptacji przez kupującego).
4. **`PATCH /api/mobile/v1/offers/{offerId}`** — obsługiwany (mapuje `status` / `newStatus` → `updateOffer`).
5. **`POST /api/deals/{id}/finalize`** — używa tej samej logiki co mobile.

## Migracja danych

```bash
node scripts/migrate-finalized-deals-archive-offers.cjs
```

Ustawia `Offer.status = SOLD` dla ofert powiązanych z dealami `FINALIZED` lub `AGREED` + `acceptedBidId`, gdy oferta nadal `ACTIVE`.

## Kryterium akceptacji

Po finalnej akceptacji właściciela oferta nie jest w Aktywnych, jest w Zakończonych, nie widać jej na Radarze — **bez polegania na PATCH z telefonu**.
