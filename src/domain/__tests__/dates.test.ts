import { describe, expect, it } from 'vitest';
import {
  czyPoprawnaData, czyWeekend, dzisiaj, poPolsku, poprzedniDzienRoboczy, przesun,
} from '../dates';

describe('daty kalendarzowe', () => {
  it('cofa się na piątek, gdy zdarzenie wypada w poniedziałek', () => {
    expect(poprzedniDzienRoboczy('2026-06-22')).toBe('2026-06-19');
  });

  it('dla zdarzenia w środę bierze wtorek', () => {
    expect(poprzedniDzienRoboczy('2026-06-24')).toBe('2026-06-23');
  });

  it('dla zdarzenia w niedzielę bierze piątek', () => {
    expect(poprzedniDzienRoboczy('2026-06-21')).toBe('2026-06-19');
  });

  it('przechodzi przez granicę roku', () => {
    expect(poprzedniDzienRoboczy('2027-01-01')).toBe('2026-12-31');
    expect(przesun('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('przechodzi przez luty roku przestępnego', () => {
    expect(przesun('2028-02-28', 1)).toBe('2028-02-29');
    expect(przesun('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('rozpoznaje weekend', () => {
    expect(czyWeekend('2026-06-20')).toBe(true);
    expect(czyWeekend('2026-06-21')).toBe(true);
    expect(czyWeekend('2026-06-22')).toBe(false);
  });

  it('bierze dzisiejszą datę z zegara lokalnego, nie z UTC', () => {
    // Pierwsza w nocy czasu polskiego latem to jeszcze poprzedni dzień w UTC.
    // Oryginalny kalkulator podstawiał w tym momencie wczorajszą datę.
    const oPierwszejWNocy = new Date(2026, 5, 24, 1, 30);
    expect(dzisiaj(oPierwszejWNocy)).toBe('2026-06-24');
  });

  it('odrzuca daty niepoprawne', () => {
    expect(czyPoprawnaData('2026-06-24')).toBe(true);
    expect(czyPoprawnaData('2026-02-30')).toBe(false);
    expect(czyPoprawnaData('24.06.2026')).toBe(false);
    expect(czyPoprawnaData('')).toBe(false);
  });

  it('pokazuje datę po polsku', () => {
    expect(poPolsku('2026-06-24')).toBe('24.06.2026');
  });
});
