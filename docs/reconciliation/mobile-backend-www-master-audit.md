# Mobile ↔ Backend ↔ WWW — master audit & reconciliation plan

> **Nad dokumentem:** pełny plan wykonawczy z grafami, macierzami i etapami PR:  
> [`MASTER_EXECUTION_PLAN.md`](./MASTER_EXECUTION_PLAN.md)  
> **Migracja SQL (prowizja oferty):** [`sql/add_agent_commission_percent.sql`](./sql/add_agent_commission_percent.sql)

**Status dokumentu:** audyt kontraktów (faza analityczna); część rekomendacji została zaimplementowana w repo — patrz `MASTER_EXECUTION_PLAN.md` §7.

**Źródło prawdy (canonical):** aplikacja mobilna **EstateOS** (`estateos-app`).

**Stan referencyjny backendu/WWW:** gałąź `recovery-local-snapshot`, commit **`729b35bf`** (Next.js + Prisma + route handlers).

---

## 0) Metodologia i ograniczenia

1. **Backend/WWW:** pełna lista handlerów API po manifestcie buildu Next (`src/app/api/**/route.ts`) — **137** plików `route.ts` (zgodnie ze skanem manifestu w środowisku analizy).
2. **Mobile:**
   - Zweryfikowano pliki dostępne lokalnie pod `/home/rommar/estateos-app` (m.in. `DealroomListScreen`, `EditOfferScreen`, `BidActionModal`, `AppointmentActionModal`, `listingQuota.ts`, `pushNotifications.ts`, `passkeyService.ts`, `iapPakietPlus.ts`, `ProfileScreen.tsx` — część ścieżek).
   - Uzupełniono kontrakty z **drzewa `main` repozytorium `estateos-app` na GitHubie** tam, gdzie lokalny checkout był **niekompletny** (np. brak `App.tsx` / `useAuthStore.ts` na dysku przy jednoczesnym imporcie z tych modułów w innych plikach).
3. **DTO „response”:** w tabeli podano **kształt oczekiwany przez mobile** (na podstawie parsowania `res.json()`) oraz **faktyczny kształt zwrotny backendu** tylko tam, gdzie wykonano odczyt pliku route/handler; w pozostałych wierszach pole `response DTO` = *„mobile tolerant / backend: weryfikacja ręczna”*.
4. **Statusy:** `OK` = ścieżka istnieje i brak oczywistego rozjazdu z nagłówka; `MISSING` = brak `route.ts`; `DTO_MISMATCH` = ten sam endpoint, ale body/nagłówki/semantyka rozjechane; `DUPLICATE` = kilka handlerów dla tej samej domeny (np. passkey); `LEGACY` = backend/WWW utrzymuje alternatywną ścieżkę spoza mobile canon.

---

## 1) Tabela kontraktów (mobile → backend)

Legenda **auth type:** `none` | `Bearer JWT` | `cookie` (nieużywane w wierszach mobile) | `mixed` (np. FormData bez Bearer w jednym call site).

