# BACKEND AGENT — Model publikacji ofert + finalizacja Dealroom (pełny brief)

**Projekt:** EstateOS™ (`estateos` — Next.js API na `estateos.pl`)  
**Klient mobilny:** `apple-style-app` (React Native / Expo)  
**Data briefu:** 2026-05-20  
**Produkt IAP:** `pl.estateos.app.pakiet_plus_30d` (consumable, App Store / Play)

Wklej ten dokument agentowi backendu jako **jedno źródło prawdy**. Mobile dostosuje się po wdrożeniu endpointów poniżej.

---

## Jedna zasada produktowa (czytaj najpierw)

**Użytkownik płaci za wystawienie konkretnej oferty (`offerId`) jako aktywnej publicznie** — widocznej na Radarze i w ogłoszeniach publicznych.

| Użytkownik NIE kupuje | Użytkownik kupuje |
|----------------------|-------------------|
| „Slotu” na koncie (`extraListings`) | **Publiczną aktywację tego ogłoszenia** |
| Abstrakcyjnych „dni” ani subskrypcji | Jednorazowe **wystawienie na rynek** danego `offerId` |
| Planu PRO / konta Premium | Consumable IAP powiązany z **`offerId` + `transactionId`** |

**30 dni** to **maksymalny czas trwania jednej publicznej aktywacji** (reguła techniczna), a **nie** produkt „kup 30 dni”. Po 30 dniach lub po wycofaniu/sprzedaży oferta **przestaje być publicznie aktywna**. Kolejne **publiczne wystawienie** (to samo lub inne `offerId`) = znowu decyzja FREE_FIRST (tylko pierwsza oferta na koncie) lub **Pakiet Plus**.

**Wiele ofert publicznie aktywnych naraz** = tyle, ile ogłoszeń ma **osobno opłaconą lub darmową publiczną aktywację** — nie „mam 3 sloty”.

---

## 0. Jak jest TERAZ (stan przed wdrożeniem)

### 0.1 Publikacja i limity

- Konto standardowe: aplikacja liczy **`existingCount` aktywnych/oczekujących** ofert i porównuje z **`1 + extraListings`** (`extraListings` rośnie po `POST /iap/verify`).
- Gdy `existingCount >= 1 + extraListings` → mobile pokazuje „Kup Pakiet Plus” i woła IAP.
- **Problem:** po wycofaniu/zakończeniu pierwszej oferty `existingCount` spada → użytkownik często może **za darmo** opublikować **nową ofertę z nowym ID** — to **nie** jest zamierzony model produktowy.
- Płatność IAP nie jest powiązana z **publiczną aktywacją konkretnego `offerId`** — tylko z abstrakcyjnym **`extraListings`** („slot”), co jest **błędne** względem modelu produktowego.
- Przy darmowym `POST /offers` mobile **nie wysyła** jawnego „30 dni” / `publicationKind` — zależy od logiki serwera.

### 0.2 Dealroom — właściciel akceptuje cenę i zamyka sprzedaż

**Oczekiwany UX:** oferta od razu **zakończona**, znika z Radaru i z Profil → Aktywne.

**Dziś:**

1. Właściciel w Dealroomie: `POST /api/mobile/v1/deals/{dealId}/actions` z `BID_RESPOND`, `decision: ACCEPT` (finalna decyzja po `AGREED`).
2. Backend **powinien** w jednej transakcji ustawić deal `FINALIZED`/`SOLD` **oraz** ofertę `ARCHIVED`/`SOLD` — **często tego brakuje lub jest niespójne**.
3. Mobile **dodatkowo** (best-effort) woła `PATCH /api/mobile/v1/offers/{offerId}` z `ARCHIVED` / `SOLD` / `CLOSED` (`archiveOfferAfterSaleClosed` w aplikacji).
4. Jeśli PATCH się nie uda → deal w czacie „zamknięty”, ale oferta **nadal ACTIVE** w `GET /offers?includeAll=true` → widać w **Aktywnych** i na Radarze.

**Wniosek:** archiwizacja oferty po sprzedaży **musi być atomowa po stronie backendu** przy `BID_RESPOND ACCEPT` od sprzedającego, nie tylko w mobile.

---

## 1. Reguły biznesowe DOCELOWE (źródło prawdy)

