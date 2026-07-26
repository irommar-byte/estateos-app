# EstateOS™ Discovery™ — Kompletny UX Design (ekrany · motion · kontrolki · przejścia)

**Status dokumentu:** REVIEW  
**Wersja:** 1.0  
**Ostatnia aktualizacja:** 2026-07-25  
**Właściciel merytoryczny:** UX Designer Apple · Behavioural Psychologist · Product Owner · Motion Lead (rola projektowa)  
**Zależności:** `03-screen-flow.md`, `01-experience-principles.md`, `02-user-journey.md`, `01-vision/04-user-emotions.md`, `03-product-principles.md`  
**Klasyfikacja:** pełny projekt doświadczenia · **nie kod** · nie makiety Figma-binarne · specyfikacja UX VisionOS-grade  
**Zakaz:** implementacja, API, SQL, konkretne biblioteki animacji

---

## 0. Obietnica designu

Discovery™ ma czuć się jak **przestrzeń przestrzenna decyzji** — bliżej VisionOS / Dynamic Island / Apple glass niż „ekran listy z przyciskami”.

| Filary | Znaczenie w UX |
|--------|----------------|
| Glass | Warstwy półprzezroczyste służą hierarchii, nie dekoracji |
| Spatial depth | Karta miejsca = obiekt w przestrzeni; chrome = orbita |
| Motion with meaning | Ruch = skutek intencji, nie showreel |
| Dynamic Island grammar | Status sesji / undo / trop = żywy, zwarty „island” sygnał |
| Zero forms | Żadnych pól „preferencje”; tylko wybór wobec miejsca |
| Psychologia first | Każdy ekran ma uzasadnienie emocjonalne |

**Paleta emocjonalna (nie hex-spec implementacyjna):** głęboka czerń / grafit przestrzeni · kość słoniowa tekstu · złoto EstateOS jako rzadki akcent rezonansu · szkło biało-czarne zależnie od motywu · zero neonów, zero confetti.

---

## 1. System designu (wspólny dla wszystkich ekranów)

### 1.1 Warstwy przestrzenne (zawsze)

```text
[L0] Atmosphere          — miękkie tło / głębia (nie flat #000 panel)
[L1] Place Object        — karta miejsca / media (dominant)
[L2] Glass Orbit         — kontrolki, island, napisy na szkle
[L3] Ephemeral Signals   — undo island, coach, soft toasts
[L4] Modal Care          — insight, bridge consent, crisis (rzadko)
```

### 1.2 Dynamic Island — Discovery Session Island (DSI)

Stały, żywy element sesji (góra, zwarty, jak Island):

| Stan Island | Zawartość | Psychologia |
|-------------|-----------|-------------|
| Idle sesji | „Discovery™” + mikro kropka aktywności | Tożsamość rytuału, spokój |
| Po decyzji | Krótki glyph tak/nie/pilniej → shrink | Potwierdzenie bez hałasu |
| Undo window | „Cofnij” w Island (tap) | Godność pomyłki |
| Trop zapisany | Mini impuls „Zapisano” | Ulga |
| Insight dostępny | Delikatny shimmer → tap „Dlaczego” | Zaufanie na żądanie |
| Pauza | Island zwija się do „Do zobaczenia” | Domknięcie |

**Zakaz Island:** score %, countdown FOMO, streak, „AI thinking…”.

### 1.3 Słownik motion (globalny)

| Token ruchu | Czas odczuwany | Użycie |
|-------------|----------------|--------|
| `breathe` | ~280–360 ms | Wejście karty, island expand |
| `commit` | ~320–420 ms | Karta odjeżdża po decyzji |
| `spatial-push` | ~400–520 ms | Wejście w Depth / Bridge |
| `glass-settle` | ~200–280 ms | Ustawienie się warstwy szkła |
| `honor` | ~500–700 ms | Dream Found (raz, powściągliwie) |
| `snap-back` | spring krótki | Nieosiągnięty próg gestu |

Krzywe: zawsze **ease-out / smooth decelerate**; unikaj bounce komediowego.

### 1.4 Haptyka (język)

| Zdarzenie | Odczucie |
|-----------|----------|
| Próg intencji (prawie decyzja) | Lekki selection |
| LIKE commit | Soft success |
| DISLIKE commit | Soft warning (nie „error alarm”) |
| PRIORITY confirm | Wyraźniejszy impact |
| Undo | Lekki „reverso” |
| Dream Found | Jeden głęboki, rzadki impuls |

