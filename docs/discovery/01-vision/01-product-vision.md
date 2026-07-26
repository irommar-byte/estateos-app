# EstateOS™ Discovery™ — Wizja produktu

**Status dokumentu:** REVIEW  
**Wersja:** 1.0  
**Ostatnia aktualizacja:** 2026-07-25  
**Właściciel merytoryczny:** Product Owner (głosy: UX Designer Apple, Behavioural Psychologist, Real Estate Expert, Senior AI Architect)  
**Zależności:** `docs/discovery/00-README.md`  
**Klasyfikacja:** dokument wizji produktu · enterprise · bez wymagań implementacyjnych

---

## Nota o charakterze dokumentu

Niniejszy dokument jest **wizją produktu** w rozumieniu Amazon Working Backwards oraz filozofii projektowania bliskiej Apple Human Interface Guidelines: jasność intencji, szacunek dla człowieka, głębia doświadczenia zamiast gęstości funkcji.

Dokument **nie** opisuje funkcji, ekranów, przepływów UI, API, modeli danych ani planu wdrożenia. Opisuje **dlaczego** Discovery™ istnieje, **jaki problem ludzki** rozwiązuje, **jaką zmianę** wprowadza w relacji człowieka z rynkiem nieruchomości oraz **jaką przyszłość** buduje dla EstateOS™.

Jeśli czytelnik szuka „co zbudować jutro”, ten dokument daje **północ**: kierunek, standard jakości emocjonalnej i kryteria tego, czym Discovery™ **nigdy nie wolno** się stać. Szczegóły doświadczenia, inteligencji i architektury powstaną w kolejnych, osobnych rozdziałach pakietu `docs/discovery/`.

---

## 1. Working Backwards — komunikat z przyszłości

### 1.1 Press Release (hipotetyczny, 2031)

**EstateOS™ Discovery™ zmienia sposób, w jaki Europa Środkowa znajduje dom**

Warszawa — EstateOS ogłasza, że Discovery™ stało się domyślnym sposobem, w jaki miliony osób odkrywają nieruchomości: nie przez wypełnianie pól i przesuwanie suwaków, lecz przez naturalne, ludzkie decyzje „to czuję / tego nie czuję”, z których system uczy się gustu z szacunkiem i przejrzystością.

„Przez dekadę branża uczyła ludzi, że muszą najpierw wiedzieć, czego chcą — zanim wolno im zobaczyć rynek,” powiedziała Product Owner EstateOS. „Tymczasem większość z nas odkrywa, czego naprawdę chce, dopiero w kontakcie z rzeczywistością. Discovery™ odwraca kolejność: najpierw spotkanie z miejscem, potem język preferencji.”

Użytkownicy opisują Discovery™ jako „spokojne”, „pewniejące” i „szanujące czas”. Agenci i zespoły EstateOS widzą w profilu gustu klienta nie ankietę, lecz żywy obraz tego, na co człowiek naprawdę reaguje — i dzięki temu prowadzą rozmowy, które zaczynają się od zrozumienia, a nie od checklisty.

EstateOS podkreśla, że Discovery™ nie zastępuje zaufanego doradcy ani decyzji życiowej. Zastępuje **ułomny rytuał wyszukiwania**, który przez lata udawał, że preferencje da się w pełni zadeklarować zanim się je poczuje.

### 1.2 FAQ Working Backwards (dla zespołu i partnerów)

**P: Czym Discovery™ różni się od „lepszego wyszukiwania”?**  
O: Wyszukiwanie zakłada, że pytanie jest znane. Discovery™ zakłada, że pytanie dopiero powstaje. To nie jest usprawnienie filtrów — to inna filozofia relacji z rynkiem.

**P: Czy użytkownik „musi” coś wiedzieć na start?**  
O: Nie. System jest zaprojektowany wokół prawa do niewiedzy na początku. Pewność ma się pojawiać w wyniku doświadczenia, nie jako warunek wejścia.

**P: Czy to nie jest tylko „Tinder mieszkań”?**  
O: Gest może być podobny do gestów znanych z innych kategorii, ale intencja jest inna. Tu stawką nie jest rozrywka ani nieskończony feed. Stawką jest jedna z najważniejszych decyzji życiowych: gdzie i jak mieszkać. Premium oznacza powagę, tempo z szacunkiem, uczenie z etyką i wyjaśnialnością — nie uzależnienie od swipe’a.

