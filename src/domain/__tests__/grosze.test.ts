import { describe, expect, it } from 'vitest';
import { doGroszy, iloczyn, iloczynPrzezIloraz, iloraz } from '../grosze';

/** Wzorzec: kwota w groszach × kurs w dziesięciotysięcznych, połowa w górę. */
const wzorzec = (kwotaGr: number, kursE4: number) =>
  Number((BigInt(kwotaGr) * BigInt(kursE4) + 5000n) / 10000n) / 100;

describe('iloczyn', () => {
  it('zaokrągla połówkę grosza w górę — przypadek zgłoszony z 400,055', () => {
    // Te pary dawały 400,05, bo 400,055 leży w pamięci jako 400,05499999…
    expect(iloczyn(2759, 0.145)).toBe(400.06);
    expect(iloczyn(2225, 0.1798)).toBe(400.06);
    expect(iloczyn(1450, 0.2759)).toBe(400.06);
  });

  it('naprawia przypadki wyłapane w próbie losowej', () => {
    expect(iloczyn(30890.96, 4.3125)).toBe(133217.27);
    expect(iloczyn(42110, 0.5005)).toBe(21076.06);
    expect(iloczyn(9078.55, 0.3)).toBe(2723.57);
  });

  it('zgadza się ze wzorcem na każdej parze z dużej próby', () => {
    let rozbieznosci = 0;
    for (let i = 0; i < 200_000; i += 1) {
      const kwotaGr = 1 + Math.floor(Math.random() * 5_000_000);
      const kursE4 = 1000 + Math.floor(Math.random() * 60_000);
      if (iloczyn(kwotaGr / 100, kursE4 / 10_000) !== wzorzec(kwotaGr, kursE4)) rozbieznosci += 1;
    }
    expect(rozbieznosci).toBe(0);
  });

  it('pomija końcówki poniżej pół grosza', () => {
    expect(iloczyn(100, 4.00004)).toBe(400);
    expect(iloczyn(100, 4.00005)).toBe(400.01);
  });

  it('radzi sobie z kursem z tabeli B o wielu miejscach po przecinku', () => {
    // Milion dongów po 0,00014309 zł to dokładnie 143,09 zł.
    expect(iloczyn(1_000_000, 0.00014309)).toBe(143.09);
    expect(iloczyn(1_234_567, 0.00014309)).toBe(176.65);
  });

  it('czyta liczby w zapisie wykładniczym', () => {
    // JavaScript przechodzi na zapis 1e-7 poniżej jednej milionowej.
    expect(iloczyn(10_000_000, 1.5e-7)).toBe(1.5);
    expect(iloczyn(1e21, 1e-21)).toBe(1);
  });

  it('zaokrągla ujemne symetrycznie — korekty mają dawać lustrzane kwoty', () => {
    expect(iloczyn(-2759, 0.145)).toBe(-400.06);
    expect(iloczyn(2759, -0.145)).toBe(-400.06);
  });
});

describe('iloraz', () => {
  it('dzieli złote przez kurs docelowy z poprawnym zaokrągleniem', () => {
    expect(iloraz(4326.4, 3.7111)).toBe(1165.8);
    expect(iloraz(100, 3)).toBe(33.33);
    expect(iloraz(200, 3)).toBe(66.67);
  });

  it('połówka grosza idzie w górę', () => {
    expect(iloraz(0.05, 2)).toBe(0.03);
    expect(iloraz(123.45, 2)).toBe(61.73);
  });

  it('nie przyjmuje zera w mianowniku', () => {
    expect(() => iloraz(1, 0)).toThrow(RangeError);
  });
});

describe('iloczyn przez iloraz', () => {
  it('liczy proporcję jednym ruchem', () => {
    // 10 000 zł × 150 000 / 187 500 = 8 000 zł
    expect(iloczynPrzezIloraz(10_000, 150_000, 187_500)).toBe(8000);
    // Proporcja, której ułamek nie ma skończonego rozwinięcia.
    expect(iloczynPrzezIloraz(1000, 150_000, 175_000)).toBe(857.14);
  });

  it('zgadza się z iloczynem, gdy mianownik to jedynka', () => {
    expect(iloczynPrzezIloraz(2759, 0.145, 1)).toBe(iloczyn(2759, 0.145));
  });
});

describe('doGroszy', () => {
  it('zaokrągla krótkie ułamki dziesiętne — sumy i różnice kwot', () => {
    expect(doGroszy(0.1 + 0.2)).toBe(0.3);
    expect(doGroszy(400.055)).toBe(400.06);
    expect(doGroszy(21076.055)).toBe(21076.06);
  });

  it('nie rusza kwot już zaokrąglonych', () => {
    expect(doGroszy(4326.4)).toBe(4326.4);
    expect(doGroszy(0)).toBe(0);
  });
});
