# Waluty EUR/PLN — oferty EstateOS

## Mobile → backend (create/update)

```json
{
  "price": 100000,
  "priceAmount": 100000,
  "priceCurrency": "EUR",
  "pricePln": 431200
}
```

- **`price` / `priceAmount`** — kwota w walucie wpisanej przez użytkownika.
- **`priceCurrency`** — `"PLN"` | `"EUR"`.
- **`pricePln` z klienta** — ignorowane przy zapisie; serwer liczy ponownie (NBP).

## GET oferty (wszystkie kanały)

Każda odpowiedź z ofertą zawiera:

```json
{
  "price": 100000,
  "priceAmount": 100000,
  "priceCurrency": "EUR",
  "pricePln": 431230,
  "exchangeRateUsed": 4.3123,
  "exchangeRateDate": "2026-05-21"
}
```

- **`pricePln`** — canonical do sortowania, filtrów radaru, mapy WWW, dopasowań CRM.
- Dla **PLN**: `exchangeRateUsed` / `exchangeRateDate` = `null`.

## GET `/api/fx/eur-pln`

Kurs średni NBP (tabela A), cache dzienny (pamięć + `.cache/nbp-eur-pln.json`):

```json
{
  "success": true,
  "rate": 4.3123,
  "date": "2026-05-21",
  "source": "NBP"
}
```

## Radar / filtry cenowe

- `RadarPreference.maxPrice` — budżet w **PLN**.
- Porównanie oferty: **`offer.pricePln`**, nie surowe EUR.
- `radar.service`, CRM radar, profil użytkownika (`searchMaxPrice`), mapa WWW — `pricePln`.

## Migracja istniejących ofert

```bash
cd /home/rommar/estateos
npx prisma generate
npx prisma db push
node scripts/migrate-offer-price-pln.cjs
npm run build
pm2 restart nieruchomosci
```

SQL (ręcznie):

```sql
UPDATE Offer SET priceCurrency = 'PLN', pricePln = price WHERE pricePln IS NULL;
```

## Test akceptacji

1. `GET /api/fx/eur-pln` → `rate` > 0, `source: "NBP"`.
2. Utwórz ofertę **100 000 EUR** → w bazie `price=100000`, `priceCurrency=EUR`, `pricePln ≈ rate × 100000` (zaokr. do 1 PLN).
3. `GET /api/mobile/v1/offers/:id` → pełne pola money.
4. Radar z `maxPrice: 500000` PLN — oferta 100k EUR liczy się po `pricePln`.

## Implementacja

| Plik | Rola |
|------|------|
| `src/lib/money/nbpEurPln.ts` | Kurs NBP + cache |
| `src/lib/money/offerPrice.ts` | Przeliczanie, `enrichOfferMoneyFields` |
| `src/app/api/fx/eur-pln/route.ts` | Endpoint kursu |
| `src/lib/services/offer.service.ts` | Zapis create/update |
| `src/lib/mobileOfferLegalPayload.ts` | Money w GET (via enrich) |
| `prisma/schema.prisma` | Kolumny `Offer` |
