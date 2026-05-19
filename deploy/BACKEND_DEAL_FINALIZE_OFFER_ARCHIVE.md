# BACKEND BRIEF — Finalizacja dealroomu → wycofanie oferty z rynku

> **Problem zgłoszony (mobile):** Właściciel w Dealroomie potwierdza ostateczną cenę („zamykam sprzedaż”), w czacie widać „Transakcja zamknięta” i można wystawić opinię, ale w **Profil → Moje ogłoszenia → Aktywne** oferta nadal ma status **ACTIVE**. Kupujący na karcie oferty widzi „cena w negocjacji” (mobile poprawione po stronie klienta, ale źródłem prawdy musi być backend).

---

## 1. Oczekiwany przepływ biznesowy

1. Kupujący akceptuje cenę właściciela → `deal.status = AGREED`, `acceptedBidId` ustawione.
2. Właściciel klika **„Ostateczna decyzja sprzedaży”** → `POST .../deals/{id}/actions` z `BID_RESPOND`, `decision: ACCEPT`.
3. **W jednej transakcji DB** backend:
   - ustawia deal na `FINALIZED` / `SOLD` / `CLOSED`,
   - ustawia powiązaną ofertę (`deal.offerId`) na **`ARCHIVED` lub `SOLD`** + `archivedAt` / `soldAt`,
   - opcjonalnie zapisuje `finalPrice` / `soldPrice` z zaakceptowanego bida.
4. Oferta **znika z Radaru** i z zakładki **Aktywne**; trafia do **Zakończone** (`ARCHIVED` / `SOLD`).

Mobile **nie może** być jedynym miejscem, które archiwizuje ofertę — request klienta może się nie udać (sieć, 403, walidacja pola), a deal i tak zostaje zamknięty w czacie.

---

## 2. Co robi aplikacja mobilna dziś (best-effort)

Po sukcesie `BID_RESPOND` + `ACCEPT` od **właściciela** (`FinalConfirmationModal` / `BidActionModal`):

```http
PATCH /api/mobile/v1/offers/{offerId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "ARCHIVED",
  "newStatus": "ARCHIVED",
  "archivedAt": "2026-05-19T12:00:00.000Z"
}
```

Kolejno próbuje też `SOLD` i `CLOSED`, jeśli `ARCHIVED` nie przejdzie.

Dodatkowo wysyła wiadomość tekstową w wątku dealroomu (audit UX), np.:

`Decyzja właściciela: ostatecznie akceptuję cenę 610 000 PLN i zamykam sprzedaż. Oferta została wycofana z rynku.`

**Jeśli PATCH oferty zwraca 4xx/5xx lub ignoruje pola — oferta zostaje ACTIVE w:**

`GET /api/mobile/v1/offers?includeAll=true&userId={id}`

---

## 3. Wymagania dla backendu (MUST)

### 3.1 Przy finalnej akceptacji właściciela

**Trigger:** `POST /api/mobile/v1/deals/{dealId}/actions`

```json
{
  "type": "BID_RESPOND",
  "bidId": 123,
  "decision": "ACCEPT",
  "message": "Decyzja właściciela: ostatecznie akceptuję cenę … i zamykam sprzedaż."
}
```

**Warunki:** tylko **seller/owner** deala; deal w stanie umożliwiającym finalizację (`AGREED` + `acceptedBidId`).

**Efekt atomowy:**

| Encja | Pole | Wartość |
|--------|------|---------|
| `Deal` | `status` | `FINALIZED` lub `SOLD` |
| `Deal` | `finalizedAt` | `now()` |
| `Deal` | `finalPrice` | kwota z `acceptedBidId` |
| `Offer` | `status` | `ARCHIVED` **lub** `SOLD` |
| `Offer` | `archivedAt` / `soldAt` | `now()` |

### 3.2 Odczyt listy „Moje ogłoszenia”

`GET /api/mobile/v1/offers?includeAll=true&userId={id}` musi zwracać **aktualny** `status` z DB (nie cache ACTIVE).

Mobile mapuje do zakładek:

- `ACTIVE`, `PENDING` → Aktywne / Oczekujące  
- `ARCHIVED`, `SOLD`, `CLOSED`, `OFF_MARKET`, `EXPIRED`, … → **Zakończone**

