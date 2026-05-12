# Profil użytkownika — edycja danych (mobile) — kontrakt dla backendu

Aplikacja mobilna (`EstateOS`) wymaga **działającego zapisu profilu**, żeby użytkownik mógł poprawić literówki i kontakt. Obecnie zapis zwraca **404** — endpoint musi istnieć pod spodziewanym URL i metodą.

## 1. Zapis imienia, nazwiska, telefonu (wymagane do „100%”)

### Preferowana ścieżka

- **Metoda:** `PATCH`
- **URL:** `https://estateos.pl/api/mobile/v1/user/me`
- **Nagłówki:** jak przy innych mobile:
  - `Authorization: Bearer <JWT>`
  - `Content-Type: application/json`
  - (opcjonalnie, jak przy `DELETE /user/me`) `x-access-token` / `auth-token` z tym samym JWT — klient może je dodać.

### Body (JSON) — pola akceptowane przez klienta

Klient wysyła **co najmniej jedno** z poniższych (łączenie dozwolone):

| Pole | Opis |
|------|------|
| `firstName` | Imię |
| `lastName` | Nazwisko |
| `name` | Pełna nazwa (klient ustawia `firstName + " " + lastName`) |
| `phone` | E.164 lub string z `+48` i 9 cyframi |
| `contactPhone` | Duplikat wartości `phone` (niektóre modele DB używają tej nazwy) |

Przykład:

```json
{
  "name": "Jan Kowalski",
  "firstName": "Jan",
  "lastName": "Kowalski",
  "phone": "+48123456789",
  "contactPhone": "+48123456789"
}
```

### Odpowiedź

- **200** (lub **204**): sukces.
- Preferowane: body `{ "success": true, "user": { ... } }` — wtedy klient od razu zaktualizuje stan bez dodatkowego `GET`.
- Jeśli body nie zawiera `user`, klient zrobi `GET /api/mobile/v1/auth` (refresh profilu).

### Zapasowy URL (już próbowany w kliencie)

Jeśli `PATCH /user/me` zwraca **404** lub **405**:

- **PATCH** `https://estateos.pl/api/mobile/v1/user/profile` z tym samym body i nagłówkami.

---

## 2. Flaga „imię i nazwisko już nie do edycji” (opcjonalnie z serwera)

Aplikacja blokuje **drugą** zmianę imienia/nazwiska lokalnie (AsyncStorage). Żeby było spójnie między urządzeniami i po reinstall:

- Zwracaj w obiekcie użytkownika (np. `GET /api/mobile/v1/auth` / login):

`profileNameLocked: boolean` — `true` gdy użytkownik już wykorzystał jedną korektę tożsamości na serwerze.

Alternatywne nazwy akceptowane w normalizacji klienta: `identityNameLocked`.

---

## 3. Weryfikacja e-mail (wyraźne pole dla UI)

Aby aplikacja mogła **wyszarzyć** e-mail po potwierdzeniu, API powinno zwracać np.:

- `emailVerified: boolean` **lub**
- `isEmailVerified: boolean` **lub**
- `emailVerifiedAt: string | null` (niepuste = zweryfikowany)

**Nie** używaj tego samego pola `isVerified` do wszystkiego (telefon vs e-mail vs profil) — klient rozróżnia **telefon** (`phoneVerified` / `isVerifiedPhone`) od **e-mail**.

---

## 4. Zmiana adresu e-mail (tylko po weryfikacji nowego adresu)

Klient próbuje **kolejno** (pierwszy nie-404 wygrywa):

### Wysłanie kodu

1. `POST /api/mobile/v1/user/me/email-change/request`  
   Body: `{ "newEmail": "user@new.pl" }`

2. `POST /api/mobile/v1/user/me/email-change`  
   Body: `{ "action": "request", "newEmail": "user@new.pl" }`

3. `POST /api/mobile/v1/auth/change-email`  
   Body: `{ "email": "user@new.pl" }`

### Potwierdzenie kodu

1. `POST /api/mobile/v1/user/me/email-change/confirm`  
   Body: `{ "newEmail": "user@new.pl", "code": "123456" }`

