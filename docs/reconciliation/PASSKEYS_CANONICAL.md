# Passkeys — kanoniczna powierzchnia API (mobile = source of truth)

## Kanon (aplikacja mobilna)

Aplikacja używa prefiksu:

- **`https://<host>/api/passkey`** (liczba pojedyncza)

Ścieżki wywoływane z klienta (RN `passkeyService`):

| Metoda | Ścieżka | Uwaga |
|--------|---------|--------|
| POST | `/api/passkey/register/start` | Bearer przy rejestracji klucza |
| POST | `/api/passkey/register/finish` | Body: `userId`, `credential` |
| POST | `/api/passkey/login/start` | Opcjonalnie body z `email` |
| POST | `/api/passkey/login/finish` | Body: assertion + `sessionId` |
| POST | `/api/passkey/revoke` (+ fallbacki w kliencie) | Bearer |

## Duplikaty po stronie backendu (nie zmieniać zachowania bez staging E2E)

Istnieją równoległe drzewa:

- `/api/passkeys/*` (mnoga forma)
- `/api/mobile/v1/passkeys/*`

**Polityka reconciliacji:** nie usuwać ani nie przekierowywać masowo do czasu:

1. Potwierdzenia, że **żaden** klient (WWW / narzędzia wewnętrzne) nie polega na mnogiej ścieżce.
2. Testów WebAuthn na staging (`RP ID`, `PASSKEY_ORIGIN`, `PASSKEY_RP_ID` w `.env`).

## Zmienne środowiska (prod)

- `PASSKEY_RP_ID` — wymagane w prod (`validateCriticalEnv`).
- `PASSKEY_ORIGIN` lub `NEXTAUTH_URL` — origin dla WebAuthn.

## Rollback

Cofnięcie zmian wyłącznie w handlerach passkey = `git revert` konkretnego commita; **nie** dotykać tabel `Authenticator` bez migracji danych.
