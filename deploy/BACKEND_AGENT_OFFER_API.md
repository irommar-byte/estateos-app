# BACKEND BRIEF — Prowizja agenta na ofercie (EstateOS™)

> **Status**: gotowy do implementacji  
> **Owner mobile**: rejestracja AGENT (już wdrożona, patrz `BACKEND_AGENT_REGISTRATION_API.md`)  
> **Kanał**: `/api/mobile/v1/offers` (POST / GET / LIST) + `/api/offers` (WWW)  
> **Cel**: agent może przy każdej swojej ofercie zadeklarować procent prowizji.
> Cena oferty **NIE** jest modyfikowana — kwota prowizji jest informacyjna,
> wyświetlana kupującemu w `OfferDetail` oraz oznacza ofertę pomarańczową
> pinezką na radarze.

---

## 1. Reguła biznesowa (uzgodnione 2026-05-11, AKTUALIZACJA 2026-05-12)

1. Agent (`user.role === 'AGENT'`) podczas dodawania oferty może opcjonalnie
   wpisać **procent prowizji**. Dopuszczalne wartości:
   - `null` / brak pola — agent nie ujawnia prowizji (nic się nie wyświetla),
   - **`0`** — **NOWE**: tryb „Bez prowizji" (zielona adnotacja, kupujący nic
     dodatkowo nie płaci, agent rezygnuje świadomie),
   - `[0.5, 10]` — standardowa prowizja, snap do 0.25%.
2. **Cena ofertowa pozostaje BEZ ZMIAN** w każdym z 3 przypadków. Nic nie jest
   doliczane do `price`.
3. **PROWIZJA JEST BRUTTO** — kwota wyliczona z `agentCommissionPercent × price`
   zawiera już VAT i wszelkie podatki. **Kupujący NIE dopłaca żadnego
   podatku ani opłat dodatkowych** ponad tę kwotę. Backend NIE ma osobnego
   pola `agentCommissionTax` ani `agentCommissionNet` — w polu trzymamy
   wartość, którą fizycznie zapłaci kupujący agentowi po transakcji
   (umowa pośrednictwa). Komunikat „Kwota jest BRUTTO (zawiera VAT) —
   kupujący nie dopłaca podatku" pojawia się w UI mobile (Step4_Finance,
   Step6_Summary, EditOfferScreen oraz pigułka kupującego w OfferDetail).
4. Kupujący widzi:
   - tę samą cenę co u prywatnych,
   - dla `percent > 0`: pomarańczową pigułkę „Prowizja agenta X% (≈ Y PLN) — płatne
     agentowi bezpośrednio po finalizacji transakcji. Kwota brutto, bez
     dodatkowych podatków",
   - dla `percent === 0`: **zieloną** pigułkę „Oferta bez prowizji — kupujący
     nie płaci prowizji na tym ogłoszeniu",
   - pomarańczową pinezkę na radarze (`#FF9F0A`) — **niezależnie** od tego czy
     percent === 0 czy > 0 (kontakt nadal idzie przez biuro).
5. Prowizja jest **rozliczana POZA PLATFORMĄ** — backend EstateOS™ nie pośredniczy
   w przelewie prowizji.
6. Osoby prywatne (`role !== 'AGENT'`) nie mogą wysłać `agentCommissionPercent`
   (backend ignoruje pole / zwraca błąd zależnie od wyboru, patrz §3).

---

## 2. Zmiana w schemacie DB

```prisma
model Offer {
  // ... istniejące pola ...
  /// Prowizja pośrednika (procent ceny ofertowej, 0.5–10).
  /// NULL dla ofert prywatnych. Cena oferty nie jest modyfikowana —
  /// to tylko informacja dla kupującego.
  agentCommissionPercent  Float?
}
```

Migracja:

```sql
ALTER TABLE Offer
  ADD COLUMN agentCommissionPercent DOUBLE PRECISION NULL;
```

Brak indeksów (kolumna informacyjna, używana tylko przy GET oferty).

