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
| od 1440 px | trzy kolumny obok siebie, strona do 1640 px |
| 940–1439 px | formularz po lewej, wynik nad wykresem po prawej |
| poniżej 940 px | jedna kolumna, kolejno formularz, wynik, wykres |

Rozmieszczenie opisane jest nazwanymi obszarami siatki, więc kolejność w kodzie
zostaje ta sama we wszystkich trzech układach — zmienia się tylko mapa obszarów.

Karty w jednym rzędzie kończą się na tej samej wysokości. Wolne miejsce nie
zbiera się w jedną dziurę: wykres wypełnia je rysunkiem, karta wyniku rozkłada
je między sekcje, a karta bez treści układa komunikat na środku.

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
  convert.ts    złożenie wyniku i zaokrąglenie do groszy
  szukaj.ts     dopasowanie waluty do frazy, wspólne dla obu pól
  wykres.ts     geometria wykresu: skale, kreski osi, ścieżki
src/components/ interfejs
```

## Zastrzeżenie

Kursy pochodzą bezpośrednio z serwisu NBP. Wynik jest wyliczeniem pomocniczym, nie poradą
podatkową — przy zaliczkach, transakcjach nietypowych i różnicach kursowych obowiązują
zasady właściwe dla danego zdarzenia.
