# EstateOS™ Discovery™ — Mapa emocji użytkownika

**Status dokumentu:** REVIEW  
**Wersja:** 1.0  
**Ostatnia aktualizacja:** 2026-07-25  
**Właściciel merytoryczny:** Behavioural Psychologist · UX Designer Apple · Product Owner · Real Estate Expert  
**Zależności:** `01-product-vision.md`, `02-discovery-manifesto.md`, `03-product-principles.md`  
**Klasyfikacja:** psychologia produktu · podróż emocjonalna  
**Zakaz w tym dokumencie:** kod, API, architektura, szczegóły implementacji UI jako specyfikacja techniczna

---

## 0. Cel dokumentu

Ten dokument opisuje **życie emocjonalne użytkownika** od pierwszego zetknięcia z Discovery™ do momentu, w którym odnajduje nieruchomość odczuwaną jako wymarzoną (lub wystarczająco „tę jedyną” w danym etapie życia).

Nie opisuje ekranów ani funkcji. Opisuje **stany wewnętrzne** oraz to, jak Discovery™ powinno na nie odpowiadać językiem doświadczenia: tempem, ruchem, mikrointerakcją, słowem i sposobem budowania zaufania przez inteligencję.

**Definicja sukcesu emocjonalnego sesji / drogi:**  
użytkownik wychodzi spokojniejszy, sprawczy i bliższy prawdzie o własnym gustie — nigdy głupszy, bardziej winny albo zmanipulowany.

---

## 1. Mapa emocjonalna całego procesu (przegląd)

Poniżej łuk emocjonalny „od niewiedzy do domu”. Emocje nie są liniowe — ludzie wracają, skaczą, cofają się. Mapa jest **kanonicznym modelem**, nie sztywnym skryptem życia.

```text
[0. Przedproże]     ciekawość · nieufność · „kolejna apka?”
        ↓
[1. Pierwsze wejście]  ulga (że wolno nie wiedzieć) ALBO lęk (że znów ankieta)
        ↓
[2. Pierwsze decyzje]  niepewność motoryczna · mikro-ekscytacja · wstyd „czy dobrze?”
        ↓
[3. Rytm odkrywania]   flow · rosnąca pewność · lekkie zmęczenie decyzyjne
        ↓
[4. Pierwszy rezonans] zaskoczenie · „to czuję” · nadzieja
        ↓
[5. Kryzys sprzeczności] frustracja · konflikt wartości · wątpliwość w siebie / w system
        ↓
[6. Klarowność gustu]  ulga poznawcza · duma · zaufanie („rozumie mnie”)
        ↓
[7. Trop poważny]      mobilizacja · ostrożna radość · lęk przed pomyłką
        ↓
[8. Most do człowieka]  ulga / napięcie społeczne · potrzeba bycia zrozumianym
        ↓
[9. Weryfikacja życia]  realizm · rozczarowanie LUB potwierdzenie · recalibracja
        ↓
[10. Dom (moment)]     spokój · pewność cielesna · wdzięczność · cisza po hałasie
```

**Emocje przewodnie, które Discovery™ musi chronić na całej mapie:** spokój, sprawczość, godność, rosnące zaufanie.  
**Emocje, których nie wolno celowo produkować:** wstyd, panika FOMO, poczucie bycia czytanym przeciw sobie, uzależnienie od nieskończoności.

---

## 2. Etap 0 — Przedproże (zanim uruchomi Discovery™)

### Co myśli
„Czy to znowu to samo co portale?” · „Czy dam radę / czy znowu zmarnuję wieczór?” · „Może partner ma rację, że nie wiemy czego chcemy.”

### Co czuje
Zmęczenie rynkiem (często) · ostrożną ciekawość · lekką nadzieję, że „tu będzie inaczej” · nieufność wobec „smart” obietnic.

### Czego się obawia
Kolejnej ankiety · utraty czasu · bycia ocenionym za niewiedzę · że to zabawka niemająca związku z poważną decyzją.

### Co go motywuje
Obietnica spokoju · skrócenie cierpienia szukania · szansa, że ktoś/coś wreszcie „zrozumie bez przepytywania”.

### Jak Discovery™ powinno reagować
Już w momencie wejścia w rytuał: **sygnał pozwolenia na niewiedzę** i powagi kategorii. Zero obiecanek cudu. Ton: pewny, cichy, dorosły.