### 3.3 Feed publiczny (Radar)

Oferty ze statusem `ARCHIVED` / `SOLD` / `CLOSED` **nie mogą** wracać w publicznym feedzie / radarze.

### 3.4 Odpowiedź API

Po finalizacji deala response (deal lub offer) powinien zawierać:

```json
{
  "deal": { "id": 173, "status": "FINALIZED", "offerId": 123, "finalPrice": 610000 },
  "offer": { "id": 123, "status": "ARCHIVED", "archivedAt": "..." }
}
```

Ułatwi to mobile odświeżenie bez drugiego PATCH.

---

## 4. PATCH oferty — kontrakt (jeśli zostaje osobny krok)

Mobile wysyła (z `persistMobileOfferUpdate`):

- `PATCH /api/mobile/v1/offers/:id` — preferowany  
- fallback: `PUT /api/mobile/v1/offers/:id`, potem `PUT /api/mobile/v1/offers`

**Body (przykład):**

```json
{
  "status": "ARCHIVED",
  "newStatus": "ARCHIVED",
  "archivedAt": "2026-05-19T12:00:00.000Z"
}
```

Backend **musi**:

- akceptować zmianę statusu przez właściciela oferty (`offer.userId === auth.userId`),
- zapisać `status` w kolumnie używanej przez listę (`Offer.status`, nie tylko `newStatus` w DTO),
- zwracać `200` + zaktualizowany obiekt; przy sukcesie **nie** zwracać `{ success: false }` z HTTP 200.

---

## 5. Diagnostyka dla zgłoszenia (2 oferty nadal ACTIVE)

Dla właściciela z screenshotu (oferty m.in. Englewood Cliffs, Praga):

1. Znaleźć deale powiązane z `offerId` (np. 171, 173).
2. Sprawdzić `Deal.status`, `Deal.acceptedBidId`, datę ostatniego `BID_RESPOND ACCEPT`.
3. Sprawdzić `Offer.status` w DB — jeśli nadal `ACTIVE`, PATCH z mobile nie zadziałał **albo** finalizacja deala nie aktualizuje oferty.
4. W logach API: ostatni `PATCH /offers/:id` dla tych ID — status HTTP, body błędu.
5. **Hotfix:** ręcznie ustawić `Offer.status = 'ARCHIVED'` dla zamkniętych deali + ewentualny skrypt migracyjny dla deali `FINALIZED` z `ACTIVE` offer.

---

## 6. Powiązane endpointy mobile (referencja)

| Endpoint | Rola |
|----------|------|
| `POST /api/mobile/v1/deals/{id}/actions` | Finalizacja ceny |
| `GET /api/mobile/v1/deals` | Snapshot deala (`status`, `acceptedBidId`, `offerId`) |
| `GET /api/mobile/v1/deals/{id}/messages` | Wiadomości + wykrywanie „zamykam sprzedaż” |
| `PATCH /api/mobile/v1/offers/{id}` | Best-effort archiwizacja z klienta |
| `GET /api/mobile/v1/offers?includeAll=true` | Lista Moje ogłoszenia |
| `POST /api/reviews` | Opinie po finalizacji (osobny moduł) |

Kontrakt opinii / IAP: `src/contracts/iapContract.ts`, `parityContracts.ts` (`isDealSaleFinalizedMessage`).

---

## 7. Kryterium akceptacji (QA)

- [ ] Po finalnej akceptacji właściciela oferta **nie** jest w zakładce Aktywne.
- [ ] Ta sama oferta jest w **Zakończone** (`ARCHIVED` lub `SOLD`).
- [ ] Oferta nie pojawia się na Radarze.
- [ ] `GET offers?includeAll=true` zwraca zaktualizowany status bez ręcznego PATCH z Postmana.
- [ ] Dla istniejących deali już sfinalizowanych w czacie — skrypt naprawczy lub jednorazowa migracja.

---

## 8. Rekomendacja architektoniczna

**Jedna transakcja:** `finalizeDeal(dealId)` w serwisie dealroomu → update Deal + Offer + ewentualnie powiadomienie push.  
PATCH oferty z mobile traktować jako **fallback**, nie jako źródło prawdy.
