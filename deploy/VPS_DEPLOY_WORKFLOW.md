# EstateOS — workflow deploy na VPS (zweryfikowany 2026-05-25)

## Branch produkcyjny

- `recovery-local-snapshot` (GitHub `origin` ↔ VPS `~/estateos`)

## Zasady

- **Bez** wdrożeń przez SCP
- **Bez** pracy na `master`
- **Bez** `git push --all`
- **Bez** commitowania `.env`, `.env.bak*`, kluczy API ani innych sekretów (`.env.bak*` w `.gitignore`)

## Lokalnie

```bash
git add .
git commit -m "opis zmian"
git push
```

Push na branch `recovery-local-snapshot` (lub merge/PR do niego przed deployem).

## Na VPS — standard (zmiany Next.js / API)

```bash
cd ~/estateos
git pull
npm run deploy:server-only
```

`deploy:server-only` = `npm run build` + `pm2 startOrReload ecosystem.config.cjs --env production`.

## Na VPS — zmiana zależności (`package.json` / `package-lock.json`)

```bash
cd ~/estateos
git pull
npm run deploy:prod
```

`deploy:prod` = `npm ci` + build + reload + `pm2 save`.

## Opcjonalna weryfikacja po deploy

```bash
npm run smoke:postdeploy
```

## Dlaczego nie `pm2 restart all`

- Produkcja: PM2 **`nieruchomosci`** → `npm run start:prod` → serwuje **gotowy** katalog `.next`.
- Samo `git pull` nie przebudowuje `.next`.
- `pm2 restart all` może uruchomić **stary** build i dotyka też procesu cron (`reviews-finalization-fallback`).

## Backup referencyjny (nie do codziennej pracy)

- Gałąź/tag na VPS: `backup-vps-20260525-1535`
