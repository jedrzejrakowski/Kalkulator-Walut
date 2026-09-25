#!/usr/bin/env bash
# Instalacja Kalkulatora walut na świeżym serwerze Ubuntu 24.04.
#
#   curl -fsSLO https://raw.githubusercontent.com/jedrzejrakowski/Kalkulator-Walut/main/vps/instaluj.sh
#   sudo bash instaluj.sh kalkulator.twojadomena.pl
#
# Co robi: instaluje Node.js 22 i Caddy (HTTPS), pobiera program z GitHuba
# i buduje go, pyta o hasło, uruchamia usługę, włącza zaporę i automatyczne
# poprawki bezpieczeństwa systemu. Można go uruchomić ponownie — kroki już
# wykonane pomija, program pobiera od nowa.
set -euo pipefail

REPO="${REPO:-https://github.com/jedrzejrakowski/Kalkulator-Walut.git}"
GALAZ="${GALAZ:-main}"
KATALOG=/opt/kalkulator-walut
KONFIG=/etc/kalkulator-walut
UZYTKOWNIK=kalkulator
PORT=8080

krok() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
uwaga() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
przerwij() {
  printf '\033[1;31mBŁĄD: %s\033[0m\n' "$*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || przerwij "Uruchom jako administrator: sudo bash $0 <domena>"

DOMENA="${1:-}"
if [ -z "$DOMENA" ]; then
  read -rp "Adres kalkulatora (np. kalkulator.twojadomena.pl): " DOMENA </dev/tty
fi
DOMENA="${DOMENA,,}"
DOMENA="${DOMENA#https://}"
DOMENA="${DOMENA#http://}"
DOMENA="${DOMENA%%/*}"
[[ "$DOMENA" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]] ||
  przerwij "To nie wygląda na adres domeny: '$DOMENA'"

# shellcheck source=/dev/null
. /etc/os-release
[ "${ID:-}" = ubuntu ] || uwaga "Skrypt był pisany dla Ubuntu, a to jest ${PRETTY_NAME:-nieznany system}."

export DEBIAN_FRONTEND=noninteractive

krok "Pakiety systemowe"
apt-get update -q
apt-get install -y -q ca-certificates curl git gnupg ufw fail2ban unattended-upgrades \
  debian-keyring debian-archive-keyring apt-transport-https

krok "Node.js 22"
if [ -x /usr/bin/node ] && [ "$(/usr/bin/node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; then
  echo "Jest już: $(/usr/bin/node -v)"
else
  # Oficjalne pakiety NodeSource — Ubuntu ma w swoim repozytorium za starą wersję.
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

krok "Caddy (HTTPS)"
if command -v caddy >/dev/null; then
  echo "Jest już: $(caddy version)"
else
  # Repozytorium z dokumentacji Caddy: https://caddyserver.com/docs/install
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
    gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    >/etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

krok "Konto usługi"
if id -u "$UZYTKOWNIK" >/dev/null 2>&1; then
  echo "Jest już: $UZYTKOWNIK"
else
  # Bez hasła, bez powłoki, bez katalogu domowego — tylko do uruchamiania kalkulatora.
  useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$UZYTKOWNIK"
fi

krok "Program (gałąź $GALAZ)"
if [ -d "$KATALOG/.git" ]; then
  git -C "$KATALOG" fetch -q origin "$GALAZ"
  git -C "$KATALOG" checkout -q -B "$GALAZ" "origin/$GALAZ"
  git -C "$KATALOG" reset -q --hard "origin/$GALAZ"
else
  git clone -q --branch "$GALAZ" "$REPO" "$KATALOG"
fi
cd "$KATALOG"
npm ci --no-audit --no-fund --loglevel=error
npm run build:vps
chmod -R a+rX dist dist-vps

krok "Hasło"
if [ -s "$KONFIG/haslo" ]; then
  echo "Jest już ustawione. Zmiana: sudo bash $KATALOG/vps/haslo.sh"
else
  bash "$KATALOG/vps/haslo.sh" --bez-restartu
fi

krok "Usługa systemowa"
install -m 644 "$KATALOG/vps/kalkulator-walut.service" /etc/systemd/system/kalkulator-walut.service
systemctl daemon-reload
systemctl enable -q kalkulator-walut
systemctl restart kalkulator-walut

krok "Caddy: https://$DOMENA"
if [ -f /etc/caddy/Caddyfile ] && ! grep -q kalkulator-walut /etc/caddy/Caddyfile; then
  cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.przed-kalkulatorem
  echo "Poprzednia konfiguracja: /etc/caddy/Caddyfile.przed-kalkulatorem"
fi
sed "s/__DOMENA__/$DOMENA/" "$KATALOG/vps/Caddyfile" >/etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 ||
  przerwij "Konfiguracja Caddy się nie sprawdza: caddy validate --config /etc/caddy/Caddyfile"
systemctl enable -q caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy

krok "Zapora i poprawki bezpieczeństwa"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443 >/dev/null
ufw --force enable >/dev/null
echo "Zapora: otwarte tylko SSH, 80 i 443."
systemctl enable -q --now fail2ban
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'KONIEC'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
KONIEC
echo "Poprawki bezpieczeństwa Ubuntu instalują się same."

krok "Sprawdzenie"
kod=000
for _ in 1 2 3 4 5 6 7 8 9 10; do
  kod=$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: text/html' "http://127.0.0.1:$PORT/" || true)
  [ "$kod" = 302 ] && break
  sleep 1
done
[ "$kod" = 302 ] ||
  przerwij "Kalkulator nie odpowiada jak trzeba (kod $kod). Dziennik: journalctl -u kalkulator-walut -n 50"
echo "Kalkulator działa i wymaga logowania."

adres_dns=$(getent ahostsv4 "$DOMENA" 2>/dev/null | awk 'NR == 1 { print $1 }' || true)
adresy_serwera=" $(hostname -I 2>/dev/null || true) "
if [ -z "$adres_dns" ]; then
  uwaga "Domena $DOMENA jeszcze nie ma adresu w DNS. Ustaw rekord A na adres tego serwera:$adresy_serwera"
  uwaga "Caddy pobierze certyfikat HTTPS sam, gdy DNS zacznie działać (zwykle do kilku godzin)."
elif [[ "$adresy_serwera" != *" $adres_dns "* ]]; then
  uwaga "Domena $DOMENA wskazuje na $adres_dns, a ten serwer ma adres:$adresy_serwera"
  uwaga "Popraw rekord A w DNS. Caddy pobierze certyfikat sam, gdy adres się zgodzi."
fi

cat <<KONIEC

Gotowe. Kalkulator: https://$DOMENA

  Zmiana hasła:   sudo bash $KATALOG/vps/haslo.sh
  Aktualizacja:   sudo bash $KATALOG/vps/aktualizuj.sh
  Dziennik:       journalctl -u kalkulator-walut -n 50
KONIEC
