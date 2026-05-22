# Backend — EUR / PLN (oferty + kurs + wyświetlanie)

Mobile (`apple-style-app`) wdrożyło warstwę walut. Backend musi być **źródłem prawdy** dla `pricePln` i kursu.

---

## 1. Model oferty (MySQL / Prisma)

Dodać pola (lub ujednolicić istniejące):

| Pole | Typ | Opis |
|------|-----|------|
| `priceAmount` | Int/Decimal | Kwota wpisana przez sprzedającego |
| `priceCurrency` | Enum `PLN` \| `EUR` | Waluta oferty (legalna / widoczna na liście) |
| `pricePln` | Int | **Kanoniczna** kwota w PLN do sortowania, filtrów, statystyk |
| `exchangeRateUsed` | Decimal nullable | Kurs przy zapisie (np. 4.3123) |
| `exchangeRateDate` | Date nullable | Data kursu (NBP) |

**Kompatybilność:** pole `price` w API = `priceAmount` w walucie oferty (jak dotąd dla starych klientów).

### Przy `POST/PUT` oferty

1. Odczytać `priceAmount` (lub `price`), `priceCurrency` (domyślnie `PLN`).
2. Pobrać kurs EUR/PLN (NBP, tabela A) — cache 12–24h.
3. `pricePln = priceAmount` jeśli PLN, else `round(priceAmount * rate)`.
4. Zapisać wszystkie pola.

### Przy `GET` ofert (lista, detail, mobile)

Zwracać w JSON:

```json
{
  "price": 450000,
  "priceAmount": 450000,
  "priceCurrency": "EUR",
  "pricePln": 1940400,
  "exchangeRateUsed": 4.312,
  "exchangeRateDate": "2026-05-21"
}
```

Stare oferty bez waluty: migracja `priceCurrency = 'PLN'`, `pricePln = price`.

---

## 2. Kurs wymiany

`GET /api/fx/eur-pln` (publiczny lub z cache)

```json
{
  "success": true,
  "rate": 4.3123,
  "date": "2026-05-21",
  "source": "NBP"
}
```

**Harmonogram (backend):** job cron **codziennie o 08:00 Europe/Warsaw** — pobierz tabelę A NBP (`EUR`, pole `mid`), zapisz w cache/DB, ustaw `exchangeRateDate` na `effectiveDate`. Mobile unieważnia lokalny cache po tej samej granicy 08:00.

Przykład (node-cron, strefa `Europe/Warsaw`):

```ts
// 0 8 * * * — każdego dnia o 08:00
cron.schedule('0 8 * * *', refreshEurPlnFromNbp, { timezone: 'Europe/Warsaw' });
```

Mobile próbuje `/api/fx/eur-pln` i `/api/mobile/v1/fx/eur-pln`. Gdy backend niedostępny — bezpośrednio `api.nbp.pl`, potem fallback ~4.32.

---

## 3. Radar / filtry cenowe

Filtry `minPrice` / `maxPrice` w API radaru i wyszukiwarce — **zawsze w PLN** (`pricePln`).

Opcjonalnie: przyjąć `maxPrice` + `maxPriceCurrency` i przeliczyć na PLN po stronie serwera.

---

## 4. Negocjacje (dealroom) — faza 2

Na start: kwoty w czacie w **walucie oferty**. Mobile formatuje wg `offer.priceCurrency`.

Później: jawne `bidCurrency` w zdarzeniach deala.

---

## 5. Preferencja użytkownika (opcjonalnie na serwerze)

Mobile trzyma lokalnie `displayCurrency`: `PLN` | `EUR` | `LISTING`.

Opcjonalnie: `user.displayCurrency` w profilu + `PATCH /api/users/me`.

---

## Wiadomość do agenta backend (kopiuj-wklej)

> **EstateOS — waluty EUR/PLN**
>
> Mobile wysyła przy tworzeniu/edycji oferty:
> - `price` / `priceAmount` — kwota w walucie wpisanej przez usera
> - `priceCurrency`: `"PLN"` | `"EUR"`
> - `pricePln` — przeliczenie po stronie klienta (proszę **przeliczyć ponownie po stronie serwera** i traktować `pricePln` jako canonical do sort/filtrów)
>
> W każdym `GET` oferty zwracać: `price`, `priceAmount`, `priceCurrency`, `pricePln`, opcjonalnie `exchangeRateUsed`, `exchangeRateDate`.
>
> Dodać `GET /api/fx/eur-pln` (kurs NBP EUR/PLN, cache dzienny).
>
> Migracja: istniejące oferty → `priceCurrency='PLN'`, `pricePln=price`.
>
> Radar i filtry cenowe operują na `pricePln`, nie na surowym EUR.
>
> Test: oferta 100 000 EUR → w bazie `pricePln` ~ 431 200 przy kursie 4.312; Polak w apce widzi PLN (preferencja), obcokrajowiec EUR + linia „≈ … PLN”.

---

## Mobile — co już jest

| Miejsce | Zachowanie |
|---------|------------|
| Dodaj ofertę (krok Finanse) | Przełącznik PLN/EUR, podgląd przeliczenia |
| Podsumowanie / POST oferty | `priceCurrency`, `priceAmount`, `pricePln` |
| Szczegóły oferty | Cena wg preferencji + druga linia ≈ |
| Profil → Ceny w aplikacji | PLN / EUR / Waluta oferty |
| Kurs | `getEurPlnRate()` + cache AsyncStorage |

Kolejne iteracje: lista ofert na radarze, dealroom, edycja oferty (częściowo EditOffer — do dopracowania), admin karty ofert.
