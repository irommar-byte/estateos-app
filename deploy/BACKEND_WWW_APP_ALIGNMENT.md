# WWW ↔ aplikacja mobilna — wyrównanie flow (produkcja)

## Cel

Strona `estateos.pl` odzwierciedla **ten sam model konta** co aplikacja:

- rejestracja: **`PRIVATE`** | **`AGENT`** (+ `companyName` dla agenta)
- **brak** podziału „kupujący / sprzedający / inwestor” w UI
- **Profil** i **pakiety Pro** tylko na WWW (`/moje-konto`, `/cennik`)

## Wdrożone zmiany

| Obszar | Plik |
|--------|------|
| Rejestracja | `src/components/auth/RegisterForm.tsx`, `src/app/rejestracja/page.tsx` |
| API | `src/app/api/register/route.ts` — `PARTNER` tylko przez `/cennik` |
| Hero CTA | `src/contracts/homeCtaContract.ts`, `HeroDepthEffect.tsx`, `dictionaries.ts` |
| Tryb użytkownika | `UserModeContext.tsx`, `PremiumModeToggle.tsx`, `ModeTransition.tsx`, `WorkspaceSwitcher.tsx` (wyłączone) |
| Logowanie PL | `src/app/login/page.tsx` |
| Profil | `src/app/moje-konto/crm/page.tsx` — nagłówek + Radar bez trybu BUYER |
| Legacy | usunięte `HeroDepthEffect.v1.tsx` (stare CTA Kupuję/Sprzedaję) |

## Deploy

```bash
./scripts/deploy-www-app-alignment.sh
```

## Test po wdrożeniu

1. `/rejestracja` — tylko Osoba prywatna / Agent, link do `/cennik` dla Pro  
2. `/` — CTA: Szukaj na Radarze, Dodaj ofertę, Moje konto, Pakiety Pro  
3. Zalogowany — **brak** przełącznika Inwestor/Właściciel w navbarze  
4. `/moje-konto` — profil, Radar, oferty, link do `/cennik`  
