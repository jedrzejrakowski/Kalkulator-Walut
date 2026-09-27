import { describe, expect, it } from 'vitest';
import { dataKonta, wygenerujHaslo } from '../konta';

describe('hasło startowe', () => {
  it('trzy grupy po pięć znaków bez znaków łatwych do pomylenia', () => {
    for (let i = 0; i < 200; i++) {
      const h = wygenerujHaslo();
      expect(h).toMatch(/^[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}$/);
      expect(h).not.toMatch(/[il1o0]/);
    }
  });

  it('za każdym razem inne', () => {
    const zbior = new Set(Array.from({ length: 500 }, () => wygenerujHaslo()));
    expect(zbior.size).toBe(500);
  });

  it('jest dość długie, żeby przejść wymogi serwera', () => {
    expect(wygenerujHaslo().length).toBeGreaterThanOrEqual(12);
  });
});

describe('data konta', () => {
  it('po polsku, a zamiast śmieci — kreska', () => {
    expect(dataKonta('2026-09-27T10:00:00.000Z')).toBe('27.09.2026');
    expect(dataKonta('nie data')).toBe('—');
  });
});