| endpoint | method | request DTO (mobile) | response DTO (mobile expectation) | auth type | plik(i) mobile | backend `route.ts` | status |
|---------|--------|----------------------|-----------------------------------|-----------|----------------|--------------------|--------|
| `/api/mobile/v1/auth/login` | POST | `{ email, password }` | JSON z tokenem / user (store) | `none` + JSON | `src/store/useAuthStore.ts` (GitHub `main`) | `src/app/api/mobile/v1/auth/login/route.ts` | OK* |
| `/api/register` | POST | `{ email, password, name?, phone?, role? }` (+ mobile powinien wysyłać `companyName` dla AGENT) | `{ success, token?, role, id, name? }` | `none` + JSON | `src/store/useAuthStore.ts` (GitHub `main`) | `src/app/api/register/route.ts` | DTO_MISMATCH* |
| `/api/auth/reset-password` | POST | Faza 1: `{ identifier }`; Faza 2: `{ identifier, otp, newPassword }` | komunikat sukcesu / błąd | `none` + JSON | `src/screens/AuthScreen.tsx` (GitHub `main`) | `src/app/api/auth/reset-password/route.ts` | OK* |
| `/api/auth/check-exists` | POST | `{ email\|phone, field, value }` | `{ exists? boolean ... }` (mobile interpretuje) | `none` + JSON | `src/screens/AuthScreen.tsx` (GitHub `main`) | `src/app/api/auth/check-exists/route.ts` | OK* |
| `/api/mobile/v1/user/avatar` | POST (A) | JSON `{ image: base64, userId }` | `{ success, url? }` | `Bearer` + JSON | `src/store/useAuthStore.ts` (GitHub `main`) | `src/app/api/mobile/v1/user/avatar/route.ts` | **DTO_MISMATCH** |
| `/api/mobile/v1/user/avatar` | POST (B) | `multipart/form-data` pola `file`, `userId` | `{ success, url }` | często **bez** Bearer w kodzie Profile | `src/screens/ProfileScreen.tsx` (GitHub `main`) | ten sam handler | OK / DTO_MISMATCH* |
| `/api/mobile/v1/offers` | GET | query: `includeAll=true` opcjonalnie `userId=` | `{ success: true, offers: Offer[] }` (+ mobile liczy statusy) | `none` lub `Bearer` zależnie od ekranu | `Radar.tsx`, `EditOfferScreen.tsx`, `listingQuota.ts`, `ProfileScreen` (część ścieżek) | `src/app/api/mobile/v1/offers/route.ts` | OK / DTO_MISMATCH* |
| `/api/mobile/v1/offers` | POST | ciało oferty + `userId` (+ opcj. `clientRequestId`) | `{ success, offer }` | `Bearer` | `src/screens/AddOffer/Step6_Summary.tsx` (GitHub `main`) | ten sam | OK* |
| `/api/mobile/v1/offers` | PUT | obiekt aktualizacji (m.in. `id`, `userId`, pola oferty) | `{ success, offer }` | `Bearer` | `EditOfferScreen.tsx` | ten sam | **DTO_MISMATCH** (brak weryfikacji Bearer w handlerze `PUT` — backend przyjmuje `userId` z body; mobile = canon zachowania, backend powinien dopasować walidację do mobile JWT) |
| `/api/upload` | POST | `FormData` (pliki, `offerId`, …, floor plan flag) | URL-e / success | `Bearer` | `Step6_Summary.tsx` (GitHub `main`) | `src/app/api/upload/route.ts` | OK* |
| `/api/mobile/v1/deals` | GET | — | tablica lub `{ deals\|items\|data... }` — mobile normalizuje | `Bearer` | `DealroomListScreen.tsx` | `src/app/api/mobile/v1/deals/route.ts` | OK |
| `/api/mobile/v1/deals/:id/messages` | GET | query cache-buster `t` | `{ messages: [...] }` (DealroomList enrichment) | `Bearer` | `DealroomListScreen.tsx`, `DealroomChatScreen.tsx` (GitHub) | `src/app/api/mobile/v1/deals/[id]/messages/route.ts` | OK* |
| `/api/mobile/v1/deals/:id/messages` | POST | `{ content }` | sukces + ewent. message | `Bearer` | `DealroomChatScreen.tsx` (GitHub) | ten sam | OK* |
| `/api/mobile/v1/deals/:id/typing` | POST | puste lub minimalne | `200` | `Bearer` | `DealroomChatScreen.tsx` (GitHub) | `src/app/api/mobile/v1/deals/[id]/typing/route.ts` | OK* |
| `/api/mobile/v1/deals/:id/actions` | POST | **BID:** `{ type:'BID_PROPOSE', amount, financing, message }` / `{ type:'BID_RESPOND', bidId, decision, counterAmount?, message }` | `{ success? }` / error JSON | `Bearer` | `BidActionModal.tsx` | `src/app/api/mobile/v1/deals/[id]/actions/route.ts` | OK* |
| `/api/mobile/v1/deals/:id/actions` | POST | **APPOINTMENT:** `{ type:'APPOINTMENT_PROPOSE', proposedDate, message }` / `{ type:'APPOINTMENT_RESPOND', appointmentId, decision:'ACCEPT'\|'COUNTER', counterDate?, message }` | jak wyżej | `Bearer` | `AppointmentActionModal.tsx` | ten sam | OK* (weryfikacja enum `decision` vs `DECLINE` w backendzie — **do potwierdzenia** przy czytaniu pełnej maszyny stanów) |
| `/api/mobile/v1/auth/sms/send` | POST | `{ userId }` | sukces | `none` + JSON | `SmsVerificationScreen.tsx` | `src/app/api/mobile/v1/auth/sms/send/route.ts` | OK |
| `/api/mobile/v1/auth/sms/verify` | POST | `{ userId, code }` | sukces | `none` + JSON | `SmsVerificationScreen.tsx` | `src/app/api/mobile/v1/auth/sms/verify/route.ts` | OK |
| `/api/mobile/v1/user/push-token` | POST | `{ email, token }` (Expo push) | brak ścisłego kontraktu w kodzie | **none** | `src/utils/pushNotifications.ts` | **BRAK pliku** | **MISSING** |
| `/api/notifications/device` | POST | `{ expoPushToken, platform, ... }` + Bearer | JSON sukcesu | `Bearer` | *nie wywoływane w skanowanym mobile* | `src/app/api/notifications/device/route.ts` | LEGACY / potential target for alias |
| `/api/passkey/register/start` | POST | `{ userId, email }` | `{ publicKey, ... }` | `Bearer` (register) | `passkeyService.ts` | `src/app/api/passkey/register/start/route.ts` | OK |
| `/api/passkey/register/finish` | POST | `{ userId, credential }` | `{ success }` | `none` + JSON | `passkeyService.ts` | `src/app/api/passkey/register/finish/route.ts` | DTO_MISMATCH* (finish bez Bearer — by design w serwisie) |
| `/api/passkey/login/start` | POST | puste lub minimalne | `{ publicKey, sessionId }` | `none` | `passkeyService.ts` | `src/app/api/passkey/login/start/route.ts` | OK |
| `/api/passkey/login/finish` | POST | assertion + `{ sessionId }` | `{ token, ... }` | `none` | `passkeyService.ts` | `src/app/api/passkey/login/finish/route.ts` | OK |
| `/api/passkey/revoke` (+ fallbacks) | POST | `{ userId }` | `{ success }` | `Bearer` | `passkeyService.ts` (próbuje `/revoke`, `/register/revoke`, `/delete`) | `src/app/api/passkey/revoke/route.ts` (+ inne) | **DUPLICATE** / DTO_MISMATCH* |
| `/api/passkeys/*` i `/api/mobile/v1/passkeys/*` | różne | WebAuthn standard | JSON options/verify | zwykle Bearer / session | *brak w skanowanym kodzie mobile* | wiele plików pod `src/app/api/passkeys/**`, `src/app/api/mobile/v1/passkeys/**` | **DUPLICATE** względem `/api/passkey/*` |
| `/api/mobile/v1/iap/pakiet-plus` | POST | iOS/Android purchase payload | `{ success|ok }` | `Bearer` | `src/services/iapPakietPlus.ts` | `src/app/api/mobile/v1/iap/pakiet-plus/route.ts` | OK* |
| `/api/stripe/checkout` | POST | `{ plan, returnUrl, cancelUrl, metadata?, offerId?, offerPayload? }` | `{ url }` dla `Linking` | `Bearer` | `listingQuota.ts` | `src/app/api/stripe/checkout/route.ts` | OK* |
| `/api/stripe/force-sync` | POST | *nie znaleziono w skanowanym mobile* | — | — | — | `src/app/api/stripe/force-sync/route.ts` | LEGACY (WWW / admin tooling) |
| `/api/mobile/v1/admin/users` | GET / DELETE | DELETE body `{ userId }` | listy / sukces | **brak Bearer w snippetach GitHub** | `ProfileScreen.tsx` (GitHub) | `src/app/api/mobile/v1/admin/users/route.ts` | **DTO_MISMATCH** (auth) |
| `/api/mobile/v1/admin/users/:userId` | GET | — | profil admin | **brak Bearer w snippetach** | `ProfileScreen.tsx` (GitHub) | `src/app/api/mobile/v1/admin/users/[userId]/route.ts` | **DTO_MISMATCH** (auth) |
| `/api/mobile/v1/admin/offers` | GET / POST | POST `{ offerId, newStatus }` | lista / update | **brak Bearer w snippetach** | `ProfileScreen.tsx` (GitHub) | `src/app/api/mobile/v1/admin/offers/route.ts` | **DTO_MISMATCH** (auth) |
| `/api/admin/settings` | GET / POST | POST `{ enable: boolean }` | settings blob | **brak auth w snippetach** | `ProfileScreen.tsx` (GitHub) | `src/app/api/admin/settings/route.ts` | **LEGACY + DTO_MISMATCH** (mobilny panel admina vs backend admin guard — krytyczne bezpieczeństwo) |
| `/api/users/:id/public` | GET | — | profil publiczny | *nie potwierdzono w lokalnym fragmencie* | *OfferDetail / Profile flows (GitHub tree)* | `src/app/api/users/[id]/public/route.ts` | OK* |

