# Kontrakt API — oferta agenta (`agentCommissionPercent`)

## Cel pola

`agentCommissionPercent` — **ujęcie procentowe** prowizji agenta względem **ceny oferty** (wyświetlanie informacyjne na liście / szczegółach). Platforma **nie** pobiera tej kwoty.

## Nazwa w JSON

Kanonicznie: **`agentCommissionPercent`** (number).

Aliasy akceptowalne przy importach (opcjonalnie, jeśli już macie w mobile): `agentCommission`, `commissionPercent` — **rekomendacja**: normalizujcie do jednego pola w DB i API response.

## Model danych (Prisma / SQL)

Dodajcie kolumnę na `Offer`, np.:

- `agentCommissionPercent` — `Float` lub `Decimal(5,2)` nullable; `null` traktujcie jak **0** przy wyświetlaniu albo jak „nie podano” — **musicie być spójni z mobile** (patrz `src/lib/agentCommission.ts`).

## Walidacja (identyczna z mobile)

Źródło prawdy: **`src/lib/agentCommission.ts`**

- Dozwolone: **`0`** **albo** wartości od **`0.5`** do **`10`** włącznie.
- Krok: **`0.25`** (np. 0,5; 0,75; 1; … 10).
- Niedozwolone: wartości **> 0** i **< 0,5**; wartości **> 10**; wartości niebędące wielokrotnością kroku 0,25 (z tolerancją numeryczną po stronie serwera).

## Reguły biznesowe

1. **Tylko** właściciel oferty z `User.role === AGENT` może ustawiać / zmieniać prowizję (lub zawsze pole opcjonalne dla innych ról — wtedy walidacja tylko gdy pole obecne).
2. Publiczne `GET /api/offers`, `GET /api/offers/:id` — zwracajcie to pole **tylko** jeśli produkt ma je pokazywać (mobile już to robi); spójny shape z listą i detailem.
3. **POST/PATCH** tworzenia/edycji oferty: walidacja przed zapisem; przy błędzie zwróćcie kod z `BACKEND_AGENT_ERROR_CODES.md`.

## Spójność z ceną

Polityka cen (czy prowizja jest „w cenie” czy adnotacja obok) — **produkt / mobile**. Backend przechowuje **procent** i ewentualnie osobno cenę oferty; nie duplikujcie logiki wyświetlania, ale **nie zapisujcie** sprzecznych wartości między mobile a API.