| # | Reguła |
|---|--------|
| R1 | Każda **aktywacja** oferty na rynku trwa **30 dni** (`ends_at` / `expiresAt`). |
| R2 | Po 30 dniach → publikacja **ENDED**, oferta **zakończona**, **z rynku** (cron). |
| R3 | **Ręczne wycofanie** (Profil → Wycofaj) przed końcem 30 dni → publikacja ENDED (`MANUAL_ARCHIVE`), **niewykorzystane dni przepadają**. |
| R4 | **Ponowna aktywacja tego samego `offerId`** po R2, R3 lub R9 → tylko **Pakiet Plus** (nowe 30 dni dla **tego ID**). |
| R5 | **Pierwsze wystawienie pierwszej oferty** na koncie (pierwsze historyczne `offerId` użytkownika) → **30 dni za darmo** (bez IAP). |
| R6 | **Każde inne `offerId`** przy pierwszym wystawieniu na rynek → wymaga **Pakiet Plus** (IAP). |
| R7 | **Wiele ofert aktywnych naraz** — dozwolone, jeśli **każde ID** ma aktywną publikację (R5 lub opłaconą R6/R4). |
| R8 | IAP = powiązanie **`offerId` + `transactionId`**, consumable zużyty przy udanej aktywacji. |
| **R9** | **Dealroom:** gdy **właściciel** finalnie akceptuje uzgodnioną cenę i zamyka sprzedaż → w **tej samej transakcji DB** deal zamknięty **oraz** publikacja oferty ENDED (`SOLD`), oferta **zakończona**, **z rynku** — jak ręczne wycofanie po sprzedaży, **bez** możliwości darmowego powrotu. |

**R9 nie zastępuje R3–R4:** sprzedaż kończy ofertę; ewentualne ponowne wystawienie **tego samego** ogłoszenia na rynek = **Plus** (nowe 30 dni).

---

## 2. Model danych (DB)

### 2.1 `users`

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  first_free_publication_used BOOLEAN NOT NULL DEFAULT FALSE;
```

Ustaw `TRUE` po pierwszej udanej publikacji `FREE_FIRST`.

### 2.2 `offer_publications` (nowa tabela — centralna)

```sql
CREATE TABLE offer_publications (
  id                 BIGSERIAL PRIMARY KEY,
  offer_id           BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  user_id            BIGINT NOT NULL REFERENCES users(id),
  kind               VARCHAR(20) NOT NULL,   -- 'FREE_FIRST' | 'PLUS_PAID'
  status             VARCHAR(20) NOT NULL,   -- 'ACTIVE' | 'ENDED'
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at            TIMESTAMPTZ NOT NULL,    -- started_at + interval '30 days'
  ended_at           TIMESTAMPTZ NULL,
  end_reason         VARCHAR(30) NULL,       -- see §3.3
  iap_transaction_id VARCHAR(128) NULL,
  iap_product_id     VARCHAR(64) NULL,
  deal_id            BIGINT NULL REFERENCES deals(id),  -- optional: when ended via R9
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (iap_transaction_id) WHERE iap_transaction_id IS NOT NULL
);

CREATE UNIQUE INDEX uq_offer_publications_one_active
  ON offer_publications (offer_id) WHERE status = 'ACTIVE';

CREATE INDEX idx_offer_publications_user_active
  ON offer_publications (user_id) WHERE status = 'ACTIVE';

CREATE INDEX idx_offer_publications_ends_at
  ON offer_publications (ends_at) WHERE status = 'ACTIVE';
```

### 2.3 `offers`

- `status`: `ACTIVE` | `ARCHIVED` | `SOLD` | `PENDING` | …
- `expiresAt`: synchronizuj z aktywną publikacją (`ends_at`).
- Po R9: preferuj **`SOLD`** (lub `ARCHIVED` + flaga sprzedaży) — mobile mapuje oba do zakładki **Zakończone**.

### 2.4 `iap_purchases` (rozszerzenie)

```text
transaction_id   UNIQUE NOT NULL
user_id
product_id
offer_id         NULL until consumed
target_offer_id  NULL optional at verify
consumed_at      NULL until publication ACTIVE
verify_status    VERIFIED | DEFERRED
```

### 2.5 Deprecacja `users.extraListings`

- Nie używać jako głównego limitu po migracji.
- Można zostawić tylko do odczytu wstecznego przez 1–2 wersje.

---

## 3. Logika serwera

### 3.1 `canActivateOffer(userId, offerId)`

```
offer = getOffer(offerId), assert offer.userId == userId
if exists active publication for offerId → reject ALREADY_ACTIVE