### Jakich błędów nie wolno popełnić
Krzykliwego marketingu „AI znajdzie Ci dom w 5 minut”. Porównania do randkowych aplikacji w copy. Wymuszania konta ścianą wstydu.

### Jakie animacje pomagają
Krótki, spokojny rytuał przejścia (oddechem, nie fajerwerkiem) — poczucie „wchodzę w inną jakość”, nie „zaczyna się gra”.

### Jakie mikrointerakcje pomagają
Lekka haptyka otwarcia · brak natychmiastowego bombardowania tipami.

### Jakie komunikaty pomagają
„Nie musisz jeszcze wiedzieć.” · „Najpierw poczuj miejsca.” · Unikać: „Uzupełnij preferencje, aby kontynuować.”

### Jak AI powinno budować zaufanie
Na tym etapie AI **milczy o sobie**. Zaufanie buduje się obietnicą procesu, nie auto-reklamą modelu.

---

## 3. Etap 1 — Pierwsze uruchomienie / pierwsze wejście

### Co myśli
„OK, co tu mam robić?” · „Czy coś zepsuję?” · „Czy to bezpieczne / czy ktoś patrzy na moje wybory?”

### Co czuje
Podwyższoną czujność · krótki lęk kompetencyjny · ulgę, jeśli od razu wolno działać bez formularza · irytację, jeśli jednak ankieta.

### Czego się obawia
Że „źle zacznie” i zepsuje dopasowanie · że dane zostaną użyte przeciw niemu · że będzie wyglądał niepoważnie.

### Co go motywuje
Szybkie poczucie sprawczości · jasna reguła pierwszego gestu · estetyczna powaga miejsca.

### Jak Discovery™ powinno reagować
Natychmiast dać **bezpieczny pierwszy sukces**: zrozumiały gest, czytelny skutek, zero kary. Potwierdzić: tu wolno nie wiedzieć.

### Jakich błędów nie wolno popełnić
Tutorialu-ściany · obowiązkowych 12 tipów · ciemnych wzorców logowania · przeładowania pierwszej karty parametrami.

### Jakie animacje pomagają
Wejście karty spokojne, czytelne · lekki „oddech” UI · brak długich intro.

### Jakie mikrointerakcje pomagają
Wyraźne potwierdzenie pierwszego gestu · opcjonalna, jedna-linijkowa podpowiedź znika po użyciu.

### Jakie komunikaty pomagają
„Przesuń, jeśli czujesz / nie czujesz.” · „To nie egzamin.”  
Unikać: „Oceń poprawnie, byśmy mogli się uczyć.”

### Jak AI powinno budować zaufanie
Przyznać skromnie fazę: „Dopiero Cię poznaję — Twoje wybory są ważniejsze niż ustawienia.” Bez score’ów i przechwałki.

---

## 4. Etap 2 — Pierwsze decyzje (niewinność motoryczna)

### Co myśli
„Czy w lewo to na pewno nie?” · „A jeśli mi się podoba, ale cena…?” · „Czy mam być konsekwentny?”

### Co czuje
Niepewność · mikro-satysfakcję kontroli · wstyd przy wahaniu · lekką zabawę, która musi pozostać poważna.

### Czego się obawia
Przypadkowego gestu · że system „źle go zrozumie” po 3 ruchach · że partner patrzy i ocenia wybory.

### Co go motywuje
Poczucie, że każda decyzja coś znaczy · rosnąca pewność ręki · brak upokorzenia za zmianę zdania.

### Jak Discovery™ powinno reagować
Stabilny słownik gestów · łatwe cofnięcie pomyłki · feedback spokojny i jednoznaczny · zero moralizowania sprzeczności.

### Jakich błędów nie wolno popełnić
Zmiany znaczenia gestów · braku undo · karania za wolne tempo · natychmiastowego „Twój typ to X” po 2 swipe’ach.

### Jakie animacje pomagają
Karta odjeżdża w kierunku intencji · kolejne wejście przewidywalne · subtelne aksenty tak/nie bez histerii.

### Jakie mikrointerakcje pomagają
Haptyka zróżnicowana lekko · wizualne „tak/nie” pojawia się dopiero po przekroczeniu progu intencji.

### Jakie komunikaty pomagają
Po pomyłce: „Cofnięto.” · Przy wahaniu: cisza > wykład.  
Unikać: „Bądź bardziej zdecydowany!”

