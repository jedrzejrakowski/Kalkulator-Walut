#!/usr/bin/env bash
# shellcheck disable=SC1111 # polskie cudzysłowy w komunikatach są zamierzone
# Logowanie do Kalkulatora walut na serwerze z Caddy w Dockerze.
#
#   curl -fsSLO https://raw.githubusercontent.com/jedrzejrakowski/Kalkulator-Walut/main/vps/instaluj.sh
#   bash instaluj.sh
#
# Co robi:
#   1. sprawdza, czy GitHub wgrał już nową wersję (aplikację i serwer);
#   2. uruchamia kontener „kalkulator” (Node.js) w sieci web, obok Caddy i n8n;
#   3. zakłada pierwsze konto administratora — pyta o identyfikator i hasło;
#   4. w Caddyfile przestawia stronę kalkulatora z plików na ten kontener:
#      z kopią zapasową, sprawdzeniem przed przeładowaniem i wycofaniem,
#      gdyby Caddy odrzucił nową konfigurację.
# Nie rusza n8n, bazy ani innych stron. Można go uruchomić ponownie.
set -euo pipefail

GALAZ="${GALAZ:-main}"
SUROWE="https://raw.githubusercontent.com/jedrzejrakowski/Kalkulator-Walut/$GALAZ/vps"
APLIKACJA=/srv/apps/kalkulator
SERWER=/srv/apps/kalkulator-serwer
PROJEKT=/opt/kalkulator
CADDYFILE="${CADDYFILE:-/opt/caddy/Caddyfile}"
KONTENER_CADDY="${KONTENER_CADDY:-caddy}"
OBRAZ=node:22-alpine
NAJKROTSZE=12

krok() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
uwaga() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
przerwij() {
  printf '\033[1;31mBŁĄD: %s\033[0m\n' "$*" >&2
  exit 1
}

compose() { docker compose -f "$PROJEKT/docker-compose.yml" "$@"; }

# --- warunki wstępne: nic jeszcze nie zmieniamy ---

[ "$(id -u)" -eq 0 ] || przerwij "Uruchom jako root (w terminalu Hostingera jesteś nim od razu)."
docker compose version >/dev/null 2>&1 || przerwij "Brak Dockera z poleceniem „docker compose”."
docker network inspect web >/dev/null 2>&1 || przerwij "Brak sieci Dockera „web”, w której działa Caddy."
[ "$(docker inspect -f '{{.State.Running}}' "$KONTENER_CADDY" 2>/dev/null)" = true ] ||
  przerwij "Kontener „$KONTENER_CADDY” nie działa."
[ -f "$CADDYFILE" ] || przerwij "Brak pliku $CADDYFILE."
command -v python3 >/dev/null || przerwij "Brak python3."
if [ ! -f "$SERWER/serwer.mjs" ] || [ ! -f "$APLIKACJA/logowanie.html" ]; then
  przerwij "GitHub nie wgrał jeszcze wersji z logowaniem ($SERWER/serwer.mjs). Poczekaj, aż skończy się
wdrożenie w zakładce Actions na GitHubie, i uruchom ten skrypt ponownie."
fi

TYMCZASOWY=$(mktemp -d)
trap 'rm -rf "$TYMCZASOWY"' EXIT

krok "Kontener kalkulatora"
install -d -m 755 "$PROJEKT"
cat >"$PROJEKT/docker-compose.yml" <<'KONIEC'
# Kalkulator walut — serwer z logowaniem. Plik zapisany przez vps/instaluj.sh.
#
# Aplikację i serwer wgrywa GitHub Actions do /srv/apps (tylko do odczytu tutaj).
# Konta i klucz sesji leżą w wolumenie kalkulator_stan — poza /srv/apps,
# więc nie widać ich w Filebrowserze.
name: kalkulator
services:
  kalkulator:
    image: node:22-alpine
    container_name: kalkulator
    restart: unless-stopped
    user: node
    command: ["node", "/serwer/serwer.mjs"]
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: "8080"
      KATALOG: /aplikacja
      STAN: /stan
      # Po wgraniu nowej wersji serwer sam się kończy, a Docker go wznawia.
      KONIEC_PRZY_ZMIANIE: "1"
    volumes:
      - /srv/apps/kalkulator:/aplikacja:ro
      - /srv/apps/kalkulator-serwer:/serwer:ro
      - stan:/stan
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    mem_limit: 256m
    networks: [web]
volumes:
  stan:
    name: kalkulator_stan
networks:
  web:
    external: true
KONIEC
docker pull -q "$OBRAZ" >/dev/null
if ! docker volume inspect kalkulator_stan >/dev/null 2>&1; then
  docker volume create kalkulator_stan >/dev/null
  # Wolumen należy do konta node w kontenerze i nikt inny do niego nie zajrzy.
  docker run --rm -v kalkulator_stan:/stan "$OBRAZ" sh -c 'chown node:node /stan && chmod 700 /stan'
fi
compose up -d --remove-orphans

