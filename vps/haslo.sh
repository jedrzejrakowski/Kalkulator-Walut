#!/usr/bin/env bash
# Ustawienie albo zmiana hasła do kalkulatora.
#
#   sudo bash /opt/kalkulator-walut/vps/haslo.sh
#
# Po zmianie wszystkie zalogowane urządzenia muszą zalogować się ponownie.
set -euo pipefail

KONFIG=/etc/kalkulator-walut
NAJKROTSZE=12

if [ "$(id -u)" -ne 0 ]; then
  echo "Uruchom jako administrator: sudo bash $0" >&2
  exit 1
fi

if [ -n "${KALKULATOR_HASLO:-}" ]; then
  # Bez pytania — do instalacji automatycznej.
  haslo="$KALKULATOR_HASLO"
  if [ "${#haslo}" -lt "$NAJKROTSZE" ]; then
    echo "Hasło za krótkie — co najmniej $NAJKROTSZE znaków." >&2
    exit 1
  fi
else
  echo "Hasło do kalkulatora: co najmniej $NAJKROTSZE znaków, najlepiej kilka słów,"
  echo "np. zielona-herbata-nad-wisla. Wpisywane znaki nie będą widoczne."
  while true; do
    IFS= read -rsp "Nowe hasło: " haslo </dev/tty
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

install -d -m 700 -o root -g root "$KONFIG"
(
  umask 077
  printf '%s' "$haslo" >"$KONFIG/haslo.nowe"
)
mv -f "$KONFIG/haslo.nowe" "$KONFIG/haslo"
unset haslo

if [ "${1:-}" != "--bez-restartu" ]; then
  systemctl restart kalkulator-walut
  echo "Hasło zmienione. Wszystkie urządzenia muszą zalogować się ponownie."
fi
