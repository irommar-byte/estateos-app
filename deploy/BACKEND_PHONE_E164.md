# Backend: numer telefonu w formacie E.164

Aplikacja mobilna (od buildu z poprawką kraju numeru) wymaga spójnego zapisu numeru telefonu na backendzie.

## Kontrakt

| Pole | Format | Przykład |
|------|--------|----------|
| `phone` / `contactPhone` przy rejestracji i PATCH profilu | **E.164** (zawsze z `+`) | `+491701234567` |
| Odpowiedź `GET /api/mobile/v1/auth`, `user/me` | Ten sam format | `+491701234567` |

**Nie** normalizować wszystkich numerów do 9 cyfr polskich ani usuwać prefiksu kraju.

## Endpointy

1. **`POST /api/register`** — pole `phone` (oraz opcjonalnie `contactPhone`) musi być zapisane jako E.164.
2. **`POST /api/mobile/v1/auth/login`** i **`GET /api/mobile/v1/auth`** — w obiekcie `user` **muszą zwracać** ten sam numer (`phone` lub `contactPhone`). Bez tego aplikacja po rejestracji pokazuje „Brak numeru” (apka ma obejście lokalne, ale docelowo API musi zwracać telefon).
3. **`PATCH /api/mobile/v1/user/me`** (lub `profile`) — `phone` / `contactPhone` w E.164.
4. **`POST /api/auth/check-exists`** — porównywanie numerów po znormalizowanym E.164 (libphonenumber lub equivalent).
5. **SMS verification** — wysyłka na ten sam E.164 zapisany w bazie.

## Błędne zachowanie (powoduje „Polska” w profilu mimo rejestracji z DE/UA)

- Zapis tylko 9 ostatnich cyfr: `501234567`
- Wymuszenie prefiksu `+48` niezależnie od kraju użytkownika
- Usunięcie `+` i kraju z odpowiedzi API

## Poprawne zachowanie

```json
// Rejestracja (Niemcy)
{ "phone": "+491701234567", ... }

// Odpowiedź profilu
{ "phone": "+491701234567", "contactPhone": "+491701234567" }
```

## Walidacja po stronie serwera

- Dozwolone kraje: zgodnie z listą w aplikacji (`ALLOWED_PHONE_COUNTRIES` w `src/utils/phoneRegions.ts`) lub szersza lista z odrzuceniem przy zapisie.
- Jedno konto = jeden unikalny numer (porównanie po E.164).

## Test regresji

1. Rejestracja z `+49…` → logowanie → profil pokazuje `+49 …` i flagę 🇩🇪 (nie 🇵🇱).
2. Rejestracja z `+380…` → flaga 🇺🇦.
3. Legacy użytkownik PL z `+48501234567` lub 9 cyfr krajowych — nadal działa.

## Legacy

Stare konta z samymi 9 cyframi bez prefiksu: aplikacja nadal interpretuje je jako **Polska** (kompatybilność wsteczna). Nowe rejestracje muszą mieć pełny E.164 z backendu.