### 1.5 Przyciski — kanon form

Discovery unika „formularzowych” primary CTA ścianek. Kontrolki to:

- **Orb glass buttons** (okrągłe/zaokrąglone na szkle)  
- **Island actions** (tekst w Island)  
- **Ghost text actions** (Anuluj, Pomiń)  
- **Spatial confirm chips** (krótkie powody dislike — nie input fields)

**Zakaz:** pola tekstowe preferencji, checkbox listy dzielnic, suwaki „budżet od–do” jako serce UX.

---

## 2. Ekran po ekranie

Dla każdego: cel UX · psychologia · layout logiczny · kontrolki · animacje · przejścia · stany · błędy UX.

---

### S-00 — App Shell (kontekst)

**Psychologia:** Obniżyć lęk „kolejna apka-portal”; nie sprzedawać Discovery krzykiem.  
**Layout logiczny:** Tab EstateOS · centralny plus z rytuałem entry.  
**Kontrolki:** Long-press plus → orbity: Discovery / Vertical / Live (zgodnie z produktem).  
**Motion:** Plus ekspanduje orbitalnie (`breathe` + stagger orbit).  
**Przejście do Discovery:** Wybór orbity Discovery → morph do `S-01`.  
**Błąd UX:** pięć równorzędnych krzykliwych CTA — napraw: jedna jasna ścieżka odkrywania.

---

### S-01 — Entry Ritual Gate

**Psychologia:** Etap J1 — sceptycyzm vs nadzieja; sygnał „wolno nie wiedzieć”.  
**Layout:** Pełna przestrzeń · w centrum szklany „portal” · krótka obietnica · zero pól.  
**Kontrolki:**  
- Primary orb: **Wejdź**  
- Ghost: **Nie teraz**  
- Micro: „Czym jest Discovery?” (rozwija 2–3 linie, nie wizard)  
**Animacje wejścia:** Atmosphere dim · glass portal scale-from-island · złoty hairline raz.  
**Wyjście Wejdź:** Portal otwiera się przestrzennie (`spatial-push`) → `S-02`.  
**Wyjście Nie teraz:** Portal zwija się do plusa → `S-00`.  
**Psychologiczny zakaz:** „Uzupełnij preferencje, aby wejść”.

---

### S-02 — Session Home (karta wiodąca)

**Psychologia:** Serce Discovery — sprawczość, flow, spotkanie z miejscem.  
**Layout:**  
- L1: Place Object (media dominant, lekko „unoszące się”)  
- L2: dolny glass rail faktów ludzkich (cena / lokalizacja soft / 1–2 sygnały) — **nie tabela**  
- DSI u góry  
- Orbity decyzji: lewo / prawo / góra (lub ekwiwalent orb buttonów dla a11y)  

**Kontrolki (musi być równoważność gest + button):**  
| Kontrola | Intencja |  
|----------|----------|  
| Gest prawo / orb ♡ | LIKE |  
| Gest lewo / orb ✕ | DISLIKE |  
| Gest góra / orb ⚡ | PRIORITY |  
| Tap media strefy | Galeria |  
| Chevron / „Więcej” | Depth |  
| Island „Dlaczego” | Insight (gdy dostępne) |  
| Close / pauza | Pause |  

**Animacje:**  
- Wejście karty: `breathe` z lekkim parallaxem głębi  
- Drag: karta rotuje mikrokątowo; glyph tak/nie fades-in po progu  
- Commit: `commit` w kierunku intencji + Island pulse  
- Następna karta: scale-up z L0 (`glass-settle`)  

**Przejścia:** patrz Screen Flow; po commit zawsze szansa `S-08` w Island.  
**Stany:** loading skeleton glass (krótki) · empty → `S-09` · error → `S-10`.  
**Psychologiczny zakaz:** score % na karcie na stałe; chipy filtrów; countdown.

---

### S-03 — Smart Gallery

**Psychologia:** Rezonans przez obraz; uważność, nie doom-scroll.  
**Layout:** Place Object pełniej · dots / counter w Island mini · strefy lewo/prawo.  
**Kontrolki:** Tap L/R · swipe photo · Close (chevron down / pinch logiczny) · orby decyzji dostępne lub „decyzja po powrocie” (kanon: decyzja możliwa, ale nie obowiązkowa).  
**Animacje:** Crossfade/spatial slide kadrów ~220 ms · bez autoplay karuzeli.  
**Przejście zamknięcia:** zdjęcie „siada” z powrotem w kartę (`spatial-push` reverse).  
**Zakaz:** infinite meme-scroll; TikTok velocity.