### Jak AI powinno budować zaufanie
Nie finalizować profilu. Komunikować: „Zbieram sygnały — jeszcze nie wnioskuję mocno.”

---

## 5. Etap 3 — Rytm odkrywania (flow)

### Co myśli
„OK, łapię to.” · „To idzie szybciej niż portal.” · „Ciekawe, co będzie dalej.”

### Co czuje
Flow · lekką lekkość · rosnący spokój kompetencyjny · pierwsze oznaki zmęczenia decyzyjnego przy za długiej sesji.

### Czego się obawia
Że wciągnie się w nieskończoność · że straci wieczór · że flow zamieni się w kompulsję.

### Co go motywuje
Poczucie postępu · coraz mniej szumu · przyjemność estetyczna spotkań z miejscami.

### Jak Discovery™ powinno reagować
Chronić rytm · nie dokładać hałasu · oferować naturalne punkty pauzy · utrzymywać powagę mimo płynności.

### Jakich błędów nie wolno popełnić
Infinite feed bez godności końca · variable rewards jak w social · powiadomień w środku flow · nagłych ankiet.

### Jakie animacje pomagają
Stały, „oddechowy” rytm przejść · brak niespodziewanych interruptów motion.

### Jakie mikrointerakcje pomagają
Płynne foto w Smart Gallery bez kradzieży decyzji · haptyka rzadka, rytmiczna.

### Jakie komunikaty pomagają
Rzadkie, spokojne: „Idzie Ci rytm — możesz przerwać, kiedy chcesz.”  
Unikać: „Jeszcze tylko 30!”

### Jak AI powinno budować zaufanie
Delikatnie zwiększać trafność; jeśli pokazuje powód — jeden, ludzki, skromny.

---

## 6. Etap 4 — Pierwszy rezonans („to czuję”)

### Co myśli
„O. To jest inne.” · „Nie spodziewałem się, że mnie to ruszy.” · „Czy to możliwe u mnie budżetowo / życiowo?”

### Co czuje
Zaskoczenie · nadzieję · ciepłą mobilizację · lekki lęk „nie przywiązuj się”

### Czego się obawia
Że to pudło przy wizycie · że partner nie poczuje tego samego · że system „wepchnie” podobne i zamknie bańkę.

### Co go motywuje
Chęć zobaczenia więcej w tym kierunku · potrzeba zachowania tropu · potrzeba zrozumienia *dlaczego* to zadziałało.

### Jak Discovery™ powinno reagować
Uhonorować moment bez teatralizacji · pozwolić pogłębić (zdjęcia, detal) · nie porywać od razu do agresywnej sprzedaży · zapamiętać sygnał z wagą.

### Jakich błędów nie wolno popełnić
Confetti · „IDEAL MATCH 99%” · natychmiastowego spamowania klonami · presji „zadzwoń teraz albo stracisz”.

### Jakie animacje pomagają
Subtelne „zatrzymanie czasu” · bardziej uważne wejście w galerię · spokojne podkreślenie momentu bez krzyku.

### Jakie mikrointerakcje pomagają
Łatwe zapisanie intencji / priorytetu świadomym gestem · płynne przejście do głębszej warstwy miejsca.

### Jakie komunikaty pomagają
„To wybrzmiewa u Ciebie mocniej.” · „Chcesz iść tym tropem?”  
Unikać: „Kup to.”

### Jak AI powinno budować zaufanie
Wyjaśnić krótko analogię do wcześniejszych wyborów — albo przyznać: „To nowy trop; sprawdzam, czy zostanie.”

---

## 7. Etap 5 — Kryzys sprzeczności (doliny emocji)

### Co myśli
„Chcę A i B naraz.” · „Wczoraj coś innego.” · „Czy ja w ogóle nadaję się do decyzji?” · „Czy appka mnie wariuje?”

### Co czuje
Frustrację · wstyd · złość na partnera/rynek/siebie · wątpliwość · czasem rezygnację.

### Czego się obawia
Że jest „niespójny” i zostanie oceniony · że system go zablokuje w złym profilu · że nigdy nie znajdzie.

### Co go motywuje
Potrzeba ulgi od konfliktu · potrzeba, by ktoś powiedział: sprzeczność jest normalna · potrzeba narzędzi jasności, nie presji.

### Jak Discovery™ powinno reagować
**Nie zawstydzać.** Traktować sprzeczność jako materiał. Spowolnić tempo. Dać język: „Widzę napięcie między X a Y — to częste.” Chronić godność.