firstOfferId = MIN(offers.id) WHERE user_id = userId

if offerId == firstOfferId AND NOT user.first_free_publication_used:
  return ALLOW_FREE_FIRST

return REQUIRES_PLUS   -- nowe ID, reaktywacja, drugi raz na tym ID po ENDED
```

### 3.2 `activatePublication(offerId, kind, iapTransactionId?)`

```
ends_at = now() + 30 days
INSERT offer_publications (status=ACTIVE, ends_at, kind, iap_transaction_id...)
UPDATE offers SET status=ACTIVE, expiresAt=ends_at
IF kind == FREE_FIRST: user.first_free_publication_used = TRUE
IF iap: mark iap_purchases consumed, offer_id = offerId
```

### 3.3 `endPublication(offerId, end_reason, dealId?)`

| `end_reason` | Kiedy |
|--------------|--------|
| `EXPIRED` | Cron: `ends_at < now()` |
| `MANUAL_ARCHIVE` | PATCH/akcja wycofania z Profilu |
| **`SOLD`** | **R9:** finalizacja deala przez właściciela |
| `ADMIN` | Panel admina |

```
UPDATE offer_publications SET status=ENDED, ended_at=now(), end_reason=..., deal_id=...
UPDATE offers SET status=SOLD or ARCHIVED, archivedAt/soldAt=now(), expiresAt unchanged or ended_at
-- Oferta NIE wraca na Radar / public feed
```

### 3.4 Cron (co 15 min)

```sql
SELECT offer_id FROM offer_publications
 WHERE status = 'ACTIVE' AND ends_at < NOW();
-- dla każdej: endPublication(offerId, 'EXPIRED')
```

---

## 4. Dealroom — finalizacja sprzedaży (R9) — MUST

### 4.1 Trigger

```http
POST /api/mobile/v1/deals/{dealId}/actions
Authorization: Bearer <seller token>
Content-Type: application/json

