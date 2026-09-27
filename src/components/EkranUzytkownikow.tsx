import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  BladSesji,
  dodajKonto,
  listaKont,
  nadajHaslo,
  NAJKROTSZE_HASLO,
  usunKonto,
  ustawAdmina,
  wygenerujHaslo,
  type Konto,
} from '../domain/konta';

interface Props {
  /** Zalogowany administrator — przy swoim wierszu nie pokazujemy usuwania. */
  ja: Konto;
  onBladSesji: () => void;
}

interface Przekazanie {
  login: string;
  haslo: string;
  nowe: boolean;
}

/**
 * Panel administratora: kto ma dostęp i z jakimi uprawnieniami.
 *
 * Hasło startowe widać tylko raz, zaraz po nadaniu — serwer trzyma wyłącznie
 * jego skrót. Nowa osoba przy pierwszym wejściu i tak musi je zmienić.
 */
export function EkranUzytkownikow({ ja, onBladSesji }: Props) {
  const [konta, setKonta] = useState<Konto[] | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [przekazanie, setPrzekazanie] = useState<Przekazanie | null>(null);
  const [skopiowano, setSkopiowano] = useState(false);
  const [pytanie, setPytanie] = useState<{ login: string; co: 'usun' | 'haslo' } | null>(null);
  const [zajety, setZajety] = useState(false);

  const [login, setLogin] = useState('');
  const [haslo, setHaslo] = useState(() => wygenerujHaslo());
  const [admin, setAdmin] = useState(false);

  /** Wspólna obsługa każdej czynności: blokada przycisków, błąd, odświeżenie listy. */
  const wykonaj = useCallback(
    async (czynnosc: () => Promise<void>) => {
      setBlad(null);
      setZajety(true);
      try {
        await czynnosc();
        setKonta(await listaKont());
      } catch (e) {
        if (e instanceof BladSesji) onBladSesji();
        else setBlad((e as Error).message);
      } finally {
        setZajety(false);
        setPytanie(null);
      }
    },
    [onBladSesji],
  );

  useEffect(() => {
    void wykonaj(async () => {});
  }, [wykonaj]);

  function pokazHaslo(p: Przekazanie) {
    setSkopiowano(false);
    setPrzekazanie(p);
  }

  function dodaj(e: FormEvent) {
    e.preventDefault();
    void wykonaj(async () => {
      const nowe = await dodajKonto({ login, haslo, admin });
      pokazHaslo({ login: nowe.login, haslo, nowe: true });
      setLogin('');
      setAdmin(false);
      setHaslo(wygenerujHaslo());
    });
  }

  function noweHaslo(k: Konto) {
    const h = wygenerujHaslo();
    void wykonaj(async () => {
      await nadajHaslo(k.login, h);
      pokazHaslo({ login: k.login, haslo: h, nowe: false });
    });
  }

  async function kopiuj(tekst: string) {
    try {
      await navigator.clipboard.writeText(tekst);
      setSkopiowano(true);
    } catch {
      // Bez uprawnień do schowka hasło i tak widać — można przepisać.
    }
  }

  return (
    <section className="card kol-historia uzytkownicy">
      <div className="historia__belka">
        <h2>Użytkownicy</h2>
        {konta ? <span className="uzytkownicy__licznik">{konta.length} {konta.length === 1 ? 'konto' : konta.length < 5 ? 'konta' : 'kont'}</span> : null}
      </div>

      {blad ? (
        <p className="error" role="alert">
          {blad}
        </p>
      ) : null}

      {przekazanie ? (
        <div className="przekazanie" role="status">
          <p>
            {przekazanie.nowe ? 'Konto' : 'Nowe hasło dla'} <strong>{przekazanie.login}</strong>
            {przekazanie.nowe ? ' założone.' : '.'} Przekaż tej osobie hasło startowe — widać je tylko teraz:
          </p>
          <div className="przekazanie__haslo">
            <code>{przekazanie.haslo}</code>
            <button type="button" className="link" onClick={() => void kopiuj(przekazanie.haslo)}>
              {skopiowano ? 'Skopiowano' : 'Kopiuj'}
            </button>
          </div>
          <p className="field-hint">
            Przy pierwszym logowaniu trzeba je zmienić na własne.{' '}
            <button type="button" className="link" onClick={() => setPrzekazanie(null)}>
              Zamknij
            </button>
          </p>
        </div>
      ) : null}

      <form className="uzytkownicy__nowy" onSubmit={dodaj}>
        <h3>Nowy użytkownik</h3>
        <div className="uzytkownicy__pola">
          <label className="field">
            <span className="field-label">Identyfikator</span>
            <input
              type="text"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value.toLowerCase())}
              placeholder="np. biuro2"
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
            />
            <span className="field-hint">Nie musi zawierać imienia — wystarczy np. biuro2 albo stanowisko3.</span>
          </label>
          <label className="field">
            <span className="field-label">Hasło startowe</span>
            <span className="uzytkownicy__haslo">
              <input type="text" required value={haslo} onChange={(e) => setHaslo(e.target.value)} autoComplete="off" spellCheck={false} minLength={NAJKROTSZE_HASLO} />
              <button type="button" className="link" onClick={() => setHaslo(wygenerujHaslo())}>
                Wylosuj
              </button>
            </span>
          </label>
        </div>
        <div className="uzytkownicy__dol">
          <label className="uzytkownicy__admin">
            <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
            Administrator — może zarządzać kontami
          </label>
          <button type="submit" className="primary primary--waski" disabled={zajety}>
            Dodaj użytkownika
          </button>
        </div>
      </form>

      {konta === null ? (
        <p className="placeholder">{zajety ? 'Wczytuję listę kont…' : 'Nie udało się wczytać listy kont.'}</p>
      ) : (
        <div className="historia__box">
          <table className="historia">
            <thead>
              <tr>
                <th scope="col">Identyfikator</th>
                <th scope="col">Rola</th>
                <th scope="col">Hasło</th>
                <th scope="col">
                  <span className="sr-only">Działania</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {konta.map((k) => {
                const to = k.login === ja.login;
                const pytam = pytanie?.login === k.login ? pytanie.co : null;
                return (
                  <tr key={k.login}>
                    <td data-etykieta="Identyfikator">
                      <span className="historia__wartosc">
                        <strong>{k.login}</strong>
                        {to ? <span className="uzytkownicy__ty"> (Ty)</span> : null}
                      </span>
                    </td>
                    <td data-etykieta="Rola">
                      {k.admin ? <span className="uzytkownicy__rola">administrator</span> : 'użytkownik'}
                    </td>
                    <td data-etykieta="Hasło">
                      {k.wymagaZmiany ? <span className="uzytkownicy__startowe">startowe, do zmiany</span> : 'własne'}
                    </td>
                    <td className="historia__prawa">
                      {to ? (
                        <span className="field-hint uzytkownicy__swoje">Swoje hasło zmieniasz w oknie „Konto”.</span>
                      ) : pytam ? (
                        <span className="historia__pytanie">
                          {pytam === 'usun' ? `Usunąć konto ${k.login}?` : `Nadać nowe hasło?`}
                          <button
                            type="button"
                            className={pytam === 'usun' ? 'link link--ostrzegawczy' : 'link'}
                            disabled={zajety}
                            onClick={() => (pytam === 'usun' ? void wykonaj(() => usunKonto(k.login)) : noweHaslo(k))}
                          >
                            Tak
                          </button>
                          <button type="button" className="link" onClick={() => setPytanie(null)}>
                            Anuluj
                          </button>
                        </span>
                      ) : (
                        <>
                          <button type="button" className="link" onClick={() => setPytanie({ login: k.login, co: 'haslo' })}>
                            Nowe hasło
                          </button>
                          <button
                            type="button"
                            className="link"
                            disabled={zajety}
                            onClick={() => void wykonaj(async () => void (await ustawAdmina(k.login, !k.admin)))}
                          >
                            {k.admin ? 'Odbierz admina' : 'Nadaj admina'}
                          </button>
                          <button type="button" className="link link--ostrzegawczy" onClick={() => setPytanie({ login: k.login, co: 'usun' })}>
                            Usuń
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="field-hint">
        Nowe hasło od administratora wylogowuje tę osobę ze wszystkich urządzeń. Usunięcie konta działa od razu — także na
        otwartych kartach. Historia przeliczeń każdej osoby zostaje w jej przeglądarce.
      </p>
    </section>
  );
}
