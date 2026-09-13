import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { czyPoprawnaData, poPolsku, type DataIso } from '../domain/dates';
import {
  DNI_TYGODNIA, miesiacDaty, nazwaMiesiaca, poprzedniDzienRoboczy,
  przesunMiesiac, siatkaMiesiaca, wyjasnienie,
} from '../domain/kalendarz';

interface Props {
  label: string;
  value: string;
  max?: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
}

/**
 * Czy urządzenie ma wskaźnik precyzyjny, czyli mysz albo touchpad.
 *
 * Na dotyku zostawiamy kalendarzyk systemowy: bębenki pod kciuk są tam
 * wyraźnie wygodniejsze od siatki, w którą trzeba celować. Własny kalendarz
 * ma przewagę merytoryczną, nie dotykową, więc nie ma powodu psuć telefonu.
 */
function useMysz(): boolean {
  const [mysz, setMysz] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const pytanie = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sprawdz = () => setMysz(pytanie.matches);
    sprawdz();
    pytanie.addEventListener('change', sprawdz);
    return () => pytanie.removeEventListener('change', sprawdz);
  }, []);

  return mysz;
}

/**
 * Pole daty zdarzenia gospodarczego.
 *
 * Wpisywanie zostaje natywne — datę da się wklepać cyframi, bez sięgania po
 * mysz. Podmieniamy wyłącznie rozwijany kalendarzyk, bo ten przeglądarki nie
 * wie nic o tym, że sobota cofa kurs do piątku.
 */
export function PoleDaty({ label, value, max, onChange, hint }: Props) {
  const mysz = useMysz();
  const [otwarty, setOtwarty] = useState(false);
  const [miesiac, setMiesiac] = useState(() => miesiacDaty(value || max || '2026-01-01'));
  const [wskazany, setWskazany] = useState<DataIso | null>(null);

  const id = useId();
  const ramka = useRef<HTMLDivElement>(null);
  const przycisk = useRef<HTMLButtonElement>(null);

  const siatka = useMemo(() => siatkaMiesiaca(miesiac, max), [miesiac, max]);
  const wybrana = czyPoprawnaData(value) ? value : null;

  // Pierścień i zdanie pod siatką idą za dniem pod kursorem, nie za wyborem:
  // sens jest w tym, żeby skutek było widać przed kliknięciem.
  const podglad = wskazany ?? wybrana;
  const dzienKursu = podglad ? poprzedniDzienRoboczy(podglad) : null;
  const poprzedniDozwolony = max === undefined || `${przesunMiesiac(miesiac, -1)}-01` <= max;
  const nastepnyDozwolony = max === undefined || `${przesunMiesiac(miesiac, 1)}-01` <= max;

  function otworz() {
    setMiesiac(miesiacDaty(wybrana ?? max ?? miesiac));
    setWskazany(null);
    setOtwarty(true);
  }

  function zamknij(wrocFokusem: boolean) {
    setOtwarty(false);
    setWskazany(null);
    if (wrocFokusem) przycisk.current?.focus();
  }

  function wybierz(data: DataIso) {
    onChange(data);
    zamknij(true);
  }

  useEffect(() => {
    if (!otwarty) return;
    const naZewnatrz = (e: PointerEvent) => {
      if (!ramka.current?.contains(e.target as Node)) zamknij(false);
    };
    document.addEventListener('pointerdown', naZewnatrz);
    return () => document.removeEventListener('pointerdown', naZewnatrz);
  }, [otwarty]);

  function klawisz(e: React.KeyboardEvent) {
    if (!otwarty) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      zamknij(true);
    } else if (e.key === 'PageUp' && poprzedniDozwolony) {
      e.preventDefault();
      setMiesiac((m) => przesunMiesiac(m, -1));
    } else if (e.key === 'PageDown' && nastepnyDozwolony) {
      e.preventDefault();
      setMiesiac((m) => przesunMiesiac(m, 1));
    }
  }

  return (
    <div className="field pole-daty" ref={ramka} onKeyDown={klawisz}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>

      <div className={mysz ? 'pole-daty__wiersz' : undefined}>
        <input
          id={id}
          type="date"
          value={value}
          max={max}
          onChange={(e) => onChange(e.target.value)}
        />
        {mysz ? (
          <button
            type="button"
            ref={przycisk}
            className="pole-daty__ikona"
            aria-haspopup="dialog"
            aria-expanded={otwarty}
            aria-label={otwarty ? 'Zamknij kalendarz' : 'Otwórz kalendarz'}
            onClick={() => (otwarty ? zamknij(true) : otworz())}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2.5" />
              <path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
          </button>
        ) : null}

        {otwarty ? (
          <div className="kalendarz" role="dialog" aria-label="Wybór daty zdarzenia">
            <div className="kalendarz__belka">
              <button
                type="button" className="kalendarz__strzalka" aria-label="Poprzedni miesiąc"
                onClick={() => setMiesiac((m) => przesunMiesiac(m, -1))}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <span className="kalendarz__miesiac" aria-live="polite">{nazwaMiesiaca(miesiac)}</span>
              <button
                type="button" className="kalendarz__strzalka" aria-label="Następny miesiąc"
                disabled={!nastepnyDozwolony}
                onClick={() => setMiesiac((m) => przesunMiesiac(m, 1))}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            <div className="kalendarz__siatka" onMouseLeave={() => setWskazany(null)}>
              {DNI_TYGODNIA.map((d) => (
                <div key={d} className="kalendarz__naglowek" aria-hidden="true">{d}</div>
              ))}
              {siatka.map((d) => (
                <button
                  key={d.data}
                  type="button"
                  disabled={d.zablokowany}
                  aria-pressed={d.data === wybrana}
                  aria-label={poPolsku(d.data)}
                  className={
                    'kalendarz__dzien' +
                    (d.wMiesiacu ? '' : ' kalendarz__dzien--obcy') +
                    (d.wolny ? ' kalendarz__dzien--wolny' : '') +
                    (d.data === wybrana ? ' kalendarz__dzien--wybrany' : '') +
                    (d.data === dzienKursu ? ' kalendarz__dzien--kurs' : '')
                  }
                  onMouseEnter={() => setWskazany(d.data)}
                  onFocus={() => setWskazany(d.data)}
                  onClick={() => wybierz(d.data)}
                >
                  {d.numer}
                </button>
              ))}
            </div>

            <p className="kalendarz__stopka">
              {podglad ? (
                <>
                  Zdarzenie <strong>{poPolsku(podglad)}</strong> wypada w{' '}
                  {wyjasnienie(podglad).dzien} — kurs pójdzie z{' '}
                  <strong>{poPolsku(wyjasnienie(podglad).dzienKursu)}</strong>, ostatniego dnia
                  roboczego przed nim.
                </>
              ) : (
                'Wskaż dzień, w którym powstało zobowiązanie.'
              )}
            </p>
          </div>
        ) : null}
      </div>

      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
