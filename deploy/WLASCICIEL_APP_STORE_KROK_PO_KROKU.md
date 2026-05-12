# App Store — krok po kroku (dla właściciela bez programisty)

Agent (AI + repo) przygotuje kod i dokumentację techniczną. **Ciebie** Apple wymaga przy koncie finansowym i prawnych danych.

## Co robi TY (bez znajomości kodu)

1. **Konto Apple Developer (płatne ~99 USD/rok)**  
   - Zaloguj się Apple ID firmowym/osobistym na [developer.apple.com](https://developer.apple.com).  
   - Opłać członkostwo, zaakceptuj umowy.

2. **App Store Connect** — [appstoreconnect.apple.com](https://appstoreconnect.apple.com)  
   - Utwórz **nową aplikację** (jeśli jeszcze nie ma): nazwa pod użytkownikami, język, bundle ID **`pl.estateos.app`** (musi się zgadzać z tym co w Xcode/EAS).

3. **Wypełnij obowiązkowe pola w sklepie**  
   - Opis aplikacji, kategoria, **wiek (rating)**.  
   - **Zrzuty ekranu** z prawdziwego iPhone’a (różne rozmiary — Apple podaje listę).  
   - **Polityka prywatności** — działający link HTTPS (np. na estateos.pl).  
   - **Support URL** (strona kontaktu lub help).

4. **App Privacy** (pytania Apple o dane)  
   - Odpowiadasz zgodnie z prawdą (konto, zdjęcia, lokalizacja, powiadomienia itd.).  
   Jeśli nie jesteś pewna — napisz do agenta: „pomóż mi wypisać odpowiedzi linia po linii” na podstawie funkcji aplikacji.

5. **Account deletion** (usuwanie konta)  
   - W aplikacji już jest flow usuwania konta — w metadanych Apple często trzeba **krótki opis lub link**, jak usunąć konto z poziomu konta www (jeśli macie taką instrukcję).

6. **Płatności w aplikacji (Pakiet Plus)**  
   - W App Store Connect: umowy **Paid Applications**, **rozliczenia, podatki, konto bankowe**.  
   - Bez tego Apple nie aktywuje sprzedaży IAP w sklepie.

7. **Konto testowe dla Apple**  
   - Zwykłe konto login + hasło **tylko do review** (bez 2FA problemów lub z instrukcją dla reviewera).

8. **Submit**  
   Po tym jak agent dostarczy **build** (plik wgrywany przez EAS/TestFlight): w App Store Connect wybierasz build, odpowiadasz na ewentualne pytanie exportu szyfrowania (często: „nie używasz wyjątkowych algorytmów” — jak w aplikacji), wysyłasz do przeglądu.

## Co robi agent (repo + Twoje środowisko)

- Kod, Expo/EAS (`eas.json`), IAP product id w konfiguracji.  
- `npm run eas:ios` — budowa iOS pod TestFlight/App Store (**ty musisz mieć**: Apple ID podpięty do Expo/EAS przy pierwszym razie — instrukcję dostaniesz od agenta przy komendzie).  
- Uzupełnienie **Notes for Review** (tekst dla Apple po angielsku) — szablon: `deploy/APP_STORE_REVIEW_NOTES_TEMPLATE.md`.  
- Checklist przed releasem: `deploy/PRODUCTION_READINESS_CHECKLIST.md`.

## Jedna ważna prawda

**Żaden agent nie zastąpi Twojego logowania do Apple ani Twoich danych firmowych.** Reszta — budowa, dokumentacja, checklisty — może iść przez agenta w tym repozytorium.

## Co napisz agentowi w następnej wiadomości

Wklej:  
„Mam już Apple Developer tak/nie. Chcę iść na TestFlight, potem produkcja. Nie mam dostępu do niczego oprócz tego konta Apple — napisz mi dokładnie jedną kolejność kroków tylko dla mnie vs co ty zrobisz w repo.”