### Jakich błędów nie wolno popełnić
„Jesteś niespójny — popraw preferencje.” · Wymuszonej ankiety „rozstrzygnij konflikt.” · Agresywnego zawężenia, które wybiera za użytkownika.

### Jakie animacje pomagają
Spokojniejsze, dłuższe oddechy UI · mniej stymulacji · poczucie „tu wolno stanąć”.

### Jakie mikrointerakcje pomagają
Pauza · cofnięcie · przegląd tropów bez oceniania · możliwość „to nie ja” przy złym wniosku systemu.

### Jakie komunikaty pomagają
„Sprzeczne reakcje są częścią odkrywania.” · „Nie musisz dziś rozstrzygać wszystkiego.”  
Unikać: „Zdecyduj się wreszcie.”

### Jak AI powinno budować zaufanie
Pokazać, że widzi konflikt *jako hipotezę*, nie wyrok: „Wygląda na napięcie między spokojem a bliskością centrum — sprawdzamy dalej razem.”

---

## 8. Etap 6 — Klarowność gustu („rozumiem siebie / rozumiesz mnie”)

### Co myśli
„OK, wiem już czego nie chcę.” · „To jest mój kierunek.” · „Wreszcie mniej szumu.”

### Co czuje
Ulga poznawcza · cichą dumę · zaufanie · ciepłą lojalność wobec EstateOS · ostrożny optymizm.

### Czego się obawia
Że system znów „zwariuje” i wróci szum · że klarowność jest złudna · że partner jest indziej.

### Co go motywuje
Chęć pogłębiania tropu · chęć rozmowy z człowiekiem na wyższym poziomie · ochrona zdobytej jasności.

### Jak Discovery™ powinno reagować
Potwierdzić postęp bez przechwałki · utrzymać jakość kuracji · dać poczucie kontroli nad profilem · nie rozwadniać talii byle czym.

### Jakich błędów nie wolno popełnić
Nagłego resetu sensu · dorzucenia chaosu „dla eksploracji” bez wyjaśnienia · celebracji „Twój profil gotowy!” jak achievement w grze.

### Jakie animacje pomagają
Płynność „dojrzałego” rytmu · subtelny sygnał rosnącej trafności (nie pasek XP).

### Jakie mikrointerakcje pomagają
Wgląd w „dlaczego to” · korekta kierunku jednym spokojnym gestem językowym.

### Jakie komunikaty pomagają
„Widać u Ciebie stały trop: …” · „Możesz to skorygować.”  
Unikać: „Algorytm zakończył kalibrację.”

### Jak AI powinno budować zaufanie
Regularne, skromne wyjaśnienia + możliwość sprzeciwu. Zaufanie = *poprawialność*.

---

## 9. Etap 7 — Trop poważny (blisko „wymarzonego”)

### Co myśli
„To może być to.” · „Sprawdzam każdy detal.” · „Co jeśli ktoś indziej weźmie?” · „Czy to rozsądek czy zauroczenie?”

### Co czuje
Mobilizację · ostrożną radość · lęk przed pomyłką · przywiązanie · napięcie decyzyjne.

### Czego się obawia
FOMO realne i sztuczne · ukrytych wad · konfliktu z partnerem · presji sprzedaży.

### Co go motywuje
Potrzeba pewności cielesnej („czy dam radę tu żyć”) · potrzeba faktów · potrzeba rozmowy z zaufanym człowiekiem.

### Jak Discovery™ powinno reagować
Podnieść powagę · ułatwić pogłębienie · chronić przed paniką · nie udawać niedoboru · wspierać most do człowieka / wizyty bez nachalności.

### Jakich błędów nie wolno popełnić
Sztucznego „ostatnia sztuka!!!” · nachalnych powiadomień · trywializacji momentu · blokowania refleksji pośpiechem UI.

### Jakie animacje pomagają
Wolniejsze, uważniejsze przejścia · nacisk na treść miejsca · mniej „zabawy gestem”, więcej obecności.

### Jakie mikrointerakcje pomagają
Świadomy fast-track / kontakt · spokojne zapisanie · porównanie emocjonalne bez tabeli excelowej jako jedynej prawdy.

### Jakie komunikaty pomagają
„To wygląda na poważny trop — bez pośpiechu.” · „Możesz pogłębić albo porozmawiać z kimś z rynku.”  
Unikać: „Zarezerwuj w 60 sekund.”

