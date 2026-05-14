# Kontrakt API — edycja profilu agenta

## Odczyt

Istniejący endpoint (referencja): `GET /api/user/profile` — zwraca m.in. `role`, `companyName`, `badges`.

## Zapis / aktualizacja

**Jeśli macie już endpoint PATCH/PUT profilu** — rozszerzcie go o pola agenta:

| Pole | Typ | Warunek | Opis |
|------|-----|---------|------|
| `companyName` | string | gdy `user.role === AGENT` | Wymagane przy zapisie (nie puste po trim), jeśli polityka produktu wymaga stale widocznego biura. |
| `name`, `phone`, `nip` | wg obecnego modelu | opcjonalnie | Spójnie z `User` w Prisma. |

### Brak dedykowanego endpointu

W takim przypadku:

1. Dodajcie **`PATCH /api/user/profile`** (lub `/api/profile`) z autoryzacją sesji jak przy GET.
2. Zwracajcie zaktualizowany obiekt użytkownika (lub `{ success: true }` + echo pól).

### Reguły

- Tylko właściciel sesji może zmieniać własne dane.
- Dla `role !== AGENT` pole `companyName` może być ignorowane lub opcjonalne — ustalcie z produktem.
- Po zapisie **nie** ustawiajcie automatycznie flag „partner” na podstawie samego `AGENT`.

## Kody błędów

Patrz `BACKEND_AGENT_ERROR_CODES.md` (np. pusty `companyName` dla agenta).