---

### S-04 — Place Depth

**Psychologia:** Progressive disclosure — fakty po ciekawości, nie przed emocją.  
**Layout:** Karta unosi się / przechodzi w panel przestrzenny; media nadal obecne; fakty w glass sheets stacked.  
**Kontrolki:**  
- Wróć  
- Galeria  
- Zapisz  
- Pilniej  
- Most (Rozmowa) — secondary  
**Animacje:** `spatial-push` · sheets settle sekwencyjnie (max 2–3, nie 12).  
**Zakaz:** Excel parametrów; formularz zapytań.

---

### S-05 — Soft Affirmation / Save

**Psychologia:** Ulga „nie stracę” bez presji.  
**Layout:** Dolny glass sheet nad sesją (sesja widoczna w tle przyciemniona).  
**Kontrolki:**  
- **Zapisz trop** (primary orb)  
- **Dalej odkrywaj** (ghost)  
- **Cofnij** (text)  
**Animacje:** Sheet rises `glass-settle` · Island „Zapisano” przy zapisie.  
**Zakaz:** „Dodaj notatkę obowiązkową”; lead form.

---

### S-06 — Dislike Reason (rzadki)

**Psychologia:** Sygnał bez przesłuchania.  
**Layout:** Krótki glass strip z 3–5 chipami powodów + **Pomiń**.  
**Kontrolki:** Chip powód · Pomiń · (brak klawiatury).  
**Animacje:** Strip in from bottom; wybór → soft check → dismiss.  
**Warunek pokazania:** nie częściej niż polityka rzadkości; zawsze pomijalne.  
**Zakaz:** „Napisz dlaczego” textarea.

---

### S-07 — Priority Confirm

**Psychologia:** Chronić most do człowieka przed przypadkiem.  
**Layout:** Central glass confirm card; miniatura miejsca; dwa jasne wybory.  
**Kontrolki:**  
- **Potwierdź pilność**  
- **Zapisz i kontynuuj**  
- **Rozmowa teraz**  
- **Anuluj**  
**Animacje:** Island expands to confirm · haptyka impact.  
**Zakaz:** Auto-dial; „Agent już dzwoni”.

---

### S-08 — Undo (Island)

**Psychologia:** Godność pomyłki (J3).  
**Layout:** Tylko DSI w trybie undo — nie fullscreen modal.  
**Kontrolki:** Tap **Cofnij** w Island.  
**Animacje:** Island morph szerokości; timeout shrink; undo → karta `snap-back` na wierzch.  
**Zakaz:** Dialog „Czy na pewno cofnąć?” z dwoma formularzowymi buttonami.

---

### S-09 — End of Deck

**Psychologia:** Sukces klarowności, nie porażka feedu.  
**Layout:** Atmosphere + szklana „cisza” · krótkie podsumowanie tropu · 3 orby.  
**Kontrolki:**  
- **Poszerz kierunek**  
- **Zmień kierunek**  
- **Zapisane tropy**  
- **Zakończ na dziś**  
**Animacje:** Ostatnia karta dissolves do przestrzeni; honor short.  
**Zakaz:** „Dokładamy 500 losowych”; FOMO.

---

### S-10 — Offline / Error

**Psychologia:** Brak winy użytkownika; sprawczość.  
**Layout:** Glass status card; ikona spokojna; retry orb.  
**Kontrolki:** **Spróbuj ponownie** · **Wyjdź** · (opcjonalnie) **Działaj offline** jeśli kolejka.  
**Animacje:** Lekki pulse retry; zero alarm red fullscreen.  
**Zakaz:** Stack trace; „Błąd 500”.

---

### S-11 — Why / Insight

**Psychologia:** Zaufanie przez wyjaśnialność na żądanie.  
**Layout:** Island expands → glass insight bubble pod Island lub floating.  
**Kontrolki:** Zamknij · **To nie ja** · **Mniej takich**.  
**Animacje:** Expand island `breathe`; tekst fade.  
**Copy:** jedno zdanie ludzkie.  
**Zakaz:** wykresy modelu; „confidence 0.91”.

---