### Jak AI powinno budować zaufanie
Oddzielić *dopasowanie gustu* od *rekomendacji życiowej*. „Pasuje do Twoich reakcji” ≠ „to Twoja decyzja finalna”.

---

## 10. Etap 8 — Most do człowieka (agent / rozmowa / wspólne decyzje)

### Co myśli
„Czy oni mnie zrozumieją?” · „Nie chcę znowu od zera.” · „Nie chcę presji.” · „Chcę, żeby partner też poczuł.”

### Co czuje
Ulga (że nie jest sam) · napięcie społeczne · nadzieję na kompetencję · lęk przed byciem „prowadzonym do podpisu”.

### Czego się obawia
Presji sprzedażowej · że dossier zostanie użyte przeciw niemu · że jego niewiedza wróci jako wstyd w rozmowie.

### Co go motywuje
Bycie zrozumianym od pierwszego zdania · ochrona tempa · wspólne nadanie sensu tropom.

### Jak Discovery™ powinno reagować
Przekazać zrozumienie jako **mapę opieki**, nie wyrok · chronić język godności · nie redukować człowieka do score.

### Jakich błędów nie wolno popełnić
„Score 97 — domykaj.” · Prezentowania profilu jak listy wad klienta · zmuszania do rozmowy jako jedynej drogi dalszego odkrywania.

### Jakie animacje pomagają
Spokojne przejście rytuału „od odkrywania do rozmowy” · poczucie ciągłości, nie wyrzucenia z produktu.

### Jakie mikrointerakcje pomagają
Podgląd tego, co zostanie udostępnione · zgoda · możliwość ograniczenia zakresu.

### Jakie komunikaty pomagają
„Możesz wejść w rozmowę z kontekstem Twoich reakcji — Ty decydujesz, ile widać.”  
Unikać: „Połączono z agentem — nie uciekaj.”

### Jak AI powinno budować zaufanie
Transparentność: co wynika z zachowań, co jest hipotezą, co wymaga potwierdzenia w życiu. Zero manipulacyjnego scoringu w copy dla użytkownika.

---

## 11. Etap 9 — Weryfikacja w życiu (wizyta / oględziny / realny kontakt)

### Co myśli
„Czy to samo co na zdjęciach?” · „Co z hałasem / sąsiadami / światłem o 17:00?” · „Czy emocja z Discovery była trafna?”

### Co czuje
Realizm · napięcie · rozczarowanie LUB potwierdzenie · potrzebę recalibracji · czasem żal.

### Czego się obawia
Że znów zacznie od zera · że system „nie uwzględni” rozczarowania · że będzie musiał udawać zadowolenie.

### Co go motywuje
Prawda · korekta kursu · ochrona energii · znalezienie lepszego tropu bez wstydu „że się mylił”.

### Jak Discovery™ powinno reagować
Przyjąć feedback rzeczywistości jako święty sygnał · umożliwić uczenie się z „myślałem że tak, a na miejscu nie” · bez wstydu · bez kasowania całej jasności.

### Jakich błędów nie wolno popełnić
Ignorowania powrotu po wizycie · zakładania, że skoro było „tak” w appce, to „tak” jest ostateczne · karania za zmianę zdania.

### Jakie animacje pomagają
Rytuał „powrotu do odkrywania” spokojny, bez resetu tożsamości produktu.

### Jakie mikrointerakcje pomagają
Szybkie: „na miejscu nie zagrało / zagrało inaczej” jako godny sygnał.

### Jakie komunikaty pomagają
„Życie weryfikuje — to też jest postęp.” · „Skorygujemy trop.”  
Unikać: „Szkoda, że odrzuciłeś idealne dopasowanie.”

### Jak AI powinno budować zaufanie
Traktować weryfikację terenową jako sygnał wyższej wagi niż sam gest. Mówić: „Dzięki temu lepiej oddzielimy zauroczenie kadrem od życia w miejscu.”

---

## 12. Etap 10 — Moment domu (wymarzona / „ta”)

### Co myśli
„Tu mogę żyć.” · „To jest zgodne ze mną.” · „Wiem dlaczego.” · „Chcę domknąć spokojnie.”

### Co czuje
Spokój · pewność cielesną · ulgę po długim hałasie · wdzięczność · czasem niedowierzanie · czułość wobec przyszłości.

