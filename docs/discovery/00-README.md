# EstateOS™ Discovery™ — Pakiet dokumentacji produktu

**Status dokumentu:** COMPLETE · kanoniczny indeks pakietu  
**Wersja:** 1.0  
**Ostatnia aktualizacja:** 2026-07-25  
**Właściciel produktu:** Product Owner (EstateOS™ Discovery™)  
**Odbiorcy:** zespół implementacyjny, design, AI/ML, QA, Centrala / admin, stakeholderzy

---

## 1. Cel tego pakietu

Ten katalog (`docs/discovery/`) jest **jedynym źródłem prawdy produktowej** dla systemu **EstateOS™ Discovery™**.

Celem Discovery™ jest stać się **największą przewagą konkurencyjną EstateOS™**: doświadczeniem premium, które uczy się gustu użytkownika przez naturalne wybory — **nie** przez ankietę, formularz ani panel filtrów.

Pakiet dokumentacji ma być na tyle kompletny, aby **niezależny zespół programistów** mógł zaimplementować Discovery™ **wyłącznie na jego podstawie**, bez domyślania się intencji produktu.

> **Zasada nadrzędna:** jeśli coś nie jest zapisane w tym pakiecie, nie jest częścią produktu Discovery™.

---

## 2. Czym jest Discovery™ (skrót kanoniczny)

| Discovery™ **jest** | Discovery™ **nie jest** |
|---------------------|-------------------------|
| Doświadczeniem selekcji premium (gest → decyzja → uczenie) | Ankietą preferencji |
| Systemem uczenia gustu z zachowania | Formularzem „powiedz nam czego szukasz” |
| Silnikiem „dla Ciebie” opartym o sygnały | Panelem filtrów / zaawansowanego searcha |
| Profilowaniem smaku widocznym dla admina/agenta (dossier) | Zamiennikiem Live Radar |
| Częścią brandu EstateOS™ (rytuał, motion, cisza, pewność) | Klonem taniego Tinder-for-homes bez domeny RE |

Szczegóły: rozdziały w `01-vision/` (po ich zatwierdzeniu i napisaniu).

---

## 3. Relacja do istniejącego EstateOS™ (kontekst as-is)

Implementacja będzie lądować w ekosystemie, który **już istnieje**:

| Warstwa | Lokalizacja / gałąź | Uwaga dla zespołu |
|---------|---------------------|-------------------|
| Mobile | `apple-style-app` · `mobile-canonical-20260514` | Expo / RN; ekran stack `EstateDiscovery`; wejście z long-press plusa |
| API / WWW | `estateos-recovery-deploy` · `recovery-local-snapshot` | Next.js + Prisma/MySQL; m.in. `/api/mobile/v1/discovery/*` |
| Mirror API | `deploy/estateos-www-full/` | Sync plik-po-pliku wg playbooka deploy — **nie** merge gałęzi |

**Istniejący zalążek (fakt, nie spec docelowa):** zdarzenia Discovery, profil JSON, feed `for_you`, swipe UI, brief w Centrali.  
**Ten pakiet dokumentacji definiuje produkt docelowy.** Gdzie as-is i to-be się rozjeżdżają, **wygrywa dokumentacja w `docs/discovery/`** — o ile dany rozdział jest oznaczony jako COMPLETE i zaakceptowany.

Szczegóły dopasowania: `09-system-architecture/07-fit-with-estateos.md` (gdy powstanie).

---

## 4. Jak czytać ten pakiet (kolejność obowiązkowa)

Zespół implementacyjny **musi** czytać w tej kolejności przed pierwszym PR:

1. **Ten plik** (`00-README.md`) — mapa, reguły, definicje statusów.  
2. **`01-vision/`** — wizja, non-goals, metryki sukcesu, głos marki.  
3. **`02-users-and-jobs/`** + **`04-behavioural-science/`** — dla kogo i dlaczego zachowanie ma znaczenie.  
4. **`05-real-estate-domain/`** — co w nieruchomościach jest sygnałem, a co szumem.  
5. **`03-experience-ux/`** + **`10-ux-specs/`** — doświadczenie i specyfikacja interakcji.  
6. **`06-intelligence/`** + **`07-data-and-analytics/`** — uczenie, ranking, dane, prywatność.  
7. **`08-product-surfaces/`** — powierzchnie (mobile, admin, powiadomienia, styki).  
8. **`09-system-architecture/`** — granice domeny, przepływy, kontrakty koncepcyjne.  
9. **`11-quality-and-acceptance/`** — DoD, scenariusze akceptacji, anty-wzorce.  
10. **`12-glossary/`** — słownik i log decyzji.

