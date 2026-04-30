# EstateOS - One Ecosystem (WWW + API + Mobile)

Projekt dziala jako jedna aplikacja Next.js:
- frontend WWW (App Router)
- API web i mobile (`/api/...`, `/api/mobile/v1/...`)
- wspolny backend danych (Prisma + MySQL)

## Produkcja (PM2 + Nginx)

- domena: `https://estateos.pl`
- reverse proxy: Nginx -> `127.0.0.1:3000`
- proces aplikacji: PM2 (`nieruchomosci`)
- konfiguracja PM2: `ecosystem.config.cjs`

## Komendy operacyjne

```bash
# uruchom dev
npm run dev

# build produkcyjny
npm run build

# start produkcyjny lokalnie
npm run start:prod

# start/reload przez PM2
npm run pm2:start
npm run pm2:reload
npm run pm2:save

# pelny deploy produkcyjny
./scripts/deploy-prod.sh
```

## Zasady konfiguracji

- Uzywamy jednego pliku konfiguracyjnego Next: `next.config.ts`.
- Uzywamy jednego procesu PM2 dla calego ekosystemu (WWW + API).
- Zmiany stylow robimy centralnie, aby zachowac spojnosc wygladu WWW i aplikacji:
  - globalne style: `src/app/globals.css`
  - wspolne komponenty: `src/components/`
