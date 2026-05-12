# EstateOS - Operations Runbook (Mobile + Backend)

Runbook operacyjny na czas wydania i pierwsze dni po publikacji.

## 1. Cel runbooka

- szybka reakcja na incydenty po release
- jasny podzial odpowiedzialnosci
- ograniczenie czasu niedostepnosci flow krytycznych

## 2. Zakres monitoringu (MUST)

- Auth:
  - blad logowania
  - blad odswiezania sesji
- Publikacja oferty:
  - bledy `POST /api/mobile/v1/offers`
  - bledy uploadu `/api/upload/mobile`
- Dealroom:
  - bledy pobierania i wysylki wiadomosci
- Platnosci:
  - bledy endpointu IAP Pakiet Plus
  - opoznienia synchronizacji po platnosci
- Push:
  - skutecznosc rejestracji urzadzenia
  - klikniecie push -> poprawna nawigacja

## 3. SLO robocze (proponowane)

- Auth i publikacja:
  - dostepnosc >= 99.9%
- Czas reakcji na P0:
  - pierwsza reakcja <= 15 min
  - plan naprawy <= 60 min

## 4. Incident severity

- P0: niedzialajace logowanie, publikacja, crash po starcie, brak mozliwosci korzystania
- P1: niedzialajace wybrane flow bez calkowitej utraty funkcji
- P2: degradacja UX lub blad uboczny

## 5. Procedura incydentu

1. Detekcja:
   - alert monitoringu lub raport od QA/uzytkownika
2. Triage:
   - okresl severity
   - sprawdz czy dotyczy mobile, backend, czy obu
3. Mitigation:
   - fallback UI (komunikat, ograniczenie flow) jesli mozliwe
   - poprawka backend lub hotfix mobile
4. Komunikacja:
   - jeden kanal statusowy
   - update co 30 min dla P0/P1
5. Zamkniecie:
   - RCA (root cause analysis)
   - action items z terminami

## 6. Rollback strategy

- App Store:
  - zatrzymanie phased release (jesli wlaczone)
  - przygotowanie hotfix build
- Backend:
  - rollback ostatniej zmiany endpointow krytycznych
  - przywrocenie poprzedniej konfiguracji, jesli to config issue

## 7. Lista kontaktow operacyjnych

Uzupelnij przed releasem:

- Mobile Owner: <imie + kontakt>
- Backend Owner: <imie + kontakt>
- Release Manager: <imie + kontakt>
- On-call fallback: <kontakt>

## 8. Postmortem template (krotki)

- Co sie stalo:
- Impact:
- Root cause:
- Co zadzialalo:
- Co poprawic:
- Owner i deadline:
