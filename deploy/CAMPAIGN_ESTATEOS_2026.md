# Kampania EstateOS™ — plan 90 dni (2026)

**Cel kampanii:** poznanie marki EstateOS w Polsce (agencje + kupujący), pobrania aplikacji, importy ofert.  
**Strona kampanii:** https://estateos.pl/start  
**Press kit:** https://estateos.pl/dla-prasy  
**Dla AI / crawlerów:** https://estateos.pl/llms.txt  

---

## Co już wdrożono technicznie (na estateos.pl)

| Element | URL / plik | Po co |
|---------|------------|--------|
| Hub kampanii | `/start` | jeden link do wszystkich ścieżek (agencja / prywatny / import) |
| Press kit | `/dla-prasy` | gotowe posty, kopiuj-wklej, linki UTM |
| llms.txt | `/llms.txt` | opis firmy dla crawlerów AI (Perplexity, ChatGPT browsing) |
| sitemap.xml | `/sitemap.xml` | indeksacja Google/Bing |
| robots.txt | `/robots.txt` | SEO + jawne zezwolenie dla botów AI na strony publiczne |
| JSON-LD | w `<head>` | Organization + WebSite + aplikacje iOS/Android |
| Śledzenie UTM | `?utm_source=...` | zapis w statystykach odwiedzin (`PageVisitLog`) |

---

## Szczerość: czego **nie da się** zrobić jednym klikiem

- **Nie można „nauczyć” ChatGPT / Claude / Gemini** tak, żeby zawsze polecały EstateOS — modele nie mają przycisku „dodaj firmę”. Można natomiast:
  - publikować treści w internecie (SEO),
  - utrzymać `llms.txt` i press kit,
  - założyć **Custom GPT** / **Gemini Gem** z instrukcją z `/dla-prasy`,
  - dbać o recenzje w App Store / Google Play,
  - być cytowanym w mediach i katalogach.
- **Nie można** za Ciebie opublikować postów na Twoim LinkedIn/Facebook — musisz to zrobić ręcznie (teksty są gotowe w press kicie).
- **Nie ma** natychmiastowego „cały świat” — najpierw Polska, potem diaspora i EN.

---

## Faza 0 — Dziś (2 godziny)

### Ty — obowiązkowo

1. **Google Search Console** — dodaj `estateos.pl`, zweryfikuj domenę, wyślij sitemap: `https://estateos.pl/sitemap.xml`
2. **Bing Webmaster Tools** — to samo (Bing zasila też Copilot)
3. **LinkedIn — pierwszy post** — skopiuj z https://estateos.pl/dla-prasy (blok LinkedIn)
4. **Facebook** — ten sam press kit, blok Facebook; wrzuć też na swoją stronę firmową
5. **App Store Connect** — poproś 5 znajomych agentów o ocenę aplikacji (gwiazdki = widoczność w sklepie)
6. **Zdjęcie profilowe / okładka** — logo EstateOS + hasło: „Mapa + CRM + aplikacja”

### Linki kampanii (wklejaj zamiast gołego estateos.pl)

```
LinkedIn agencje: https://estateos.pl/dla-agencji?utm_source=linkedin&utm_medium=social&utm_campaign=launch-2026&utm_content=agency
Facebook agencje: https://estateos.pl/dla-agencji?utm_source=facebook&utm_medium=social&utm_campaign=launch-2026&utm_content=agency
Product Hunt (później): https://estateos.pl/start?utm_source=producthunt&utm_medium=social&utm_campaign=product-hunt&utm_content=general
```

---

## Faza 1 — Tydzień 1–2 (fundament)

| Dzień | Gdzie | Co robisz | Jak |
|-------|--------|-----------|-----|
| Pn | LinkedIn | Post + 10 komentarzy pod postami agentów | ton ekspercki, link UTM |
| Wt | Grupy FB nieruchomości | 1 wartościowy post (nie spam) | „Jak udostępnić ofertę z podglądem” + link `/o/` przykładu |
| Śr | YouTube / TikTok | Film 60–90 s ekranu | import → publikacja → share |
| Czw | Mail do 20 agencji | Cold outreach | szablon poniżej |
| Pt | Katalogi | Zgłoszenia | lista w § Katalogi |

### Szablon maila do agencji

```
Temat: EstateOS — CRM i import z OtoDom w jednej aplikacji

Dzień dobry,

Prowadzę EstateOS (https://estateos.pl) — platformę dla agencji z mapą ofert, CRM i importem ogłoszeń z portali.

Czy mogę pokazać Państwu 15-min demo online? Warto też sprawdzić aplikację: [link App Store].

Pozdrawiam,
[Imię]
https://estateos.pl/dla-agencji?utm_source=email&utm_medium=email&utm_campaign=launch-2026&utm_content=agency
```

