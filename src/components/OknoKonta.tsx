import { useEffect, useRef, useState } from 'react';
import type { Konto } from '../domain/konta';
import { wyloguj } from '../domain/sesja';
import { FormularzHasla } from './FormularzHasla';

interface Props {
  otwarty: boolean;
  konto: Konto;
  onZmianaKonta: (konto: Konto) => void;
  onZamknij: () => void;
}

/** Okno „Konto": kto jest zalogowany, zmiana hasła, wylogowanie. */
export function OknoKonta({ otwarty, konto, onZmianaKonta, onZamknij }: Props) {
  const okno = useRef<HTMLDialogElement>(null);
  const [zmienione, setZmienione] = useState(false);

  useEffect(() => {
    const d = okno.current;
    if (!d) return;
    if (otwarty && !d.open) {
      setZmienione(false);
      d.showModal();
    }
    if (!otwarty && d.open) d.close();
  }, [otwarty]);

  return (
    <dialog ref={okno} className="ustawienia" onClose={onZamknij} aria-label="Konto">
      <div className="ustawienia__belka">
        <h2>Konto</h2>
        <button type="button" className="ustawienia__zamknij" onClick={onZamknij} aria-label="Zamknij">
          ✕
        </button>
      </div>

      <div className="ustawienia__tresc ustawienia__tresc--konto">
        <section className="konto__kto">
          <span className="konto__dane">
            <strong>{konto.login}</strong>
            <span>{konto.admin ? 'administrator' : 'użytkownik'}</span>
          </span>
          <button type="button" className="konto__przycisk-wyloguj" onClick={() => void wyloguj()}>
            Wyloguj
          </button>
        </section>

        <section>
          <h3>Zmiana hasła</h3>
          {zmienione ? (
            <p className="konto__ok" role="status">
              Hasło zmienione. Na innych urządzeniach trzeba będzie zalogować się ponownie.
            </p>
          ) : (
            <FormularzHasla
              onZmieniono={(k) => {
                setZmienione(true);
                onZmianaKonta(k);
              }}
            />
          )}
        </section>
      </div>
    </dialog>
  );
}
