# Stabilne kody błędów dla auth / passkey / profil — kontrakt dla backendu

Cel: zlikwidować zależność klienta mobilnego od **tekstu** błędu z odpowiedzi serwera. Wprowadzamy stabilny **`error_code: string`** w odpowiedzi `4xx/5xx`, którego klient używa jako jedynego źródła prawdy. Pole `error` i `message` zostają dla wstecznej kompatybilności (PL fallback dla starszych klientów).

Wszystko, co potrzebne do wdrożenia, jest w tym pliku. **Nie potrzeba dodatkowych pytań.**

---

## 1. Wspólny kształt odpowiedzi błędu

Każda odpowiedź `≥400` z endpointów wymienionych w tym pliku musi mieć dokładnie taki shape:

```json
{
  "success": false,
  "error_code": "INVALID_CREDENTIALS",
  "message": "Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.",
  "error": "Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie."
}
```

Reguły:

- `success: false` — zawsze.
- `error_code: string` — **WIELKIE_LITERY_Z_UNDERSCORES** ASCII. Stabilne — istniejących nazw **nie renamujemy**, dodajemy tylko nowe.
- `message: string` — przyjazny komunikat **po polsku**, zgodnie z tabelami w sekcjach 3–11.
- `error: string` — duplikat `message` (PL). Klient mobilny czyta `message` jako pierwsze, `error` jako fallback. Stara strona www wciąż czyta `error`.
- HTTP status — dokładnie taki, jak podano w tabeli (klient mapuje też po statusie jako secondary signal).

Opcjonalne pola (rekomendowane, klient już je obsługuje):

- `retry_after_seconds: number` — dla `RATE_LIMITED` i `MAINTENANCE`.
- `fields: { [name]: string }` — dla `VALIDATION_ERROR`, np. `{ "email": "Niepoprawny format" }`.
- `support_ref: string` — krótki request id, np. `req_7Hx0qN` (do podawania w zgłoszeniach).

Sukces (`2xx`) — pozostaje **bez zmian** względem aktualnych kontraktów; ten dokument dotyczy wyłącznie błędów.

---

## 2. Helper referencyjny (TypeScript / Node)

Wstaw raz w warstwie wspólnej i używaj wszędzie:

```ts
// src/lib/errorResponse.ts
import type { NextResponse } from 'next/server';

export type AppErrorCode =
  | 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_LOCKED' | 'ACCOUNT_SUSPENDED' | 'RATE_LIMITED' | 'VALIDATION_ERROR'
  | 'EMAIL_ALREADY_EXISTS' | 'PHONE_ALREADY_EXISTS' | 'WEAK_PASSWORD'
  | 'INVALID_EMAIL' | 'INVALID_PHONE' | 'TERMS_NOT_ACCEPTED'
  | 'CODE_INVALID' | 'CODE_EXPIRED' | 'CODE_ALREADY_USED' | 'ALREADY_VERIFIED'
  | 'SMS_DELIVERY_FAILED' | 'EMAIL_DELIVERY_FAILED'
  | 'PASSKEY_NOT_REGISTERED' | 'PASSKEY_ALREADY_REGISTERED'
  | 'CREDENTIAL_NOT_FOUND' | 'ASSERTION_INVALID' | 'SIGNATURE_INVALID'
  | 'ATTESTATION_INVALID' | 'CHALLENGE_EXPIRED' | 'RP_ID_MISMATCH'
  | 'PASSWORD_REQUIRED' | 'PASSWORD_INVALID'
  | 'UNAUTHORIZED' | 'FORBIDDEN' | 'BAD_REQUEST' | 'NOT_FOUND'
  | 'CONFLICT' | 'SERVER_ERROR' | 'MAINTENANCE';

export function errorResponse(
  status: number,
  error_code: AppErrorCode,
  message: string,
  extra?: {
    retry_after_seconds?: number;
    fields?: Record<string, string>;
    support_ref?: string;
  },
) {
  return Response.json(
    {
      success: false,
      error_code,
      message,
      error: message,
      ...(extra || {}),
    },
    { status },
  );
}
```

Użycie w route handlerze (przykład):

```ts
if (!user) return errorResponse(404, 'USER_NOT_FOUND',
  'Nie znaleziono konta z tym adresem e-mail. Sprawdź pisownię lub załóż nowe konto.');

if (!passwordOk) return errorResponse(401, 'INVALID_CREDENTIALS',
  'Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.');
```

