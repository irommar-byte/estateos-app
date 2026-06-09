# Playbook agenta — Git, commit, push, deploy (OBOWIĄZKOWY)

**Ten plik jest drogowskazem dla każdego agenta Cursor pracującego w tym repo.**  
Przeczytaj go **przed** pierwszym `git commit`, `git push` lub deployem na VPS.  
Nie informuj użytkownika, że „coś się rozjeżdża” — **pilnujesz tego sam**, według checklisty poniżej.

Powiązane: [VPS_DEPLOY_WORKFLOW.md](./VPS_DEPLOY_WORKFLOW.md) (szczegóły VPS).

---

## 1. Mapa repozytorium (zapamiętaj)

To **jedno** repo GitHub (`irommar-byte/estateos-app`), ale **dwie niezależne historie** i **dwa różne układy katalogów w korzeniu**.

| Gałąź | Rola | Korzeń repo zawiera | Gdzie pracować lokalnie |
|--------|------|---------------------|-------------------------|
| `mobile-canonical-20260514` | Aplikacja mobilna (Expo/RN) | `App.tsx`, `ios/`, `src/` (mobile), `deploy/estateos-www-full/` (kopia backendu) | `/Users/marian/apple-style-app` |
| `recovery-local-snapshot` | Produkcja **estateos.pl** (Next.js + API) | `package.json` (Next), `src/app/`, `prisma/` — **backend w korzeniu** | `/Users/marian/estateos-recovery-deploy` (git worktree) |
| `main` | Stara stabilna mobilka — **nie** deploy www | jak mobilka | nie używać do produkcji |

**VPS produkcja:** `ssh estateos`, katalog `~/estateos`, branch **`recovery-local-snapshot`**.

**Nie ma wspólnego merge-base** między `mobile-canonical-*` a `recovery-local-snapshot` — to **nie są** gałęzie do zwykłego `git merge`. Łączenie tylko **plik po pliku** według mapowania w §3.

### Worktree (drugi katalog)

```text
/Users/marian/apple-style-app           → branch mobile-canonical-20260514
/Users/marian/estateos-recovery-deploy  → branch recovery-local-snapshot
```

Przed commitem backendu: **`cd /Users/marian/estateos-recovery-deploy`** i sprawdź `git branch --show-current`.

---

## 2. Zasady nadrzędne (bez wyjątków)

1. **Agent wykonuje** commit / push / deploy — nie zostawia „użytkownik musi wdrożyć”, chyba że brakuje dostępu SSH lub jawnej zgody na pominięcie deployu.
2. **Nigdy** `git push --all`, **nigdy** force push na `main`, **nigdy** `prisma db push --accept-data-loss` na produkcji bez analizy.
3. **Nigdy** pełny `rsync deploy/estateos-www-full/` → korzeń `recovery-local-snapshot` (psuje build www).
4. **Nigdy** commit `.env`, kluczy API, haseł.
5. Po zmianie backendu na produkcji: **zawsze** `npm run build` lokalnie w worktree recovery **albo** `npm run deploy:server-only` na VPS — nie samo `pm2 restart`.
6. Po deployu API: **zawsze** weryfikacja (smoke lub `curl` na nowy endpoint — oczekiwany ≠ 404).
7. Zmiana tylko w mobilce → tylko `mobile-canonical-20260514`. Zmiana API/www → **obowiązkowo** też `recovery-local-snapshot` + deploy VPS.

---

## 3. Mapowanie ścieżek (mobilka → produkcja)

Edycja w kopii (gałąź mobilna):

```text
deploy/estateos-www-full/<ścieżka>
```

Ten sam plik na gałęzi produkcyjnej (worktree recovery):

```text
<ścieżka>   # bez prefiksu deploy/estateos-www-full/
```

Przykłady:

| Mobilka (edycja) | Produkcja (commit + VPS) |
|------------------|---------------------------|
| `deploy/estateos-www-full/src/app/api/mobile/v1/open-house/...` | `src/app/api/mobile/v1/open-house/...` |
| `deploy/estateos-www-full/src/lib/openHouse.ts` | `src/lib/openHouse.ts` |
| `deploy/estateos-www-full/prisma/schema.prisma` | `prisma/schema.prisma` (+ migracja SQL, §5) |

### 3.1 Rejestr funkcji www (nie usuwać — zawsze sync recovery + kopia)

Każda pozycja musi istnieć **równocześnie** na `recovery-local-snapshot` i w `deploy/estateos-www-full/` (oraz na VPS po deployu):

