// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { KROJE, PALETY, SKALE } from '../../domain/ustawienia';
import { ADRES_WYLOGOWANIA as WYLOGUJ_W_APLIKACJI, czyZalogowany } from '../../domain/sesja';
import { ADRES_LOGOWANIA, ADRES_WYLOGOWANIA, CIASTKO_ZNACZNIK, STRONA_LOGOWANIA } from '../ochrona';
import strona from '../../../public/logowanie.html?raw';

/**
 * Ekran logowania jest osobnym plikiem bez dostępu do kodu aplikacji, więc
 * część rzeczy musi być w nim przepisana. Te testy pilnują, żeby się nie rozjechały.
 */
function obiekt(nazwa: string): unknown {
  const m = strona.match(new RegExp(`var ${nazwa} = (\\{[\\s\\S]*?\\n        \\});`));
  if (!m) throw new Error(`Brak ${nazwa} w ${STRONA_LOGOWANIA}`);
  return JSON.parse(m[1]!);
}

describe('ekran logowania', () => {
  it('leży pod adresem, który serwer wydaje bez logowania', () => {
    expect(STRONA_LOGOWANIA).toBe('/logowanie.html');
  });

  it('ma te same palety co ustawienia aplikacji', () => {
    const oczekiwane = Object.fromEntries(
      Object.entries(PALETY).map(([k, p]) => [
        k,
        {
          jasny: [p.jasny.accent, p.jasny.accentSoft, p.jasny.titlebarBg],
          ciemny: [p.ciemny.accent, p.ciemny.accentSoft, p.ciemny.titlebarBg],
        },
      ]),
    );
    expect(obiekt('PALETY')).toEqual(oczekiwane);
  });

  it('ma te same kroje pisma i skale', () => {
    const { plex, ...reszta } = KROJE;
    expect(plex.stos).toContain('IBM Plex Sans');
    expect(obiekt('KROJE')).toEqual(Object.fromEntries(Object.entries(reszta).map(([k, v]) => [k, v.stos])));
    expect(strona).toContain(`var SKALE = [${SKALE.join(', ')}];`);
  });

  it('wysyła formularz tam i w takiej postaci, jakiej oczekuje serwer', () => {
    expect(strona).toContain(`<form class="karta" method="post" action="${ADRES_LOGOWANIA}"`);
    expect(strona).toMatch(/<input id="haslo" name="haslo" type="password"/);
    expect(strona).toContain('<input type="checkbox" name="zapamietaj" value="1" />');
    expect(strona).toContain('<input type="hidden" name="powrot" id="powrot" value="/" />');
  });

  it('wstawia adres powrotu jako wartość pola, nigdy jako kod strony', () => {
    expect(strona).toContain("document.getElementById('powrot').value = powrot;");
    expect(strona).not.toMatch(/innerHTML|document\.write|insertAdjacentHTML/);
  });

  it('aplikacja wylogowuje pod adresem, który obsługuje serwer', () => {
    expect(WYLOGUJ_W_APLIKACJI).toBe(ADRES_WYLOGOWANIA);
  });
});

describe('znacznik logowania w aplikacji', () => {
  it('rozpoznaje znacznik wśród innych ciasteczek', () => {
    expect(czyZalogowany(`${CIASTKO_ZNACZNIK}=1`)).toBe(true);
    expect(czyZalogowany(`motyw=ciemny; ${CIASTKO_ZNACZNIK}=1; inne=2`)).toBe(true);
    expect(czyZalogowany('')).toBe(false);
    expect(czyZalogowany(`${CIASTKO_ZNACZNIK}=0`)).toBe(false);
    expect(czyZalogowany(`x${CIASTKO_ZNACZNIK}=1`)).toBe(false);
  });
});
