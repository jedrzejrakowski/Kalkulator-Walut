#!/usr/bin/env python3
"""Przestawia w Caddyfile blok kalkulatora z plików na serwer z logowaniem.

    python3 caddyfile.py <Caddyfile> <nowy-Caddyfile>

Szuka jedynego bloku strony, który podaje pliki z /srv/apps/kalkulator
(`root` + `file_server`), i zamienia te dwie dyrektywy na
`reverse_proxy kalkulator:8080`. Resztę pliku — n8n, inne strony,
komentarze, wcięcia — zostawia co do znaku.

Kody wyjścia: 0 zmieniono, 3 już przestawione, 2 konfiguracja nietypowa
(nic nie zapisano — trzeba dopasować ręcznie). Na standardowe wyjście
wypisuje adres strony kalkulatora, na błędy — wyjaśnienie.
"""
import re
import sys

KATALOG = re.compile(r'/srv/apps/kalkulator(?![\w.-])')
CEL = 'reverse_proxy kalkulator:8080'


def bez_komentarza(linia: str) -> str:
    # Komentarz w Caddyfile zaczyna się od # na początku słowa.
    return re.sub(r'(^|\s)#.*$', '', linia).strip()


def nietypowe(powod: str) -> None:
    print(powod, file=sys.stderr)
    sys.exit(2)


def main() -> None:
    zrodlo, cel = sys.argv[1], sys.argv[2]
    tekst = open(zrodlo, encoding='utf-8').read()
    linie = tekst.split('\n')

    # Głębokość zagnieżdżenia na początku każdej linii. W Caddyfile blok
    # otwiera „{" na końcu linii, a zamyka „}" stojące samo — klamry
    # w środku słów to zmienne, np. {host}.
    glebokosc = []
    g = 0
    for linia in linie:
        glebokosc.append(g)
        czysta = bez_komentarza(linia)
        if czysta == '}':
            g -= 1
            glebokosc[-1] = g
        elif czysta.endswith('{') and (czysta == '{' or czysta[-2].isspace()):
            g += 1
    if g != 0:
        nietypowe('Nie umiem odczytać Caddyfile (niesparowane klamry).')

    # Bloki najwyższego poziomu: [początek, koniec] włącznie.
    bloki = []
    poczatek = None
    for i, linia in enumerate(linie):
        czysta = bez_komentarza(linia)
        if glebokosc[i] == 0 and czysta.endswith('{'):
            poczatek = i
        elif glebokosc[i] == 0 and czysta == '}' and poczatek is not None:
            bloki.append((poczatek, i))
            poczatek = None

    trafione = [b for b in bloki if any(KATALOG.search(bez_komentarza(linie[i])) for i in range(b[0], b[1] + 1))]
    juz = [b for b in bloki if any(bez_komentarza(linie[i]) == CEL for i in range(b[0], b[1] + 1))]

    if not trafione and len(juz) == 1:
        print(bez_komentarza(linie[juz[0][0]])[:-1].strip())
        sys.exit(3)
    if not trafione:
        nietypowe('Nie znalazłem w Caddyfile strony podającej pliki z /srv/apps/kalkulator.')
    if len(trafione) > 1:
        nietypowe('Pliki z /srv/apps/kalkulator podaje więcej niż jedna strona w Caddyfile.')

    start, koniec = trafione[0]
    adres = bez_komentarza(linie[start])[:-1].strip()
    if not adres or adres.startswith('('):
        nietypowe('Kalkulator jest we fragmencie wielokrotnego użytku, a nie w bloku strony.')

    do_usuniecia = []
    wstaw_przy = None
    wciecie = '\t'
    for i in range(start + 1, koniec):
        czysta = bez_komentarza(linie[i])
        if not czysta:
            continue
        slowa = czysta.split()
        if KATALOG.search(czysta):
            # Odwołanie zagnieżdżone (np. w handle_path) — kalkulator siedzi
            # pod ścieżką, a nie na własnej stronie. Tego nie przestawiamy sami.
            if glebokosc[i] != 1 or slowa[0] != 'root':
                nietypowe(f'Nietypowe odwołanie do kalkulatora w linii {i + 1}: {czysta}')
            do_usuniecia.append(i)
            if wstaw_przy is None:
                wstaw_przy = i
                wciecie = re.match(r'\s*', linie[i]).group(0)
        elif glebokosc[i] == 1 and slowa[0] in ('file_server', 'try_files'):
            if czysta.endswith('{'):
                nietypowe(f'file_server z własnymi ustawieniami w linii {i + 1} — do przestawienia ręcznie.')
            do_usuniecia.append(i)
        elif glebokosc[i] == 1 and slowa[0] in ('reverse_proxy', 'php_fastcgi', 'handle', 'handle_path', 'route', 'redir', 'respond'):
            nietypowe(f'W bloku kalkulatora jest już „{slowa[0]}" (linia {i + 1}) — do przestawienia ręcznie.')

    nowe = []
    for i, linia in enumerate(linie):
        if i == wstaw_przy:
            nowe.append(wciecie + CEL)
        if i not in do_usuniecia:
            nowe.append(linia)
    open(cel, 'w', encoding='utf-8').write('\n'.join(nowe))

    for i in range(start + 1, koniec):
        if glebokosc[i] == 1 and bez_komentarza(linie[i]).split()[:1] in (['basic_auth'], ['basicauth']):
            print('UWAGA: kalkulator ma też hasło Caddy (basic_auth) — zostaje; logowanie w kalkulatorze '
                  'wystarczy, więc można je usunąć.', file=sys.stderr)

    # Ostrzeżenia: strona podająca cały /srv/apps pokazywałaby pliki kalkulatora
    # z ominięciem logowania.
    for s, k in bloki:
        for i in range(s + 1, k):
            czysta = bez_komentarza(linie[i])
            if re.match(r'root\s+(\*\s+)?/srv/apps/?$', czysta):
                print(f'UWAGA: strona „{bez_komentarza(linie[s])[:-1].strip()}" podaje cały katalog /srv/apps.', file=sys.stderr)
    print(adres)


if __name__ == '__main__':
    main()