gotowy=nie
for _ in $(seq 1 20); do
  if docker exec kalkulator node -e "fetch('http://127.0.0.1:8080/',{headers:{accept:'text/html'},redirect:'manual'})
      .then(r=>process.exit([302,503].includes(r.status)?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    gotowy=tak
    break
  fi
  sleep 1
done
[ "$gotowy" = tak ] || przerwij "Kontener kalkulatora nie odpowiada. Dziennik: docker logs kalkulator"
echo "Działa."

krok "Konto administratora"
if compose run --rm -T kalkulator node /serwer/serwer.mjs lista 2>/dev/null | grep -q administrator; then
  echo "Jest już. Nowe hasło dla administratora: bash $PROJEKT/admin.sh <identyfikator>"
else
  login="${ADMIN:-}"
  if [ -z "$login" ]; then
    read -rp "Identyfikator administratora [admin]: " login </dev/tty
    login="${login:-admin}"
  fi
  if [ -z "${NOWE_HASLO:-}" ]; then
    echo "Hasło: co najmniej $NAJKROTSZE znaków, najlepiej kilka słów. Wpisywane znaki nie będą widoczne."
    while true; do
      IFS= read -rsp "Hasło: " NOWE_HASLO </dev/tty
      echo
      IFS= read -rsp "Powtórz hasło: " powtorzone </dev/tty
      echo
      if [ "$NOWE_HASLO" != "$powtorzone" ]; then
        echo "Hasła się różnią — jeszcze raz."
      elif [ "${#NOWE_HASLO}" -lt "$NAJKROTSZE" ]; then
        echo "Za krótkie — co najmniej $NAJKROTSZE znaków."
      else
        break
      fi
    done
    unset powtorzone
  fi
  # Hasło idzie w zmiennej środowiskowej, nie w argumentach polecenia.
  export NOWE_HASLO
  compose run --rm -T -e NOWE_HASLO kalkulator node /serwer/serwer.mjs admin "$login"
  unset NOWE_HASLO
fi
curl -fsSL "$SUROWE/admin.sh" -o "$PROJEKT/admin.sh"

krok "Caddy: strona kalkulatora przez logowanie"
curl -fsSL "$SUROWE/caddyfile.py" -o "$TYMCZASOWY/caddyfile.py"
set +e
adres=$(python3 "$TYMCZASOWY/caddyfile.py" "$CADDYFILE" "$TYMCZASOWY/Caddyfile")
wynik=$?
set -e
case $wynik in
  0)
    obraz=$(docker inspect -f '{{.Config.Image}}' "$KONTENER_CADDY")
    docker run --rm -v "$TYMCZASOWY/Caddyfile:/etc/caddy/Caddyfile:ro" "$obraz" \
      caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >"$TYMCZASOWY/sprawdzenie.log" 2>&1 ||
      { cat "$TYMCZASOWY/sprawdzenie.log"; przerwij "Caddy odrzucił nową konfigurację — nic nie zmieniłem."; }
    kopia="$CADDYFILE.przed-logowaniem-$(date +%Y%m%d-%H%M%S)"
    cp -p "$CADDYFILE" "$kopia"
    # Zapis w miejscu, nie podmiana pliku: Caddy ma go podpiętego jako pojedynczy
    # plik, a podpięcie trzyma się starego pliku, nie nazwy.
    cat "$TYMCZASOWY/Caddyfile" >"$CADDYFILE"
    if ! docker exec "$KONTENER_CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >"$TYMCZASOWY/reload.log" 2>&1; then
      cat "$kopia" >"$CADDYFILE"
      docker exec "$KONTENER_CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || true
      cat "$TYMCZASOWY/reload.log"
      przerwij "Caddy nie przyjął zmiany — przywróciłem poprzednią konfigurację."
    fi
    echo "Przestawione. Kopia poprzedniej konfiguracji: $kopia"
    ;;
  3) echo "Już przestawione wcześniej." ;;
  *)
    uwaga "Caddyfile ma nietypowy układ — nic w nim nie zmieniłem. Kontener kalkulatora działa,"
    uwaga "ale strona nadal jest podawana wprost z plików. Wklej w rozmowie komunikat powyżej"
    uwaga "i wynik polecenia: cat $CADDYFILE"
    exit 1
    ;;
esac

krok "Sprawdzenie"
domena=${adres%%[ ,]*}
domena=${domena#*://}
domena=${domena%%:*}
kod=$(curl -sk --resolve "$domena:443:127.0.0.1" -o /dev/null -w '%{http_code} %{redirect_url}' \
  -H 'Accept: text/html' "https://$domena/" || true)
case $kod in
  "302 "*logowanie.html*) echo "https://$domena prosi o logowanie." ;;
  *) uwaga "Odpowiedź https://$domena to „$kod” zamiast przekierowania na logowanie. Dziennik: docker logs kalkulator" ;;
esac

cat <<KONIEC

Gotowe. Kalkulator: https://$domena
Zaloguj się jako administrator — kolejne osoby dodasz w aplikacji, na ekranie „Użytkownicy”.

  Nowe hasło administratora (np. gdy zapomnisz):  bash $PROJEKT/admin.sh <identyfikator>
  Dziennik:                                        docker logs kalkulator
  Cofnięcie w Caddy:                               cat <kopia> > $CADDYFILE && docker exec $KONTENER_CADDY caddy reload --config /etc/caddy/Caddyfile
KONIEC