To jest cały „interfejs”, którego potrzebujesz, żeby się ze mną nie rozjechać.

---

## 3. Logowanie e-mail / hasło — `POST /api/mobile/v1/auth/login`

Body: `{ "email": string, "password": string }`

| HTTP | `error_code` | Kiedy | `message` (PL — wyślij dokładnie tak) |
|---|---|---|---|
| 401 | `INVALID_CREDENTIALS` | Hasło nie pasuje do istniejącego konta | Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie. |
| 404 | `USER_NOT_FOUND` | Nie ma konta z tym e-mailem | Nie znaleziono konta z tym adresem e-mail. Sprawdź pisownię lub załóż nowe konto. |
| 403 | `EMAIL_NOT_VERIFIED` | Konto istnieje, ale e-mail nie potwierdzony i polityka tego wymaga | Konto nie zostało jeszcze potwierdzone. Sprawdź skrzynkę i kliknij link weryfikacyjny. |
| 423 | `ACCOUNT_LOCKED` | Lockout po próbach bruteforce / antifraud | Konto jest tymczasowo zablokowane. Skontaktuj się z pomocą EstateOS™. |
| 423 | `ACCOUNT_SUSPENDED` | Decyzja administratora | Konto zostało zawieszone. Skontaktuj się z pomocą EstateOS™. |
| 429 | `RATE_LIMITED` | Za dużo prób (dorzuć `retry_after_seconds`) | Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie. |
| 422 | `VALIDATION_ERROR` | Brak `email` / `password` lub zły format | Sprawdź poprawność e-maila i hasła. |
| 500–599 | `SERVER_ERROR` | Wyjątek po stronie serwera | Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę. |

Pełna przykładowa odpowiedź `401`:

```json
{
  "success": false,
  "error_code": "INVALID_CREDENTIALS",
  "message": "Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.",
  "error": "Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie."
}
```

---

## 4. Rejestracja — `POST /api/register`

Body (z apki): `{ email, password, name, firstName, lastName, phone, role, acceptedTerms }`

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 409 | `EMAIL_ALREADY_EXISTS` | E-mail zajęty | Ten adres e-mail jest już zarejestrowany. Spróbuj się zalogować. |
| 409 | `PHONE_ALREADY_EXISTS` | Telefon zajęty | Ten numer telefonu jest już używany na innym koncie. |
| 422 | `INVALID_EMAIL` | Niepoprawny format | Niepoprawny format e-maila. |
| 422 | `INVALID_PHONE` | Niepoprawny format | Niepoprawny format numeru telefonu. |
| 422 | `WEAK_PASSWORD` | Hasło nie spełnia polityki | Hasło jest zbyt słabe. Użyj min. 8 znaków, dużych liter i cyfr. |
| 422 | `TERMS_NOT_ACCEPTED` | `acceptedTerms !== true` | Aby założyć konto, musisz zaakceptować regulamin. |
| 422 | `VALIDATION_ERROR` | Inne braki w body — dorzuć `fields` | Uzupełnij wymagane pola formularza. |
| 429 | `RATE_LIMITED` | — | Zbyt wiele prób. Spróbuj ponownie za chwilę. |
| 500–599 | `SERVER_ERROR` | — | Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę. |

---

## 5. Sprawdzanie dostępności — `POST /api/auth/check-exists`

Body: `{ "email"?: string, "phone"?: string }`. Sukces zwraca `{ exists: boolean }`. Błędy:

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 422 | `INVALID_EMAIL` | Niepoprawny e-mail w body | Niepoprawny format e-maila. |
| 422 | `INVALID_PHONE` | Niepoprawny telefon w body | Niepoprawny format numeru telefonu. |
| 422 | `VALIDATION_ERROR` | Brak obu pól | Podaj e-mail lub telefon do sprawdzenia. |
| 429 | `RATE_LIMITED` | — | Zbyt wiele zapytań. Spróbuj za chwilę. |
| 500–599 | `SERVER_ERROR` | — | Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę. |

---

## 6. SMS — weryfikacja telefonu

- Wysyłka kodu: `POST /api/mobile/v1/auth/sms/send` — body `{ phone: string }`.
- Potwierdzenie: `POST /api/mobile/v1/auth/sms/verify` — body `{ phone: string, code: string }`.

