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

## Wyszukiwanie kursu

Zamiast odpytywać API dzień po dniu, aplikacja pobiera **zakres szesnastu dni** kończący się
wymaganym dniem i bierze ostatnią ogłoszoną tabelę. Jedno zapytanie zamiast kilkunastu,
a przy okazji poprawna obsługa świąt oraz tygodniowego rytmu tabeli B.

Gdy kurs pochodzi z dnia wcześniejszego niż wymagany, aplikacja mówi o tym wprost i wyjaśnia
dlaczego — święto albo tygodniowa tabela B.

## Daty

Wszystkie rachunki na datach idą po UTC, a zegar lokalny czyta wyłącznie funkcja `dzisiaj`.
Mieszanie `toISOString()` z `getDate()` powoduje, że latem między północą a drugą w nocy
data cofa się o dobę — testy w `src/domain/__tests__/dates.test.ts` pilnują, żeby to nie
wróciło.

## Ustawienia wyglądu

Zębatka w prawym górnym rogu otwiera panel: motyw jasny, ciemny albo za systemem,
cztery palety kolorów, cztery kroje pisma i cztery wielkości. Wybór zapamiętuje się
między uruchomieniami.

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
src/components/ interfejs
```

## Zastrzeżenie

Kursy pochodzą bezpośrednio z serwisu NBP. Wynik jest wyliczeniem pomocniczym, nie poradą
podatkową — przy zaliczkach, transakcjach nietypowych i różnicach kursowych obowiązują
zasady właściwe dla danego zdarzenia.
