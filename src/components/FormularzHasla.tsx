import { useState, type FormEvent } from 'react';
import { NAJKROTSZE_HASLO, zmienWlasneHaslo, type Konto } from '../domain/konta';

interface Props {
  /** Podpis pierwszego pola — przy haśle startowym brzmi inaczej. */
  etykietaStarego?: string;
  przycisk?: string;
  onZmieniono: (konto: Konto) => void;
}

/**
 * Zmiana własnego hasła: obecne, nowe i powtórzone nowe.
 *
 * Proste błędy (różne hasła, za krótkie) wyłapujemy od razu, żeby nie
 * czekać na serwer. Ostateczne słowo i tak ma serwer.
 */
export function FormularzHasla({ etykietaStarego = 'Obecne hasło', przycisk = 'Zmień hasło', onZmieniono }: Props) {
  const [stare, setStare] = useState('');
  const [nowe, setNowe] = useState('');
  const [powtorzone, setPowtorzone] = useState('');
  const [blad, setBlad] = useState<string | null>(null);
  const [wysylam, setWysylam] = useState(false);

  async function wyslij(e: FormEvent) {
    e.preventDefault();
    setBlad(null);
    if ([...nowe].length < NAJKROTSZE_HASLO) {
      setBlad(`Nowe hasło musi mieć co najmniej ${NAJKROTSZE_HASLO} znaków.`);
      return;
    }
    if (nowe !== powtorzone) {
      setBlad('Powtórzone hasło różni się od nowego.');
      return;
    }
    setWysylam(true);
    try {
      const konto = await zmienWlasneHaslo(stare, nowe);
      setStare('');
      setNowe('');
      setPowtorzone('');
      onZmieniono(konto);
    } catch (err) {
      setBlad((err as Error).message);
    } finally {
      setWysylam(false);
    }
  }

  return (
    <form className="formularz-hasla" onSubmit={(e) => void wyslij(e)}>
      {blad ? (
        <p className="error" role="alert">
          {blad}
        </p>
      ) : null}
      <label className="field">
        <span className="field-label">{etykietaStarego}</span>
        <input type="password" autoComplete="current-password" required value={stare} onChange={(e) => setStare(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Nowe hasło</span>
        <input type="password" autoComplete="new-password" required value={nowe} onChange={(e) => setNowe(e.target.value)} />
        <span className="field-hint">Co najmniej {NAJKROTSZE_HASLO} znaków — najłatwiej z kilku słów, np. zielona-herbata-o-poranku.</span>
      </label>
      <label className="field">
        <span className="field-label">Powtórz nowe hasło</span>
        <input type="password" autoComplete="new-password" required value={powtorzone} onChange={(e) => setPowtorzone(e.target.value)} />
      </label>
      <button type="submit" className="primary" disabled={wysylam}>
        {wysylam ? 'Zapisuję…' : przycisk}
      </button>
    </form>
  );
}