\*Wymaga pełnego odczytu handlera przy implementacji — tu: ocena wstępna na podstawie częściowego kodu.

---

## 2) Brakujące endpointy (względem mobile)

| Endpoint | Skutek |
|---------|--------|
| **`POST /api/mobile/v1/user/push-token`** | Mobile wysyła token Expo na produkcję — **brak route** w drzewie 137 handlerów → rejestracja push prawdopodobnie **nie działa** lub trafia w 404/rewrites. |

**Rekomendacja (plan, nie implementacja):** dodać kanoniczny handler zgodny z mobile **albo** dopisać cienką fasadę proxy do istniejącego `/api/notifications/device` po uzgodnieniu mapowania `{email,token}` → zapis urządzenia (uwaga na brak JWT w mobile — ryzyko abuse).

---

## 3) Zdublowane / rozproszone endpointy (backend-only noise dla mobile)

**Passkeys / WebAuthn — DUPLICATE (wysokie ryzyko regresji):**

- `/api/passkey/*` — **używane przez mobile** (`passkeyService.ts`).
- `/api/passkeys/*` — duplikat nazewnictwa (mnoga forma).
- `/api/mobile/v1/passkeys/*` — osobna przestrzeń „mobile v1”.

**Auth logowanie — DUPLICATE:**

