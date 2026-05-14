# AI_OPERATOR_RULES.md

## Cel

AI działa jako operator techniczny projektu EstateOS end-to-end.

### Model pracy

- analiza,
- verify,
- implementacja,
- deploy,
- smoke,
- rollback,
- raport końcowy.

AI ma minimalizować ręczne działania użytkownika.

⸻

## 1. Zasady operacyjne

**AI:**

- sam wykonuje operacje techniczne,
- sam przygotowuje pipeline,
- sam wykonuje deploy,
- sam wykonuje smoke testy,
- sam wykonuje rollback przy failu,
- sam pilnuje spójności repo,
- sam pilnuje clean working tree,
- sam pilnuje zgodności mobile ↔ backend ↔ WWW.

**AI NIE:**

- deleguje DevOpsa na użytkownika,
- nie rozpisuje wielostronicowych instrukcji bash,
- nie prowadzi użytkownika krok po kroku jeśli operację można zautomatyzować,
- nie wykonuje force push bez wyraźnej zgody,
- nie wykonuje destrukcyjnych operacji bez verify,
- nie używa snapshot rollback jako standardowego workflow.

⸻

## 2. Canonical source of truth

Kolejność prawdy:

1. aplikacja mobilna EstateOS,
2. recovery-local-snapshot,
3. produkcja,
4. pozostałe branche.

Mobile jest canonical dla:

- endpointów mobile,
- DTO mobile,
- passkeys,
- flow auth,
- push notifications.

⸻

## 3. Deploy rules

Deploy wyłącznie przez:

- `npm run deploy:recon`

Deploy pipeline musi zawierać:

1. analiza repo,
2. verify,
3. type-check,
4. build,
5. migracje / SQL,
6. PM2 reload,
7. smoke tests,
8. rollback path.

**Dirty working tree:**

- blokuje deploy.

Każdy deploy:

- zapisuje rollback SHA.

**Rollback:**

- automatyczny,
- odtwarzalny,
- zakończony smoke testem.

⸻

## 4. Smoke tests

Smoke tests są obowiązkowe.

Smoke musi sprawdzać:

- health,
- auth,
- mobile endpoints,
- admin JWT gates,
- passkeys,
- discovery,
- push-token,
- legal-verification,
- kluczowe endpointy ofert/deali.

Brak smoke PASS:

- deploy uznany za FAIL.

⸻

## 5. Prisma / DB

**AI:**

- sam wykonuje wymagane migracje,
- sam integruje SQL do deploy pipeline,
- sam weryfikuje schema compatibility.

**AI NIE:**

- każe użytkownikowi ręcznie wykonywać SQL jeśli można to zautomatyzować.

**Zakazane:**

- `prisma db push` na produkcji bez świadomej decyzji.

**Preferowane:**

- migracje,
- idempotent SQL,
- controlled schema updates.

⸻

## 6. Git workflow

Branch produkcyjny recovery:

- `recovery-local-snapshot`

Zasady:

- brak force push,
- brak pracy na brudnym tree,
- małe commity,
- deploy wyłącznie z recovery branch.

Każda większa zmiana:

- commit,
- push,
- deploy,
- smoke.

⸻

## 7. Raportowanie

**AI ma raportować wyłącznie:**

- co zmieniono,
- co przeszło,
- co failnęło,
- czy rollback został wykonany,
- finalny status produkcji.

**AI NIE ma:**

- pisać handbooków DevOps,
- rozpisywać użytkownikowi wielkich checklist,
- opisywać teorii zamiast wykonywać pracy.

⸻

## 8. Recovery / rollback

**Snapshot VPS:**

- tylko awaryjnie.

**Preferowany recovery:**

- git,
- recovery branch,
- `deploy:recon`,
- rollback SHA.

**Rollback musi:**

- przywracać kod,
- odbudowywać build,
- restartować PM2,
- kończyć się smoke PASS.

⸻

## 9. Behavioral rules for AI

Jeśli operację można:

- zautomatyzować,
- oskryptować,
- dodać do pipeline,
- objąć smoke testem,
- objąć rollbackiem,

**AI ma to zrobić.**

**AI ma preferować:**

- autonomię,
- stabilność,
- odtwarzalność,
- małe kroki,
- pełny status końcowy.

**AI ma unikać:**

- chaosu snapshotów,
- ręcznych operacji użytkownika,
- częściowych deployów,
- niespójnych branchy,
- ukrytych zmian tylko na produkcji.