2. `POST /api/mobile/v1/user/me/email-change`  
   Body: `{ "action": "confirm", "newEmail": "...", "code": "..." }`

3. `POST /api/mobile/v1/auth/change-email/verify`  
   Body: `{ "email": "...", "code": "..." }`

**200** + opcjonalnie `{ "user": { ... } }` — sukces; e-mail w `user.email` musi być już nowy.

---

## 4b. Weryfikacja **bieżącego** adresu e-mail (po rejestracji)

Po wciśnięciu „Dołącz” w rejestracji aplikacja od razu woła `sendCurrentEmailVerification`. Potrzebujemy endpointów (pierwszy nie-404 wygrywa):

**Krok 1 — wyślij kod na adres zalogowanego usera:**

1. `POST /api/mobile/v1/user/me/email-verify/send` — body puste (`{}`); auth `Authorization: Bearer <JWT>`.
2. `POST /api/mobile/v1/user/me/email-verify` — body `{ "action": "send" }`.
3. `POST /api/mobile/v1/auth/email/verify/send` — body `{ "email": "..." }`.
4. `POST /api/auth/email/verify/send` — body `{ "email": "..." }`.

**Krok 2 — potwierdź kod:**

1. `POST /api/mobile/v1/user/me/email-verify/confirm` — body `{ "code": "123456" }`.
2. `POST /api/mobile/v1/user/me/email-verify` — body `{ "action": "confirm", "code": "..." }`.
3. `POST /api/mobile/v1/auth/email/verify/confirm` — body `{ "code": "..." }`.
4. `POST /api/auth/email/verify/confirm` — body `{ "code": "...", "email": "..." }`.

**Odpowiedzi:**
- 200 `{ "success": true, "user": { ..., "emailVerified": true, "emailVerifiedAt": "..." } }` — apka od razu odświeży stan.
- 400/404/410/429 — apka pokaże `error` / `message` z body.

Wystarczy podpiąć jeden wariant z każdego kroku — pozostałe są fallbackiem. Można reużyć rdzenia z `emailChange.ts` (tylko bez wymogu nowego adresu — kod leci na `user.email`).

---

## 5. Telefon (weryfikacja SMS)

Aplikacja blokuje edycję pola telefonu wyłącznie, gdy w obiekcie `user` znajdzie **jawną** flagę weryfikacji SMS. Akceptujemy te pola (pierwsze niezerowe wygrywa):

- `phoneVerified: boolean` ← **preferowane**
- `isVerifiedPhone: boolean` (alias)
- `isPhoneVerified: boolean` (alias)
- `phoneVerifiedAt: string | null` (ISO; niepuste = zweryfikowany)
- `smsVerified: boolean` (alias)

Legacy fallback (działa do czasu wdrożenia powyższych):
- jeśli `isVerified === true` **i** brak jakiegokolwiek pola e-mailowego (`emailVerified`/`isEmailVerified`/`emailVerifiedAt`) **i** user ma `phone`, klient potraktuje `isVerified` jako weryfikację telefonu. To tylko siatka bezpieczeństwa — docelowo wystawcie `phoneVerified` osobno.

Zalecenie: po sukcesie SMS verify (`POST /api/mobile/v1/auth/sms/verify`) zwracajcie zaktualizowanego `user` z `phoneVerified: true` i `phoneVerifiedAt: <now>` — wtedy `GET /me` zachowuje ten stan między sesjami i nie polegamy na lokalnym cache w `AsyncStorage`.

---

## Checklist wdrożenia

1. [ ] `PATCH /api/mobile/v1/user/me` — 200, aktualizacja `name` / `phone` w DB  
2. [ ] `GET /api/mobile/v1/auth` zwraca spójnego `user` po zapisie  
3. [ ] (Opcjonalnie) `profileNameLocked`, `emailVerified` / `emailVerifiedAt`  
4. [ ] Endpointy zmiany e-mail (request + confirm) zgodne z jednym z wariantów powyżej  

Po spełnieniu punktu 1 znika błąd **„Serwer odrzucił zapis (404)”** z arkusza „Edytuj dane”.
