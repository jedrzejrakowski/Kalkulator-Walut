# Kalkulator walut NBP

Przelicza kwotę w walucie obcej na złote według **kursu średniego NBP z ostatniego dnia
roboczego poprzedzającego zdarzenie gospodarcze** — tak, jak wymaga art. 11a ust. 2 ustawy
o PIT, art. 15 ust. 1 ustawy o CIT oraz art. 31a ust. 1 ustawy o VAT.

## Obie tabele kursów

| Tabela | Co zawiera | Kiedy ogłaszana |
| --- | --- | --- |
| A | waluty wymienialne | każdy dzień roboczy |
| B | pozostałe, w tym rynki wschodzące | raz w tygodniu, w środy |

Aplikacja pyta najpierw o tabelę A, a gdy NBP nie ogłasza tam danej waluty — o tabelę B.
Dzięki temu działa również dla walut azjatyckich, których w tabeli A nie ma.

Lista walut pobierana jest **prosto z API NBP**, z obu tabel. W kodzie nie ma wpisanego na
stałe spisu kodów: NBP przenosi waluty między tabelami i dopisuje nowe, więc każda lista
w kodzie zdezaktualizowałaby się bez ostrzeżenia. Gdy API jest nieosiągalne, kod waluty
można wpisać ręcznie.

## Przeliczanie między walutami obcymi

Waluta docelowa inna niż złoty prowadzi przeliczenie przez złotego: kwota razy kurs
źródłowy daje wartość w złotych, a ta podzielona przez kurs docelowy daje wynik.
NBP ogłasza wszystkie kursy względem złotego, więc innej drogi nie ma — i tej samej
wymaga art. 11a ust. 2 ustawy o PIT, który zakazuje kursów krzyżowych z rynku.

Wartość w złotych zaokrąglana jest do groszy przed dalszym przeliczeniem, bo to ona
trafia do ksiąg. Dzięki temu rachunek pokazany na ekranie odtwarza się krok po kroku.

**Zaokrąglenie do groszy liczymy na liczbach całkowitych**, nie zmiennoprzecinkowych
(`src/domain/grosze.ts`). Liczba 400,055 leży w pamięci komputera jako 400,05499999…,
więc zwykłe zaokrąglenie dawało 400,05 zamiast 400,06 — i tak było przy każdej kwocie
kończącej się równo na połówce grosza. Kwotę i kurs rozkładamy na cyfry, mnożymy
dokładnie i zaokrąglamy raz, na końcu: końcówki od pół grosza w górę. Test porównuje
wynik ze wzorcem na dwustu tysiącach losowych par kwoty i kursu.

Obie waluty mogą pochodzić z różnych tabel, a wtedy także z różnych dni — tabela B
bywa starsza, bo ogłaszana jest raz w tygodniu. Wynik pokazuje obie tabele osobno.

## Wybór waluty

NBP ogłasza ponad sto czterdzieści walut, więc zwykła lista rozwijana przeglądarki
nie wystarcza — trzeba szukać po kodzie albo nazwie. Oba pola działają tak samo:
pokazują bieżący wybór, a klik otwiera panel z wyszukiwarką, który wypływa nad
formularzem. Dwie listy rozwinięte na stałe zajmowałyby ponad pół ekranu na wybór,
który po ustawieniu rzadko się zmienia.

Nad wyszukiwarką waluty źródłowej stoi podział na tabele, bo zawęża inaczej niż
ona — po rytmie ogłaszania, a nie po nazwie. Dla księgowego to rozróżnienie
istotne: kurs z tabeli B bywa starszy od wymaganego dnia, bo NBP ogłasza ją
w środy. Po wyborze pole mówi wprost, z której tabeli pochodzi kurs.

Wspólny jest cały mechanizm pola — `src/components/PoleWaluty.tsx` — bo oba
różnią się tylko zawartością listy i tym, co stoi nad wyszukiwarką. Samo szukanie
siedzi w `src/domain/szukaj.ts` i pomija znaki diakrytyczne w obie strony:
„filipinskie” trafia tak samo jak „filipińskie”.
Nikt nie sięga po ogonki, szukając waluty w pośpiechu.

