# EstateOS iOS - App Store Release Playbook

Dokument operacyjny dla publikacji iOS od przygotowania do wyslania i monitoringu po wdrozeniu.

## 1. MUST before submit

- App Store Connect:
  - aplikacja skonfigurowana pod poprawnym Bundle ID `pl.estateos.app`
  - App Privacy wypelnione i zgodne z realnym dzialaniem aplikacji
  - URL polityki prywatnosci i support URL ustawione
  - konto testowe dla App Review (jesli wymagane flow logowania)
- IAP:
  - produkt `pl.estateos.app.pakiet_plus_30d` gotowy do review
  - ceny i lokalizacje ustawione
  - test sandbox potwierdzony
- Compliance:
  - account deletion dziala i jest opisane w metadatach
  - brak niedozwolonego kierowania do zewnetrznych platnosci w flow iOS, gdzie dotyczy to towarow cyfrowych in-app

## 2. Build i publikacja

1. Zweryfikuj branch release i status testow.
2. Zbuduj release:
   - `npm run eas:ios`
3. Zweryfikuj artefakt i numer builda.
4. Wyslij build:
   - `npm run eas:ios:submit`
5. Ustaw release notes i screenshoty.
6. Dodaj `App Review Notes` (uzyj szablonu z osobnego pliku).

## 3. App Review Notes - minimum content

- Jak zalogowac sie do aplikacji (lub dane testowe).
- Jak odtworzyc glowne flow:
  - publikacja oferty,
  - zakup Pakiet Plus (jesli review ma to testowac),
  - usuwanie konta.
- Wyjasnienie zachowania funkcji "Pakiet PRO - wkrotce" na iOS.

## 4. Go/No-Go gate przed kliknieciem Submit

- [ ] `npm run test:contracts` zielone
- [ ] `npm run lint` bez nowych problemow w zmienianych plikach
- [ ] build dziala na realnym iPhonie
- [ ] push/deeplink smoke test zaliczony
- [ ] account deletion zaliczone end-to-end
- [ ] IAP sandbox zaliczony
- [ ] krytyczne analityki/monitoring wlaczone

## 5. Post-submit monitoring (0-72h)

0-24h:
- crash rate
- API 4xx/5xx dla endpointow krytycznych
- skutecznosc logowania i publikacji

24-72h:
- retencja sesji
- skutecznosc push
- skutecznosc flow IAP Pakiet Plus

## 6. Plan awaryjny

- Jesli wystapi blocker produkcyjny:
  - zatrzymaj rollout (jesli phased release)
  - komunikuj status w jednym kanale release
  - przygotuj hotfix build
- Jesli backend powoduje blad flow krytycznego:
  - wlacz fallback komunikatow user-facing
  - ogranicz wejscie w uszkodzony flow do czasu poprawki
