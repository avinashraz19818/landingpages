#!/usr/bin/env bash
# =====================================================================
#  One-shot VPS setup for the 0-Fake-Click Meta -> Telegram System
#
#  Target : fresh Ubuntu 22.04 / 24.04 LTS VPS, run as root
#  Usage  :  bash deploy/setup-vps.sh yourdomain.com
#
#  Installs : Node.js 22 LTS, PM2, Nginx, Let's Encrypt SSL
# =====================================================================
set -euo pipefail

# ---------- Args & paths --------------------------------------------
DOMAIN="${1:-}"
APP_DIR="${APP_DIR:-/opt/app}"
APP_NAME="zero-fake-click"
NODE_PORT="${PORT:-3000}"

if [ -z "$DOMAIN" ]; then
  echo "❌ Domain missing."
  echo "   Usage: bash deploy/setup-vps.sh yourdomain.com"
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "❌ This script must run as root (use sudo)."
  exit 1
fi

echo "=============================================================="
echo " 0-Fake-Click System — VPS Setup"
echo " Domain   : $DOMAIN"
echo " App dir  : $APP_DIR"
echo " App port : $NODE_PORT"
echo "=============================================================="

# ---------- 1. Base packages ----------------------------------------
echo "▶ [1/8] Updating apt & installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git unzip ca-certificates gnupg ufw

# ---------- 2. Node.js 22 LTS ---------------------------------------
echo "▶ [2/8] Installing Node.js 22 LTS..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi
echo "   node $(node -v)  |  npm $(npm -v)"

# ---------- 3. App files + dependencies -----------------------------
echo "▶ [3/8] Preparing app in $APP_DIR..."
if [ ! -f "$APP_DIR/server.js" ]; then
  echo "   ⚠ $APP_DIR/server.js not found."
  echo "   Clone the repo first, e.g.:"
  echo "     git clone https://github.com/avinashraz19818/landingpages.git $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

# Writable dirs the app needs at runtime
mkdir -p public/uploads
chmod -R 755 "$APP_DIR"

# .env from template if absent
if [ ! -f .env ]; then
  cp .env.example .env 2>/dev/null || echo "PORT=$NODE_PORT" > .env
  sed -i "s/^PORT=.*/PORT=$NODE_PORT/" .env
  echo "   created .env with PORT=$NODE_PORT"
fi

npm install --omit=dev --no-audit --no-fund

# ---------- 4. PM2 ---------------------------------------------------
echo "▶ [4/8] Installing PM2 & starting app..."
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

mkdir -p /var/log/$APP_NAME

pm2 delete $APP_NAME >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.config.js
pm2 save
# Start PM2 automatically on server reboot
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save

# ---------- 5. Firewall ---------------------------------------------
echo "▶ [5/8] Configuring UFW firewall (22, 80, 443 only)..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "   Node port $NODE_PORT stays private (Nginx proxies to it)."

# ---------- 6. Nginx -------------------------------------------------
echo "▶ [6/8] Installing Nginx & writing site config..."
apt-get install -y nginx
mkdir -p /var/www/certbot

# HTTP-only bootstrap config so certbot can issue the certificate
cat > /etc/nginx/sites-available/$APP_NAME <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    # SSE feed must stay unbuffered even in this temporary config
    location = /api/admin/events-stream {
        proxy_pass http://127.0.0.1:$NODE_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection        '';
        proxy_buffering                    off;
        proxy_cache                        off;
        proxy_read_timeout                 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:$NODE_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/$APP_NAME
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---------- 7. SSL certificate ---------------------------------------
echo "▶ [7/8] Issuing Let's Encrypt SSL certificate..."
apt-get install -y certbot python3-certbot-nginx

if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
     --non-interactive --agree-tos --register-unsafely-without-email \
     --redirect; then
  SSL_OK=1
  echo "   ✅ SSL installed for $DOMAIN"
else
  SSL_OK=0
  echo "   ⚠ SSL failed. Usually DNS has not propagated yet."
  echo "     Fix DNS then re-run:  certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

# ---------- 8. Full Nginx config (SSE + uploads tuned) ---------------
echo "▶ [8/8] Applying production Nginx config..."
if [ -f "$APP_DIR/deploy/nginx.conf" ]; then
  sed "s|__DOMAIN__|$DOMAIN|g; s|127.0.0.1:3000|127.0.0.1:$NODE_PORT|g; s|/opt/app|$APP_DIR|g" \
    "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/$APP_NAME

  if [ "$SSL_OK" -eq 1 ]; then
    nginx -t && systemctl reload nginx && echo "   ✅ Production config live"
  else
    echo "   ⚠ Config written but not reloaded (no SSL cert yet)."
    echo "     After certbot succeeds, run:  nginx -t && systemctl reload nginx"
  fi
fi

# ---------- Done ------------------------------------------------------
echo ""
echo "=============================================================="
echo " ✅ Setup complete"
echo ""
echo "   Landing page : https://$DOMAIN"
echo "   Admin panel  : https://$DOMAIN/admin"
echo "   Webhook URL  : https://$DOMAIN/api/telegram-webhook"
echo ""
echo "   pm2 status            -> check process"
echo "   pm2 logs $APP_NAME -> live logs"
echo ""
echo " ⚠️  NEXT: open https://$DOMAIN/admin and fill in"
echo "    - Telegram Bot Token + Channel ID  -> Test Bot & Channel"
echo "    - Public URL = https://$DOMAIN     -> Set Webhook"
echo "    - Meta Pixel ID + CAPI token       -> Send Test Event"
echo ""
echo " 🔴 SECURITY: /api/admin/* currently has NO authentication."
echo "    Anyone can read your bot token & Meta CAPI token. Lock it down"
echo "    before you run real ads. See DEPLOYMENT.md section 6."
echo "=============================================================="
