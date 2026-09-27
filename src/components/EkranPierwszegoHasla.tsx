import type { Konto } from '../domain/konta';
import { wyloguj } from '../domain/sesja';
import { FormularzHasla } from './FormularzHasla';

interface Props {
  konto: Konto;
  onZmieniono: (konto: Konto) => void;
}

/**
 * Pierwsze wejście z hasłem od administratora.
 *
 * Hasło startowe zna ktoś jeszcze, więc zanim pokażemy kalkulator, trzeba
 * ustawić własne. Serwer pilnuje tego samo — do czasu zmiany odmawia
 * wszystkiego poza nią.
 */
export function EkranPierwszegoHasla({ konto, onZmieniono }: Props) {
  return (
    <section className="card pierwsze-haslo">
      <h2>Ustaw własne hasło</h2>
      <p className="card-hint">
        Konto <strong>{konto.login}</strong> założył administrator. Zanim zaczniesz, zamień hasło startowe na
        własne — nikt poza Tobą nie będzie go znał.
      </p>
      <FormularzHasla etykietaStarego="Hasło startowe (od administratora)" przycisk="Ustaw hasło i przejdź dalej" onZmieniono={onZmieniono} />
      <p className="pierwsze-haslo__wyjscie">
        <button type="button" className="link" onClick={() => void wyloguj()}>
          Wyloguj
        </button>
      </p>
    </section>
  );
}