{
  "type": "BID_RESPOND",
  "bidId": 123,
  "decision": "ACCEPT",
  "message": "Decyzja właściciela: ostatecznie akceptuję cenę 610000 PLN i zamykam sprzedaż."
}
```

**Warunki:**

- Wywołuje **sprzedający / właściciel** oferty (`deal.sellerId`).
- Deal w stanie **`AGREED`** z ustawionym `acceptedBidId` (kupujący już zaakceptował cenę).
- To jest **ostateczna** akceptacja właściciela (zamyka transakcję), nie zwykłe `PROPOSED`/`COUNTERED`.

### 4.2 Efekt atomowy (jedna transakcja DB)

| Encja | Zmiana |
|--------|--------|
| `Deal` | `status` → `FINALIZED` lub `SOLD`; `finalizedAt`, `finalPrice` z bida |
| `Offer` (`deal.offerId`) | `status` → **`SOLD`** (lub `ARCHIVED`); `soldAt` / `archivedAt` |
| `offer_publications` | aktywna publikacja → **`ENDED`**, `end_reason = SOLD`, `deal_id = dealId` |
| Konkurencyjne deale na tę ofertę | anuluj / zamknij według istniejącej logiki |
| Radar / public API | oferta **nie zwracana** |

### 4.3 Response (wymagane pola)

```json
{
  "deal": {
    "id": 173,
    "status": "FINALIZED",
    "offerId": 123,
    "finalPrice": 610000,
    "finalizedAt": "2026-05-20T10:00:00.000Z"
  },
  "offer": {
    "id": 123,
    "status": "SOLD",
    "soldAt": "2026-05-20T10:00:00.000Z",
    "expiresAt": "2026-06-01T..."
  },
  "publication": {
    "status": "ENDED",
    "endReason": "SOLD"
  }
}
```

Mobile **nie polega** na follow-up `PATCH` oferty — PATCH może zostać jako fallback, ale **nie jest wymagany** do poprawnego stanu.

### 4.4 Kupujący akceptuje cenę (bez R9 na ofercie)

Gdy **kupujący** akceptuje → `deal.status = AGREED` — oferta **pozostaje ACTIVE** na rynku do momentu **decyzji właściciela** (R9). To zgodne z obecnym UX (rezerwacja / negocjacja do finalnego kliknięcia właściciela).

### 4.5 Implementacja — plik do sprawdzenia

Wdrożyć / zweryfikować w `dealFinalize.ts` (lub równoważnie w `deals/[id]/actions/route.ts`):

- Seller `BID_RESPOND` + `ACCEPT` przy `AGREED` → **finalize deal + endPublication(SOLD)**.
- Buyer `ACCEPT` przy negocjacji → tylko `AGREED`, **bez** zamykania oferty.

---

## 5. API — endpointy

### 5.1 `POST /api/mobile/v1/offers` (utworzenie + aktywacja)

**Request:**

```json
{
  "title": "...",
  "price": "...",
  "activateOnCreate": true,
  "publication": {
    "kind": "FREE_FIRST | PLUS_PAID",
    "iapTransactionId": "wymagane gdy PLUS_PAID",
    "consumePlusPublication": true
  }
}
```

**Logika:**

1. Utwórz ofertę.
2. `canActivateOffer` → jeśli `REQUIRES_PLUS` bez IAP → **422**:

```json
{
  "errorCode": "PUBLICATION_REQUIRES_PLUS",
  "message": "Publikacja tego ogłoszenia na 30 dni wymaga Pakiet Plus."
}
```

3. Zweryfikuj IAP (Apple JWS) przy `PLUS_PAID`, idempotencja po `transactionId`.
4. `activatePublication`.

**Response:** `offer` + `publication.endsAt` (+30 dni).

### 5.2 `POST /api/mobile/v1/offers/{id}/activate` (reaktywacja)

Po wycofaniu (R3), wygaśnięciu (R2) — **nie** po R9 bez nowego Plusa (oferta sprzedana = inny flow produktowy; jeśli biznesowo zezwalacie na ponowną sprzedaż tej nieruchomości, traktuj jak R4 + Plus).

**Request:**

```json
{
  "iapTransactionId": "...",
  "consumePlusPublication": true
}
```

### 5.3 `PATCH /api/mobile/v1/offers/{id}` — wycofanie ręczne

Przy `newStatus: ARCHIVED`:

- `endPublication(offerId, MANUAL_ARCHIVE)` natychmiast.
- **Nie** resetuj `first_free_publication_used`.
- **Nie** przyznawaj darmowego `POST` dla **innego** `offerId`.

### 5.4 `POST /api/mobile/v1/iap/verify`

**Request (iOS przykład):**

```json
{
  "platform": "ios",
  "productId": "pl.estateos.app.pakiet_plus_30d",
  "transactionId": "...",
  "jwsRepresentation": "...",
  "deferPublicationConsume": true,
  "publicationIntent": "NEW_OFFER | REACTIVATE_OFFER",
  "targetOfferId": 123
}
```

**Gdy `deferPublicationConsume: true`:**

- Zweryfikuj z Apple.
- Zapisz zakup jako **VERIFIED, nie consumed**.
- **Nie** zwiększaj `extraListings`.
- Response:

```json
{
  "success": true,
  "verified": true,
  "publicationConsumeDeferred": true,
  "transactionId": "...",
  "extraListings": 0
}
```

**Consume:** przy udanym `POST /offers` lub `POST /offers/{id}/activate` z tym samym `iapTransactionId`.

### 5.5 `GET /api/mobile/v1/offers/publication-quote` (nowy, zalecany)

**Query:** `?offerId=123` (opcjonalnie — brak = nowa oferta)

**Response:**

```json
{
  "offerId": 123,
  "action": "CREATE_AND_ACTIVATE | ACTIVATE",
  "requiresPayment": true,
  "allowedFreeFirst": false,
  "reason": "NOT_FIRST_OFFER | FREE_ALREADY_USED | REACTIVATION_AFTER_ARCHIVE | REACTIVATION_AFTER_SOLD",
  "productId": "pl.estateos.app.pakiet_plus_30d"
}
```

### 5.6 `GET /api/mobile/v1/offers?includeAll=true&userId={id}`

- Zwracaj **aktualny** `status` z DB.
- Mobile: `ACTIVE`, `PENDING*` → Aktywne; `ARCHIVED`, `SOLD`, `CLOSED`, `EXPIRED` → Zakończone.

### 5.7 Feed Radar / publiczny

Wyklucz oferty bez aktywnej publikacji oraz `status IN (SOLD, ARCHIVED, CLOSED, ...)`.

---

## 6. Kolejność wdrożenia (checklist)

### Faza A — Backend

- [ ] **A1** Migracja: `offer_publications`, `users.first_free_publication_used`, `iap_purchases.offer_id`.
- [ ] **A2** `activatePublication` / `endPublication` / `canActivateOffer`.
- [ ] **A3** Cron `EXPIRED`.
- [ ] **A4** `POST /offers` + `POST /offers/{id}/activate` + `publication-quote`.
- [ ] **A5** `iap/verify` z `deferPublicationConsume`.
- [ ] **A6** **R9:** `BID_RESPOND ACCEPT` od seller przy `AGREED` → deal finalize + `endPublication(SOLD)` w **jednej transakcji**.
- [ ] **A7** `PATCH ARCHIVED` → `MANUAL_ARCHIVE`.
- [ ] **A8** Radar / public — filtr statusów.
- [ ] **A9** Migracja danych: użytkownicy z ofertami w historii → `first_free_publication_used = true`.
- [ ] **A10** Testy E2E (patrz §7).

### Faza B — Mobile (po A4–A6 na staging)

- [ ] Publikacja z `publication-quote` + IAP defer + consume przy POST.
- [ ] Profil: reaktywacja przez `/activate`, nie slot `extraListings`.
- [ ] Dealroom: po finalizacji polegać na response API (PATCH oferty tylko fallback).
- [ ] Teksty UI zgodne z R1–R9.

### Faza C — Produkcja

- [ ] Regulamin PL (+ 30 dni, wycofanie, sprzedaż w Dealroom, Plus).
- [ ] App Review Notes EN.
- [ ] `npm run build` + `pm2 reload`.

---

## 7. Testy akceptacyjne

| ID | Kroki | Oczekiwany wynik |
|----|--------|------------------|
| T1 | Nowe konto → pierwsza oferta → publish | ACTIVE, 30 dni, **brak IAP** |
| T2 | T1 aktywna → druga oferta → publish | IAP, **dwie ACTIVE** |
| T3 | T1 → Wycofaj w dzień 10 | ENDED `MANUAL_ARCHIVE`, znika z Radaru |
| T4 | T3 → Przywróć to samo ID | IAP, ACTIVE 30 dni **od nowa** |
| T5 | T1 wygaśnie (cron) | ENDED `EXPIRED`, Zakończone |
| T6 | T1 zakończona → nowe ID=2 | IAP, **nie darmowe** |
| T7 | IAP OK, POST offers fail | Retry z tym samym `transactionId`, bez drugiego IAP |
| **T8** | Deal AGREED → **seller** ACCEPT final | Deal FINALIZED, offer **SOLD**, publikacja **ENDED/SOLD**, **nie** w Aktywnych, **nie** na Radarze |
| **T9** | T8 bez PATCH z mobile | Stan poprawny **tylko** z backendu |
| T10 | Buyer ACCEPT → seller jeszcze nie | Oferta **nadal ACTIVE** na Radarze |

---

## 8. Kompatybilność wsteczna

- Dual-write `extraListings` opcjonalnie 1 wersja — mobile przestanie na tym polegać.
- Stare verify bez `offer_id`: support ręczny lub migracja.

---

## 9. Apple App Store (kontekst)

- Pierwsza publikacja pierwszej oferty: **darmowa** — reviewer musi móc przejść bez IAP.
- Kolejna / reaktywacja: **consumable** `pl.estateos.app.pakiet_plus_30d` tylko przez IAP.
- **Brak** płatności poza sklepem na iOS.
- Promoted IAP na stronie produktu: **wyłączone** lub bez ceny na grafice.

---

## 10. Podsumowanie dla agenta backendu (TL;DR)

1. Wprowadź **`offer_publications`** (30 dni, ACTIVE/ENDED, powód zakończenia).
2. **Pierwsze `offerId` na koncie** — jedna darmowa publikacja; **każde inne** wystawienie / reaktywacja = **IAP per `offerId`**.
3. **Cron** wygasza po 30 dniach.
4. **Ręczne wycofanie** = ENDED, dni przepadają, powrót = Plus.
5. **R9 Dealroom:** seller final `ACCEPT` → **w tej samej transakcji** zamknij deal **i** zakończ ofertę (`SOLD` + `endPublication SOLD`) — **to dziś często robi tylko mobile PATCH i się wywala**.
6. **`iap/verify`** z defer — consume dopiero przy udanym activate/POST.
7. Endpoint **`publication-quote`** dla mobile.

**Deploy:** staging → test T1–T10 → produkcja (`npm run build`, `pm2 reload`).

---

*Koniec briefu — jeden plik, bez odwołań do innych dokumentów.*
