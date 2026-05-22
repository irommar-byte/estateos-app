# BACKEND — `plotArea`, `isTwoLevel`, spójność mobile ↔ Prisma

> **Status:** do wdrożenia na estateos.pl (build + `pm2 reload`)  
> **Mobile:** wysyła / czyta pola w POST|PATCH|GET `/api/mobile/v1/offers` oraz w feedzie listy.

## 1. Prisma

```prisma
model Offer {
  // ...istniejące pola...
  /// Metraż działki (m²) — sensowne przy `propertyType === 'HOUSE'` (dom na działce).
  /// Przy `PLOT` główny metraż nadal w `area`.
  plotArea   Float?
  /// Udogodnienie: dom / lokal dwupoziomowy.
  isTwoLevel Boolean @default(false)
}
```

```sql
ALTER TABLE "Offer"
  ADD COLUMN IF NOT EXISTS "plotArea" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "isTwoLevel" BOOLEAN NOT NULL DEFAULT false;
```

## 2. API — body POST / PATCH

```jsonc
{
  "plotArea": 850.5,      // number | null — opcjonalne; dla HOUSE >= 0
  "isTwoLevel": true      // boolean, domyślnie false
}
```

**Walidacja:**

| Warunek | Wynik |
|--------|--------|
| `plotArea` null / pominięte | OK |
| `plotArea` liczba < 0 | `400` |
| `propertyType !== 'HOUSE'` i `plotArea` > 0 | OK (zachować — kupujący widzi metraż działki przy domu) |
| `isTwoLevel` | boolean, coerce |

## 3. API — response GET (lista + szczegół)

Każda oferta **musi** zwracać:

```jsonc
{
  "plotArea": 920,
  "isTwoLevel": false
}
```

## 4. Wyszukiwanie / radar (opcjonalnie backend)

Jeśli filtry radaru lub wyszukiwanie rozszerzone są serwowane po stronie API, obsłuż:

- `minPlotArea` / `maxPlotArea` — dotyczy pola `plotArea` (domy), nie `area`,
- `requireTwoLevel` — `isTwoLevel === true`.

Mobile na dziś filtruje po stronie klienta na feedzie; backend i tak powinien **persistować i zwracać** pola dla spójności admina / WWW.

## 5. Lokalizacja publiczna (przypomnienie)

Mobile przy `isExactLocation === false` pokazuje **tylko nazwę ulicy** (bez numeru) — dla wszystkich typów; przy domu/działce domyślnie włączamy tryb przybliżony w formularzu dodawania.