| HTTP | `error_code` | Endpoint | Kiedy | `message` (PL) |
|---|---|---|---|---|
| 422 | `INVALID_PHONE` | send | Zły format numeru | Niepoprawny format numeru telefonu. |
| 429 | `RATE_LIMITED` | send / verify | Za szybkie żądanie (dorzuć `retry_after_seconds`) | Poczekaj chwilę przed kolejną próbą. |
| 502 | `SMS_DELIVERY_FAILED` | send | Operator SMS odrzucił dostawę | Nie udało się wysłać SMS-a. Sprawdź numer i spróbuj ponownie. |
| 400 | `CODE_INVALID` | verify | Kod nie zgadza się | Wpisany kod jest nieprawidłowy. |
| 410 | `CODE_EXPIRED` | verify | Kod wygasł | Kod stracił ważność. Poproś o nowy. |
| 409 | `CODE_ALREADY_USED` | verify | Już skonsumowany | Ten kod został już użyty. Poproś o nowy. |
| 409 | `ALREADY_VERIFIED` | verify | Telefon już potwierdzony | Twój numer telefonu jest już potwierdzony. |
| 500–599 | `SERVER_ERROR` | obie | — | Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę. |

---

## 7. E-mail — weryfikacja bieżącego adresu (po rejestracji / z profilu)

- Wysyłka kodu: `POST /api/mobile/v1/user/me/email-verify/send` *(uwierzytelnione Bearer)*.
- Potwierdzenie: `POST /api/mobile/v1/user/me/email-verify/confirm` — body `{ code: string }`.

Aliasy akceptowane przez klienta (gdyby były wygodniejsze do implementacji):

- send: `/api/mobile/v1/user/me/email-verify { action: "send" }`, `/api/mobile/v1/auth/email/verify/send { email }`, `/api/auth/email/verify/send { email }`.
- confirm: `/api/mobile/v1/user/me/email-verify { action: "confirm", code }`, `/api/mobile/v1/auth/email/verify/confirm { code }`, `/api/auth/email/verify/confirm { code, email }`.

**Wystarczy zaimplementować jedną parę kanoniczną**. Klient próbuje wariantów w kolejności podanej w `useAuthStore.ts`.

| HTTP | `error_code` | Endpoint | Kiedy | `message` (PL) |
|---|---|---|---|---|
| 401 | `UNAUTHORIZED` | obie | Brak/zły JWT | Sesja wygasła. Zaloguj się ponownie. |
| 409 | `ALREADY_VERIFIED` | obie | E-mail już potwierdzony | Twój e-mail jest już potwierdzony. |
| 429 | `RATE_LIMITED` | send | Za szybko po poprzedniej wysyłce | Poczekaj chwilę przed kolejną próbą. |
| 502 | `EMAIL_DELIVERY_FAILED` | send | SMTP odmówił | Nie udało się wysłać wiadomości. Spróbuj ponownie. |
| 400 | `CODE_INVALID` | confirm | Zły kod | Wpisany kod jest nieprawidłowy. |
| 410 | `CODE_EXPIRED` | confirm | Kod wygasł | Kod stracił ważność. Poproś o nowy. |
| 409 | `CODE_ALREADY_USED` | confirm | Skonsumowany | Ten kod został już użyty. Poproś o nowy. |
| 500–599 | `SERVER_ERROR` | obie | — | Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę. |

Sukces `confirm` (2xx) — **zwracaj** zaktualizowany obiekt `user` z `emailVerified: true` (klient użyje go bez dodatkowego `GET /auth`).

---

## 8. E-mail — zmiana adresu

- Wysyłka kodu na **nowy** adres: `POST /api/mobile/v1/user/me/email-change/request` — body `{ newEmail: string }`.
- Potwierdzenie zmiany: `POST /api/mobile/v1/user/me/email-change/confirm` — body `{ newEmail: string, code: string }`.

Aliasy akceptowane (jak w sekcji 7): `/api/mobile/v1/user/me/email-change { action: "request|confirm", ... }`, `/api/mobile/v1/auth/change-email`, `/api/mobile/v1/auth/change-email/verify`.