**Zakaz:** implementacja „od API w górę” bez przeczytania wizji i non-goals.

---

## 5. Struktura katalogów (kanoniczna)

```text
docs/discovery/
├── 00-README.md                          ← ten plik (indeks)
├── 01-vision/
├── 02-users-and-jobs/
├── 03-experience-ux/
├── 04-behavioural-science/
├── 05-real-estate-domain/
├── 06-intelligence/
├── 07-data-and-analytics/
├── 08-product-surfaces/
├── 09-system-architecture/
├── 10-ux-specs/
├── 11-quality-and-acceptance/
└── 12-glossary/
```

Każdy podkatalog zawiera **osobne pliki Markdown = osobne rozdziały**.  
**Nie** łączymy rozdziałów w jeden monolityczny dokument.

### 5.1 Mapa rozdziałów (pliki planowane)

#### `01-vision/`
| Plik | Temat |
|------|--------|
| `01-product-vision.md` | Wizja produktu i przewaga konkurencyjna |
| `02-positioning-and-non-goals.md` | Pozycjonowanie; czym Discovery nie jest |
| `03-competitive-landscape.md` | Kontekst rynkowy (orientacyjny) |
| `04-success-metrics.md` | KPI biznesowe i produktowe |
| `05-brand-voice-discovery.md` | Ton i język marki Discovery™ |

#### `02-users-and-jobs/`
| Plik | Temat |
|------|--------|
| `01-personas.md` | Persony |
| `02-jobs-to-be-done.md` | Jobs-to-be-done |
| `03-emotional-journey.md` | Podróż emocjonalna |
| `04-trust-and-consent.md` | Zaufanie, zgoda, kontrola |
| `05-home-vs-car-scope.md` | Zakres Home vs Car |

#### `03-experience-ux/`
| Plik | Temat |
|------|--------|
| `01-experience-principles.md` | Zasady doświadczenia premium |
| `02-entry-and-ritual.md` | Wejście i rytuał otwarcia |
| `03-core-loop-swipe.md` | Pętla główna gestów |
| `04-signals-without-forms.md` | Sygnały bez formularzy |
| `05-feedback-and-delight.md` | Feedback sensoryczny i delight |
| `06-session-arc.md` | Łuk sesji |
| `07-empty-and-edge-states.md` | Stany puste i brzegowe |
| `08-accessibility-and-safety.md` | Dostępność i bezpieczeństwo behawioralne |
| `09-visual-motion-language.md` | Język wizualny i motion |

#### `04-behavioural-science/`
| Plik | Temat |
|------|--------|
| `01-preference-elicitation.md` | Elicytacja preferencji przez wybór |
| `02-cognitive-load.md` | Obciążenie poznawcze |
| `03-habit-and-retention.md` | Nawyk i retencja |
| `04-bias-and-fairness.md` | Bias i fairness |
| `05-dislike-reasons-ethics.md` | Etyka powodów odrzucenia |

#### `05-real-estate-domain/`
| Plik | Temat |
|------|--------|
| `01-decision-dimensions.md` | Wymiary decyzji o nieruchomości |
| `02-implicit-signals-map.md` | Mapa sygnałów ukrytych |
| `03-transaction-contexts.md` | Sprzedaż / wynajem / inwestycja |
| `04-agent-and-fast-track.md` | Agent i fast-track |
| `05-market-constraints.md` | Ograniczenia rynku i danych |