### S-12 — Correct Direction

**Psychologia:** Kontrola bez ankiety.  
**Layout:** Lista wniosków jako **glass toggles** „zachowaj / odrzuć wniosek” — nie formularz adresowy.  
**Kontrolki:** Toggle wniosków · **Ucz się od teraz** · **Zastosuj** · Anuluj.  
**Animacje:** Toggles settle; po Apply — spatial refresh talii.  
**Zakaz:** 20 pól nowej preferencji.

---

### S-13 — Pause / Closing

**Psychologia:** Domknięcie sesji = sukces.  
**Layout:** Dim atmosphere · krótkie „Na dziś wystarczy” · Island zwija się.  
**Kontrolki:** **Zakończ** · **Wznów** · **Tropy**.  
**Animacje:** Cards retreat into depth; island to pill.  
**Zakaz:** „Jeszcze jedno!”; streak.

---

### S-14 — Resume

**Psychologia:** Ciągłość vs świeżość po przerwie.  
**Layout:** Trzy spatial choices jako glass cards.  
**Kontrolki:**  
- **Kontynuuj trop**  
- **Sprawdź, co się przesunęło**  
- **Zacznij lekko od nowa**  
**Animacje:** Cards fan-in; wybór → morph do sesji.  
**Zakaz:** pełny re-tutorial; FOMO „straciłeś 40 ofert”.

---

### S-15 — Life Shift

**Psychologia:** Życie się zmienia — wolno zmienić kurs bez wstydu.  
**Layout:** Opcjonalne **hipotezy-chip** (Sprzedaż/Wynajem/Inny budżet emocjonalny/Inna lokalizacja soft) + primary **„Ucz się z kolejnych wyborów”**. Wszystko pomijalne.  
**Kontrolki:** Chips opcjonalne · Primary orb nauka z wyborów · Zastosuj · Anuluj.  
**Animacje:** Soft recalibration ripple (nie wipe tożsamości).  
**Zakaz:** wizard 8 kroków.

---

### S-16 — Contradiction Care

**Psychologia:** Dolina emocji — spowolnienie, język napięcia.  
**Layout:** Spokojniejsza atmosfera (mniej parallaxu) · glass care card z hipotezą napięcia.  
**Kontrolki:** **Kontynuuj wolniej** · **Skoryguj** · **Porozmawiaj** · **Pauza**.  
**Animacje:** Tempo globalne → slow; motion damping.  
**Copy:** „Widzę napięcie między X a Y — to częste.”  
**Zakaz:** „Jesteś niespójny”.

---

### S-17 — Human Bridge Consent

**Psychologia:** Most bez utraty kontroli.  
**Layout:** Preview digest na szkle · scope chips (np. reakcje / zapisane / bez historii) · confirm.  
**Kontrolki:** Scope chips · **Udostępnij i przejdź** · Podgląd · Anuluj.  
**Animacje:** `spatial-push` do mostu; Island „Kontekst gotowy”.  
**Zakaz:** ukryte full share; score „domykaj”.

---

### S-18 — Auth Gate

**Psychologia:** Continuity > friction; nigdy ściana przed Discovery.  
**Layout:** Glass auth sheet **nad** zachowanym kontekstem Discovery.  
**Kontrolki:** metody logowania EstateOS · Anuluj · (jeśli wolno) Kontynuuj lokalnie.  
**Animacje:** Sheet over ritual; po sukcesie merge soft check.  
**Zakaz:** kasowanie lokalnych sygnałów bez merge.

---

### S-19 — Visit Feedback

**Psychologia:** Prawda terenu > gest.  
**Layout:** Miniatura miejsca · trzy orby emocji terenu.  
**Kontrolki:** **Zagrało** · **Nie zagrało** · **Inaczej** (+ opcjonalne 2–3 chipy) · Pomiń.  
**Animacje:** Soft confirm; powrót do przestrzeni sesji.  
**Zakaz:** „Dlaczego napisz esej”.

---

### S-20 — Saved Tropes

**Psychologia:** Ulga posiadania tropów; baza powrotu.  
**Layout:** Spatial stack / rail szklanych miniatur (nie excel lista).  
**Kontrolki na elemencie:** Otwórz · Priorytet · Usuń · Wizyta · Most.  
**Animacje:** Stack parallax; select → expand to Depth.  
**Zakaz:** sortowanie 12 kolumnami; bulk CRM.

---

