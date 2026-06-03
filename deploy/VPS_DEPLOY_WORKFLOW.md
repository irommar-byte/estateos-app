# EstateOS — deploy backendu (estateos.pl) na VPS

**Jedyne źródło prawdy** dla wdrożeń WWW/API na produkcję (zweryfikowane na VPS 2026-05-25).

> **Agenci Cursor:** przed commit/push/deploy przeczytaj obowiązkowo  
> **[AGENT_GIT_DEPLOY_PLAYBOOK.md](./AGENT_GIT_DEPLOY_PLAYBOOK.md)** — mapa gałęzi, worktree, checklisty, zakazy.

Backend (**estateos.pl**) jest wdrażany **z Git na VPS**:

| | |
|---|---|
| Katalog | `~/estateos` |
| Branch produkcyjny | `recovery-local-snapshot` |

## Workflow

**Lokalnie (gałąź `recovery-local-snapshot`, katalog worktree `/Users/marian/estateos-recovery-deploy`):**

```bash
cd /Users/marian/estateos-recovery-deploy
git add .
git commit -m "opis zmian"
git push origin recovery-local-snapshot
```

**Na VPS — standard (Next.js / API):**

```bash
cd ~/estateos
git pull
npm run deploy:server-only
```

**Na VPS — zmiana `package.json` / `package-lock.json`:**

```bash
cd ~/estateos
git pull
npm run deploy:prod
```

**Opcjonalnie po deploy:**

```bash
npm run smoke:postdeploy
```

## Zakazy

- SCP
- branch `master` jako produkcja
- `git push --all`
- commitowanie `.env`, `.env.bak*`, kluczy API
- **`pm2 restart all` jako zamiennik deploy** — patrz niżej

## Dlaczego nie `pm2 restart all`

Produkcja: PM2 **`nieruchomosci`** → `npm run start:prod` → serwuje **gotowy** katalog `.next` (wynik `next build`).

| Kroki | Efekt |
|-------|--------|
| `git pull` | Aktualizuje **kod źródłowy**, nie `.next` |
| `pm2 restart all` | Restartuje proces ze **starym** buildem |
| `npm run deploy:server-only` | `build` + `pm2 reload` przez `ecosystem.config.cjs` |

`deploy:server-only` = `npm run build` + `pm2 startOrReload ecosystem.config.cjs --env production`.

`deploy:prod` = `npm ci` + build + reload + `pm2 save`.

## Backup referencyjny (nie do codziennej pracy)

- `backup-vps-20260525-1535`
