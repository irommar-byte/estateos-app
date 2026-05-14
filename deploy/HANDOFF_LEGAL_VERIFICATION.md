# Handoff: Weryfikacja prawna oferty (KW + nr lokalu)

> Aktualizacja: 12 maja 2026  
> Autor frontu: EstateOS™ mobile  
> Pojedyncze źródło prawdy (typy / endpointy): `src/contracts/legalVerificationContract.ts`

---

## 1. Po co to jest

Właściciel oferty zgłasza numer **księgi wieczystej** + **numer lokalu**.
Administrator EstateOS™ ręcznie waliduje to w EKW
(https://przegladarka-ekw.ms.gov.pl) i:

- **akceptuje** → na karcie oferty zapala się zielony znaczek
  „Zweryfikowano prawnie" (czyli `isLegalSafeVerified = true`),
- **odrzuca** → właściciel widzi powód i może poprawić oraz wysłać ponownie.

Front-end **już dziś** czyta z oferty następujące pola i zachowuje się
poprawnie nawet bez tego flow (pokazuje „Weryfikacja prawna w toku"):

- `isLegalSafeVerified` (bool, kanon)
- `legalCheckStatus` ('VERIFIED' / 'SAFE' / ...)
- `isLandRegistryVerified`, `landRegistryVerified`, `isVerifiedLegal`
  (legacy aliasy — wszystkie traktowane jako synonimy)

Po wdrożeniu tego flow backend MUSI zacząć przesyłać `isLegalSafeVerified`
opartego o nowy `legal_check_status` (patrz § 3).

---

## 2. Decyzja architektoniczna — NIE robimy osobnej tabeli

`landRegistryNumber` i `apartmentNumber` JUŻ są atrybutami oferty —
zbierane w `AddOffer/Step3_Parameters.tsx`, wysyłane w `Step6_Summary.tsx`.
Każda oferta ma dokładnie jeden stan weryfikacji. Dlatego dokładamy
do tabeli `offers` kilka kolumn audytowych i KONIEC.

„Kolejka admina" to po prostu filtrowany SELECT:
```sql
WHERE legal_check_status = 'PENDING'
ORDER BY legal_check_submitted_at ASC
```

To prostsze niż osobny obiekt domenowy (mniej joinów, atomowe update,
brak duplikatów stanu).

---

## 3. Schemat bazy — kolumny do dodania na `offers`

```sql
ALTER TABLE offers
  ADD COLUMN legal_check_status        VARCHAR(16)  NOT NULL DEFAULT 'NONE',
  ADD COLUMN legal_check_submitted_at  TIMESTAMPTZ  NULL,
  ADD COLUMN legal_check_reviewed_at   TIMESTAMPTZ  NULL,
  ADD COLUMN legal_check_reviewed_by   BIGINT       NULL REFERENCES users(id),
  ADD COLUMN legal_check_rejection_code  VARCHAR(40) NULL,
  ADD COLUMN legal_check_rejection_text  TEXT       NULL,
  ADD COLUMN legal_check_owner_note      TEXT       NULL,
  ADD COLUMN legal_check_internal_note   TEXT       NULL;

CREATE INDEX idx_offers_legal_check_status_submitted
  ON offers (legal_check_status, legal_check_submitted_at)
  WHERE legal_check_status IN ('PENDING', 'REJECTED');

-- Constraint trzymający dozwolone wartości statusu:
ALTER TABLE offers
  ADD CONSTRAINT chk_offers_legal_check_status
  CHECK (legal_check_status IN ('NONE','PENDING','VERIFIED','REJECTED'));
```

**Pochodne**:
- `isLegalSafeVerified` = `(legal_check_status = 'VERIFIED' AND legal_check_reviewed_at IS NOT NULL)` — wyliczamy w SELECT-cie.

---

## 4. State machine

```
NONE ──(owner submit)──▶ PENDING
PENDING ──(admin approve)──▶ VERIFIED   (sets isLegalSafeVerified=true)
PENDING ──(admin reject)───▶ REJECTED   (zwraca owner reason)
REJECTED ──(owner resubmit)─▶ PENDING
VERIFIED ──(owner edits KW)─▶ PENDING   (ważne! zmiana KW unieważnia ACK)
```

`VERIFIED → PENDING` po edycji KW wymusza ponowne sprawdzenie — to
gwarantuje, że zielony znaczek zawsze odpowiada AKTUALNEMU numerowi
księgi (nie da się obejść weryfikacji przez zmianę KW po fakcie).

---

## 5. Endpointy

> Wszystkie ścieżki są zdefiniowane w `src/contracts/legalVerificationContract.ts`
> jako `LEGAL_VERIFICATION_ENDPOINTS`. Jeśli się tu zmienią — front-end
> trzeba zaktualizować w jednym miejscu (tym pliku).

### 5.1 Owner: pobranie statusu

```
GET /api/mobile/v1/offers/:offerId/legal-verification
Auth: Bearer (właściciel oferty)
```

Response 200:
```json
{
  "offerId": 1234,
  "status": "PENDING",
  "landRegistryNumber": "WA4M/00012345/6",
  "apartmentNumber": "14A",
  "submittedAt": "2026-05-12T11:24:18.000Z",
  "reviewedAt": null,
  "reviewedByName": null,
  "rejection": null,
  "isLegalSafeVerified": false
}
```

Jeśli nie ma jeszcze żadnego zgłoszenia — backend MOŻE:
- a) zwrócić 404 (front sam wytworzy „pusty" widok `status: 'NONE'`), lub
- b) zwrócić 200 z `{status: 'NONE', ...nulle...}`.

Front obsługuje obie ścieżki.

### 5.2 Owner: zgłoszenie / aktualizacja

```
POST /api/mobile/v1/offers/:offerId/legal-verification/submit
Auth: Bearer (właściciel oferty)
```

Body:
```json
{
  "landRegistryNumber": "WA4M/00012345/6",
  "apartmentNumber": "14A",
  "ownerNote": "opcjonalnie"
}
```

Reguły:
1. Tylko `offer.user_id = currentUser.id`.
2. `landRegistryNumber` MUSI pasować do regexu `^[A-Z]{2}[0-9A-Z]{2}/[0-9]{8}/[0-9]$`
   (patrz `src/utils/landRegistry.ts`).
3. Update na `offers`:
   - `land_registry_number = $1`
   - `apartment_number = $2`
   - `legal_check_owner_note = $3`
   - `legal_check_status = 'PENDING'`
   - `legal_check_submitted_at = now()`
   - `legal_check_reviewed_at = NULL`
   - `legal_check_reviewed_by = NULL`
   - `legal_check_rejection_code = NULL`
   - `legal_check_rejection_text = NULL`
4. **Idempotencja**: jeśli identyczny KW+apt JUŻ jest PENDING, zwracamy
   200 z aktualnym widokiem (bez resetu `submitted_at`).
5. Audyt: zapis do `events` (lub `audit_log`) z `actor`, `offer_id`,
   `event: 'legal.submit'`.

Response: ten sam shape co GET (§ 5.1).

### 5.3 Admin: kolejka

```
GET /api/mobile/v1/admin/legal-verification?status=PENDING
Auth: Bearer (role = ADMIN)
```

`status` to jeden z `PENDING | VERIFIED | REJECTED` (front dopuszcza
też `NONE`, ale w panelu nie ma takiej zakładki).

Response 200:
```json
{
  "items": [
    {
      "offerId": 1234,
      "offerTitle": "Mieszkanie przy parku Łazienkowskim",
      "ownerId": 99,
      "ownerName": "Marian Kowalski",
      "city": "Warszawa",
      "district": "Śródmieście",
      "street": "Marszałkowska 12",
      "apartmentNumber": "14A",
      "landRegistryNumber": "WA4M/00012345/6",
      "submittedAt": "2026-05-12T11:24:18.000Z",
      "status": "PENDING",
      "ownerNote": null,
      "ekwQuickLink": "https://przegladarka-ekw.ms.gov.pl/...?numerKW=WA4M%2F00012345%2F6"
    }
  ],
  "total": 1,
  "nextCursor": null
}
```

`ekwQuickLink` — wygodny pre-fill z numerem KW w query string.
Jeśli backend nie potrafi go sensownie zbudować — może być `null`
(front otwiera EKW „głównym wejściem").

### 5.4 Admin: accept

```
POST /api/mobile/v1/admin/legal-verification/:offerId/approve
Auth: Bearer (role = ADMIN)
```

Body:
```json
{ "internalNote": null }
```

Update na `offers`:
- `legal_check_status = 'VERIFIED'`
- `legal_check_reviewed_at = now()`
- `legal_check_reviewed_by = currentAdmin.id`
- `legal_check_internal_note = $1`
- `legal_check_rejection_code = NULL`
- `legal_check_rejection_text = NULL`

Response: aktualny widok (§ 5.1).

**Powiadomienie do właściciela** (push + email):
- tytuł: „Twoja oferta została zweryfikowana prawnie"
- treść: „Zielony znaczek bezpieczeństwa jest już aktywny."

### 5.5 Admin: reject

```
POST /api/mobile/v1/admin/legal-verification/:offerId/reject
Auth: Bearer (role = ADMIN)
```

Body:
```json
{
  "reasonCode": "APARTMENT_NUMBER_MISMATCH",
  "reasonText": "Numer lokalu 14A nie istnieje w wykazie; może chodzi o 14B?"
}
```

Dozwolone `reasonCode` (TYLKO te wartości):
```
KW_NOT_FOUND
KW_NUMBER_MISMATCH
APARTMENT_NUMBER_MISMATCH
OWNER_NAME_MISMATCH
DEBT_OR_ENCUMBRANCE
EXPIRED_OR_INVALID_FORMAT
OTHER
```

`reasonText` wymagane tylko gdy `reasonCode === 'OTHER'` (na froncie też
to walidujemy, ale backend MUSI też wymusić).

Update na `offers`:
- `legal_check_status = 'REJECTED'`
- `legal_check_reviewed_at = now()`
- `legal_check_reviewed_by = currentAdmin.id`
- `legal_check_rejection_code = $1`
- `legal_check_rejection_text = $2`

**Powiadomienie do właściciela** (push + email):
- tytuł: „Weryfikacja prawna oferty wymaga poprawy"
- treść: krótka etykieta z `reasonCode` + `reasonText` jeśli jest.

---

## 6. Wpływ na inne endpointy

### 6.1 `GET /api/mobile/v1/offers/:id` i lista ofert

Backend MUSI zacząć dorzucać do odpowiedzi (kanon):

```json
{
  "isLegalSafeVerified": true,
  "legalCheckStatus": "VERIFIED"
}
```

Front już dziś czyta oba (`OfferDetail.tsx` linijka ~493). Stare aliasy
(`isLandRegistryVerified`, `landRegistryVerified`, `verificationStatus`)
można utrzymywać przez 1–2 wersje, później wycofać.

### 6.2 `POST /api/mobile/v1/offers` (publikacja oferty z Step6)

Jeśli ofertę publikuje user z wypełnionym `landRegistryNumber`,
**backend MOŻE automatycznie** ustawić jej `legal_check_status = 'PENDING'`
i `legal_check_submitted_at = now()`. To wygodne, bo właściciel nie musi
osobno klikać „Wyślij do weryfikacji" — wszystko leci jednym strzałem.

(Alternatywnie: pozostawiamy `NONE` i pokazujemy CTA w OfferDetail.
Front obsługuje OBA scenariusze.)

### 6.3 `PUT /api/mobile/v1/offers/:id` (edycja oferty)

Jeśli właściciel ZMIENI `landRegistryNumber` lub `apartmentNumber`,
backend MUSI:
- `legal_check_status = 'PENDING'` (niezależnie od poprzedniego),
- `legal_check_submitted_at = now()`,
- wyczyścić pola review (jak w §5.2 punkt 3).

To znaczy: jeśli oferta była VERIFIED i właściciel zmieni KW, traci ona
status VERIFIED. **Tego nie wolno omijać.**

---

## 7. Bezpieczeństwo i prywatność

- Numer KW i numer mieszkania to dane wrażliwe (umożliwiają lookup
  właściciela w EKW). NIE pojawiają się w odpowiedziach publicznych
  (`GET /api/mobile/v1/offers/...` bez ownera/admina → ukrywamy).
- Endpoint `GET /api/mobile/v1/offers/:offerId/legal-verification`:
  - jeśli caller != owner && caller.role != 'ADMIN' → **403**.
- Endpoint `POST /...legal-verification/submit`:
  - jeśli caller != owner → **403**.
- Endpointy `/admin/...`:
  - jeśli caller.role != 'ADMIN' → **403**.
- **Rate-limit** po `submit`: 5 req/min/user (zapobiega spamowi kolejki).

---

## 8. Plan testów cURL (kopiuj i wklej)

```bash
# 1) Owner zgłasza
curl -X POST https://estateos.pl/api/mobile/v1/offers/1234/legal-verification/submit \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"landRegistryNumber":"WA4M/00012345/6","apartmentNumber":"14A"}'

# 2) Admin czyta kolejkę
curl https://estateos.pl/api/mobile/v1/admin/legal-verification?status=PENDING \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3) Admin akceptuje
curl -X POST https://estateos.pl/api/mobile/v1/admin/legal-verification/1234/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"internalNote":null}'

# 4) Sprawdzenie statusu po akceptacji — `isLegalSafeVerified=true`
curl https://estateos.pl/api/mobile/v1/offers/1234 \
  -H "Authorization: Bearer $OWNER_TOKEN"

# 5) Admin odrzuca
curl -X POST https://estateos.pl/api/mobile/v1/admin/legal-verification/1234/reject \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reasonCode":"APARTMENT_NUMBER_MISMATCH","reasonText":"Lokal 14A nie istnieje."}'
```

---

## 9. Edge cases / FAQ

**Pytanie:** Co jeśli właściciel oferty wyrejestruje konto?  
**Odpowiedź:** Zachowujemy `legal_check_reviewed_by` (FK do `users` może
być `ON DELETE SET NULL`), żeby audyt admina pozostał. KW + apt są
częścią rekordu oferty, więc jeśli oferta przeżyje — dane też.

**Pytanie:** Czy admin może edytować zgłoszenie zamiast accept/reject?  
**Odpowiedź:** Nie. Admin tylko ocenia to, co dostał. Jeśli coś jest
niedokładne, odrzuca z powodem i właściciel poprawia.

**Pytanie:** Czy `OWNER_NAME_MISMATCH` ma sens, skoro w aplikacji nie
zbieramy nazwiska na ofercie?  
**Odpowiedź:** Tak — KW pokazuje właściciela w dziale II, więc admin może
spojrzeć i jeśli to nie zgadza się z `user.full_name`, oflagować jako
podejrzane. Decyzja merytoryczna admina.

**Pytanie:** Czy front-end ma `ekwQuickLink`?  
**Odpowiedź:** Tak — jeśli backend go zwróci, otwieramy ten URL. Jeśli
nie, otwieramy `https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wyszukiwanieKW`.
Admin sam wklei numer.

---

## 10. TL;DR dla agenta backendu

1. Dodaj kolumny audytowe na `offers` (§3).
2. Postaw 5 endpointów (§5).
3. Dorzuć `isLegalSafeVerified` + `legalCheckStatus` do każdej oferty
   w listach i detalu (§6.1).
4. Auto-przełącz na PENDING przy publikacji oferty z KW (§6.2).
5. Auto-przełącz na PENDING przy edycji KW (§6.3).
6. Wyślij push do właściciela po accept/reject (§5.4, §5.5).
7. Wymuś 403 dla obcych + rate-limit 5/min na submit (§7).
8. Przetestuj scenariusze z §8.

Front-end jest gotowy — endpointy są zdefiniowane w
`src/contracts/legalVerificationContract.ts`, klient: `src/services/legalVerificationService.ts`.
