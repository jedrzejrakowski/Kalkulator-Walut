#!/usr/bin/env bash
# shellcheck disable=SC1111 # polskie cudzysłowy w komunikatach są zamierzone
# Konto administratora: założenie albo nowe hasło — także gdy zapomnisz hasła.
#
#   bash /opt/kalkulator/admin.sh <identyfikator>
#
# Kolejne osoby dodaje administrator w aplikacji (ekran „Użytkownicy”).
set -euo pipefail

PROJEKT=/opt/kalkulator
NAJKROTSZE=12

[ "$(id -u)" -eq 0 ] || { echo "Uruchom jako root." >&2; exit 1; }
[ -f "$PROJEKT/docker-compose.yml" ] || { echo "Brak instalacji w $PROJEKT — najpierw instaluj.sh." >&2; exit 1; }

login="${1:-}"
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
docker compose -f "$PROJEKT/docker-compose.yml" run --rm -T -e NOWE_HASLO kalkulator node /serwer/serwer.mjs admin "$login"
