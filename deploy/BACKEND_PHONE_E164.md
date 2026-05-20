# Kontrakt numerów telefonu (E.164)

Aplikacja mobilna zapisuje i oczekuje numerów w formacie **E.164** z prefiksem `+`, np. `+491701234567`.

## Wymagania API

| Endpoint | Pole | Zachowanie |
|----------|------|------------|
| `POST /api/register` | `phone`, `contactPhone` | Zapis w E.164; w odpowiedzi zwrócić `phone` (i `user.phone` jeśli jest obiekt user) |
| `POST /api/mobile/v1/auth` (`action: register`) | `phone` | Zapis w E.164 |
| `PATCH /api/mobile/v1/user/me` | `phone` | Zapis w E.164 |
| `POST /api/mobile/v1/auth/login`, `GET /api/mobile/v1/auth` | `user.phone`, `user.contactPhone` | Ten sam numer co w bazie (E.164) |
| `POST /api/auth/check-exists` | `phone` / `value` | Porównanie po znormalizowanym E.164 (+ warianty legacy PL) |
| SMS (`sendSMS`) | — | Wysyłka na cyfry z kodem kraju (bez wymuszania +48 dla każdego 9-cyfrowego) |

## Czego nie robić

- Nie obcinać numeru zagranicznego do 9 cyfr.
- Nie wymuszać `+48` dla wszystkich użytkowników.
- Nie zapisywać wyłącznie lokalnej części bez kodu kraju (np. `1701234567` zamiast `+491701234567`).

## Test regresji

1. Rejestracja z numerem DE: `+49 170 1234567` → w bazie `+491701234567`.
2. `GET /api/mobile/v1/auth` po logowaniu → `user.phone` = `+491701234567`, opcjonalnie `contactPhone` to samo.
3. `POST /api/auth/check-exists` z tym numerem → `exists: true` jeśli konto istnieje.
4. Profil w aplikacji: flaga 🇩🇪, numer `+49…`, nie „Brak numeru” / 🇵🇱.

## Implementacja backendu

Logika: `src/lib/phoneE164.ts` (`normalizePhoneE164`, `buildPhoneLookupVariants`, `normalizePhoneForSms`).
