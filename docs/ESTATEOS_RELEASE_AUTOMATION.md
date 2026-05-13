# EstateOS™ — release automation, CI/CD, staging, immutable deploys

Ten dokument opisuje **konfigurację** dodaną w repozytorium: GitHub Actions, webhooks, metryki czasu deployu, staging oraz **rekomendacje** dla „immutable releases” z Next.js.

## Single-command na serwerze

- `npm run release` — status → (opcjonalnie `RELEASE_AUTO_COMMIT=1`) → push → `deploy:prod` → curle publiczne → raport (`scripts/.release-report.txt`).
- `npm run deploy:prod` — pełny deploy na bieżącym hoście (**deploy lock** `.deploy/deploy.lock`, preflight, backup DB, pull, build, PM2, smoke, health, historia `.deploy/deploy-history.jsonl`, webhook jeśli ustawiony).
- `npm run deploy:staging` — osobny PM2 (`nieruchomosci-staging`, port **3001**, `ecosystem.staging.config.cjs`, `.env.staging`). Pierwszy raz: `pm2 start ecosystem.staging.config.cjs --env staging`. **Bez** produkcyjnego `deploy.lock`.

## Deploy lock (tylko produkcja)

- **Plik:** `.deploy/deploy.lock` — w katalogu `.deploy/` (już gitignored).
- **Semantyka:** maksymalnie jeden równoległy deploy produkcji (lokalnie, `npm run release`, GitHub Actions → `ci-remote-deploy.sh` → `deploy:prod`).
- **Zawartość:** `pid`, `ppid`, `started_epoch`, `started_iso`, git `sha`, `branch`, `hostname`, `user`, `trigger` (`DEPLOY_LOCK_TRIGGER`, domyślnie `local`; `release-prod.sh` ustawia `npm-release`; workflow produkcyjny ustawia `github-actions`).
- **Zwolnienie:** `trap` na `EXIT` usuwa lock tylko jeśli PID w pliku = bieżący proces (własny lock).
- **Stale:** brak żywego PID-u z locka **albo** wiek locka > `DEPLOY_LOCK_MAX_AGE_SEC` (domyślnie **7200** s) → ostrzeżenie, usunięcie, ponowna próba zajęcia.
- **Kolizja:** skrypt kończy się kodem **17** i wypisuje zawartość locka („kto / od kiedy / SHA”).
- **Wyłączenie:** `DEPLOY_SKIP_DEPLOY_LOCK=1` wyłącza lock wyłącznie świadomie (np. awaryjny hotfix).

## Webhooki (Discord / Slack)

Na serwerze w `.env` (nie commituj):

- `DISCORD_WEBHOOK_URL` **lub** `SLACK_WEBHOOK_URL` **lub** `GENERIC_WEBHOOK_URL`

Skrypt `scripts/notify-deploy.cjs` wołany jest z `deploy-prod.sh` po sukcesie i po błędzie (rollback hint w treści).

Opcjonalnie publiczny URL w treści powiadomienia:

- `DEPLOY_URL=https://estateos.pl` (alias: `DEPLOY_PUBLIC_URL`)

## Historia deployów i czas trwania

- Plik (gitignored): `.deploy/deploy-history.jsonl` — każda linia to JSON: `ts`, `status`, `durationSec`, `sha`, `branch`, `rollbackSha`, `ecosystem`, `pm2App`, `hostname`, `exitCode`, `releaseId`, `releaseImmutable`.

## GitHub Actions — wymagane sekrety

### Production (`.github/workflows/production-deploy.yml`)

Trigger: **push** na gałąź `production`.

Opcjonalnie: zmienna repozytorium **`ESTATEOS_STAGING_FIRST=1`** — przed produkcją workflow uruchomi deploy **staging** (wymaga sekretów staging jak w tabeli poniżej).

| Secret | Opis |
|--------|------|
| `PROD_SSH_HOST` | Host SSH |
| `PROD_SSH_USER` | Użytkownik SSH |
| `PROD_SSH_KEY` | Klucz prywatny PEM |
| `PROD_APP_PATH` | Katalog repo na serwerze, np. `/home/rommar/estateos` |
| `PROD_GIT_BRANCH` | Opcjonalnie; domyślnie workflow ustawia `production` jeśli puste |
| `DISCORD_WEBHOOK_URL` | Opcjonalnie — powiadomienia z CI |