| HTTP | `error_code` | Endpoint | Kiedy | `message` (PL) |
|---|---|---|---|---|
| 401 | `UNAUTHORIZED` | obie | Brak/zły JWT | Sesja wygasła. Zaloguj się ponownie. |
| 422 | `INVALID_EMAIL` | request | Niepoprawny format `newEmail` | Niepoprawny format nowego adresu e-mail. |
| 409 | `EMAIL_ALREADY_EXISTS` | request | `newEmail` zajęty | Ten adres e-mail jest już używany na innym koncie. |
| 409 | `ALREADY_VERIFIED` | request | `newEmail === currentEmail` | To jest Twój obecny adres e-mail. |
| 429 | `RATE_LIMITED` | request | — | Poczekaj chwilę przed kolejną próbą. |
| 502 | `EMAIL_DELIVERY_FAILED` | request | SMTP odmówił | Nie udało się wysłać wiadomości. Spróbuj ponownie. |
| 400 | `CODE_INVALID` | confirm | Zły kod | Wpisany kod jest nieprawidłowy. |
| 410 | `CODE_EXPIRED` | confirm | — | Kod stracił ważność. Poproś o nowy. |
| 409 | `CODE_ALREADY_USED` | confirm | — | Ten kod został już użyty. Poproś o nowy. |
| 500–599 | `SERVER_ERROR` | obie | — | Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę. |

Sukces `confirm` (2xx) — zwracaj zaktualizowany `user` z nowym `email` i `emailVerified: true`.

---

## 9. Profil — `PATCH /api/mobile/v1/user/me` (imię, nazwisko, telefon)

Klient też próbuje `PUT /api/mobile/v1/user/me` jako fallback.

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | Brak/zły JWT | Sesja wygasła. Zaloguj się ponownie. |
| 403 | `FORBIDDEN` | Próba zmiany cudzego profilu | Brak uprawnień do tej operacji. |
| 409 | `PHONE_ALREADY_EXISTS` | `phone` zajęty | Ten numer telefonu jest już używany na innym koncie. |
| 422 | `INVALID_PHONE` | Zły format numeru | Niepoprawny format numeru telefonu. |
| 422 | `VALIDATION_ERROR` | Inne braki — dorzuć `fields` | Sprawdź poprawność wpisanych danych. |
| 403 | `NAME_CHANGE_LOCKED` | Druga zmiana imienia/nazwiska zablokowana po stronie serwera | Imię i nazwisko można poprawić tylko raz. Skontaktuj się z pomocą, jeśli musisz to zmienić. |
| 500–599 | `SERVER_ERROR` | — | Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę. |

Sukces (2xx) — zwracaj zaktualizowanego `user` z `profileNameLocked` (jeśli wsparłeś tę flagę).

---

## 10. Konto — `DELETE /api/mobile/v1/user/me` (Bearer + hasło w body)

Body: `{ "password": string }` (potwierdzenie tożsamości).

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | Brak/zły JWT | Sesja wygasła. Zaloguj się ponownie. |
| 422 | `PASSWORD_REQUIRED` | Brak `password` w body | Aby usunąć konto, podaj swoje hasło. |
| 401 | `PASSWORD_INVALID` | Hasło nie pasuje | Hasło jest nieprawidłowe. Spróbuj ponownie. |
| 423 | `ACCOUNT_LOCKED` | Konto zablokowane (anty-fraud) | Konto jest tymczasowo zablokowane. Skontaktuj się z pomocą. |
| 500–599 | `SERVER_ERROR` | — | Nie udało się usunąć konta. Spróbuj ponownie za chwilę. |

Sukces (204 lub 200 z `{ success: true }`).

---

## 11. Passkey

### 11a. `POST /api/passkey/login/start` *(i alias `/api/mobile/v1/passkeys/auth-options`)*

Sukces: `{ publicKey: PublicKeyCredentialRequestOptions, sessionId: string }`.

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 404 | `PASSKEY_NOT_REGISTERED` | Brak zapisanego klucza dla użytkownika / urządzenia | Na tym koncie nie ma zarejestrowanego klucza Passkey. Zaloguj się e-mailem i hasłem, a następnie włącz Passkey w profilu. |
| 400 | `RP_ID_MISMATCH` | `rpId` nie zgadza się z domeną (np. dev → prod) | Wykryto niezgodność domeny Passkey. Skontaktuj się z pomocą EstateOS™. |
| 429 | `RATE_LIMITED` | — | Zbyt wiele prób. Spróbuj ponownie za chwilę. |
| 500–599 | `SERVER_ERROR` | — | Logowanie Passkey jest tymczasowo niedostępne. Spróbuj e-mailem i hasłem. |

