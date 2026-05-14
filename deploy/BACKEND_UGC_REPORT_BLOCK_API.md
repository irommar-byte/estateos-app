# Backend — UGC Report + Block API

> Wymagane przez **Apple App Store Review Guideline 1.2** (User-Generated Content).
>
> **Status: WDROŻONE I PRZETESTOWANE 12.05.2026** — backend agent zaraportował
> 13/13 zielonych scenariuszy. Ten dokument opisuje FAKTYCZNY kontrakt, który
> aplikacja mobilna konsumuje produkcyjnie (`src/store/useBlockedUsersStore.ts`,
> `src/components/ReportSheet.tsx`).

Klient mobilny:

- pokazuje przyciski „Zgłoś" i „Zablokuj" w `OfferDetail` (`⋯` w prawym górnym
  rogu) oraz w `DealroomChatScreen` (`⋯` w nagłówku rozmowy),
- ma 7 kanonicznych kategorii zgłoszeń (zsynchronizowanych z backendem),
- filtruje listy ofert/dealroomów po lokalnym `useBlockedUsersStore`,
- ma sekcję „Zablokowani użytkownicy" w Profilu z możliwością odblokowania,
- obsługuje stable error codes z backendu (`CANNOT_BLOCK_ADMIN`,
  `CANNOT_REPORT_SELF`, `RATE_LIMITED` itd.) konkretnym Alertem.

Backend dodatkowo:

- filtruje `GET /api/mobile/v1/offers` po obustronnej liście blokad
  (`getBlockedScope(viewerUserId)`) — defense-in-depth.

## 1. Modele bazy danych

### `UserReport`

```
id                  PK
reporterUserId      FK users
targetType          enum('USER'|'OFFER')
targetUserId        nullable FK users
targetOfferId       nullable FK offers
category            enum SPAM | HARASSMENT | INAPPROPRIATE_CONTENT
                       | FRAUD_SCAM | IMPERSONATION | HATE_SPEECH | OTHER
reason              text (opcjonalny opis ≤ 500 znaków)
status              enum('PENDING'|'REVIEWED_VALID'|'REVIEWED_INVALID'|'ACTIONED')
audit columns       createdAt, updatedAt, reviewerId, reviewedAt, resolutionNote
indeksy             reporter, target, status
```

### `UserBlock`

```
id                  PK
blockerUserId       FK users
blockedUserId       FK users
createdAt           timestamp
UNIQUE(blockerUserId, blockedUserId)
```

### Migracja

`prisma/manual/sql/2026-05-12_ugc_report_block.sql` — idempotentna,
zaaplikowana na produkcji.

## 2. Endpointy

Wszystkie wymagają `Authorization: Bearer <mobileJwt>` poza `categories`.

### `GET /api/mobile/v1/reports/categories`

Publiczne. Zwraca tablicę z 7 kategoriami — single source of truth dla API
i panelu admina. Klient mobilny ma te same ID twardo zaszyte z polskimi
labelkami, więc działa offline.

### `POST /api/mobile/v1/reports`

Request body:

```json
{
  "targetType": "USER" | "OFFER",
  "targetUserId":  number?,
  "targetOfferId": number?,
  "category": "SPAM" | "HARASSMENT" | "INAPPROPRIATE_CONTENT"
            | "FRAUD_SCAM" | "IMPERSONATION" | "HATE_SPEECH" | "OTHER",
  "reason": "string opcjonalny ≤ 500 znaków"
}
```

Responses:

- `200` — `{ "duplicate": false, "status": "PENDING" }` — nowe zgłoszenie.
- `200` — `{ "duplicate": true,  "status": "PENDING" }` — duplikat w oknie 24h
  (idempotencja per `reporter + target + category`). UI traktuje jak sukces.
- `400` `INVALID_PAYLOAD` / `INVALID_TARGET_TYPE` / `INVALID_TARGET_ID` /
  `INVALID_CATEGORY`.
- `400` `CANNOT_REPORT_SELF` — próba zgłoszenia własnego konta.
- `400` `CANNOT_REPORT_OWN_OFFER` — próba zgłoszenia własnej oferty.
- `401` `MISSING_AUTH`.
- `404` `TARGET_NOT_FOUND` — target został usunięty.
- `429` — rate-limit (30 zgłoszeń / h / reporter).
- `500` `INTERNAL_ERROR`.