#### `06-intelligence/`
| Plik | Temat |
|------|--------|
| `01-learning-philosophy.md` | Filozofia uczenia |
| `02-signal-taxonomy.md` | Taksonomia sygnałów |
| `03-profile-model.md` | Model profilu gustu (konceptualny) |
| `04-ranking-and-for-you.md` | Ranking „dla Ciebie” |
| `05-cold-start.md` | Cold start |
| `06-exploration-vs-exploitation.md` | Eksploracja vs eksploatacja |
| `07-ml-system-design.md` | Projekt systemu ML |
| `08-offline-online-learning.md` | Uczenie online vs batch |
| `09-explainability.md` | Wyjaśnialność |

#### `07-data-and-analytics/`
| Plik | Temat |
|------|--------|
| `01-event-schema.md` | Schemat zdarzeń (konceptualny) |
| `02-privacy-and-retention.md` | Prywatność i retencja |
| `03-experimentation.md` | Eksperymenty |
| `04-quality-metrics.md` | Metryki jakości |
| `05-admin-taste-dossier.md` | Dossier gustu (admin / agent) |

#### `08-product-surfaces/`
| Plik | Temat |
|------|--------|
| `01-mobile-discovery.md` | Powierzchnia mobile |
| `02-admin-centrala.md` | Centrala |
| `03-agent-crm-touchpoints.md` | Styki CRM / agent |
| `04-notifications-philosophy.md` | Filozofia powiadomień Discovery |
| `05-cross-feature-relations.md` | Relacje z Radar, Live, Favorites, Dealroom |

#### `09-system-architecture/`
| Plik | Temat |
|------|--------|
| `01-domain-boundaries.md` | Granice domeny |
| `02-logical-components.md` | Komponenty logiczne |
| `03-data-flow.md` | Przepływ danych |
| `04-api-surface-conceptual.md` | Powierzchnia API (koncepcja) |
| `05-persistence-conceptual.md` | Trwałość (koncepcja) |
| `06-security-and-auth.md` | Bezpieczeństwo i auth |
| `07-fit-with-estateos.md` | Dopasowanie do EstateOS |

#### `10-ux-specs/`
| Plik | Temat |
|------|--------|
| `01-information-architecture.md` | Architektura informacji |
| `02-card-anatomy.md` | Anatomia karty |
| `03-gesture-spec.md` | Specyfikacja gestów |
| `04-copy-and-microcopy.md` | Mikrocopy |
| `05-haptics-and-sound.md` | Haptyka i dźwięk |
| `06-flows.md` | Flowy użytkownika |

#### `11-quality-and-acceptance/`
| Plik | Temat |
|------|--------|
| `01-definition-of-done.md` | Definition of Done |
| `02-acceptance-scenarios.md` | Scenariusze akceptacji |
| `03-anti-patterns-checklist.md` | Checklista anty-wzorców |
| `04-launch-phases.md` | Fazy uruchomienia produktu |

#### `12-glossary/`
| Plik | Temat |
|------|--------|
| `01-glossary.md` | Słownik pojęć |
| `02-decision-log.md` | Log decyzji produktowych |

---

## 6. Proces tworzenia dokumentacji (obowiązujący)

1. Dokumenty powstają **jeden po drugim**.  
2. Każdy dokument musi być **kompletny** i **produkcyjnej jakości** przed oddaniem.  
3. Po oddaniu dokumentu zespół dokumentacyjny **zatrzymuje się** i czeka na **akceptację Product Ownera (użytkownika zlecającego)**.  
4. **Zakaz** samodzielnego przejścia do kolejnego pliku bez akceptacji.  
5. **Zakaz** pisania kodu aplikacji w ramach tej fazy — wyłącznie dokumentacja w `docs/discovery/`.  
6. Zmiana zaakceptowanego dokumentu wymaga **nowej wersji** w nagłówku pliku + wpisu w `12-glossary/02-decision-log.md`.

### 6.1 Statusy dokumentu (nagłówek każdego pliku)

Każdy plik Markdown w tym pakiecie **musi** zaczynać się od bloku:

```markdown
# <Tytuł>
**Status dokumentu:** DRAFT | REVIEW | COMPLETE | SUPERSEDED  
**Wersja:** X.Y  
**Ostatnia aktualizacja:** YYYY-MM-DD  
**Właściciel merytoryczny:** <rola>  
**Zależności:** <lista plików w docs/discovery/, które trzeba znać wcześniej>
```

