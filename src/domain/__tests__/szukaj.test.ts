import { describe, expect, it } from 'vitest';
import { filtruj, znormalizuj } from '../szukaj';

const waluty = [
  { kod: 'EUR', nazwa: 'euro' },
  { kod: 'PHP', nazwa: 'peso filipińskie' },
  { kod: 'VND', nazwa: 'dong (Wietnam)' },
  { kod: 'RON', nazwa: 'lej rumuński' },
  { kod: 'PLN', nazwa: 'złoty polski' },
  { kod: 'THB', nazwa: 'bat (Tajlandia)' },
];

const kody = (szukane: string) => filtruj(waluty, szukane).map((w) => w.kod);

describe('normalizacja frazy', () => {
  it('sprowadza do małych liter', () => {
    expect(znormalizuj('EuRo')).toBe('euro');
  });

  it('zdejmuje znaki diakrytyczne', () => {
    expect(znormalizuj('filipińskie')).toBe('filipinskie');
    expect(znormalizuj('rumuński')).toBe('rumunski');
  });

  it('radzi sobie z „ł”, którego NFD nie rozkłada', () => {
    expect(znormalizuj('złoty')).toBe('zloty');
    expect(znormalizuj('ŁÓDŹ')).toBe('lodz');
  });
});

describe('filtrowanie walut', () => {
  it('pusta fraza przepuszcza całą listę', () => {
    expect(kody('')).toHaveLength(waluty.length);
    expect(kody('   ')).toHaveLength(waluty.length);
  });

  it('szuka po kodzie, bez względu na wielkość liter', () => {
    expect(kody('vnd')).toEqual(['VND']);
    expect(kody('EUR')).toEqual(['EUR']);
  });

  it('szuka po nazwie', () => {
    expect(kody('dong')).toEqual(['VND']);
    expect(kody('wietnam')).toEqual(['VND']);
  });

  it('znajduje mimo pominiętych ogonków — tak się szuka w pośpiechu', () => {
    expect(kody('filipinskie')).toEqual(['PHP']);
    expect(kody('rumunski')).toEqual(['RON']);
    expect(kody('zloty')).toEqual(['PLN']);
  });

  it('działa też z ogonkami wpisanymi poprawnie', () => {
    expect(kody('filipińskie')).toEqual(['PHP']);
    expect(kody('złoty')).toEqual(['PLN']);
  });

  it('obcina białe znaki dookoła frazy', () => {
    expect(kody('  dong  ')).toEqual(['VND']);
  });

  it('zwraca pustą listę, gdy nic nie pasuje', () => {
    expect(kody('rubel')).toEqual([]);
  });

  it('nie modyfikuje listy wejściowej', () => {
    const wejscie = [...waluty];
    filtruj(wejscie, 'euro');
    expect(wejscie).toHaveLength(waluty.length);
  });
});
