import { describe, expect, it } from 'vitest';
import { wygenerujHaslo } from '../konta';

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