### 11b. `POST /api/passkey/login/finish` *(i alias `/api/mobile/v1/passkeys/auth-verify`)*

Body: zwrotka WebAuthn + `sessionId`. Sukces: `{ token, user }`.

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 400 | `ASSERTION_INVALID` | Zła struktura asercji | Logowanie Passkey nie powiodło się. Spróbuj ponownie. |
| 400 | `SIGNATURE_INVALID` | Podpis nie pasuje do `publicKey` | Logowanie Passkey nie powiodło się. Spróbuj ponownie. |
| 404 | `CREDENTIAL_NOT_FOUND` | `credentialId` z asercji nie istnieje w DB | Klucz Passkey nie został rozpoznany. Zaloguj się e-mailem i hasłem i dodaj klucz ponownie w profilu. |
| 410 | `CHALLENGE_EXPIRED` | Wygasł `sessionId`/`challenge` | Sesja Passkey wygasła. Spróbuj jeszcze raz. |
| 404 | `USER_NOT_FOUND` | Konto pod kluczem usunięte | Konto powiązane z tym kluczem już nie istnieje. |
| 423 | `ACCOUNT_LOCKED` | Lockout | Konto jest tymczasowo zablokowane. Skontaktuj się z pomocą EstateOS™. |
| 429 | `RATE_LIMITED` | — | Zbyt wiele prób. Spróbuj ponownie za chwilę. |
| 500–599 | `SERVER_ERROR` | — | Logowanie Passkey jest tymczasowo niedostępne. Spróbuj e-mailem i hasłem. |

### 11c. `POST /api/passkey/register/start` *(alias `/api/mobile/v1/passkeys/register-options`)* — **Bearer required**

Body: `{ userId: string, email: string }`. Sukces: `{ publicKey: PublicKeyCredentialCreationOptions }`.

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | Brak/zły JWT | Sesja wygasła. Zaloguj się ponownie. |
| 409 | `PASSKEY_ALREADY_REGISTERED` | Klucz dla tego konta już istnieje | Na tym koncie jest już zarejestrowany klucz Passkey. |
| 400 | `RP_ID_MISMATCH` | — | Wykryto niezgodność domeny Passkey. Skontaktuj się z pomocą EstateOS™. |
| 429 | `RATE_LIMITED` | — | Zbyt wiele prób. Spróbuj ponownie za chwilę. |
| 500–599 | `SERVER_ERROR` | — | Nie udało się dodać klucza. Spróbuj ponownie za chwilę. |

### 11d. `POST /api/passkey/register/finish` *(alias `/api/mobile/v1/passkeys/register-verify`)*

Body: `{ userId: string, credential: PublicKeyCredential }`. Sukces: `{ success: true }`.

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 400 | `ATTESTATION_INVALID` | Atestacja WebAuthn nie przeszła | Nie udało się zweryfikować klucza Passkey. Spróbuj ponownie. |
| 410 | `CHALLENGE_EXPIRED` | Wygasł `challenge` z `register/start` | Sesja Passkey wygasła. Spróbuj jeszcze raz. |
| 409 | `PASSKEY_ALREADY_REGISTERED` | — | Na tym koncie jest już zarejestrowany klucz Passkey. |
| 500–599 | `SERVER_ERROR` | — | Nie udało się dodać klucza. Spróbuj ponownie za chwilę. |

### 11e. `POST /api/passkey/revoke` *(aliasy: `/api/passkey/register/revoke`, `/api/passkey/delete`)*

Body: `{ userId: string }`. Sukces: `{ success: true }`.

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | — | Sesja wygasła. Zaloguj się ponownie. |
| 404 | `PASSKEY_NOT_REGISTERED` | Nie ma czego usunąć | Na tym koncie nie ma zarejestrowanego klucza Passkey. |
| 500–599 | `SERVER_ERROR` | — | Nie udało się usunąć klucza. Spróbuj ponownie za chwilę. |

---

## 12. Cross-cutting (wszystkie inne endpointy)