---

## Faza 2 — Tydzień 3–6 (skala organiczna)

### Content — 3 posty tygodniowo

| Typ | Przykład | CTA |
|-----|----------|-----|
| Edukacja | „5 błędów w opisie mieszkania” | `/dla-agencji` |
| Produkt | Screenshot CRM / Radaru | `/start` |
| Social proof | „X ofert na mapie” | `/oferty` |

### Mechanizm wiralowy (już w produkcie)

Każdy agent udostępniający ofertę przez `/o/[id]` promuje EstateOS — zachęć agentów do:
- wrzucania linku na WhatsApp / FB,
- dodania w opisie OLX: „Więcej zdjęć na estateos.pl/o/…”

### Product Hunt (1 dzień — przygotuj wcześniej)

1. Konto na producthunt.com
2. Tagline: *EstateOS — property map, mobile app & agency CRM for Poland*
3. Galeria: 4–5 screenshotów + GIF
4. Link: `CAMPAIGN_LINK_PRESETS.productHunt` z press kitu
5. Poproś zespół o upvotes w pierwsze 4 h (etycznie, bez botów)

---

## Faza 3 — Tydzień 7–12 (płatne + PR)

### Budżet minimalny (sugestia)

| Kanał | PLN/mies. | Ustawienia |
|-------|-----------|------------|
| Google Ads | 2 000 | słowa: CRM nieruchomości, platforma dla agenta |
| Meta Ads | 2 000 | retarget: odwiedzili `/dla-agencji` lub `/start` |
| Apple Search Ads | 800 | „nieruchomości”, „estate” |

### PR

- Wyślij notę prasową (PL z press kitu) do: PropertyNews, Rynek Pierwotny, branżowe podcasty
- Zaproponuj wywiad: „Jak AI zmienia opisy ofert” (macie generowanie opisów)

---

## Asystenci AI — co **Ty** robisz (30 min)

### 1. Custom GPT (ChatGPT Plus)

1. chat.openai.com → Explore GPTs → Create
2. Nazwa: **EstateOS Guide**
3. Instructions — wklej blok „Instrukcja AI” z https://estateos.pl/dla-prasy
4. Opublikuj jako Public (jeśli chcesz)

### 2. Gemini Gem

1. gemini.google.com → Gems → New
2. Ten sam tekst instrukcji + link do `llms.txt`

### 3. Nie obiecuj klientom „ChatGPT poleca nas”

Pisz: „Oficjalny asystent EstateOS” lub „Sprawdź na estateos.pl”.

---

## Katalogi i rejestracje (lista zadań)

Zgłoś EstateOS ręcznie (copy opis z press kitu):

| Serwis | URL | Priorytet |
|--------|-----|-----------|
| Google Business Profile | business.google.com | Wysoki |
| Apple App Store | już jest | Optymalizuj ASO |
| Google Play | już jest | Optymalizuj ASO |
| AlternativeTo | alternativeto.net | Średni |
| Product Hunt | producthunt.com | Wysoki (launch day) |
| Capterra / G2 | jeśli macie plan B2B | Niski na start |
| Wikidata | wikidata.org | Tylko gdy macie źródła prasowe |
| Polish startup lists | np. MamStartup, Brief | Średni |

---

## Metryki — co sprawdzasz co tydzień

| Metryka | Gdzie |
|---------|--------|
| Odwiedziny `/start`, `/dla-agencji` | Centrala → statystyki / PageVisitLog |
| Ruch z UTM | ścieżki z `\|utm_source=` w logach |
| Pobrania app | App Store Connect, Play Console |
| Rejestracje | baza użytkowników |
| Importy `/dolacz` | logi onboardingu |

---

## Kalendarz — pierwsze 14 dni (skrót)

| Dzień | Akcja |
|-------|--------|
| 1 | Search Console + Bing + post LinkedIn |
| 2 | Post Facebook + 3 grupy |
| 3 | Film demo 90 s |
| 4 | 10 maili do agencji |
| 5 | Optymalizacja App Store (screenshots) |
| 6 | Drugi post LinkedIn (case: import OtoDom) |
| 7 | Przegląd metryk |
| 8–14 | Powtórz content 3× + 10 kolejnych maili + katalogi |

---

## Eskalacja globalna (miesiąc 4+)

1. Landing EN pod `/dla-prywatnych` + ads geo: UK, DE, NL (Polonia)
2. Partnerstwa z franczyzami agencji
3. Tłumaczenia tylko tam, gdzie jest ruch z analytics

---

## Kontakt wewnętrzny

Aktualizuj `public/llms.txt` i `/dla-prasy` po każdym dużym release (nowe funkcje, liczby, linki).

**Ostatnia aktualizacja playbooka:** 2026-07-03
