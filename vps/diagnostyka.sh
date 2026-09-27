#!/usr/bin/env bash
# Odczyt konfiguracji serwera — niczego nie zmienia.
#
#   curl -fsSL https://raw.githubusercontent.com/jedrzejrakowski/Kalkulator-Walut/main/vps/diagnostyka.sh | sudo bash
#
# Pokazuje, czym są wystawiane strony (nginx, Caddy, Traefik w Dockerze…),
# gdzie leży kalkulator i co jest zainstalowane — tyle, ile trzeba, żeby
# dopasować instalację logowania. Wiersze, które wyglądają na hasła, klucze
# albo tokeny, są zamazywane, więc wynik można bezpiecznie wkleić do rozmowy.
set -uo pipefail

naglowek() { printf '\n===== %s =====\n' "$*"; }

# Zamazuje wartości wyglądające na sekrety.
# shellcheck disable=SC2016 # znaki $ to część wzorca, nie zmienne
zamaz() {
  sed -E \
    -e 's/((pass(word)?|secret|token|key|auth|credential|hash|salt|users)[^=:]*[=:][[:space:]]*).*/\1***/I' \
    -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/***@***/g' \
    -e 's/\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}/***/g' \
    -e 's/-----BEGIN [A-Z ]*KEY-----.*/***/'
}

pokaz_plik() {
  [ -f "$1" ] || return 0
  echo "--- $1"
  grep -vE '^[[:space:]]*(#|$)' "$1" | zamaz | head -n 120
}

naglowek "System"
# shellcheck source=/dev/null
. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"
uname -r
echo "Użytkownik: $(id -un), $(nproc) CPU, $(free -m | awk '/Mem:/ {print $2 " MB RAM"}')"
df -h / | tail -1

naglowek "Usługi WWW i kontenery"
for u in nginx caddy apache2 httpd traefik docker containerd n8n; do
  if systemctl list-unit-files "$u.service" >/dev/null 2>&1 && systemctl list-unit-files "$u.service" | grep -q "$u"; then
    echo "$u: $(systemctl is-active "$u" 2>/dev/null) / $(systemctl is-enabled "$u" 2>/dev/null)"
  fi
done

naglowek "Nasłuchujące porty"
if command -v ss >/dev/null; then ss -ltnp 2>/dev/null | awk 'NR == 1 || /LISTEN/' | sed -E 's/,fd=[0-9]+//g'
elif command -v netstat >/dev/null; then netstat -ltnp 2>/dev/null
fi

if command -v docker >/dev/null; then
  naglowek "Docker: kontenery"
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' 2>&1
  naglowek "Docker: katalogi z plikami compose"
  docker ps -q 2>/dev/null | xargs -r docker inspect --format '{{.Name}} → {{index .Config.Labels "com.docker.compose.project.working_dir"}} ({{index .Config.Labels "com.docker.compose.project.config_files"}})' 2>/dev/null | sort -u
  naglowek "Docker: montowane katalogi z /srv i /opt"
  docker ps -q 2>/dev/null | xargs -r docker inspect --format '{{.Name}}{{range .Mounts}} | {{.Source}} → {{.Destination}}{{end}}' 2>/dev/null | grep -E '/srv|/opt|/var/www' || echo "(brak)"
  naglowek "Docker: pliki compose (bez sekretów)"
  docker ps -q 2>/dev/null | xargs -r docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' 2>/dev/null |
    tr ',' '\n' | sort -u | while read -r plik; do pokaz_plik "$plik"; done
fi

naglowek "Konfiguracja serwerów WWW"
pokaz_plik /etc/caddy/Caddyfile
for katalog in /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/apache2/sites-enabled; do
  [ -d "$katalog" ] && for plik in "$katalog"/*; do pokaz_plik "$plik"; done
done
for plik in /etc/traefik/traefik.yml /etc/traefik/traefik.toml; do pokaz_plik "$plik"; done

naglowek "Gdzie jest mowa o /srv/apps"
grep -rlsI --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.cache --exclude-dir=.claude \
  '/srv/apps' /etc/nginx /etc/caddy /etc/apache2 /etc/traefik /etc/systemd/system /opt /root /home 2>/dev/null |
  head -n 20 || true

naglowek "Katalog aplikacji"
ls -la /srv/apps 2>&1
# shellcheck disable=SC2012
ls -la /srv/apps/kalkulator 2>&1 | head -n 12

naglowek "Konto deploy"
id deploy 2>&1
sudo -l -U deploy 2>&1 | sed -n '1,15p'

naglowek "Node.js"
command -v node && node -v || echo "(brak Node.js na serwerze)"

naglowek "Zapora"
ufw status 2>/dev/null | head -n 20 || echo "(brak ufw)"

echo
echo 'Koniec. Skopiuj cały wynik powyżej i wklej go w rozmowie.'