| Obszar | Ścieżki / endpointy |
|--------|---------------------|
| Contact (DM użytkownik↔użytkownik) | `src/app/api/contact/threads/*`, `src/app/api/mobile/v1/contact/threads/*`, `src/app/moje-konto/wiadomosci/`, `src/components/contact/*`, modele `ContactThread` / `ContactMessage` w Prisma |
| Powiadomienia Contact (grupowanie) | `src/app/api/notifications/route.ts` (`groupKey: contact-thread:{id}`), `src/components/NotificationCenter.tsx` |
| Push Contact (grupowanie iOS/Android) | `src/lib/contactPushPayload.ts`, `src/lib/services/notification.service.ts` |
| Admin użytkownicy (pełny podgląd) | `src/app/centrala/uzytkownicy/`, `src/components/admin/AdminUserDetailPanel.tsx`, `src/lib/adminUserDetail.ts` |
| CRM PRO / Open House / Import | `src/components/ProWidget.tsx`, `src/components/crm/*`, `src/components/otodom/*`, `src/components/openHouse/*` |

Przed usunięciem pliku z powyższych — **zatrzymaj się** i potwierdź z użytkownikiem. Commit tylko na mobilce bez recovery = regresja produkcji.

**Mobilka (`src/`, `App.tsx`, `ios/`)** nie istnieje na gałęzi recovery — tam nie commitujesz plików RN.

---

## 4. Workflow A — tylko aplikacja mobilna

Dotyczy: `src/`, `App.tsx`, `ios/`, i18n mobilne, komponenty bez zmian w `deploy/estateos-www-full/`.

```bash
cd /Users/marian/apple-style-app
git checkout mobile-canonical-20260514
git status && git diff
# commit + push
git push origin mobile-canonical-20260514
```

**Deploy VPS:** nie wymagany. Użytkownik buduje app: `npx expo run:ios`.

---

## 5. Workflow B — tylko backend / API / Prisma

Dotyczy: pliki pod `deploy/estateos-www-full/` **lub** bezpośrednio w worktree recovery.

### Krok B1 — edycja (wybierz jedną ścieżkę)

**Opcja zalecana (bez rozjazdu kopii):**

```bash
cd /Users/marian/estateos-recovery-deploy
# edytuj pliki w src/, prisma/, public/ ...
```

**Opcja z sesji mobilnej:** edytuj `deploy/estateos-www-full/...` w `apple-style-app`, potem **skopiuj zmienione pliki** do worktree recovery (te same ścieżki względne, §3).

### Krok B2 — commit na recovery

```bash
cd /Users/marian/estateos-recovery-deploy
git checkout recovery-local-snapshot
git pull origin recovery-local-snapshot
git status
git add <tylko dotknięte pliki>
git commit -m "Opis po angielsku lub polsku: dlaczego, nie tylko co."
git push origin recovery-local-snapshot
```

### Krok B3 — build lokalny (OBOWIĄZKOWY przed VPS)

```bash
cd /Users/marian/estateos-recovery-deploy
npm run build
```

Jeśli build pada — **napraw przed push/deploy**, nie wdrażaj na VPS.

### Krok B4 — deploy VPS

```bash
ssh estateos "cd ~/estateos && git pull origin recovery-local-snapshot"
```

Jeśli `git pull` blokuje lokalne zmiany na VPS:

```bash
ssh estateos "cd ~/estateos && git stash push -u -m 'pre-agent-deploy' && git pull origin recovery-local-snapshot"
```

**Build + reload:**

```bash
ssh estateos "cd ~/estateos && npm run deploy:server-only"
```

Jeśli zmieniono `package.json` / `package-lock.json`:

```bash
ssh estateos "cd ~/estateos && npm run deploy:prod"
```

**Smoke:**

```bash
ssh estateos "cd ~/estateos && npm run smoke:postdeploy"
```

### Krok B5 — weryfikacja endpointu

Dla nowego API mobilnego sprawdź, że **nie** zwraca 404 (401/403/422 OK):

```bash
curl -sS -o /dev/null -w "%{http_code}" -X POST "https://estateos.pl/api/mobile/v1/<ścieżka>" \
  -H "Content-Type: application/json" -d '{}'
```

### Krok B6 — opcjonalnie zsynchronizuj kopię na gałęzi mobilnej

Żeby `deploy/estateos-www-full/` nie było przestarzałe:

```bash
# z recovery do kopii w mobilce (tylko zmienione pliki, nie cały rsync!)
cp /Users/marian/estateos-recovery-deploy/src/lib/foo.ts \
   /Users/marian/apple-style-app/deploy/estateos-www-full/src/lib/foo.ts
cd /Users/marian/apple-style-app
git add deploy/estateos-www-full/...
git commit -m "Sync www-full copy with recovery: <krótki opis>."
git push origin mobile-canonical-20260514
```

---

## 6. Workflow C — mobilka + backend (typowy feature)

Kolejność **zawsze**:

1. Implementacja w `apple-style-app` (mobile + ewentualnie `deploy/estateos-www-full/`).
2. Commit + push **`mobile-canonical-20260514`**.
3. Przeniesienie plików backendu do **`estateos-recovery-deploy`** (§3).
4. Build recovery → commit + push **`recovery-local-snapshot`**.
5. Deploy VPS (§5 B4–B5).
6. Krótko użytkownikowi: co wdrożone, że app wymaga rebuild jeśli dotyczy UI.

**Nie kończ zadania** mając tylko push mobilki przy zmianach API.

---

## 7. Baza danych (Prisma / MySQL na produkcji)

| Sytuacja | Co robić |
|----------|----------|
| Nowe tabele / enumy (np. Open House) | Dodać modele w `prisma/schema.prisma` na **recovery**, dodać plik `prisma/manual/sql/YYYY-MM-DD_opis.sql`, na VPS: `npx prisma db execute --file prisma/manual/sql/....sql`, potem `npx prisma generate` |
| Pełny `prisma db push` | **Zakazane** na produkcji bez przeglądu diffu — grozi usunięciem kolumn/tabel z żywym API |
| Po migracji SQL | `npx prisma generate` przed buildem |

---

## 8. Czego NIE robić (powody historycznych awarii)

| Akcja | Skutek |
|-------|--------|
| Merge `mobile-canonical` → `recovery` | Katastrofa — inny root repo |
| `rsync -av deploy/estateos-www-full/ → recovery/` | Build www się sypie, giną pliki tylko na produkcji |
| Deploy tylko open house / tylko fragment bez import API | 404 w aplikacji (brak route na VPS) |
| `prisma db push --accept-data-loss` na VPS | Ryzyko utraty danych produkcyjnych |
| Commit tylko na mobilce przy zmianie `deploy/estateos-www-full` | Produkcja nie dostaje API — użytkownik widzi błędy |
| Mówienie „gałęzie się rozjechały” bez wykonania §5 B | Niedopuszczalne — agent ma naprawić według playbooka |

---

## 9. Checklist przed zamknięciem zadania użytkownika

Zaznacz mentalnie — wszystkie pasujące punkty muszą być spełnione:

- [ ] Wiem, czy zmiana dotyczy **mobilki**, **backendu**, czy **obu**.
- [ ] Właściwa gałąź(i) ma commit i push.
- [ ] Backend: build recovery przeszedł przed deployem.
- [ ] VPS: `git pull` + `deploy:server-only` (lub `deploy:prod`) wykonane.
- [ ] Nowe endpointy sprawdzone (≠ 404).
- [ ] Migracja DB wykonana jeśli były nowe modele.
- [ ] Użytkownik wie, czy potrzebny `npx expo run:ios` (zmiany UI mobilne).
- [ ] Nie zostawiono „do zrobienia później” deployu bez powodu.

---

## 10. Szybkie komendy (kopiuj)

```bash
# Gdzie jestem?
pwd && git branch --show-current

# Mobilka — status + push
cd /Users/marian/apple-style-app && git status && git push origin mobile-canonical-20260514

# Produkcja — build + push
cd /Users/marian/estateos-recovery-deploy && npm run build && git push origin recovery-local-snapshot

# VPS — deploy standard
ssh estateos "cd ~/estateos && git pull origin recovery-local-snapshot && npm run deploy:server-only && npm run smoke:postdeploy"
```

---

## 11. Aktualizacja tego playbooka

Jeśli zmieni się branch produkcyjny, ścieżka worktree lub hosting — **zaktualizuj ten plik w tym samym PR** i sekcję w [VPS_DEPLOY_WORKFLOW.md](./VPS_DEPLOY_WORKFLOW.md).

Ostatnia weryfikacja struktury repo: **2026-06-03** (`mobile-canonical-20260514` + `recovery-local-snapshot` + worktree `estateos-recovery-deploy`).
