#!/usr/bin/env bash
# Aktualizacja kalkulatora do najnowszej wersji z GitHuba.
#
#   sudo bash /opt/kalkulator-walut/vps/aktualizuj.sh
#
# Przy okazji aktualizuje Node.js i Caddy — ich poprawki nie przychodzą
# z Ubuntu, więc automatyczne aktualizacje systemu ich nie obejmują.
set -euo pipefail

KATALOG=/opt/kalkulator-walut
PORT=8080

krok() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
przerwij() {
  printf '\033[1;31mBŁĄD: %s\033[0m\n' "$*" >&2
  exit 1
}

# Całość w funkcji: bash wczyta ją przed startem, więc podmiana tego pliku
# przez „git reset" w trakcie działania nie namiesza w wykonaniu.
aktualizuj() {
  [ "$(id -u)" -eq 0 ] || przerwij "Uruchom jako administrator: sudo bash $0"
  cd "$KATALOG"

  GALAZ="${GALAZ:-$(git rev-parse --abbrev-ref HEAD)}"
  przed=$(git rev-parse --short HEAD)

  krok "Pobieram najnowszą wersję (gałąź $GALAZ)"
  git fetch -q origin "$GALAZ"
  git checkout -q -B "$GALAZ" "origin/$GALAZ"
  git reset -q --hard "origin/$GALAZ"
  po=$(git rev-parse --short HEAD)

  krok "Buduję"
  npm ci --no-audit --no-fund --loglevel=error
  npm run build:vps
  chmod -R a+rX dist dist-vps

  krok "Node.js i Caddy"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -y -q --only-upgrade nodejs caddy

  krok "Uruchamiam ponownie"
  install -m 644 vps/kalkulator-walut.service /etc/systemd/system/kalkulator-walut.service
  systemctl daemon-reload
  systemctl restart kalkulator-walut
  systemctl reload caddy 2>/dev/null || true

  kod=000
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kod=$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: text/html' "http://127.0.0.1:$PORT/" || true)
    [ "$kod" = 302 ] && break
    sleep 1
  done
  [ "$kod" = 302 ] ||
    przerwij "Kalkulator nie odpowiada jak trzeba (kod $kod). Dziennik: journalctl -u kalkulator-walut -n 50"

  if [ "$przed" = "$po" ]; then
    echo "Program był już w najnowszej wersji ($po); zaktualizowane zostały tylko pakiety."
  else
    echo "Zaktualizowano: $przed → $po"
  fi
}

aktualizuj "$@"