---

## 3. Endpointy

### 3.1 `POST /api/mobile/v1/offers`  (oraz `POST /api/offers` dla WWW)

**Nowy field w body**:

```jsonc
{
  // ...wszystkie dotychczasowe pola...
  "agentCommissionPercent": 2.5   // Float | null
}
```

**Walidacja**:

| Warunek                                                                 | Wynik                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `user.role !== 'AGENT'` i pole jest niepuste                            | **Zignorować** i zapisać `null` (defensywnie). Nie zwracać błędu — UI po prostu nie pokazuje pola dla nie-agentów. |
| `user.role === 'AGENT'` i pole jest `null` / pominięte                  | OK — zapisać `null` (agent nie ujawnia prowizji)                                       |
| `user.role === 'AGENT'` i `percent === 0`                               | **OK — zapisać `0`** (tryb „Bez prowizji", zielona pigułka u kupującego)               |
| `user.role === 'AGENT'` i `0.5 ≤ percent ≤ 10`                          | OK — zapisać `Math.round(percent * 4) / 4` (snap do 0.25)                              |
| `user.role === 'AGENT'` i `0 < percent < 0.5` (np. `0.3`)               | `400 { error_code: 'AGENT_COMMISSION_OUT_OF_RANGE' }` — pomiędzy 0 a 0.5 to literówka |
| `user.role === 'AGENT'` i percent > 10 lub nie-liczba                   | `400 { error_code: 'AGENT_COMMISSION_OUT_OF_RANGE' }`                                  |

**Response**: pełny obiekt oferty (dotychczasowy `shapeOffer`) + nowe pole
`agentCommissionPercent`.

### 3.2 `GET /api/mobile/v1/offers` (lista) + `GET /api/mobile/v1/offers/:id`

Każda zwracana oferta MUSI zawierać:

```jsonc
{
  // ...dotychczasowe pola...
  "agentCommissionPercent": 2.5,        // Float | null
  // Owner shape (dla pinezki + label "kto wystawił"):
  "ownerRole": "AGENT",                 // 'USER' | 'AGENT' | 'ADMIN'
  "companyName": "Nieruchomości WAW",   // string | null (z `user.companyName`)
}
```

> **WAŻNE**: mobile używa kanonicznej detekcji agenta przez OR po polach:
> `role`, `userRole`, `ownerRole`, `user.role`, `owner.role`, `user.planType`,
> `owner.planType`. Wystarczy że JEDNO z nich zawiera `AGENT` lub `AGENCY`.
> Najpewniej zwrócić **wszystkie 3**: `ownerRole`, `companyName`, oraz wewnątrz
> `user` / `owner`. Dzięki temu pomarańczowa pinezka i pigułka prowizji
> zaświecą się od razu, bez dodatkowych zmian po stronie mobile.

### 3.3 `PATCH /api/mobile/v1/offers/:id` (edycja)

Te same reguły walidacji co w POST. Agent może aktualizować prowizję; osoba
prywatna nie może wstawić tego pola.

---

## 4. Stabilne kody błędów

Dodaj do istniejącej puli kodów:

| `error_code`                       | HTTP | Sytuacja                                            |
| ---------------------------------- | ---- | --------------------------------------------------- |
| `AGENT_COMMISSION_OUT_OF_RANGE`    | 400  | percent poza 0.5–10 lub nie-liczba                  |
| `AGENT_COMMISSION_NOT_ALLOWED`*    | 403  | (OPCJA, jeśli nie wybieracie wariantu „ignoruj") — gdy nie-agent próbuje ustawić pole |

`*` — frontend domyślnie zakłada wariant „ignore". Wybierz jeden i trzymaj się go w `OFFER_ERROR_CODES.md`.

---

## 5. Testy do przejścia

1. **AGENT tworzy ofertę z `agentCommissionPercent: 2.5`** → 201, pole zapisane jako `2.5`.
2. **AGENT tworzy ofertę bez pola** → 201, pole = `null`.
3. **AGENT tworzy ofertę z `agentCommissionPercent: 12`** → 400 `AGENT_COMMISSION_OUT_OF_RANGE`.
4. **AGENT tworzy ofertę z `agentCommissionPercent: 0.1`** → 400 `AGENT_COMMISSION_OUT_OF_RANGE`.
5. **AGENT tworzy ofertę z `agentCommissionPercent: 2.51`** → 201, w bazie `2.5` (snap do 0.25).
6. **USER (prywatny) tworzy ofertę z `agentCommissionPercent: 3`** → 201, w bazie `null` (defensywnie zignorowane).
7. **NOWE: AGENT tworzy ofertę z `agentCommissionPercent: 0`** → 201, pole zapisane jako `0` (tryb „Bez prowizji").
8. **NOWE: AGENT tworzy ofertę z `agentCommissionPercent: 0.3`** → 400 `AGENT_COMMISSION_OUT_OF_RANGE` (między 0 a 0.5 to nielegalne).
9. **GET listy ofert** → każda zwraca `agentCommissionPercent` (nullable, dopuszczalne `0`), `ownerRole`, `companyName`.
10. **GET szczegółów oferty agenta** → `ownerRole === 'AGENT'`, `companyName` niepuste, `agentCommissionPercent` może być `null` / `0` / liczba.
11. **PATCH oferty agenta z `1.5`** → można zmienić w obrębie 0 lub 0.5–10.
12. **NOWE: PATCH oferty agenta z `0`** → wyzerowanie do trybu „Bez prowizji" (NIE myl z `null`).
13. **PATCH oferty agenta z `null`** → wyczyszczenie pola (agent przestaje ujawniać prowizję, pigułka znika u kupującego).

---

## 6. Co MAMY już wdrożone po stronie mobile (FYI dla backendu)

- Helper `src/lib/agentCommission.ts` — parser, walidacja, formatery, detekcja.
- `Step4_Finance` (kreator ofert) — karta „Prowizja Agenta" widoczna **tylko**
  gdy `user.role === 'AGENT'`. Input + stepper +/- 0.25%, auto-kalkulacja kwoty PLN.
- `Step6_Summary` — karta podsumowania z procentem i kwotą + payload POST zawiera
  `agentCommissionPercent: number | null`.
- `OfferDetail` — pod ceną w bottom barze pigułka „Prowizja agenta X% ≈ Y PLN"
  + opis „płatne agentowi bezpośrednio po finalizacji transakcji".
- `RadarHomeScreen` — `isPartnerOffer` rozszerzony o `role === 'AGENT'` →
  oferty agenta zawsze pomarańczową pinezką (`#FF9F0A`).
- Pole `User.companyName` (string | null) zostało już zwrócone przez backend
  rejestracji — mobile wyświetla je w karcie prowizji w podsumowaniu.

---

## 7. Czego NIE zmieniamy

- Cena oferty (`price`) — pozostaje bez zmian.
- Sposób rozliczeń prowizji — POZA platformą, brak Stripe / IAP / przelewów.
- Rola enum — bez nowych wartości.
- Brak NIP/REGON ani pola „rachunek bankowy agenta" — to nie należy do MVP.

---

## 8. Pytania kontrolne

1. Czy `Offer.agentCommissionPercent` jest już w schemacie? (jeśli nie — migracja z §2)
2. Czy `shapeOffer` (mobile + WWW) zwraca `companyName` oraz `ownerRole` w obu listach
   (lista + szczegóły)?
3. Czy chcecie wariant „ignore" czy „403" dla nie-agentów wysyłających pole?
   (mobile domyślnie zakłada `ignore` — patrz §3.1).
4. Czy `PATCH` jest już dostępny dla edycji ofert? Jeśli tak — proszę spiąć tę
   walidację razem z `POST`.

Po wdrożeniu zrobimy E2E z mobile: rejestracja agent → wystawienie oferty z prowizją
→ widoczność u kupującego (pin + pigułka pod ceną).