Na serwerze musi istnieć `scripts/ci-remote-deploy.sh` (fetch/checkout/pull + deploy).

### Serwer — snapshot release (`RELEASE_IMMUTABLE`)

| Zmienna | Opis |
|---------|------|
| `RELEASE_IMMUTABLE=1` | Po `npm run build`: `rsync` `.next` (+ `node_modules/.prisma`) do `releases/<timestamp>/`, symlink `releases/current`. Wymaga `rsync`; **duże zużycie dysku**. |

Rollback do poprzedniego buildu bez pełnego `npm run build`:

```bash
ROLLBACK_CONFIRM=1 bash scripts/rollback-to-release.sh <release_id>
```

`release_id` to folder (np. `20260113_120000` z `deploy-prod.sh`).

### Staging (`.github/workflows/staging-deploy.yml`)

Trigger: **push** na `staging`.

| Secret | Opis |
|--------|------|
| `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY`, `STAGING_APP_PATH` | Analogicznie do prod |
| `STAGING_GIT_BRANCH` | Opcjonalnie; domyślnie `staging` w skrypcie SSH jeśli puste |

### Health / uptime (`.github/workflows/health-monitor.yml`)

- Cron co **5 minut**: `curl` `PROD_HEALTH_URL` lub domyślnie `https://estateos.pl/api/health`, walidacja JSON `{ ok: true }`.
- Przy błędzie: opcjonalny alert na Discord (ten sam `DISCORD_WEBHOOK_URL`).
- Job `pm2-metrics` uruchamiany **ręcznie** (`workflow_dispatch`) — `pm2 jlist` przez SSH (wymaga sekretów prod jak wyżej).

## Release tagi z CI

Po udanym deployu workflow tworzy tag `deploy/<runId>-<timestamp>` wskazujący na **`github.sha`** commita, który ztriggerował workflow (zwykle równy HEAD na `production`).

## Immutable releases (`/releases/<timestamp>` + `current`)

**W repozytorium:** ustaw na serwerze `RELEASE_IMMUTABLE=1` przy `npm run deploy:prod` (np. `export` przed deployem). Powstaje:

- `releases/<STAMP>/` — kopia `.next/`, opcjonalnie `node_modules/.prisma/`, plik `META.json` (sha, branch, data),
- `releases/current` — symlink do aktywnego release.

**Rollback artefaktu:** `ROLLBACK_CONFIRM=1 bash scripts/rollback-to-release.sh <STAMP>` (przywraca `.next` z snapshotu, `pm2 reload`).

Next.js nadal czyta `.next` z katalogu aplikacji — snapshot **kopiuje** build do `releases/...`; przy rollbacku kopiujemy z powrotem do `.next` (kompromis czas/dysk vs pełne blue/green z osobnym `cwd`).

Dalsze opcje produkcyjne:

1. **Docker / OCI** — tag obrazu = release.
2. **Osobny katalog roboczy PM2** na release z własnym `node_modules` — pełniejsza izolacja.
3. **Git SHA** — tagi `deploy/...` + `.deploy/recovery/` jako lekki rollback kodu (`git reset --hard` + build).

Dodatkowo: snapshot tar źródeł w `deploy-prod.sh` (`.deploy/recovery/`).

## Uptime / PM2 „auto alerts”

- **Health**: workflow cron + Discord.
- **PM2**: okresowy snapshot ręczny z Actions lub zewnętrzny monitor (Datadog, Grafana Cloud, PM2 Plus) — poza zakresem minimalnego pliku YAML.

## Rollback

- **Nigdy** automatyczny `git reset --hard` z CI — tylko powiadomienie + SHA w Discord/logach.
- Na serwerze: komunikaty z `deploy-prod.sh` / `.deploy/recovery/pre_pull_commit` oraz `npm run recover:prod` (wymaga `RECOVER_CONFIRM=1`).
- **Artefakt buildu** (gdy włączone `RELEASE_IMMUTABLE=1`): `ROLLBACK_CONFIRM=1 bash scripts/rollback-to-release.sh <STAMP>`.