**P: Co z ludźmi, którzy dokładnie wiedzą, czego chcą?**  
O: Discovery™ nie karze wiedzy. Ludzie o jasnej intencji również zyskują: szybsze trafianie w gust, mniej szumu, lepsze rozmowy z agentem. Ale produkt nie jest budowany wyłącznie pod tę mniejszość. Budowany jest pod prawdę rynku: większość nie wie — albo wie tylko częściowo.

**P: Jaką obietnicę składa EstateOS?**  
O: Że EstateOS przestanie traktować użytkownika jak operatora formularza, a zacznie traktować go jak człowieka, którego gust da się poznać z godnością.

---

## 2. Dlaczego Discovery™ powstało

Discovery™ powstało z obserwacji, która jest jednocześnie prosta i niewygodna dla całej branży ogłoszeniowej:

**Ludzie nie kupują i nie wynajmują nieruchomości tak, jak branża każe im ich szukać.**

Branża nauczyła się optymalizować **podaż informacji**: więcej ogłoszeń, więcej parametrów, więcej filtrów, więcej sortowań, więcej „zaawansowanych wyszukiwań”. Użytkownik nauczył się przegrywać z tym systemem: otwierać dziesiątki kart, porównywać niespójne opisy, wracać do tych samych dzielnic, zmieniać kryteria co wieczór, czuć się winnym, że „nadal nie wie”.

EstateOS™ — jako platforma, która łączy rynek, mapę, radar, live i relację z agentem — nie może powielić tej samej pułapki pod ładniejszą skórką. Jeśli EstateOS ma być kategorią samą w sobie, musi rozwiązać problem **pierwszy**: problem odkrywania tego, co naprawdę pasuje do człowieka, zanim człowiek potrafi to nazwać.

Discovery™ powstało więc nie jako „kolejna funkcja aplikacji”, lecz jako **odpowiedź strategiczna** na pytanie:

> Jak wygląda EstateOS, gdy przestajemy pytać użytkownika o parametry, a zaczynamy słuchać jego wyborów?

Powstało także dlatego, że w EstateOS zbiegają się trzy rzadkie warunki naraz:

1. **Zaufanie do marki premium** — EstateOS nie musi krzyczeć; może prowadzić.  
2. **Bliskość decyzji** — użytkownik nie jest anonimowym „ruchem”; jest kimś, kto może przejść od odkrycia do rozmowy, do wizyty, do transakcji.  
3. **Odpowiedzialność za gust** — system, który uczy się z zachowania, musi robić to przejrzyście i z szacunkiem; inaczej premium staje się manipulacją.

Discovery™ jest miejscem, w którym EstateOS deklaruje: **naszą przewagą nie będzie większa liczba filtrów. Naszą przewagą będzie głębsze zrozumienie człowieka.**

---

## 3. Jaki problem rozwiązuje

### 3.1 Problem powierzchniowy (to, co ludzie mówią)

„Nie mogę znaleźć mieszkania.”  
„Za dużo ogłoszeń.”  
„Wszystko jest albo za drogie, albo w złym miejscu.”  
„Przeglądam od miesięcy i nic.”

Te zdania są prawdziwe emocjonalnie, ale niepełne diagnostycznie. Problem nie zaczyna się od braku ofert. Zaczyna się od **niedopasowania narzędzia do natury decyzji**.

### 3.2 Problem głęboki (to, co dzieje się naprawdę)

Decyzja o nieruchomości jest:

- **wysokiej stawce** (pieniądze, czas, tożsamość, rodzina),  
- **wielowymiarowa** (lokalizacja, światło, hałas, status, dojazdy, metraż, piętro, sąsiedztwo, „czy wyobrażam tu sobie życie”),  
- **częściowo niewyrażalna językiem formularza**,  
- **zmienna w czasie** (to, czego chciałem w styczniu, nie jest tym, czego chcę po trzech tygodniach oglądania).

Narzędzie, które wymaga pełnej deklaracji preferencji na wejściu, zakłada model człowieka, którego ten rynek rzadko dostarcza: człowieka o stabilnym, kompletnym, świadomym wektorze potrzeb.

Discovery™ rozwiązuje problem **odkrywania preferencji w warunkach niepewności** — tak, aby:

- użytkownik mógł zacząć bez wstydu z niewiedzy,  
- system mógł budować obraz gustu z zachowania,  
- rynek przestawał być ścianą szumu, a stawał się sekwencją coraz bardziej trafnych spotkań z miejscami.

### 3.3 Problem biznesowy EstateOS

