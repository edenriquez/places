#!/usr/bin/env bash
# Worker remoto de entrelugares.mx en esta Mac (apunta a producción).
#
#   ops/worker.sh setup      crea packages/ingest/.env.prod (URL + service_role por la CLI de Supabase; pide la contraseña de la BD)
#   ops/worker.sh check      prueba la conexión a producción con ese perfil (doctor)
#   ops/worker.sh install    instala y arranca el agente de launchd (arranca al iniciar sesión, se reinicia si muere)
#   ops/worker.sh status     ¿está cargado? ¿qué pid? últimas líneas del log
#   ops/worker.sh logs       sigue el log
#   ops/worker.sh restart    reinicia el agente (p. ej. tras git pull)
#   ops/worker.sh uninstall  detiene y quita el agente
#   ops/worker.sh run        corre el worker en primer plano con .env.prod (para depurar)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INGEST="$REPO/packages/ingest"
ENV_FILE="$INGEST/.env.prod"
LABEL="mx.entrelugares.worker"
PLIST_SRC="$REPO/ops/launchd/$LABEL.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
REF="${SUPABASE_PROJECT_REF:-swsdnphwstuvrjhrpmlw}"
UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
DOMAIN="gui/$(id -u)"

need() { command -v "$1" >/dev/null 2>&1 || { echo "falta $1"; exit 1; }; }

cmd_setup() {
  need supabase; need python3
  if [[ -f "$ENV_FILE" ]]; then
    read -r -p ".env.prod ya existe. ¿Sobrescribir? [s/N] " yn; [[ "$yn" =~ ^[sSyY]$ ]] || exit 0
  fi
  echo "→ llave service_role del proyecto $REF (supabase projects api-keys)…"
  local key
  key="$(supabase projects api-keys --project-ref "$REF" -o json | python3 -c '
import json,sys
keys=json.load(sys.stdin)
for k in keys:
    if k.get("name")=="service_role": print(k["api_key"]); break
')"
  [[ -n "$key" ]] || { echo "no pude obtener la llave; ¿hiciste supabase login?"; exit 1; }
  local pooler=""
  [[ -f "$REPO/supabase/.temp/pooler-url" ]] && pooler="$(cat "$REPO/supabase/.temp/pooler-url")"
  [[ -n "$pooler" ]] || pooler="postgresql://postgres.$REF@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
  echo "→ contraseña de la base (Project Settings → Database; la misma que SUPABASE_DB_PASSWORD en GitHub)."
  read -r -s -p "  contraseña: " pw; echo
  [[ -n "$pw" ]] || { echo "vacía; cancelo"; exit 1; }
  local url
  url="$(python3 - "$pooler" "$pw" <<'EOF'
import sys, urllib.parse
pooler, pw = sys.argv[1], sys.argv[2]
scheme, rest = pooler.split("://", 1)
user, host = rest.split("@", 1)
user = user.split(":", 1)[0]
print(f"{scheme}://{user}:{urllib.parse.quote(pw, safe='')}@{host}")
EOF
)"
  sed -e "s#^DATABASE_URL=.*#DATABASE_URL=$url#" \
      -e "s#^SUPABASE_URL=.*#SUPABASE_URL=https://$REF.supabase.co#" \
      -e "s#^SUPABASE_SERVICE_KEY=.*#SUPABASE_SERVICE_KEY=$key#" \
      "$INGEST/.env.prod.example" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "✓ $ENV_FILE listo (está en .gitignore). Ahora: ops/worker.sh check"
}

cmd_check() {
  [[ -f "$ENV_FILE" ]] || { echo "no existe $ENV_FILE; corre ops/worker.sh setup"; exit 1; }
  ( cd "$INGEST" && PLACES_ENV_FILE=.env.prod "$UV" run places-ingest doctor )
}

cmd_install() {
  [[ -f "$ENV_FILE" ]] || { echo "no existe $ENV_FILE; corre ops/worker.sh setup"; exit 1; }
  mkdir -p "$HOME/Library/LaunchAgents" "$INGEST/data/logs"
  sed -e "s#__REPO__#$REPO#g" -e "s#__UV__#$UV#g" -e "s#__HOME__#$HOME#g" "$PLIST_SRC" > "$PLIST_DST"
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$PLIST_DST"
  launchctl kickstart -k "$DOMAIN/$LABEL"
  echo "✓ agente $LABEL cargado. En unos segundos aparece en /admin/jobs. Log: ops/worker.sh logs"
}

cmd_uninstall() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "✓ agente quitado"
}

cmd_restart() {
  launchctl kickstart -k "$DOMAIN/$LABEL" && echo "✓ reiniciado"
}

cmd_status() {
  if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    launchctl print "$DOMAIN/$LABEL" | grep -E "state|pid|last exit" | sed 's/^/  /'
  else
    echo "  agente no cargado (ops/worker.sh install)"
  fi
  echo "--- worker.log"; tail -n 15 "$INGEST/data/logs/worker.log" 2>/dev/null || echo "  (sin log)"
  echo "--- worker.err.log"; tail -n 5 "$INGEST/data/logs/worker.err.log" 2>/dev/null || true
}

cmd_logs() { tail -F "$INGEST/data/logs/worker.log" "$INGEST/data/logs/worker.err.log"; }

cmd_run() {
  [[ -f "$ENV_FILE" ]] || { echo "no existe $ENV_FILE; corre ops/worker.sh setup"; exit 1; }
  ( cd "$INGEST" && PLACES_ENV_FILE=.env.prod "$UV" run places-ingest worker "$@" )
}

case "${1:-}" in
  setup|check|install|uninstall|restart|status|logs) "cmd_$1" ;;
  run) shift; cmd_run "$@" ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
