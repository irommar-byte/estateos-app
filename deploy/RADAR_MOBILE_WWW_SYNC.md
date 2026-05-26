# Radar — synchronizacja mobile ↔ WWW

**Źródło prawdy:** tabela `RadarPreference` + `POST/GET /api/radar/preferences`.

## Kontrakt (oba kanały)

| Pole | Mobile | CRM WWW |
|------|--------|---------|
| Tryb | `calibrationMode` CITY / MAP | tak |
| Transakcja | `RENT` / `SELL` | tak |
| Typ | `FLAT`, `HOUSE`, `PLOT`, `COMMERCIAL`, `ALL`→null | tak |
| Miasto / dzielnice | `city`, `selectedDistricts` | tak |
| Mapa | `lat`, `lng`, `radius` (tylko MAP) | tak |
| Budżet / metraż / rok | `maxPrice`, `minArea`, `minYear` | tak |
| Udogodnienia | + `requireTwoLevel` | tak |
| Próg | `matchThreshold` → `minMatchThreshold` | tak |
| Push | `pushNotifications` | tak |

## Zapis

1. **Aplikacja** — `buildCanonicalRadarPreferencesDto` + `mapContextForCanonicalDto` → `POST /api/radar/preferences`.
2. **CRM** — `buildRadarPreferencesPostBody` → ten sam endpoint (+ opcjonalnie legacy `POST /api/szukaj/aktualizuj`).
3. **API** — upsert `RadarPreference` + **`syncUserLegacySearchFromRadarPreference`** (pola `User.search*` dla CRM).

## Odczyt

1. **Aplikacja** — po zalogowaniu `GET /api/radar/preferences?userId=` → `radarFiltersFromApiPreference`.
2. **CRM** — profil + `GET /api/radar/preferences` → `webRadarFiltersFromPreference`.

## Deploy (VPS)

```bash
cd ~/estateos && git fetch origin && git log origin/recovery-local-snapshot -3
# Oczekiwany HEAD: 563a9fc lub nowszy
git pull && npm run deploy:server-only
```

SQL (jeśli kolumna brak na prod):

```bash
# deploy/docs/reconciliation/sql/add_radar_preference_require_two_level.sql
```

## Gałęzie w repo

- **Produkcja:** `recovery-local-snapshot` → katalog `src/` (root Next).
- **Mobile + mirror WWW:** `mobile-canonical-20260514` → `deploy/estateos-www-full/` (kopia; deploy idzie z recovery).