Dla EstateOS problem ma także wymiar strategiczny. Jeśli użytkownik doświadcza EstateOS głównie jako „ładniejszego portalu z mapą”, EstateOS konkuruje na polu, na którym wygrywają skala katalogu i budżet performance marketingu. To pole jest wyczerpujące i łatwe do skopiowania wizualnie.

Jeśli użytkownik doświadcza EstateOS jako miejsca, które **coraz lepiej zna jego gust**, powstaje przewaga trudna do skopiowania: **skumulowane zrozumienie + zaufanie + nawyk odkrywania**. To jest aktywo, którego nie da się kupić samym feedem reklamowym.

Discovery™ rozwiązuje więc równolegle:

- ból człowieka („nie wiem / tonę / marnuję wieczory”),  
- ból rynku („rozmowy zaczynają się od zera, bo nie znamy prawdziwych reakcji klienta”),  
- ból strategii EstateOS („konkurujemy parametrem, zamiast konkurować zrozumieniem”).

---

## 4. Dlaczego obecne portale nieruchomości są niewystarczające

Portale odegrały historycznie ważną rolę: scentralizowały podaż, ustandaryzowały część języka ogłoszeń, nauczyły rynek szukać online. Ich niewystarczalność nie wynika z „złej woli”, lecz z **architektury intencji**, wokół której powstały.

### 4.1 Portal optymalizuje katalog, nie decyzję

Dominującą jednostką optymalizacji jest ogłoszenie w indeksie: widoczność, pozycja, liczba wejść, lead. Doświadczenie użytkownika jest często środkiem do tej optymalizacji, nie celem samym w sobie. Skutek: interfejsy, które świetnie obsługują **przeszukiwanie zbioru**, ale słabo obsługują **dojrzewanie wyboru**.

### 4.2 Portal zakłada racjonalnego deklaratora

Typowa ścieżka mówi: wybierz miasto, typ, cenę, metraż, liczbę pokoi — potem przeglądaj wyniki. To jest model „query → results”. Działa dla części zapytań (np. „kawalerka do 3000 w tej dzielnicy na już”). Załamuje się, gdy użytkownik jest we wczesnej fazie, gdy kryteria są sprzeczne, gdy „nie spodobało się, choć parametry grały”, gdy decyzja jest estetyczna i życiowa jednocześnie.

### 4.3 Portal produkuje zmęczenie, nie klarowność

Im więcej kart otwartych w przeglądarce, tym większe poczucie pracy — i paradoksalnie często mniejsze poczucie postępu. Ludzie mylą aktywność z postępem. Portale, pokazując „jeszcze 2 847 ogłoszeń”, wzmacniają wrażenie, że odpowiedź jest gdzieś w ilości, jeśli tylko wystarczająco się napracujesz. Discovery™ stoi po stronie przeciwnej intuicji: **postęp to rosnąca trafność i rosnąca pewność, nie rosnąca liczba otwartych kart.**

### 4.4 Portal słabo pamięta człowieka

Nawet gdy istnieje konto, „pamięć” bywa płytka: zapisane wyszukiwania, alerty z filtrów, lista ulubionych. To są artefakty narzędziowe, nie profil gustu. Ulubione mówią „to odłożyłem”. Nie mówią wystarczająco: „dlaczego to we mnie zagrało, a tamto — mimo podobnych parametrów — nie”.

### 4.5 Portal nie buduje relacji premium z decyzją

Premium w nieruchomościach nie jest grubością cienia na karcie. Premium to poczucie, że ktoś (lub coś) prowadzi Cię przez złożoność z klasą: bez poniżania niewiedzy, bez chaosu, bez szantażu FOMO co trzy sekundy. Większość portali nie została zbudowana jako doświadczenie premium decyzji życiowej — została zbudowana jako rynek ogłoszeń.

EstateOS nie wygrywa, stając się „jeszcze jednym portalem”. EstateOS wygrywa, gdy portalowa logika przestaje być centrum grawitacji, a centrum staje się **rozumienie człowieka w drodze do domu**.

---

## 5. Dlaczego filtry nie rozwiązują problemu

Filtry są użyteczne. Discovery™ nie neguje ich istnienia w całym ekosystemie EstateOS. Neguje ich **pozycję jako głównego rytuału odkrywania**.

### 5.1 Filtr wymaga języka, którego użytkownik często nie ma

Aby ustawić filtr, trzeba wiedzieć, że „balkon” jest ważniejszy niż „piętro”, że „40–55 m²” jest właściwym przedziałem, że „Mokotów” jest właściwym zbiorem skojarzeń. Tymczasem wielu użytkowników odkrywa dopiero po fakcie, że balkon był warunkiem koniecznym, a „blisko metro” oznaczało coś innego niż myśleli.