### Czego się obawia
Pośpiechu rynku · że emocja przysłoni procedurę · że bliscy podważą · że „za dobrze, żeby było prawdziwe”.

### Co go motywuje
Domknięcie z godnością · ochrona spokoju · praktyczne następne kroki bez zniszczenia momentu.

### Jak Discovery™ powinno reagować
**Uszanować ciszę sukcesu.** Nie zaciemniać celebracją-grą. Wspierać domknięcie (rozmowa, kolejne kroki ekosystemu) bez krzyku. Pozostawić poczucie sprawczości.

### Jakich błędów nie wolno popełnić
Fajerwerków · „WYGRAŁEŚ DOM!” · natychmiastowego cross-sellu · odciągania uwagi na inne swipe’e „dla pewności”.

### Jakie animacje pomagają
Maksymalna powściągliwość · obecność · ewentualnie bardzo krótki, szlachetny akcent zamknięcia tropu.

### Jakie mikrointerakcje pomagają
Jasne, spokojne przejście do działań domykających · brak konkurujących CTA.

### Jakie komunikaty pomagają
„To wygląda na Twoje miejsce — w Twoim tempie.” · „Jesteśmy tu, gdy zechcesz domknąć.”  
Unikać: „Nie zwlekaj — inni patrzą.”

### Jak AI powinno budować zaufanie
Oddać głos człowiekowi. Podsumować drogę skromnie: „Doszedłeś tu przez swoje wybory — nie przez nasz wyrok.” To jest szczyt zaufania.

---

## 13. Etapy równoległe i powroty (psychologia nie-liniowa)

Użytkownicy często:

- wracają z Etapu 9 do 5 (kryzys po wizycie),  
- skaczą z 4 do 8 (rezonans → od razu człowiek),  
- utykają w 3 (flow bez klarowności) — tu Discovery musi delikatnie pomóc wyjść z kompulsji do sensu,  
- przeżywają Etap 10 bardziej jako „wystarczająco dobre życie” niż bajkowe „wymarzone” — to też sukces emocjonalny, jeśli spokój i sprawczość są obecne.

**Zasada mapy:** każdy powrót ma być możliwy **bez utraty godności** i bez utraty całego dorobku jasności.

---

## 14. Emocje zakazane jako cel projektowy (przypomnienie operacyjne)

| Emocja | Dlaczego zakazana jako cel |
|--------|----------------------------|
| Wstyd z niewiedzy | Zabija prawdę behawioralną |
| Panika FOMO | Niszczy decyzję wysokiej stawki |
| Poczucie inwigilacji | Zabija zaufanie do AI |
| Kompulsja swipe | Zamienia Discovery w dopaminę |
| Poczucie głupoty po sesji | Hańba marki EstateOS |

---

## 15. Skrót: AI i zaufanie na całej mapie

1. **Milcz o sobie na starcie** — mów efektami.  
2. **Przyznawaj niepewność** we wczesnych etapach.  
3. **Wyjaśniaj krótko i po ludzku**, gdy trafność rośnie.  
4. **Pozwalaj się poprawiać** — zaufanie = kontrola.  
5. **Oddzielaj dopasowanie od wyroku życiowego.**  
6. **Podnoś wagę sygnałów z życia (wizyta) ponad sam gest.**  
7. **W momencie domu — oddaj sprawczość całkowicie.**

---

## 16. Skrót: motion i mikrointerakcje jako psychologia

| Potrzeba emocjonalna | Motion / mikro |
|----------------------|----------------|
| Bezpieczeństwo na start | Krótki rytuał, jasny skutek gestu, undo |
| Flow | Rytm przewidywalny, brak interruptów |
| Rezonans | Uważniejsze tempo, głębia galerii |
| Kryzys | Spowolnienie, mniej stymulacji |
| Klarowność | Subtelny sygnał trafności, wgląd „dlaczego” |
| Trop poważny | Powaga, mniej „zabawy” |
| Dom | Cisza, powściągliwość |

---

## 17. Rejestr akceptacji

| Pole | Wartość |
|------|---------|
| Dokument | `docs/discovery/01-vision/04-user-emotions.md` |
| Status | `REVIEW` |
| Charakter | psychologia produktu · mapa emocji |
| Następny dokument | tylko po Twojej akceptacji |

**STOP.** Nie powstaje kolejny dokument do czasu Twojej decyzji.

**Koniec dokumentu `04-user-emotions.md`.**