| HTTP | `error_code` | Kiedy | `message` (PL) |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | Brak/zły/wygasły JWT | Sesja wygasła. Zaloguj się ponownie. |
| 403 | `FORBIDDEN` | Token OK, brak uprawnień | Brak uprawnień do tej operacji. |
| 400 | `BAD_REQUEST` | Złe body / brak pól; dorzuć `details` | Nieprawidłowe żądanie. |
| 422 | `VALIDATION_ERROR` | Walidacja pól (`fields: {...}`) | Sprawdź poprawność wpisanych danych. |
| 409 | `CONFLICT` | Konflikt stanu | Operacja jest sprzeczna z aktualnym stanem konta. |
| 404 | `NOT_FOUND` | Brak zasobu | Nie znaleziono zasobu. |
| 429 | `RATE_LIMITED` | + `retry_after_seconds` | Zbyt wiele zapytań. Spróbuj za chwilę. |
| 500–599 | `SERVER_ERROR` | Wyjątek | Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę. |
| 503 | `MAINTENANCE` | Planowana przerwa | Trwa przerwa techniczna. Spróbuj ponownie później. |

---

## 13. Minimalny zestaw na start (priorytet wdrożenia)

Jeśli wdrażacie etapami — proszę o **te kody w kolejności**:

**ETAP 1 (login + passkey + profil — pokrywa ~95% UX-u)**

| Endpoint | HTTP | `error_code` | `message` (PL) |
|---|---|---|---|
| `POST /api/mobile/v1/auth/login` | 401 | `INVALID_CREDENTIALS` | Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie. |
| `POST /api/mobile/v1/auth/login` | 404 | `USER_NOT_FOUND` | Nie znaleziono konta z tym adresem e-mail. Sprawdź pisownię lub załóż nowe konto. |
| `POST /api/mobile/v1/auth/login` | 403 | `EMAIL_NOT_VERIFIED` | Konto nie zostało jeszcze potwierdzone. Sprawdź skrzynkę i kliknij link weryfikacyjny. |
| `POST /api/mobile/v1/auth/login` | 423 | `ACCOUNT_LOCKED` | Konto jest tymczasowo zablokowane. Skontaktuj się z pomocą EstateOS™. |
| `POST /api/mobile/v1/auth/login` | 429 | `RATE_LIMITED` | Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie. |
| `POST /api/mobile/v1/auth/login` | 500 | `SERVER_ERROR` | Chwilowy problem po stronie serwera. Spróbuj ponownie za chwilę. |
| `POST /api/passkey/login/start` | 404 | `PASSKEY_NOT_REGISTERED` | Na tym koncie nie ma zarejestrowanego klucza Passkey. Zaloguj się e-mailem i hasłem, a następnie włącz Passkey w profilu. |
| `POST /api/passkey/login/start` | 400 | `RP_ID_MISMATCH` | Wykryto niezgodność domeny Passkey. Skontaktuj się z pomocą EstateOS™. |
| `POST /api/passkey/login/finish` | 404 | `CREDENTIAL_NOT_FOUND` | Klucz Passkey nie został rozpoznany. Zaloguj się e-mailem i hasłem i dodaj klucz ponownie w profilu. |
| `POST /api/passkey/login/finish` | 410 | `CHALLENGE_EXPIRED` | Sesja Passkey wygasła. Spróbuj jeszcze raz. |
| `POST /api/passkey/register/start` | 409 | `PASSKEY_ALREADY_REGISTERED` | Na tym koncie jest już zarejestrowany klucz Passkey. |
| `POST /api/mobile/v1/user/me/email-verify/confirm` | 400 | `CODE_INVALID` | Wpisany kod jest nieprawidłowy. |
| `POST /api/mobile/v1/user/me/email-verify/confirm` | 410 | `CODE_EXPIRED` | Kod stracił ważność. Poproś o nowy. |
| `POST /api/mobile/v1/user/me/email-verify/confirm` | 409 | `ALREADY_VERIFIED` | Twój e-mail jest już potwierdzony. |
| `DELETE /api/mobile/v1/user/me` | 401 | `PASSWORD_INVALID` | Hasło jest nieprawidłowe. Spróbuj ponownie. |
| `DELETE /api/mobile/v1/user/me` | 422 | `PASSWORD_REQUIRED` | Aby usunąć konto, podaj swoje hasło. |

**ETAP 2** — reszta z sekcji 3–11 wg potrzeb.

---

## 14. Smoke testy (curl) — gotowe do uruchomienia po wdrożeniu