Filtr wymusza **przedwczesną precyzję**. Przedwczesna precyzja wygląda jak kompetencja, a często jest zgadywaniem.

### 5.2 Filtr jest binarny wobec rzeczywistości ciągłej

Życie w mieszkaniu nie jest checklistą. Światło o 16:00 w październiku, akustykę klatki, „czy kuchnia otwarta daje poczucie przestrzeni czy bałaganu”, „czy ta ulica jest moja” — tego nie da się wiarygodnie zredukować do przełączników bez utraty istoty. Filtry świetnie tną to, co mierzalne. Słabo reprezentują to, co decyduje o „chcę tu żyć”.

### 5.3 Filtr uczy system mniej, niż się wydaje

Ustawienie „cena do X” jest deklaracją. Ale odrzucenie pięciu ofert w limicie X, bo „coś nie gra”, oraz polubienie oferty nieco powyżej X, bo „tu wreszcie czuję jakość”, uczy więcej o prawdziwym budżecie psychicznym i aspiracyjnym. Filtry zapisują intencję werbalną. Zachowanie zapisuje intencję ujawnioną.

### 5.4 Filtr skaluje złożoność UI, nie klarowność umysłu

Im więcej filtrów „zaawansowanych”, tym większa iluzja kontroli. Użytkownik dostaje panel laboratoryjny do problemu, który jest częściowo zmysłowy i narracyjny. Efekt uboczny: poczucie winy („pewnie źle ustawiłem filtry”), zamiast poczucia spotkania z miejscem.

### 5.5 Filtr jest łatwy do skopiowania — więc nie jest przewagą

Każdy konkurent może dodać te same checkboxy. Przewaga EstateOS nie może opierać się na liczbie dimmerów. Przewaga musi opierać się na jakości zrozumienia i jakości doświadczenia odkrywania.

**Wniosek wizji:** filtry mogą pozostać narzędziem w innych kontekstach EstateOS (np. celowe, świadome zawężenie). Discovery™ istnieje po to, by **główna droga odkrywania nie zaczynała się od laboratorium parametrów**.

---

## 6. Dlaczego użytkownicy często nie wiedzą, czego naprawdę szukają

To nie jest defekt użytkownika. To jest **normalny stan poznawczy** przy decyzjach złożonych i rzadkich.

### 6.1 Preferencje konstruktywistyczne, nie tylko odczytywane

W behawioralnej nauce o decyzjach często przyjmuje się, że preferencje nie zawsze „czekają w głowie” na odczytanie — bywają **konstruowane w procesie wyboru**. Człowiek dowiaduje się, czego chce, porównując, odrzucając, zaskakując się własną reakcją. Formularz zakłada preferencje gotowe. Życie dostarcza preferencje powstające.

### 6.2 Konflikt wartości jest normą, nie wyjątkiem

„Chcę ciszy i jednocześnie życia miasta.”  
„Chcę prestiżu i jednocześnie rozsądku.”  
„Chcę przestrzeni i jednocześnie niskiego czynszu.”  
„Chcę blisko pracy i jednocześnie zieleni.”

Filtr wymaga rozstrzygnięcia konfliktu zanim użytkownik zobaczy, jak konflikt wygląda w realnych ofertach. Discovery™ pozwala konfliktowi ujawnić się naturalnie: przez serię mikro-decyzji, w których niektóre wartości wygrywają częściej niż inne — nie dlatego, że ktoś tak zadeklarował w ankiecie, lecz dlatego, że tak wybrał, gdy zobaczył miejsce.

### 6.3 Język rynku nie jest językiem życia

Użytkownik myśli: „żebym wracał do domu i czuł ulgę”. Portal pyta: „liczba pokoi”. Między tymi językami jest przepaść tłumaczenia. Ludzie nie są głupi — są zmuszani do mówienia dialektem katalogu o sprawach, które są dialektem życia.

### 6.4 Wstyd z niewiedzy

Kultura „musisz wiedzieć, czego chcesz” produkuje wstyd. Ludzie udają pewność, ustawiają ostro filtry, a potem czują się zagubieni, bo wyniki są „poprawne”, ale martwe. Discovery™ musi być przestrzenią, w której **niewiedza na starcie jest dozwolona i szanowana** — bo tylko wtedy prawdziwy gust ma szansę się ujawnić.

### 6.5 Decyzja jest tożsamościowa

