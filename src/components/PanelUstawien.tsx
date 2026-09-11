import { useEffect, useRef } from 'react';
import {
  DOMYŚLNE, KROJE, PALETY, SKALE,
  type Krój, type Motyw, type Paleta, type Ustawienia,
} from '../domain/ustawienia';

const MOTYWY: { wartość: Motyw; nazwa: string }[] = [
  { wartość: 'system', nazwa: 'Jak w systemie' },
  { wartość: 'jasny', nazwa: 'Jasny' },
  { wartość: 'ciemny', nazwa: 'Ciemny' },
];

const OPIS_SKALI: Record<number, string> = {
  0.9: 'Drobne',
  1: 'Zwykłe',
  1.1: 'Duże',
  1.25: 'Bardzo duże',
};

interface Props {
  otwarty: boolean;
  ustawienia: Ustawienia;
  onZmiana: (ustawienia: Ustawienia) => void;
  onZamknij: () => void;
}

export function PanelUstawien({ otwarty, ustawienia, onZmiana, onZamknij }: Props) {
  const okno = useRef<HTMLDialogElement>(null);

  // Okno modalne otwieramy metodą przeglądarki, żeby dostać przyciemnione tło,
  // pułapkę na zaznaczenie i zamykanie klawiszem Escape bez własnego kodu.
  useEffect(() => {
    const d = okno.current;
    if (!d) return;
    if (otwarty && !d.open) d.showModal();
    if (!otwarty && d.open) d.close();
  }, [otwarty]);

  const zmień = (część: Partial<Ustawienia>) => onZmiana({ ...ustawienia, ...część });

  return (
    <dialog ref={okno} className="ustawienia" onClose={onZamknij} aria-label="Ustawienia wyglądu">
      <div className="ustawienia__belka">
        <h2>Wygląd</h2>
        <button type="button" className="ustawienia__zamknij" onClick={onZamknij} aria-label="Zamknij">
          ✕
        </button>
      </div>

      <div className="ustawienia__tresc">
        <section>
          <h3>Motyw</h3>
          <div className="segmented">
            {MOTYWY.map((m) => (
              <button
                key={m.wartość}
                type="button"
                aria-pressed={ustawienia.motyw === m.wartość}
                onClick={() => zmień({ motyw: m.wartość })}
              >
                {m.nazwa}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>Kolor wiodący</h3>
          <div className="swatche">
            {(Object.keys(PALETY) as Paleta[]).map((klucz) => (
              <button
                key={klucz}
                type="button"
                className={`swatch${ustawienia.paleta === klucz ? ' swatch--on' : ''}`}
                style={{ ['--probka' as string]: PALETY[klucz].jasny.accent }}
                aria-pressed={ustawienia.paleta === klucz}
                onClick={() => zmień({ paleta: klucz })}
              >
                <span className="swatch__plama" />
                {PALETY[klucz].nazwa}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>Krój pisma</h3>
          <div className="kroje">
            {(Object.keys(KROJE) as Krój[]).map((klucz) => (
              <button
                key={klucz}
                type="button"
                className={`krój${ustawienia.krój === klucz ? ' krój--on' : ''}`}
                style={{ fontFamily: KROJE[klucz].stos }}
                aria-pressed={ustawienia.krój === klucz}
                onClick={() => zmień({ krój: klucz })}
              >
                {KROJE[klucz].nazwa}
              </button>
            ))}
          </div>
          <p className="field-hint">
            Kroje systemowe działają bez pobierania z sieci — przydatne przy wolnym łączu.
          </p>
        </section>

        <section>
          <h3>Wielkość pisma</h3>
          <div className="segmented">
            {SKALE.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={ustawienia.skala === s}
                onClick={() => zmień({ skala: s })}
              >
                {OPIS_SKALI[s] ?? `${Math.round(s * 100)}%`}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="ustawienia__stopka">
        <button type="button" className="link" onClick={() => onZmiana(DOMYŚLNE)}>
          Przywróć domyślne
        </button>
        <button type="button" className="primary primary--waski" onClick={onZamknij}>
          Gotowe
        </button>
      </div>
    </dialog>
  );
}