### S-21 — Coach (ephemeral)

**Psychologia:** Nauka przez użycie.  
**Layout:** Jedna linia pod Island lub na karcie.  
**Kontrolki:** brak obowiązkowych; auto-dismiss.  
**Animacje:** Fade; never block.  
**Zakaz:** 10 slajdów.

---

### S-22 — Serious Trope Hub

**Psychologia:** Mobilizacja bez paniki.  
**Layout:** Jedno miejsce jako bohater przestrzeni; secondary actions na szkle.  
**Kontrolki:** **Domknij z człowiekiem** · **Wizyta / feedback** · **Odrzuć po namyśle** · **Wróć do odkrywania**.  
**Animacje:** Wolniejsze `honor`-lite; mniej orbitującego chrome.  
**Zakaz:** countdown; „inni patrzą”.

---

### S-23 — Dream Found

**Psychologia:** Cisza sukcesu; sprawczość.  
**Layout:** Atmosphere prawie pusta · miejsce w centrum · jedno zdanie.  
**Kontrolki:** **To jest to** · **Jeszcze nie** · **Domknij poszukiwanie**.  
**Animacje:** Jedyny moment `honor` (0.5–0.7s) · potem cisza. Haptyka jeden impuls.  
**Zakaz:** fajerwerki; „WYGRANA”; od razu cross-sell.

---

### S-24 — Epilogue

**Psychologia:** Relacja kończy się z klasą.  
**Layout:** Minimal glass · prywatność · wyjście do EstateOS.  
**Kontrolki:** **Zakończ fazę** · **Dane gustu** · **Wróć do aplikacji**.  
**Animacje:** Island dissolves; atmosfera wraca do shell.  
**Zakaz:** „Tęsknimy za swipe’ami”.

---

## 3. Matryca przycisków (kanoniczna nazwa → intencja)

| Przycisk / kontrolka | Ekrany | Intencja użytkownika |
|----------------------|--------|----------------------|
| Wejdź | S-01 | Start rytuału |
| Nie teraz | S-01 | Odmowa bez kary |
| LIKE orb / gest | S-02/03/04 | Afirmacja |
| DISLIKE orb / gest | S-02/03/04 | Odrzucenie |
| PRIORITY orb / gest | S-02/04 | Pilność |
| Więcej / Depth | S-02 | Progressive disclosure |
| Zamknij galerię | S-03 | Powrót |
| Zapisz trop | S-05/04 | Bezpieczeństwo tropu |
| Dalej odkrywaj | S-05 | Flow |
| Cofnij | S-05/08 | Godność błędu |
| Pomiń powód | S-06 | Anti-przesłuchanie |
| Chip powodu | S-06 | Sygnał opcjonalny |
| Potwierdź pilność | S-07 | Świadomy most |
| Rozmowa teraz | S-07/22 | Bridge |
| Anuluj | wiele | Bezpieczeństwo |
| Poszerz kierunek | S-09 | Eksploracja |
| Zmień kierunek | S-09/15 | Life shift |
| Zakończ na dziś | S-09/13 | Pauza |
| Spróbuj ponownie | S-10 | Sprawczość |
| To nie ja | S-11/12 | Korekta zaufania |
| Zastosuj korektę | S-12 | Kontrola profilu |
| Kontynuuj trop | S-14 | Ciągłość |
| Ucz się z wyborów | S-15 | Zmiana bez formularza |
| Kontynuuj wolniej | S-16 | Opieka kryzysu |
| Udostępnij kontekst | S-17 | Zgoda |
| Zagrało / Nie / Inaczej | S-19 | Prawda terenu |
| To jest to | S-23 | Domknięcie emocjonalne |
| Zakończ fazę | S-24 | Epilog |

---

## 4. Matryca animacji przejść (ekran A → B)