Wybór mieszkania mówi coś o tym, kim się jest i kim się chce stać. Dlatego tak często „nie wiem”: bo pytanie nie brzmi tylko „gdzie spać”, lecz „jaką wersję życia wybieram”. Żaden suwak ceny nie uniesie ciężaru tego pytania. Może je tylko poprzedzić albo — w gorszym wypadku — zagłuszyć.

---

## 7. Dlaczego zachowanie użytkownika jest cenniejsze niż deklaracje

### 7.1 Deklaracje są teoriami o sobie

Gdy człowiek mówi „szukam X”, często opisuje teorię: tożsamość aspiracyjną, oczekiwanie społeczne, wczorajszą rozmowę z partnerem, artykuł, który przeczytał, lęk przed błędem. Teoria bywa cenna. Nie jest tożsama z reakcją na konkretne miejsce.

### 7.2 Zachowanie jest kontaktem z rzeczywistością

Gest „tak / nie / chcę to pilniej” w obliczu konkretnej oferty jest aktem w świecie, nie w abstrakcji. Zawiera informację o estetyce, o tolerancji kompromisów, o prawdziwym napięciu budżetu, o tym, czy „blisko centrum” znaczyło to, co użytkownik myślał.

### 7.3 Zachowanie jest gęstsze informacyjnie

Jedna deklaracja „max 800 000” to jeden bit polityki. Dwanaście decyzji wobec ofert wokół tej granicy — z wahaniami, wyjątkami, konsekwentnymi odrzuceniami mimo „idealnych parametrów” — to mapa. Discovery™ istnieje, by zbierać mapy, nie tylko hasła.

### 7.4 Zachowanie zmienia się wraz z uczciem

Deklaracja lubi być sztywna („ustawiłem filtr i koniec”). Zachowanie naturalnie ewoluuje: po tygodniu człowiek wie więcej o sobie. System oparty o zachowanie może dojrzewać razem z użytkownikiem. System oparty wyłącznie o deklarację często zostaje w tyle za człowiekiem albo zmusza go do ręcznego „przebudowywania siebie” w panelu.

### 7.5 Szacunek wymaga obu — ale hierarchia jest jasna

Wizja Discovery™ nie brzmi: „ignoruj, co ludzie mówią”. Brzmi: **traktuj deklaracje jako hipotezy, a zachowanie jako dowody** — i buduj doświadczenie tak, by dowody powstawały godnie, świadomie, z możliwością wpływu użytkownika na to, czego system się o nim uczy.

To jest fundament zaufania: uczenie się z zachowania bez poczucia, że ktoś „czyta w myślach przeciw mnie”.

---

## 8. Jak Discovery™ zmieni sposób wyszukiwania nieruchomości

Discovery™ nie „dokłada swipe do portalu”. Zmienia **kolejność poznania**.

### 8.1 Od zapytania do spotkania

Klasycznie: najpierw zapytanie (filtry), potem lista, potem (może) emocja.  
Discovery™: najpierw spotkanie z miejscem, potem emocja i decyzja, potem — emergentnie — język preferencji.

To jest zmiana epistemologii wyszukiwania: od „wiem → szukam” do „spotykam → wiem coraz lepiej”.

### 8.2 Od pracy w katalogu do prowadzenia przez rynek

Użytkownik przestaje być operatorem bazy ogłoszeń. Staje się osobą prowadzoną przez kurację, która robi się coraz bardziej osobista — bez teatralnego „algoritm wie lepiej od Ciebie”, lecz z postawą: „im więcej Twoich prawdziwych wyborów, tym mniej szumu między Tobą a właściwymi miejscami”.

### 8.3 Od ilości otwartych kart do jakości pewności

Sukces sesji nie jest mierzony tym, ile ogłoszeń „przerobiono” jak na taśmie. Jest mierzony tym, czy człowiek wychodzi z większą jasnością: „to jest mój kierunek”, „tego nie chcę już nigdy”, „z tym chcę rozmawiać z agentem”.

### 8.4 Od samotnego zgadywania do współdzielonego zrozumienia

Gdy gust jest poznawany z zachowania, rozmowa z człowiekiem po stronie rynku (agent, doradca, zespół EstateOS) może zacząć się wyżej: nie od „to co Pan/Pani dokładnie szuka?” w próżni, lecz od wspólnego oglądu tego, na co ktoś naprawdę reaguje. To nie zastępuje empatii. To daje empatii lepszy punkt startu.

### 8.5 Od wyszukiwania jako obowiązku do odkrywania jako doświadczenia premium