```bash
# 1) Złe hasło
curl -s -X POST https://estateos.pl/api/mobile/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@estateos.pl","password":"WRONG"}' | jq
# oczekuj: HTTP 401, error_code = INVALID_CREDENTIALS

# 2) Nieistniejący user
curl -s -X POST https://estateos.pl/api/mobile/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nope-xyz@estateos.pl","password":"WhateverPass1"}' | jq
# oczekuj: HTTP 404, error_code = USER_NOT_FOUND

# 3) Rate limit (5x z rzędu)
for i in {1..6}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    https://estateos.pl/api/mobile/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"smoke@estateos.pl","password":"WRONG"}';
done
# oczekuj: kilka 401, potem 429 z error_code=RATE_LIMITED, retry_after_seconds w body.

# 4) Passkey login bez kontaIa
curl -s -X POST https://estateos.pl/api/passkey/login/start \
  -H 'Content-Type: application/json' \
  -d '{}' | jq
# oczekuj: HTTP 404, error_code = PASSKEY_NOT_REGISTERED (jeżeli baza pusta dla tego klienta).

# 5) E-mail verify z niepoprawnym kodem (po wcześniejszym uwierzytelnieniu)
curl -s -X POST https://estateos.pl/api/mobile/v1/user/me/email-verify/confirm \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <JWT>' \
  -d '{"code":"000000"}' | jq
# oczekuj: HTTP 400, error_code = CODE_INVALID
```

---

## 15. Wsteczna kompatybilność i kontrakt zmian

- `error` (PL) — **zostaje** w odpowiedzi. Klient mobilny przez kilka wersji będzie czytał `message` jako primary, `error` jako fallback. Strona www nadal działa po staremu.
- Lista `error_code` — **otwarta na rozszerzenie**, **zamknięta na rename**.
- Klient traktuje nieznany `error_code` jako `SERVER_ERROR` (pokaże komunikat generyczny).
- Klient mapuje też po HTTP statusie (`401 → UNAUTHORIZED`, `429 → RATE_LIMITED`, …) gdy `error_code` brakuje.

---

## 16. Jak klient mobilny to konsumuje (info dla agenta backend — żeby wiedzieć, co działa po deployu)

Po deployu kod aplikacji w `src/store/useAuthStore.ts` (`login`) i `src/services/passkeyService.ts` zostanie zaktualizowany na:

```ts
// pseudo
const code = String(data?.error_code || '').toUpperCase();
const messagePL = String(data?.message || data?.error || '').trim();
const friendly = MAP[code] || messagePL || GENERIC_FALLBACK;
```

Dlatego **`message` musi być PL** w każdej odpowiedzi błędu — nawet jeśli klient mobilny zna `error_code`, używamy `message` jako kontroli i jako string dla wersji bez mapowania.

---

## 17. Plan po stronie agenta backend (kopiuj jako zadania)

1. Dodać `src/lib/errorResponse.ts` z helperem z sekcji 2.
2. Zaktualizować `src/app/api/mobile/v1/auth/login/route.ts` zgodnie z sekcją 3.
3. Zaktualizować `src/app/api/register/route.ts` zgodnie z sekcją 4.
4. Zaktualizować `src/app/api/auth/check-exists/route.ts` zgodnie z sekcją 5.
5. Zaktualizować SMS verify (`.../sms/send|verify`) wg sekcji 6.
6. Zaktualizować e-mail verify (`.../email-verify/send|confirm`) wg sekcji 7.
7. Zaktualizować e-mail change (`.../email-change/request|confirm`) wg sekcji 8.
8. Zaktualizować profile patch (`PATCH /user/me`) wg sekcji 9.
9. Zaktualizować account delete (`DELETE /user/me`) wg sekcji 10.
10. Zaktualizować passkey endpointy (start/finish/register/revoke) wg sekcji 11.
11. Uruchomić smoke testy z sekcji 14 i wkleić do PR-a wyniki (status + JSON).
12. Wrzucić logi z `support_ref` i `error_code` do agregatora (Datadog/Sentry).

Po pkt 11 daj znać — podepnę dokładne mapowanie kodów po stronie klienta, schowam regex-y i zamkniemy temat.

---

Pytań nie potrzebuję — wszystko jest tu. Jeśli któryś endpoint w sekcjach 3–11 nie istnieje jeszcze po stronie backendu, to znaczy, że apka go i tak nie wywoła; pomiń go i wróć po wdrożeniu właściwych funkcji.
