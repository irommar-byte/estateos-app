# EstateOS - Security, Privacy and Compliance Checklist

Dokument laczy wymagania techniczne i App Store compliance dla produkcyjnego wydania.

## 1. Account and Auth security

- [ ] Wszystkie endpointy mobilne wymagaja poprawnego JWT tam, gdzie to konieczne.
- [ ] Brak logowania sekretow/tokenow w logach produkcyjnych.
- [ ] Session restore nie tworzy niespójnego stanu (user bez tokenu lub odwrotnie).
- [ ] Logout i delete account czyszcza lokalne dane sesyjne.

## 2. Account deletion (App Store 5.1.1)

- [ ] Uzytkownik moze usunac konto bez kontaktu z supportem.
- [ ] Usuniecie konta wymaga potwierdzenia (haslo) i dziala end-to-end.
- [ ] Po usunieciu konto jest wylogowane i lokalne artefakty sa usuniete.
- [ ] W App Store Connect jest opisane jak usunac konto.

## 3. Payments compliance (App Store 3.1)

- [ ] iOS: cyfrowe korzysci in-app korzystaja z IAP, gdzie wymagane.
- [ ] Brak niedozwolonego "steering" do zewnetrznych platnosci w flow iOS dla tych samych korzysci.
- [ ] Pakiet Plus IAP ma zgodny product ID i backendowe potwierdzenie zakupu.
- [ ] Komunikaty "PRO wkrotce" nie obiecuja niedostepnego flow checkoutu in-app.

## 4. Privacy and permissions

- [ ] `NS*UsageDescription` sa konkretne, zrozumiale i zgodne z realnym uzyciem.
- [ ] Privacy Policy URL jest aktualny i publiczny.
- [ ] App Privacy w App Store Connect jest zgodne z praktyka zbierania danych.
- [ ] Powiadomienia push maja jasny cel i nie sa wysylane bez zgody.

## 5. Data handling

- [ ] Dane wrazliwe nie sa przechowywane lokalnie bez potrzeby.
- [ ] Dane uzytkownika sa czyszczone po wylogowaniu/usunieciu konta.
- [ ] Transfer danych odbywa sie po HTTPS.
- [ ] Walidacja payloadow backend<->mobile jest stabilna.

## 6. Security testing before release

- [ ] Test blednych tokenow i wygaslej sesji.
- [ ] Test niezaufanych payloadow (braki pol, bledne typy) bez crashy.
- [ ] Test rate limit i czytelnych komunikatow bledu dla usera.
- [ ] Test restartu aplikacji po utracie polaczenia.

## 7. Compliance sign-off

Przed releasem potrzebne sa 3 podpisy:

- Mobile Owner
- Backend Owner
- Release/Compliance Owner

Brak podpisu dla dowolnego obszaru blokuje production release.