Apple Human Interface Guidelines uczą, że interfejs powinien być jasny, podporządkowany treści i głęboki w warstwach znaczenia — nie w ozdobie. Discovery™ przenosi tę filozofię na kategorię nieruchomości: **treścią jest miejsce i decyzja człowieka**; UI ma ustąpić; głębokość ma być w rosnącym dopasowaniu i w emocjonalnym bezpieczeństwie procesu — nie w gęstości kontrolek.

---

## 9. Jaką przewagę konkurencyjną daje EstateOS™

### 9.1 Przewaga trudna do skopiowania: skumulowany gust + zaufanie

Każdy może skopiować layout karty. Trudniej skopiować lata uczciwego uczenia się preferencji w sposób, któremu ludzie ufają wystarczająco, by wracać. Discovery™ buduje aktywo: **relację zrozumienia**.

### 9.2 Przewaga kategorii, nie feature’a

Dopóki Discovery™ jest „modułem swipe”, jest feature’em. Gdy Discovery™ staje się domyślnym sposobem, w jaki EstateOS rozumie „szukanie domu”, staje się **definicją kategorii EstateOS**. Konkurenci porównujący „mamy filtry i mapę” przegrywają narracyjnie z „u nas rynek uczy się Ciebie”.

### 9.3 Przewaga w całym lejku

Lepsze odkrywanie oznacza:

- mniej przypadkowych leadów „z ciekawości parametrów”,  
- więcej rozmów opartych o realny sygnał zainteresowania,  
- wyższą jakość czasu agenta,  
- wyższe poczucie, że EstateOS „zna mnie” także poza samym Discovery — w sposób etyczny i użyteczny.

### 9.4 Przewaga marki premium

Premium nie jest gradientem. Premium jest konsekwencją: mniej chaosu, więcej sensu, mniej wstydu z niewiedzy, więcej pewności w czasie. Discovery™ jest nośnikiem tej obietnicy w najbardziej intymnym momencie produktu: gdy człowiek styka się z możliwym domem.

### 9.5 Przewaga obronna

Gdy użytkownik czuje, że system rozumie jego gust, koszt zmiany platformy rośnie — nie przez lock-in techniczny, lecz przez **koszt utraty zrozumienia**. To jest obrona rynkowa oparta o wartość, nie o pułapkę.

### 9.6 Przewaga strategiczna wobec „dużych portali”

Duże portale wygrywają skalą podaży. EstateOS nie musi wygrywać „więcej ogłoszeń niż ktokolwiek”. Może wygrywać „lepsze spotkania człowieka z właściwymi miejscami przy mniejszym cierpieniu”. Discovery™ jest mechanizmem tej asymetrii.

---

## 10. Jakie emocje ma wywoływać Discovery™

Discovery™ ma projektować emocje celowo — jak produkt Apple projektuje spokój przy złożoności — a nie „jako efekt uboczny animacji”.

### 10.1 Emocje pożądane (rdzeń)

**Spokój** — „mogę tu być, nawet jeśli jeszcze nie wiem”.  
**Pewność narastająca** — nie natychmiastowa wszechwiedza, lecz poczucie, że z sesji na sesję jestem bliżej jasności.  
**Szacunek** — „system nie ocenia mojej niewiedzy”.  
**Prowadzenie** — „nie dryfuję sam po oceanie ogłoszeń”.  
**Przyjemność kontaktu z miejscem** — estetyka i powaga kadru, nie tania stymulacja.  
**Ulga** — mniej hałasu poznawczego.  
**Godność decyzji** — poczucie, że to poważna sprawa traktowana poważnie.

### 10.2 Emocje dopuszczalne w mikro-momentach

**Lekkie zaskoczenie** — „nie spodziewałem się, że to mnie ruszy”.  
**Satysfakcja rozpoznania** — „tak, to jest 'moje'”.  
**Zdrowa mobilizacja** — gdy pojawia się właściwy trop (bez paniki).

### 10.3 Emocje zakazane jako cel projektu

**Uzależnienie od nieskończonego feedu** — Discovery™ nie jest maszynką dopaminową.  
**Wstyd** — z niewiedzy, z „złych” wyborów, z braku decyzji.  
**Presja manipulacyjna** — sztuczny niedobór, agresywne FOMO, zawstydzanie.  
**Poczucie bycia czytanym przeciw sobie** — uczenie bez transparentności i kontroli.  
**Chaos** — gęstość UI, hałas, „panel sterowania życiem”.  
**Płytka zabawa** — trywializacja decyzji o domu.

### 10.4 Emocjonalny kontrakt marki