| Status | Znaczenie |
|--------|-----------|
| `DRAFT` | W trakcie pisania — **nie** używać do implementacji |
| `REVIEW` | Oddany do akceptacji — czekamy na decyzję |
| `COMPLETE` | Zaakceptowany — **wolno** traktować jako wymaganie |
| `SUPERSEDED` | Zastąpiony nowszą wersją / innym plikiem — nie implementować |

**Reguła dla inżynierów:** implementować wyłącznie wymagania ze statusem `COMPLETE`.

---

## 7. Konwencje pisania (jakość produkcyjna)

Każdy rozdział musi:

1. **Mieć jednoznaczne wymagania** — tam gdzie coś jest obowiązkowe, używać języka: *MUST / SHOULD / MAY* (RFC 2119 w tłumaczeniu: **musi / powinien / może**).  
2. **Być implementowalny** — unikać ogólników typu „ładnie”, „inteligentnie”, „premium” bez operacyjnej definicji w tym samym dokumencie lub odwołaniu do COMPLETE rozdziału.  
3. **Oddzielać warstwy:**
   - *Produkt / UX / zachowanie* — co użytkownik czuje i robi  
   - *Inteligencja / dane* — czego system się uczy  
   - *Architektura* — jak to siedzi w systemie (bez kodu źródłowego aplikacji)  
4. **Zawierać kryteria akceptacji** albo wyraźne odesłanie do `11-quality-and-acceptance/`.  
5. **Nie zawierać** kodu aplikacji (TypeScript/Swift/SQL produkcyjny). Dozwolone: diagramy tekstowe, tabele, przykłady payloadów **koncepcyjnych**, pseudo-kontrakty.  
6. **Używać nazwy** `Discovery™` / `EstateOS™ Discovery™` konsekwentnie; unikać synonimów typu „Tinder mieszkań”, „swipe feed” w copy użytkownika (w dokumentacji wewnętrznej wolno w nawiasie wyjaśniającym).  
7. **Język dokumentów:** polski (kanoniczny). Terminy angielskie tylko gdy są nazwami technicznymi lub brandowymi ustalonymi w glossary.

---

## 8. Role zespołu dokumentacyjnego (głosy)

| Rola | Głos wiodący w |
|------|----------------|
| Product Owner | wizja, zakres, priorytety, akceptacja |
| UX Designer Apple | doświadczenie, rytuał, motion, anatomia karty |
| Behavioural Psychologist | elicytacja, obciążenie poznawcze, etyka |
| Real Estate Expert | wymiary decyzji, realizm rynku |
| Data Scientist | zdarzenia, metryki, eksperymenty, prywatność danych |
| Machine Learning Engineer | ranking, cold start, explor/exploit, ewaluacja modeli |
| Senior AI Architect | filozofia uczenia, wyjaśnialność, spójność intelligence |
| Senior Software Architect | granice domeny, przepływy, API/persistence koncepcyjne, fit EstateOS |

Konflikty między głosami rozstrzyga **Product Owner** wpisem w decision log.

---

## 9. Rejestr akceptacji (ten plik)

| Pole | Wartość |
|------|---------|
| Dokument | `docs/discovery/00-README.md` |
| Status przed akceptacją | `REVIEW` |
| Następny dokument po akceptacji | `01-vision/01-product-vision.md` |

Po Twojej akceptacji status tego pliku należy uznać za **`COMPLETE`** (w kolejnym przebiegu dokumentacyjnym zaktualizujemy nagłówek na COMPLETE).

---

## 10. Stop

**Ten dokument jest oddany do akceptacji.**

Nie powstaje żaden kolejny plik w `docs/discovery/` do czasu Twojej decyzji:

- **Akceptuję** → status COMPLETE + przechodzimy do `01-vision/01-product-vision.md`  
- **Poprawki** → wskaż zmiany w tym README; poprawiamy tylko ten dokument  
- **Odrzucam strukturę mapy** → korygujemy §5 przed wizją produktu

**Koniec dokumentu `00-README.md`.**
