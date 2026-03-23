#!/usr/bin/env bash
# ============================================================
# setup-env.sh – Erstellt .env aus .env.example mit
#                automatisch generierten Secrets.
#
# Nutzung:
#   ./setup-env.sh                     # Interaktiv (fragt VPS-IP)
#   ./setup-env.sh 217.154.146.101     # IP als Argument
# ============================================================

set -euo pipefail

ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

# ── Schutz: bestehende .env nicht ueberschreiben ──────────
if [ -f "$ENV_FILE" ]; then
  printf "\n  .env existiert bereits.\n"
  printf "  Ueberschreiben? (j/N): "
  read -r answer
  if [[ ! "$answer" =~ ^[jJyY]$ ]]; then
    echo "Abgebrochen."
    exit 0
  fi
fi

# ── .env.example muss vorhanden sein ──────────────────────
if [ ! -f "$EXAMPLE_FILE" ]; then
  echo "Fehler: $EXAMPLE_FILE nicht gefunden."
  exit 1
fi

# ── VPS-IP ermitteln ──────────────────────────────────────
VPS_IP="${1:-}"
if [ -z "$VPS_IP" ]; then
  printf "VPS-IP oder Domain eingeben (z.B. 217.154.146.101): "
  read -r VPS_IP
fi

if [ -z "$VPS_IP" ]; then
  echo "Fehler: Keine IP/Domain angegeben."
  exit 1
fi

# ── Secrets generieren ────────────────────────────────────
gen_secret() {
  openssl rand -base64 32 | tr -d '/+=' | head -c 40
}

POSTGRES_PW="$(gen_secret)"
JWT="$(gen_secret)"
SESSION="$(gen_secret)"

# ── .env schreiben ────────────────────────────────────────
cat > "$ENV_FILE" <<EOF
# ============================================================
# .env – Generiert von setup-env.sh am $(date +%Y-%m-%d)
# ============================================================

# ── Frontend (Vite) ─────────────────────────────────────
VITE_ENABLED_MODULES=elternsprechtag,schulsozialarbeit,beratungslehrer,flow

# ── Backend: Server ────────────────────────────────────
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
CORS_ORIGINS=http://${VPS_IP}
PUBLIC_BASE_URL=http://${VPS_IP}

# ── Backend: Cookie ──────────────────────────────────
# Kein HTTPS = COOKIE_SECURE muss false sein
COOKIE_SECURE=false

# ── Backend: Datenbank (Docker-intern) ──────────────────
POSTGRES_DB=sprechtag
POSTGRES_USER=sprechtag
POSTGRES_PASSWORD=${POSTGRES_PW}

# ── Backend: Authentifizierung ─────────────────────────
JWT_SECRET=${JWT}
SESSION_SECRET=${SESSION}
ADMIN_USERNAME=admin

# ── Backend: E-Mail ────────────────────────────────────
MAIL_TRANSPORT=ethereal
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=no-reply@example.com

# ── Backend: Module ───────────────────────────────────
ENABLED_MODULES=elternsprechtag,schulsozialarbeit,beratungslehrer,flow

# ── Backend: Token ────────────────────────────────────
VERIFICATION_TOKEN_TTL_HOURS=72

# ── Docker: Port-Binding ──────────────────────────────
FRONTEND_BIND=0.0.0.0
FRONTEND_PORT=80

# ── Backend: Logging ──────────────────────────────────
LOG_LEVEL=info
EOF

echo ""
echo "  .env erstellt!"
echo ""
echo "  Secrets:"
echo "    POSTGRES_PASSWORD = ${POSTGRES_PW}"
echo "    JWT_SECRET        = ${JWT}"
echo "    SESSION_SECRET    = ${SESSION}"
echo ""
echo "  Naechster Schritt:"
echo "    docker compose up -d --build"
echo ""