Jeśli po sesji Discovery™ człowiek czuje się **głupszy, bardziej winny albo bardziej zmęczony bez klarowności** — produkt złamał wizję, nawet jeśli „zaangażowanie” wzrosło.  
Jeśli po sesji czuje się **spokojniejszy i bardziej zorientowany** — produkt jest na kursie.

---

## 11. Jakie wartości reprezentuje Discovery™

Wartości nie są ozdobnikami. Są kryteriami rozstrzygania sporów projektowych.

### 11.1 Człowiek przed katalogiem

Najpierw godność i tempo człowieka, potem efektywność indeksu ogłoszeń.

### 11.2 Prawda ujawniona przed deklaracją wygodną

Wolimy prawdziwy sygnał z wyboru niż ładną, ale pustą deklarację w formularzu.

### 11.3 Cisza przed hałasem

Premium ubywa elementów, nie dodaje. Każdy element musi uzasadnić swoją obecność wobec spokoju decyzji.

### 11.4 Jasność przed sprytem

Wyjaśnialność i zrozumiałość intencji systemu wygrywają ze „smart” bez sensu. Inteligencja, której użytkownik nie ufa, nie jest premium — jest zagrożeniem.

### 11.5 Szacunek przed optymalizacją retencji

Nie maksymalizujemy czasu w produkcie kosztem zdrowia decyzyjnego. Retencja ma wynikać z wartości, nie z pułapki.

### 11.6 Odpowiedzialność przed wygodą algorytmu

Uczenie się z zachowania obliguje do etyki, prywatności, kontroli i anty-dyskryminacyjnej uważności. Wygoda modelu nie usprawiedliwia krzywdy.

### 11.7 Realizm rynku przed fantazją technologiczną

Nieruchomości mają ograniczenia podaży, jakości zdjęć, czasu, prawa, lokalnych rytuałów. Discovery™ nie obiecuje magii — obiecuje lepsze prowadzenie w świecie rzeczywistym.

### 11.8 Ciągłość marki EstateOS™

Discovery™ ma smakować jak EstateOS: pewnie, nowocześnie, z klasą — nie jak osobna aplikacja „do zabawy swipe’em” doklejona taśmą.

---

## 12. Jak będzie wyglądać przyszłość Discovery™ za 5 lat

Wizja pięcioletnia nie jest roadmapą ticketów. Jest obrazem świata, w którym Discovery™ spełniło obietnicę.

### 12.1 Rok 0–1: nowa norma odkrywania w EstateOS

Discovery™ staje się rozpoznawalnym rytuałem marki: sposobem, w jaki ludzie „wchodzą w rynek” bez wstydu z niewiedzy. EstateOS przestaje być opisywane wyłącznie przez mapę i katalog — zaczyna być opisywane przez **rozumienie gustu**.

### 12.2 Rok 2–3: Discovery jako język relacji z rynkiem

Profil gustu — budowany z zachowania, wyjaśnialny, kontrolowalny — staje się mostem między człowiekiem a profesjonalistą po drugiej stronie. Rozmowy o nieruchomościach w ekosystemie EstateOS zaczynają się od wspólnego zrozumienia reakcji, nie od pustej ankiety. Discovery™ wpływa na jakość całego rynku relacji w produkcie, nie tylko na jeden tryb przeglądania.

### 12.3 Rok 3–5: kategoria „Discovery living decisions”

W świadomości użytkowników i partnerów EstateOS Discovery™ oznacza kategorię: **premium discovery dla decyzji mieszkaniowych** (a w dojrzałej fazie — spójne rozszerzenie filozofii także na inne verticale ekosystemu, o ile zachowana zostanie ta sama godność i non-goals). Konkurenci mają swipe. EstateOS ma **kulturę odkrywania**: spokój, uczenie, wyjaśnialność, skuteczność życiową.

### 12.4 Obraz sukcesu za 5 lat (jakościowy)

- Ludzie mówią: „w EstateOS znalazłem nie przez filtrowanie — przez odkrywanie”.  
- Decyzje zapadają z mniejszym wyczerpaniem psychicznym.  
- Profesjonaliści rynku dostają lepszy start zrozumienia klienta.  
- EstateOS jest kojarzone z inteligencją szanującą człowieka, nie z manipulacją.  
- Discovery™ jest chronione jako klejnot marki: nie rozmyte w feature creep, nie spłycone do „kolejnego feedu”.

### 12.5 Czego wizja świadomie nie obiecuje za 5 lat

- Że algorytm „wybierze dom za człowieka”.  
- Że zniknie potrzeba oględzin, doradztwa, negocjacji, emocji pary/rodziny.  
- Że każda preferencja będzie w 100% przewidywalna.  
- Że nieskończony engagement jest celem.

Discovery™ ma czynić człowieka **bardziej sobą w decyzji** — nie mniej odpowiedzialnym.

---

## 13. Zasady wizji (kanon rozstrzygający)

Poniższe zasady są częścią wizji. Służą do odrzucania pomysłów, które wyglądają atrakcyjnie, ale łamią produkt.

1. **Discovery™ nie jest ankietą.** Jeśli rozwiązanie wymaga, by użytkownik „najpierw wypełnił siebie”, jest poza wizją.  
2. **Discovery™ nie jest formularzem.** Jeśli centrum doświadczenia to pola i walidacje deklaracji, jest poza wizją.  
3. **Discovery™ nie jest panelem filtrów.** Jeśli główna obietnica to „więcej kryteriów”, jest poza wizją.  
4. **Discovery™ jest doświadczeniem premium.** Premium = spokój, jasność, szacunek, głębia sensu — nie ozdoba.  
5. **Zachowanie > pusta deklaracja**, przy zachowaniu godności, zgody i kontroli.  
6. **Prowadzenie > porzucenie w katalogu.**  
7. **Klarowność narastająca > aktywność bez postępu.**  
8. **Wyjaśnialność > czarna skrzynka.**  
9. **Zdrowie decyzyjne > maksymalizacja czasu sesji.**  
10. **EstateOS najpierw, feature później.** Discovery™ wzmacnia markę, nie konkuruje z nią estetycznie ani moralnie.

---

## 14. Definicja „najlepszego na świecie” w tej kategorii

„Najlepszy na świecie” nie oznacza „najwięcej gestów” ani „najwięcej AI w prezentacji”. Oznacza jednocześnie:

- **najwyższą jakość emocjonalną** procesu odkrywania domu,  
- **najwyższą etyczną jakość** uczenia się z zachowania,  
- **najwyższą skuteczność** w prowadzeniu człowieka ku jasności i trafnym spotkaniom z miejscami,  
- **najwyższą spójność marki premium** w kategorii decyzji wysokiej stawki,  
- **najtrudniejszą do skopiowania** przewagę zrozumienia.

Discovery™ wygrywa, gdy po latach konkurenci nadal mogą naśladować powierzchnię, ale nie mogą naśladować **zaufania i głębi relacji gustu**, którą EstateOS uczciwie zbudował.

---

## 15. Głosy zespołu wizji (synteza)

**Product Owner:** Discovery™ jest strategią kategorii, nie sprintowym bajerem. Chronimy non-goals jak IP.  
**UX Designer Apple:** Interfejs ustępuje treści i decyzji; głębokość jest w doświadczeniu, nie w gęstości.  
**Behavioural Psychologist:** Preferencje powstają w wyborze; wstyd z niewiedzy jest wrogiem prawdy o gustach.  
**Real Estate Expert:** Dom to życie, nie wiersz w bazie; narzędzie musi honorować wielowymiarowość decyzji.  
**Senior AI Architect:** Inteligencja bez szacunku i wyjaśnialności nie jest przewagą — jest ryzykiem marki.  
**Data Scientist / ML Engineer (ramy wizji):** Wartość sygnału behawioralnego przewyższa wygodę deklaracji — o ile pomiar nie niszczy doświadczenia.  
**Senior Software Architect (ramy wizji):** Wizja wyznacza granice domeny: Discovery™ nie pochłania Radaru, filtrów ani całego EstateOS — staje się sercem odkrywania.

---

## 16. Zdanie zamykające wizję

**EstateOS™ Discovery™ istnieje po to, by człowiek mógł odkryć, gdzie chce żyć — zanim będzie musiał to perfekcyjnie nazwać — i by EstateOS stało się synonimem rynku, który rozumie ludzi głębiej niż katalogi rozumieją parametry.**

---

## 17. Rejestr akceptacji

| Pole | Wartość |
|------|---------|
| Dokument | `docs/discovery/01-vision/01-product-vision.md` |
| Status | `REVIEW` |
| Objętość docelowa | minimum 4000 słów |
| Następny dokument po akceptacji | `01-vision/02-positioning-and-non-goals.md` |

**STOP.** Nie powstaje kolejny dokument do czasu Twojej akceptacji, listy poprawek lub odrzucenia.

**Koniec dokumentu `01-product-vision.md`.**
