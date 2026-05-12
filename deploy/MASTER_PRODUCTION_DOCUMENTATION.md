# EstateOS Mobile - Master Production Documentation

Ten dokument jest glownym punktem wejscia do wydania produkcyjnego aplikacji.
Traktuj go jako "single source of truth" dla zespolu mobilnego, backendu i osoby publikujacej release.

## 1. Zakres aplikacji i wersji

- Produkt: EstateOS Mobile (iOS/Android, Expo/React Native)
- Wersja marketingowa: `1.0.0`
- Bundle ID iOS: `pl.estateos.app`
- API produkcyjne: `https://estateos.pl`
- Model platnosci:
  - Pakiet Plus (sloty publikacji): natywne IAP na iOS/Android
  - Pakiet PRO: komunikat "wkrotce" po stronie iOS (bez zewnetrznego checkoutu in-app)

## 2. Dokumenty obowiazkowe przed produkcja

1. `deploy/PRODUCTION_READINESS_CHECKLIST.md`
   - Gate "go/no-go" dla TestFlight i produkcji.
2. `deploy/HANDOFF_BACKEND_SYNC.md`
   - Kontrakt miedzy mobile a backendem.
3. `deploy/APP_STORE_RELEASE_PLAYBOOK.md`
   - Krok po kroku publikacja App Store.
4. `deploy/QA_E2E_TEST_PLAN.md`
   - Scenariusze testowe E2E i kryteria akceptacji.
5. `deploy/OPERATIONS_RUNBOOK.md`
   - Monitoring, incident response, rollback.
6. `deploy/SECURITY_PRIVACY_COMPLIANCE.md`
   - Privacy, App Store compliance, audyt uprawnien.
7. `deploy/APP_STORE_REVIEW_NOTES_TEMPLATE.md`
   - Szablon notatek do App Review.

## 3. Definicja "Production Ready"

Release jest gotowy do publikacji tylko wtedy, gdy:

- Wszystkie punkty "MUST" w dokumentach QA/Compliance/Release sa zamkniete.
- Build produkcyjny jest podpisany i dziala na realnym urzadzeniu iOS.
- Krytyczne flow przechodza E2E:
  - logowanie + sesja + wylogowanie,
  - publikacja ogloszenia,
  - Dealroom (wiadomosci + akcje),
  - push notifications i deeplinki,
  - account deletion,
  - IAP Pakiet Plus (sandbox/TestFlight).
- Nie ma blockerow P0/P1.

## 4. Role i odpowiedzialnosci (RACI - uproszczone)

- Mobile Owner:
  - finalny gate kodu mobilnego i buildow
  - poprawki UI/UX i kompatybilnosci iOS
- Backend Owner:
  - stabilnosc endpointow kontraktowych
  - walidacja i synchronizacja platnosci
- Release Manager:
  - App Store Connect metadata
  - submit i komunikacja z review
- QA:
  - wykonanie planu testow
  - raport ryzyk i regresji

## 5. Minimalny harmonogram wydania

- T-3 dni: freeze feature, tylko bugfixy release-critical
- T-2 dni: pelne QA E2E + poprawki
- T-1 dzien: finalny build, final metadata, review notes
- T-0: submit do App Review
- T+1..T+3: monitoring crashy, API, push i konwersji

## 6. Artefakty wymagane na koniec releasu

- numer buildu i commit SHA
- changelog wersji
- wypelniony checklist "go-live"
- review notes wyslane do Apple
- raport powdrozeniowy 24h i 72h

## 7. Zasady aktualizacji dokumentacji

- Kazda zmiana flow krytycznego (platnosci, auth, account deletion, privacy) wymaga aktualizacji odpowiednich plikow w `deploy/`.
- W PR z taka zmiana musi byc sekcja "Docs updated".
- Brak aktualizacji dokumentacji blokuje "production-ready".