Waluta źródłowa nie pojawia się na liście celów, a wybranie jej po lewej stronie
cofa cel do złotego — przeliczenie waluty na samą siebie nie miałoby sensu.

## Kalendarz daty zdarzenia

Rozwijany kalendarzyk jest własny, bo natywny nie wie nic o regule z art. 11a
ust. 2: że sobota cofa kurs do piątku. Siatka niesie to wprost — dni wolne
innym kolorem, przerywany pierścień na dniu, z którego pójdzie kurs, dni
z przyszłości wygaszone, a pod spodem zdanie tłumaczące wybór.

Pierścień i zdanie idą za dniem **pod kursorem**, nie za wyborem: skutek ma być
widoczny przed kliknięciem, a nie po nim. To ta sama konwencja co na wykresie,
gdzie przerywana kreska wskazuje kurs użyty do księgowania.

Wpisywanie daty zostaje natywne — podmieniamy wyłącznie rozwijany kalendarzyk,
więc datę dalej da się wklepać cyframi, bez sięgania po mysz.

Na urządzeniach dotykowych własnego kalendarza nie ma: systemowy wybierak
z bębenkami jest tam wyraźnie wygodniejszy od siatki, w którą trzeba celować.
Decyduje zapytanie `(hover: hover) and (pointer: fine)`, a nie szerokość okna —
bo chodzi o rodzaj wskaźnika, nie o rozmiar ekranu.

## Wyszukiwanie kursu

Zamiast odpytywać API dzień po dniu, aplikacja pobiera **zakres szesnastu dni** kończący się
wymaganym dniem i bierze ostatnią ogłoszoną tabelę. Jedno zapytanie zamiast kilkunastu,
a przy okazji poprawna obsługa świąt oraz tygodniowego rytmu tabeli B.

Gdy kurs pochodzi z dnia wcześniejszego niż wymagany, aplikacja mówi o tym wprost i wyjaśnia
dlaczego — święto albo tygodniowa tabela B.

## Układ

Trzy bloki obok siebie: formularz, wynik, wykres. Przy dwóch kolumnach wykres
lądował pod wynikiem i strona rosła na dwa ekrany — trzeba było przewijać, żeby
go w ogóle zobaczyć. Na monitorze Full HD zostawało przy tym ponad siedemset
pikseli pustego marginesu po bokach, bo strona trzymała się szerokości 1160 px.
Trzecia kolumna zajmuje to miejsce, zamiast zabierać je formularzowi.

| Szerokość okna | Układ |
| --- | --- |
| od 1200 px | trzy kolumny obok siebie, strona do 1640 px |
| 940–1199 px | formularz po lewej, wynik nad wykresem po prawej |
| poniżej 940 px | jedna kolumna, kolejno formularz, wynik, wykres |

Granica trzech kolumn stoi na 1200 px, a nie wyżej, bo laptop 15,6" rzadko
daje więcej: 1366×768 albo 1920×1080 przy skalowaniu Windows 125–150% to
1280–1536 px logicznych. Przy dwóch kolumnach strona rosła tam do 1405 px
i wracał problem, dla którego trzecia kolumna w ogóle powstała.

Osobno liczy się wysokość okna. Poniżej 860 px nagłówek układa się w rzędzie —
logo obok tytułu zamiast nad nim — bo wyśrodkowany zajmuje 199 px, czyli jedną
trzecią ekranu laptopa. Na monitorze stacjonarnym próg się nie włącza.

Rozmieszczenie opisane jest nazwanymi obszarami siatki, więc kolejność w kodzie
zostaje ta sama we wszystkich trzech układach — zmienia się tylko mapa obszarów.

Karty w jednym rzędzie kończą się na tej samej wysokości, a treść mają różnej
długości. Wolne miejsce nie zbiera się w jedną dziurę: wykres wypełnia je
rysunkiem, formularz i karta wyniku rozkładają je między swoje sekcje, a karta
bez treści układa komunikat na środku.

Rozkładanie działa tylko przy trzech kolumnach. Przy dwóch formularz sięga
wysokości wyniku i wykresu razem, więc ten sam zabieg rozrzuciłby pola po pół
ekranu — tam przycisk zostaje przy dolnej krawędzi.

## Wykres historyczny

Pod wynikiem rysuje się przebieg kursu z ostatnich 30, 90 albo 365 dni — z tych samych
tabel NBP, z których liczy się księgowanie. Przerywana pionowa kreska i pierścień
wskazują dzień kursu użytego do przeliczenia, żeby było widać, czy wypadł on wysoko,
czy nisko na tle okresu.

Najechanie kursorem czyta wartość z najbliższego notowania; sekcja *Notowania w tabeli*
podaje ten sam szereg liczbami, dla czytników ekranu i do przeklejenia.

Geometria siedzi w `src/domain/wykres.ts` jako czysta matematyka — skale, kreski osi
i ścieżki — więc testy sprawdzają, że każda podpisana kreska mieści się w zakresie,
a punkty nie wychodzą poza pole rysowania. Wykres rysowany jest w jednostkach równych
pikselom kontenera: gdyby ramka miała stałą szerokość, na telefonie przeglądarka
przeskalowałaby rysunek razem z podpisami osi i daty stałyby się nieczytelne.

Wysokość rysunku wynika z wysokości karty, a gęstość kresek osi z wysokości
rysunku. W wysokiej kolumnie skala obejmuje dane ciaśniej — inaczej ten sam
zaokrąglony zakres zostawiałby pod linią połowę pustego pola.

Zakres ograniczony jest do roku, bo API NBP nie przyjmuje dłuższych okresów.

## Daty

Wszystkie rachunki na datach idą po UTC, a zegar lokalny czyta wyłącznie funkcja `dzisiaj`.
Mieszanie `toISOString()` z `getDate()` powoduje, że latem między północą a drugą w nocy
data cofa się o dobę — testy w `src/domain/__tests__/dates.test.ts` pilnują, żeby to nie
wróciło.

## Historia przeliczeń

Pasek przy lewej krawędzi przełącza dwa ekrany: przeliczanie i historię. Ikona
historii niesie licznik zapisanych pozycji, żeby od razu było widać, czy jest
po co tam zaglądać. Na wąskim ekranie pasek wraca do biegu strony jako rząd nad
kartami — przyklejony zabierałby telefonowi połowę i tak skąpej szerokości.

Każde udane przeliczenie zapisuje się samo. Historia przydaje się tylko wtedy,
gdy jest kompletna, a osobny przycisk „zapisz" łatwo pominąć. Powtórzone
przeliczenie tego samego zdarzenia nie dubluje wiersza, a pojedyncze wpisy
i całość da się usunąć.

Wiersz niesie komplet danych z dowodu: datę zdarzenia, kwotę, kurs, numer tabeli
NBP i jej datę oraz wynik. Po tygodniu sama kwota i wynik niczego nie tłumaczą.
„Kopiuj opis" wstawia do schowka jedną linię gotową do wklejenia w opis dowodu —
jedną, bo pola opisu w programach księgowych bywają jednowierszowe.

Na telefonie wiersz nie mieści się nawet w połowie, więc poniżej 760 px tabela
rozkłada się na kafelki: te same dane, jedno pod drugim.

**Sortowanie i filtr.** Nagłówki *Zdarzenie*, *Kwota* i *Wynik* sortują po
kliknięciu: rosnąco, malejąco, a za trzecim razem wracają do kolejności liczenia
— bez tego kroku nie dałoby się wrócić do stanu wyjściowego. Sortowanie jest
stabilne, więc dwa przeliczenia z tego samego dnia zachowują kolejność.

Po wyniku sortujemy zawsze po wartości w złotych, bo to jedyna liczba wspólna
dla wszystkich walut. Sortowanie po kwocie w walucie obcej ma sens dopiero po
zawężeniu do jednej waluty — milion dongów i dwieście euro to nie ta sama skala
— i stopka mówi o tym wprost.

Filtr walut bierze listę z samych danych, nie ze spisu NBP: nie ma sensu
oferować waluty, której nigdy się nie przeliczało. Wpis trafia do wyniku, gdy
waluta stoi po którejkolwiek stronie przeliczenia.

Poniżej 760 px wiersze stają się kafelkami, więc nagłówków tabeli nie ma w co
kliknąć — sortowanie dostaje wtedy własne pole obok filtra.

**Gdzie to siedzi.** W `localStorage` tej przeglądarki, na tym komputerze —
nigdzie nie jest wysyłane i zniknie razem z danymi witryny. To notatnik
pomocniczy, a nie dokumentacja księgowa; dowodem pozostaje to, co w księgach.
Zawartość pamięci przeglądarki traktujemy jak dane spoza aplikacji: każdy wpis
jest sprawdzany przy odczycie, a uszkodzony odrzucany, żeby nie wywrócił ekranu.
Trzymamy najwyżej 200 ostatnich pozycji.

## Ustawienia wyglądu

Zębatka w prawym górnym rogu otwiera panel: motyw jasny, ciemny albo za systemem,
osiem palet kolorów, osiem krojów pisma i cztery wielkości. Wybór zapamiętuje się
między uruchomieniami.

Każda paleta niesie osobne odcienie dla motywu jasnego i ciemnego, a napis na
wypełnieniu w kolorze wiodącym ma własny token. W motywie ciemnym kolor wiodący
jaśnieje, żeby odcinać się od tła — biały napis by wtedy na nim zniknął, więc
atrament staje się ciemny. Testy w `kontrast.test.ts` liczą stosunek kontrastu
według WCAG dla każdej palety w obu motywach i pilnują progu 4,5.

Panel nie przerysowuje niczego samodzielnie — podmienia wartości tych samych zmiennych
CSS, których używa motyw jasny i ciemny. Dlatego rozmiary pisma są w jednostce względnej,
a nie w pikselach: jedno pokrętło skaluje całą typografię.

Kroje systemowe działają bez pobierania z sieci, co ma znaczenie za firmowym filtrem.

## Uruchomienie

```bash
npm install
npm run dev            # serwer deweloperski
npm run build          # build produkcyjny do dist/
npm test               # testy logiki
npm run build:artifact # jeden samodzielny plik HTML
```

Ikony powstają ze źródeł SVG w `public/icons`; po zmianie rysunku:

```bash
npm i -D playwright && node scripts/build-icons.mjs && npm uninstall playwright
```

## Instalacja jako aplikacja

Manifest sprawia, że Edge i Chrome rozpoznają kalkulator jako program do zainstalowania —
z własnym oknem, ikoną w menu Start i przejętym paskiem tytułu. Wymaga adresu `https`.

## Struktura

```
src/domain/     logika niezależna od interfejsu
  dates.ts      daty kalendarzowe bez pułapki stref czasowych
  nbp.ts        klient API: lista walut oraz kurs z przejściem A → B
  convert.ts    złożenie wyniku przeliczenia
  grosze.ts     dokładne mnożenie i dzielenie z zaokrągleniem do groszy
  szukaj.ts     dopasowanie waluty do frazy, wspólne dla obu pól
  kalendarz.ts  siatka miesiąca, dni wolne i dzień kursu
  historia.ts   zapis przeliczeń w pamięci przeglądarki i opis do schowka
  wykres.ts     geometria wykresu: skale, kreski osi, ścieżki
src/components/ interfejs
```

## Zastrzeżenie

Kursy pochodzą bezpośrednio z serwisu NBP. Wynik jest wyliczeniem pomocniczym, nie poradą
podatkową — przy zaliczkach, transakcjach nietypowych i różnicach kursowych obowiązują
zasady właściwe dla danego zdarzenia.
