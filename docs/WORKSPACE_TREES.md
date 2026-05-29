# Drzewa robocze EstateOS (WWW + mobile)

## Co jest źródłem prawdy dla produkcji

| Ścieżka lokalna | Rola | Branch produkcyjny |
|-----------------|------|-------------------|
| **`/Users/marian/estateos-recovery-deploy`** | **Kanoniczne repo WWW/API** — tu commitujesz i pushujesz zmiany na `estateos.pl` | `recovery-local-snapshot` |
| VPS `~/estateos` (`rommar@estateos`) | Klon tego samego repozytorium na serwerze | `recovery-local-snapshot` |
| **`/Users/marian/apple-style-app`** | Aplikacja mobilna (Expo/React Native) + **kopia lustrzana** WWW w `deploy/estateos-www-full/` | zwykle `mobile-canonical-*` (nie deployuje WWW) |

Oba katalogi lokalne wskazują na ten sam remote: `https://github.com/irommar-byte/estateos-app.git`, ale **nie są zsynchronizowane co commit** — to osobne checkouty / gałęzie.

## Zasada pracy

1. Zmiany **strony i API** (`src/`, `prisma/`, skrypty deploy): edycja w **`estateos-recovery-deploy`**, commit, `git push`, deploy na VPS (patrz `DEPLOY_PRODUCTION.md`).
2. Zmiany **aplikacji mobilnej**: edycja w **`apple-style-app`** (katalog `ios/`, ekrany RN itd.).
3. Folder **`apple-style-app/deploy/estateos-www-full/`** — archiwum / podgląd; **nie wgrywać na produkcję przez SCP**. Po większej paczce WWW warto skopiować zmienione pliki z recovery do lustra (rsync), żeby nie rozjechały się wersje.

## Deploy produkcji (skrót)

```bash
# lokalnie (estateos-recovery-deploy)
git push origin recovery-local-snapshot

# na VPS
ssh estateos 'cd /home/rommar/estateos && git pull --ff-only origin recovery-local-snapshot && ./scripts/deploy-prod.sh && npm run smoke:postdeploy'
```

Szczegóły: `DEPLOY_PRODUCTION.md`, `deploy/VPS_DEPLOY_WORKFLOW.md` (w apple-style-app).
