# EstateOS - QA E2E Test Plan

Plan testow E2E pod wydanie produkcyjne iOS/Android.

## 1. Srodowisko testowe

- Urzadzenia:
  - iPhone (male, standard, duze)
  - iPad (min. 1 scenariusz smoke)
  - 1 Android referencyjny
- Siec:
  - Wi-Fi stabilne
  - slabasiec / offline test
- Konta:
  - konto zwykle
  - konto z dodatkowymi slotami
  - konto testowe do IAP sandbox

## 2. Priorytety i klasyfikacja

- P0: funkcja krytyczna dla dzialania i publikacji (must-pass)
- P1: funkcja glowna, moze blokowac release po analizie ryzyka
- P2: funkcja wazna, ale nie blokuje pierwszego release

## 3. Testy P0 (must-pass)

### Auth
- [ ] Logowanie poprawnymi danymi
- [ ] Logowanie blednymi danymi zwraca komunikat
- [ ] Przywrocenie sesji po restarcie
- [ ] Wylogowanie czysci sesje

### Profile / Compliance
- [ ] Link "usun konto" jest dyskretny i dziala
- [ ] Usuniecie konta z haslem przechodzi end-to-end
- [ ] Po usunieciu konta sesja jest zamknieta

### Add Offer
- [ ] Publikacja nowej oferty konczy sie sukcesem
- [ ] Upload zdjec dziala (w tym konwersja HEIC -> JPG)
- [ ] Walidacje pol blokuja bledne dane

### Dealroom
- [ ] Otwieranie listy dealroom i szczegolow
- [ ] Wysylka wiadomosci tekstowej
- [ ] Odbior i odswiezanie wiadomosci

### Payments / Quota
- [ ] iOS: limit publikacji pokazuje flow IAP (bez Stripe)
- [ ] IAP Pakiet Plus potwierdza odblokowanie slotu
- [ ] Reaktywacja/podbicie oferty po platnosci dziala

### Push / Deeplink
- [ ] Tap push otwiera poprawny ekran
- [ ] Deeplink `estateos://o/:id` otwiera oferte
- [ ] Universal link `https://estateos.pl/o/:id` dziala

## 4. Testy P1

- [ ] Radar map/list parity i filtry
- [ ] Live Activity fallback lub natywny update (iOS)
- [ ] Powiadomienia systemowe i zgody
- [ ] Tryb ciemny/jasny - glowne ekrany

## 5. Kryteria akceptacji release

- Brak otwartych P0
- Maksymalnie 2 zaakceptowane P1 z planem naprawy
- Brak crasha w glownej sciezce uzycia na realnych urzadzeniach

## 6. Raport testowy (format)

Kazdy run testowy powinien zawierac:

- data i build number
- urzadzenia i wersje systemu
- lista zaliczonych/niezaliczonych testow
- lista bugow z priorytetem
- decyzja: GO / NO-GO