- `/api/auth/login`, `/api/login`, `/api/mobile/v1/login`, `/api/mobile/v1/auth/login` — równoległe ścieżki (WWW vs mobile). Mobile canon: **`/api/mobile/v1/auth/login`** (store).

**Deale — DUPLICATE:**

- `/api/deals/*` (bogate drzewo) vs `/api/mobile/v1/deals/*` — mobile używa **wyłącznie** drugiej rodziny w skanowanych plikach.

---

## 4) Legacy (WWW / stare ścieżki) istotne dla reconciliacji

- **NextAuth** (`/api/auth/[...nextauth]`) + **cookie `estateos_session`** (`/api/register` ustawia cookie) — świat WWW; mobile opiera się na **JWT** z endpointów mobile/passkey.
- **`/api/offers/*`, `/api/user/profile`** — publiczne i sesyjne ścieżki WWW; mobile korzysta z **`/api/mobile/v1/offers`** dla właściciela.
- **CRM `/api/crm/*`, admin `/api/admin/*`** — raczej operator; mobile admin wywołania są pod **`/api/mobile/v1/admin/*`** ale z **problemami auth** (patrz tabela).

---

## 5) Prisma / schema vs oczekiwania mobile (sygnały)

Na podstawie wcześniejszej analizy modelu `Offer` / `User` w recovery:

- **Agent / biuro:** mobile (product) oczekuje pól typu **`companyName` dla AGENT**, ewent. **`agentCommissionPercent`** na ofercie — w schemacie `Offer` **brak** dedykowanego pola prowizji (wymaga migracji + serwisu, **osobny PR**).
- **Deale / eventy:** backend zapisuje zdarzenia dealroom m.in. jako treść wiadomości z prefiksem `[[DEAL_EVENT]]` — mobile ma lustrzany parser (`DealroomListScreen.tsx`) → **OK**, ale zmiana formatu po stronie WWW jest **breaking** dla appki.

---

## 6) Auth / sesja / JWT — macierz rozjazdów

| Mechanizm | Mobile | Backend recovery | Uwaga |
|-----------|--------|------------------|-------|
| Logowanie hasłem | `POST /api/mobile/v1/auth/login` → JWT w store | handler mobile JWT | Kanon mobile |
| Rejestracja | `POST /api/register` | tworzy user + **cookie sesji** | Mobile może **nie** używać cookie; zależnie od fetch RN |
| Passkey login | `/api/passkey/login/*` bez Bearer na finish | osobna implementacja | Nie zmieniać RP ID „z palca” |
| Push | `/api/mobile/v1/user/push-token` **bez** Bearer | `/api/notifications/device` **wymaga** Bearer | **MISSING + DTO_MISMATCH** |
| Admin mobile | wywołania bez Bearer w snippetach | endpointy admin zwykle JWT | **krytyczne** do weryfikacji (albo mobile bug, albo backend zbyt permisyjny) |

