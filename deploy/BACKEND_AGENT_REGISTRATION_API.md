# Kontrakt API — rejestracja agenta

## Endpoint

`POST /api/register`

`Content-Type: application/json`

## Body (agent)

| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| `email` | string | tak | Unikalny e-mail (normalizacja lower-case). |
| `password` | string | tak | Hasło (hash po stronie serwera). |
| `name` | string | nie | Wyświetlana nazwa osoby (fallback wg obecnej logiki). |
| `phone` | string | nie | Zgodnie z obecną normalizacją PL. |
| `role` | string | tak dla ścieżki agenta | **Musi być dokładnie `"AGENT"`** dla nowych rejestracji agenta. |
| `companyName` | string | **tak**, gdy `role === "AGENT"` | Nazwa biura; trim; min. 1 znak po trim (konkretny min length ustalcie z UX, rekomendacja ≥ 2). |

## Zachowanie serwera

1. Jeśli `role === "AGENT"` i brak / pusty `companyName` → **400** + kod błędu (patrz `BACKEND_AGENT_ERROR_CODES.md`).
2. Zapis w DB: `User.role = AGENT` (enum Prisma `Role.AGENT`), **`User.companyName`** ustawione z body.
3. **Nie** ustawiać `role` ani pól pochodnych tak, jakby użytkownik był **PARTNER** programu — w bazie zostaje **`AGENT`**.
4. (Opcjonalnie, legacy) jeśli kiedyś mobile wysyłało `PARTNER` jako string roli — polityka migracji: albo **odrzucić** z komunikatem „użyj AGENT”, albo mapować wyłącznie do **`Role.AGENT`** bez tworzenia rekordów partnera; **nie** zapisujcie `PARTNER` jako osobnej roli w `Role`, jeśli enum jej nie ma.

## Odpowiedź sukcesu (propozycja — spójna z obecnym API)

```json
{
  "success": true,
  "token": "<session>",
  "role": "AGENT",
  "name": "…",
  "id": 123
}
```

## Uwaga implementacyjna (stan referencyjny repo)

W kodzie referencyjnym `register/route.ts` może jeszcze **nie zapisywać** `companyName` z body — należy to dodać przy wdrożeniu kontraktu.
