// @vitest-environment node
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { czyHasloPasuje, dodaj, Kolejka, Magazyn, skrotHasla } from '../uzytkownicy';
import { konta, srodowisko, type Srodowisko } from './pomoc';

let s: Srodowisko;
afterEach(() => s?.sprzataj());

describe('skróty haseł', () => {
  it('scrypt z losową solą: to samo hasło daje różne skróty, oba pasują', async () => {
    const a = await skrotHasla('zażółć gęślą jaźń 2026');
    const b = await skrotHasla('zażółć gęślą jaźń 2026');
    expect(a).toMatch(/^scrypt\$32768\$8\$3\$[\w-]{22}\$[\w-]{43}$/);
    expect(a).not.toBe(b);
    expect(await czyHasloPasuje('zażółć gęślą jaźń 2026', a)).toBe(true);
    expect(await czyHasloPasuje('zażółć gęślą jaźń 2026', b)).toBe(true);
    expect(await czyHasloPasuje('zazolc gesla jazn 2026', a)).toBe(false);
    expect(await czyHasloPasuje('', a)).toBe(false);
  });

  it('polskie litery zapisane na dwa sposoby to to samo hasło', async () => {
    const zlozone = 'źdźbło-trawy-2026'.normalize('NFC');
    const rozlozone = zlozone.normalize('NFD');
    expect(rozlozone).not.toBe(zlozone);
    expect(await czyHasloPasuje(rozlozone, await skrotHasla(zlozone))).toBe(true);
  });

  it('uszkodzony zapis skrótu nigdy nie pasuje', async () => {
    for (const z of ['', 'scrypt', 'bcrypt$10$abc', 'scrypt$32768$8$3$$']) {
      expect(await czyHasloPasuje('cokolwiek', z)).toBe(false);
    }
  });
});

describe('plik kont', () => {
  it('zapis trafia na dysk z prawami tylko dla właściciela, bez plików tymczasowych', async () => {
    s = await srodowisko();
    const [, biuro] = await konta();
    await s.magazyn.zmien((l) => dodaj(l.filter((u) => u.login !== 'biuro2'), { ...biuro!, login: 'biuro3' }));
    const plik = s.magazyn.plik;
    expect(((await stat(plik)).mode & 0o777).toString(8)).toBe('600');
    expect(await readdir(path.dirname(plik))).toEqual(['uzytkownicy.json']);
    const zapisane = JSON.parse(await readFile(plik, 'utf8')) as { uzytkownicy: { login: string }[] };
    expect(zapisane.uzytkownicy.map((u) => u.login)).toEqual(['biuro1', 'biuro3']);
    // Drugi odczyt z dysku — nowy obiekt, te same konta.
    expect((await new Magazyn(plik).wszyscy()).map((u) => u.login)).toEqual(['biuro1', 'biuro3']);
  });

  it('zmiana pliku z zewnątrz (polecenie w terminalu) działa bez restartu', async () => {
    s = await srodowisko();
    expect(await s.magazyn.znajdz('biuro2')).toBeDefined();
    const [admin] = await konta();
    await new Promise((r) => setTimeout(r, 20));
    await writeFile(s.magazyn.plik, JSON.stringify({ uzytkownicy: [admin] }));
    expect(await s.magazyn.znajdz('biuro2')).toBeUndefined();
  });

  it('równoczesne zmiany nie gubią się nawzajem', async () => {
    s = await srodowisko();
    const [, biuro] = await konta();
    await Promise.all(
      ['a1', 'a2', 'a3', 'a4', 'a5'].map((login) => s.magazyn.zmien((l) => dodaj(l, { ...biuro!, login }))),
    );
    expect((await new Magazyn(s.magazyn.plik).wszyscy()).length).toBe(7);
  });

  it('nieudana zmiana nie psuje pliku ani kolejnych zmian', async () => {
    s = await srodowisko();
    await expect(s.magazyn.zmien(() => {
      throw new Error('przerwane');
    })).rejects.toThrow('przerwane');
    const [, biuro] = await konta();
    await s.magazyn.zmien((l) => dodaj(l, { ...biuro!, login: 'po.bledzie' }));
    expect((await new Magazyn(s.magazyn.plik).wszyscy()).length).toBe(3);
  });

  it('uszkodzony plik zatrzymuje logowanie zamiast wpuszczać bez kontroli', async () => {
    s = await srodowisko();
    await writeFile(s.magazyn.plik, JSON.stringify({ uzytkownicy: [{ login: 'x', haslo: 'jawne' }] }));
    await expect(new Magazyn(s.magazyn.plik).wszyscy()).rejects.toThrow('uszkodzony');
  });

  it('pola spoza modelu (np. dopisane ręcznie) nie przechodzą dalej ani nie wracają na dysk', async () => {
    s = await srodowisko();
    const [admin] = await konta();
    await writeFile(s.magazyn.plik, JSON.stringify({ uzytkownicy: [{ ...admin, nazwa: 'Imie Nazwisko', email: 'ktos@example.com' }] }));
    const m = new Magazyn(s.magazyn.plik);
    expect(Object.keys((await m.wszyscy())[0]!).sort()).toEqual(['admin', 'haslo', 'login', 'wymagaZmiany']);
    await m.zmien((l) => [...l]);
    const naDysku = await readFile(s.magazyn.plik, 'utf8');
    expect(naDysku).not.toContain('Nazwisko');
    expect(naDysku).not.toContain('example.com');
  });

  it('brak pliku to brak kont', async () => {
    s = await srodowisko();
    expect(await new Magazyn(path.join(s.katalog, 'nie-ma.json')).wszyscy()).toEqual([]);
  });
});

describe('kolejka sprawdzania haseł', () => {
  it('najwyżej dwa naraz, nadmiar ponad kolejkę — odmowa, a potem wszystko się wykonuje', async () => {
    const k = new Kolejka(2, 3);
    let teraz = 0;
    let najwiecej = 0;
    const zwolnij: (() => void)[] = [];
    const zadanie = () =>
      k.wykonaj(async () => {
        teraz++;
        najwiecej = Math.max(najwiecej, teraz);
        await new Promise<void>((r) => zwolnij.push(r));
        teraz--;
      });
    const wszystkie = [zadanie(), zadanie(), zadanie(), zadanie(), zadanie()];
    await expect(zadanie()).rejects.toThrow('zajęty');
    let zwolnione = 0;
    while (zwolnione < 5) {
      await new Promise((r) => setTimeout(r, 0));
      expect(zwolnij.length).toBeLessThanOrEqual(2);
      zwolnij.shift()?.();
      zwolnione++;
    }
    await Promise.all(wszystkie);
    expect(najwiecej).toBe(2);
    // Po opróżnieniu kolejki od razu przyjmuje nowe.
    const nowe = zadanie();
    await new Promise((r) => setTimeout(r, 0));
    zwolnij.shift()!();
    await nowe;
  });
});