---

## 7) WWW vs mobile — UX / flow (wysoki poziom)

- **Stripe checkout:** mobile otwiera URL w przeglądarce (`Linking`) — flow hybrydowy; WWW ma pełny checkout w przeglądarce. Reconciliacja = **spójne plany** (`pakiet_plus`) i redirect URLs.
- **Passkey:** WWW może używać innego klienta (`@simplewebauthn/browser`) niż RN passkey — **nie scalać** implementacji bez testów E2E per platforma.
- **Listing limits:** logika slotów w `listingQuota.ts` odnosi się do pól user (`planType`, `plusExpiresAt`, `extraListings`) — backend musi **dokładnie** te pola ustawiać po IAP/Stripe (audyt osobno).

---

## 8) Plan reconciliacji (kontrolowany) — bez implementacji w tym dokumencie

Zasady: **mobile = canon**, **brak force-merge**, **brak masowych rewrite’ów**, zmiany **per domena** i małe PR-y.

### P0 — krytyczna zgodność aplikacji

1. **Push:** zaimplementować **`POST /api/mobile/v1/user/push-token`** zgodnie z mobile `{ email, token }` *lub* uzgodnić zmianę mobile — **preferowany pierwszy wariant** (canon mobile). Osobno: model bezpieczeństwa (email-only jest słaby).
2. **Passkeys:** wybrać **jedną** powierzchnię publiczną zgodną z `passkeyService.ts` (`/api/passkey/*`); pozostałe (`/api/passkeys/*`, `/api/mobile/v1/passkeys/*`) oznaczyć jako **DUPLICATE** → strategia: proxy deprecate lub dokumentacja „internal only”.
3. **Auth:** spiąć kanoniczne ścieżki logowania mobile (`/api/mobile/v1/auth/login`) z wydawaniem JWT; audyt **różnic claimów** vs `verifyMobileToken` / passkey finish token.
4. **`/api/mobile/v1/*`:** pełny przegląd pozostałych endpointów używanych w GitHub `main` (np. `user/me`, email change) — dopisać wiersze tabeli w kolejnej iteracji audytu.
5. **Oferty create/update:**  
   - dopisać walidację **Bearer ↔ userId** w `PUT /api/mobile/v1/offers` zgodnie z zachowaniem `POST`;  
   - rozstrzygnąć pola **prowizji agenta** vs Prisma.
6. **Rejestracja agenta:** mobile musi wysyłać `companyName` dla `role: AGENT`; backend `register` musi być zgodny (recovery mógł to częściowo mieć — **weryfikacja diff**).

### P1

- **Deals:** utrzymać `mobile/v1/deals/*` jako kanon; unikać mieszania z `/api/deals/*` w appce.  
- **CRM / notifications / discovery:** discovery istnieje na backendzie, **nie** wykryto w skanowanym kodzie mobile — albo feature wyłączony w tej wersji app, albo inny moduł poza skanem; **inventory follow-up**.

### P2

- **Admin / analytics / metrics** — dopiero po P0/P1; szczególnie **`/api/admin/settings` z mobile bez auth** w snippetach = **bloker bezpieczeństwa** do natychmiastowej weryfikacji na realnym buildzie.

---

## 9) Następne kroki analityczne (zalecane przed pierwszym PR)

1. Uruchomić lokalnie skrypt statyczny: **wylistować wszystkie literały URL** z pełnego `estateos-app` (nie tylko `/api/`) i zmergować z tabelą §1.
2. Dla każdego wiersza `DTO_MISMATCH`: otworzyć **konkretny** `route.ts` i porównać z **faktycznym** parserem w mobile (nie z dokumentacją).
3. Dodać test kontraktowy „smoke mobile”: zestaw `curl` z tokenem testowym vs staging.

---

## 10) Disclaimer

Ten dokument **nie** stanowi pełnego formalnego specyfikacji OpenAPI — jest **audytem integracyjnym** w punkcie czasowym analizy. Szczegóły `response DTO` w wierszach oznaczonych gwiazdką wymagają dalszego, **linia-po-linii** odczytu handlerów.

**Koniec audytu.**
