#!/usr/bin/env bash
# Konto administratora: założenie albo nowe hasło.
#
#   sudo bash admin.sh <identyfikator>
#
# Pierwsze konto zakłada się tym poleceniem na serwerze; kolejne osoby dodaje
# już administrator w aplikacji (ekran „Użytkownicy"). To samo polecenie
# ratuje sytuację, gdy administrator zapomni hasła.
set -euo pipefail

SERWER=${SERWER:-/srv/apps/kalkulator-serwer/serwer.mjs}
STAN=${STAN:-/var/lib/kalkulator-walut}
KONTO_USLUGI=kalkulator
NAJKROTSZE=12

if [ "$(id -u)" -ne 0 ]; then
  echo "Uruchom jako administrator: sudo bash $0 <identyfikator>" >&2
  exit 1
fi
[ -f "$SERWER" ] || { echo "Brak serwera kalkulatora: $SERWER" >&2; exit 1; }

login="${1:-}"
if [ -z "$login" ]; then
  read -rp "Identyfikator administratora (np. admin): " login </dev/tty
fi

if [ -n "${NOWE_HASLO:-}" ]; then
  haslo="$NOWE_HASLO"
else
  echo "Hasło: co najmniej $NAJKROTSZE znaków, najlepiej kilka słów. Wpisywane znaki nie będą widoczne."
  while true; do
    IFS= read -rsp "Hasło: " haslo </dev/tty
    echo
    IFS= read -rsp "Powtórz hasło: " powtorzone </dev/tty
    echo
    if [ "$haslo" != "$powtorzone" ]; then
      echo "Hasła się różnią — jeszcze raz."
    elif [ "${#haslo}" -lt "$NAJKROTSZE" ]; then
      echo "Za krótkie — co najmniej $NAJKROTSZE znaków."
    else
      break
    fi
  done
  unset powtorzone
fi

install -d -m 700 -o "$KONTO_USLUGI" -g "$KONTO_USLUGI" "$STAN"
# Hasło idzie w zmiennej środowiskowej, nie w argumentach — tych nie widać
# na liście procesów innych użytkowników.
export NOWE_HASLO="$haslo" STAN
unset haslo
runuser -u "$KONTO_USLUGI" -- /usr/bin/node "$SERWER" admin "$login"