| Przejście | Motion | Sens psychologiczny |
|-----------|--------|---------------------|
| S-00 → S-01 | Orbital morph z plusa | Wejście w inną jakość |
| S-01 → S-02 | Portal open spatial | Pozwolenie na niewiedzę → spotkanie |
| S-02 → S-03 | Place expands | Uważność |
| S-03 → S-02 | Place settles | Powrót do decyzji |
| S-02 → S-04 | Spatial push | Głębia na życzenie |
| S-02 → commit | Directional commit | Sprawczość |
| Commit → S-08 | Island undo expand | Bezpieczeństwo |
| S-02 → S-09 | Dissolve to calm | Klarowność > feed |
| S-02 → S-10 | Soft replace | Brak winy |
| S-02 → S-11 | Island expand | Zaufanie |
| S-11 → S-12 | Sheet care | Kontrola |
| S-02 → S-13 | Retreat to depth | Pauza = OK |
| S-00 → S-14 | Fan of three | Ciągłość po przerwie |
| S-14/09 → S-15 | Recalibration ripple | Życie się zmienia |
| S-02 → S-16 | Dampen motion | Kryzys |
| * → S-17 | Spatial push + consent | Most z godnością |
| S-17 → S-18 | Sheet over context | Continuity auth |
| * → S-19 | Soft modal | Prawda terenu |
| * → S-20 | Stack rise | Ulga tropów |
| S-20 → S-22 | Hero focus | Powaga |
| S-22 → S-23 | Honor | Cisza sukcesu |
| S-23 → S-24 | Island dissolve | Domknięcie relacji |

---

## 5. Flow UX „VisionOS storyboard” (całość)

```text
[Shell]──long-press──▶[Entry Portal]
                         │ Wejdź
                         ▼
              ┌────[Session Island + Card]────┐
              │         ▲     │               │
         Gallery/Depth  │     │ decisions     │
              │         │     ▼               │
              │    Undo Island / Save / Reason / Priority
              │         │
              ├─ empty ─▶ End Deck ─▶ Shift / Pause / Tropes
              ├─ error ─▶ Recovery
              ├─ why ───▶ Insight ─▶ Correct
              ├─ crisis ▶ Care
              └─ pause ─▶ Closing ─▶ Shell
                              │
                         Resume Fan
                              │
                         Tropes Rail ◀──▶ Visit Feedback
                              │
                         Serious Hub ──▶ Bridge Consent ──▶ Auth?
                              │
                         Dream Honor ──▶ Epilogue ──▶ Shell
```

---

## 6. Stany Dynamic Island (pełny cykl)

1. **Pill:** Discovery™  
2. **Live:** po geście — mikro glyph  
3. **Undo:** Cofnij (5–8 s odczuwalne)  
4. **Saved:** Zapisano  
5. **Insight:** Dlaczego?  
6. **Bridge:** Kontekst  
7. **Pause:** Do zobaczenia  
8. **Honor:** (tylko Dream Found) krótki expand  
9. **End:** dissolve  

---

## 7. Checklist „Apple VisionOS-grade” (akceptacja designu)

- [ ] Czy da się opisać ekran jako obiekt w przestrzeni, nie jako tabelę?  
- [ ] Czy glass służy czytelności?  
- [ ] Czy jest forma (pola preferencji)? → jeśli tak, odrzuć.  
- [ ] Czy motion ma znaczenie przyczynowe?  
- [ ] Czy Island zastępuje hałas toastów?  
- [ ] Czy każdy ekran ma uzasadnienie psychologiczne?  
- [ ] Czy dostępność ma równoważnik gestu?  
- [ ] Czy Dream Found jest cichy?

---

## 8. Uzasadnienia psychologiczne — skrót zbiorczy

| Ekran | Emocja chroniona |
|-------|------------------|
| S-01 | Pozwolenie na niewiedzę |
| S-02 | Sprawczość + flow |
| S-03–04 | Rezonans / ciekawość |
| S-05–08 | Ulga, bezpieczeństwo błędu |
| S-09 | Klarowność bez FOMO |
| S-10 | Brak winy |
| S-11–12 | Zaufanie przez kontrolę |
| S-13–14 | Ciągłość i odpoczynek |
| S-15–16 | Godność zmiany i sprzeczności |
| S-17–19 | Kontrola mostu i prawda życia |
| S-20–22 | Mobilizacja bez paniki |
| S-23–24 | Cisza sukcesu i domknięcie |

---

## Rejestr akceptacji

| Pole | Wartość |
|------|---------|
| Dokument | `docs/discovery/03-experience-ux/04-complete-ux-design.md` |
| Status | `REVIEW` |
| Zakres | Wszystkie ekrany S-00…S-24 + system motion/Island/przyciski/przejścia |
| Następny | tylko po Twojej akceptacji |

**STOP.** Nie powstaje kod ani kolejny dokument do czasu Twojej decyzji.

**Koniec kompletnego UX Design `04-complete-ux-design.md`.**