### `GET /api/mobile/v1/reports`

Zwraca własne zgłoszenia użytkownika (max 100). Wykorzystywane przez
historię zgłoszeń (na razie nieużywane w UI mobile, ale endpoint istnieje
dla przyszłej sekcji „Moje zgłoszenia" w Profilu).

### `POST /api/mobile/v1/blocks`

Request body: `{ "targetUserId": number }`.

Responses:

- `200` — `{ "duplicate": false }` — nowa blokada.
- `200` — `{ "duplicate": true  }` — idempotentna powtórka.
- `400` `CANNOT_BLOCK_SELF`.
- `400` `CANNOT_BLOCK_ADMIN` — ochrona admina/supportu.
- `401` `MISSING_AUTH`.
- `404` `TARGET_NOT_FOUND`.

### `DELETE /api/mobile/v1/blocks/:userId`

Idempotentne — DELETE na nieistniejącej blokadzie też zwraca 200.

### `GET /api/mobile/v1/blocks`

Zwraca listę zablokowanych w pełnym kształcie user-shape (klient cache'uje
to w `useBlockedUsersStore.usersById`, dzięki czemu `BlockedUsersModal` w
Profilu nie strzela do `/api/users/:id/public` per użytkownik):

```jsonc
// Kształt 1 (raw array)
[
  { "id": 17, "blockedUserId": 42, "createdAt": "...",
    "user": { "id": 42, "name": "Jan Kowalski", "role": "USER", "companyName": null } }
]

// Kształt 2 (envelope)
{ "blocks": [{ "user": {...} }, ...] }
```

Klient parsuje OBA kształty defensywnie (`parseBlocksPayload`).

## 3. Filtr ofert (Apple UGC 1.2 — sedno wymagania)

`GET /api/mobile/v1/offers` dla zalogowanego viewera dokłada:

```sql
WHERE userId NOT IN (
  SELECT blockedUserId FROM "UserBlock" WHERE blockerUserId = :viewer
  UNION
  SELECT blockerUserId FROM "UserBlock" WHERE blockedUserId = :viewer
)
```

Symetria jest celowa: jeśli A blokuje B, to nie tylko A nie widzi ofert B,
ale i B nie widzi ofert A. To eliminuje vector „zablokuj się sam, żeby
zobaczyć więcej cudzych ofert" i odpowiada modelowi Apple Messages/Twitter.

Owner view (`?userId=<self>`) zostaje bez zmian — agent/admin widzi swoje
oferty niezależnie od blokad.

## 4. Stable error codes — kontrakt mobile

| Kod | Gdzie | UI mobile |
|-----|-------|-----------|
| `MISSING_AUTH` | 401 wszędzie | Wymagane zalogowanie |
| `INVALID_PAYLOAD` | 400 wszędzie | Niepoprawne dane (generic) |
| `INVALID_CATEGORY` | 400 `/reports` | "Wybierz powód z listy" |
| `INVALID_TARGET_TYPE` | 400 `/reports` | Niepoprawne dane |
| `INVALID_TARGET_ID` | 400 wszędzie | Niepoprawne dane |
| `TARGET_NOT_FOUND` | 404 `/reports` | "Zgłaszany element został już usunięty" |
| `CANNOT_REPORT_SELF` | 400 `/reports` | "Nie można zgłosić własnego konta" |
| `CANNOT_REPORT_OWN_OFFER` | 400 `/reports` | "To Twoja oferta — edytuj/usuń w Profilu" |
| `CANNOT_BLOCK_SELF` | 400 `/blocks` | "Nie można zablokować siebie" |
| `CANNOT_BLOCK_ADMIN` | 400 `/blocks` | "Tego konta nie można zablokować — administrator" |
| `RATE_LIMITED` | 429 `/reports` | "Zbyt wiele zgłoszeń, spróbuj za chwilę" |
| `INTERNAL_ERROR` | 500 wszędzie | Cichy fallback do sukcesu (idempotencja) |

## 5. Moderacja

- `ugc.report.created` (warn) — do audytu CS.
- `ugc.report.duplicate` (info).
- `ugc.block.created` / `ugc.block.removed` / `ugc.block.error` — analytics.
- Notes for Review w App Store Connect: „Reports are reviewed within 24h
  via admin panel + email alert to `moderation@estateos.pl`."
