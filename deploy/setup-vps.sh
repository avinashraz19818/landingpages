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

# data.json is gitignored (it holds live tokens + lead history), so a fresh
# clone will not have it. Seed it from the clean template. The app also
# self-initialises, but seeding keeps the first boot deterministic.
if [ ! -f data.json ] && [ -f data.json.example ]; then
  cp data.json.example data.json
  echo "   seeded data.json from data.json.example"
fi
chmod 600 data.json 2>/dev/null || true

npm install --omit=dev --no-audit --no-fund

# ---------- 4. PM2 ---------------------------------------------------
echo "▶ [4/8] Installing PM2 & starting app..."
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

mkdir -p /var/log/$APP_NAME

pm2 delete $APP_NAME >/dev/null 2>&1 || true
# Export PORT so ecosystem.config.js picks it up instead of defaulting to 3000.
# On a shared box 3000 may already belong to the other running site.
PORT="$NODE_PORT" NODE_ENV=production pm2 start deploy/ecosystem.config.js
echo "   ✅ PM2 process '$APP_NAME' started on port $NODE_PORT"
pm2 save
# Start PM2 automatically on server reboot
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save

# ---------- 5. Firewall ---------------------------------------------
echo "▶ [5/8] Firewall..."
# These two rules are additive and safe regardless of UFW's current state.
ufw allow OpenSSH      >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
echo "   ✅ rules added: 22 (SSH), 80/443 (Nginx)"

# Enabling UFW on a server that already hosts something can lock out ports
# we know nothing about (DB, panel, mail). So only enable it when it is
# already on, or when the operator explicitly agrees.
if ufw status 2>/dev/null | grep -qi "Status: active"; then
  echo "   ✅ UFW pehle se active tha — sirf rules add kiye, kuch block nahi hua."
else
  echo "   ⚠ UFW abhi INACTIVE hai."
  if [ "${ASSUME_YES:-0}" = "1" ]; then
    echo "     ASSUME_YES=1 set hai, isliye enable nahi kar rahe (safe default)."
  else
    echo "     Enable karne se sirf 22/80/443 khule rahenge. Agar is server pe"
    echo "     koi aur service chal rahi hai (DB, panel, mail, custom port)"
    echo "     to wo BLOCK ho jaayegi."
    read -r -p "     UFW enable karna hai? [y/N] " ufw_ans
    case "${ufw_ans:-N}" in
      [yY]*) ufw --force enable && echo "   ✅ UFW enabled" ;;
      *)     echo "   ⏭ UFW inactive chhod diya (existing services safe)." ;;
    esac
  fi
fi
echo "   Node port $NODE_PORT private rahega (Nginx proxy karta hai)."

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

# We deliberately DO NOT remove sites-enabled/default.
#
# Our vhost declares an explicit server_name, so requests for $DOMAIN match
# ours and the default site only catches requests that match nothing. Deleting
# it buys us a slightly tidier "hit the raw IP" page, but on a box that already
# hosts another site it can take that site down outright. Not worth it.
if [ -e /etc/nginx/sites-enabled/default ]; then
  echo "   ℹ sites-enabled/default maujood hai — chheda NAHI gaya."
  echo "     Hamara vhost explicit server_name ($DOMAIN) use karta hai, isliye"
  echo "     existing site pe koi asar nahi padega."
fi

# Validate BEFORE reloading. If nginx -t fails we must not reload, because a
# failed reload on a shared box can take the other site down with it.
if nginx -t; then
  systemctl reload nginx
  echo "   ✅ Nginx vhost live (reload successful)"
else
  echo "   🔴 nginx -t FAIL hua — reload NAHI kiya, existing site safe hai."
  echo "      Error upar dikha hai. Hamara vhost: /etc/nginx/sites-available/$APP_NAME"
  exit 1
fi

# ---------- 7. SSL certificate ---------------------------------------
echo "▶ [7/8] Issuing Let's Encrypt SSL certificate..."
apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1

# Use certonly + webroot, NOT `certbot --nginx`.
#
# `certbot --nginx` rewrites Nginx config files to inject ssl_certificate
# lines and (with --redirect) a 301 block. On a box that already serves
# another site that rewrite can disturb the neighbouring vhost. `certonly`
# only obtains the certificate and touches nothing else — then we write our
# own vhost with the cert paths in step 8.
CERT_ARGS=(-d "$DOMAIN")
# www only makes sense for an apex domain; for a subdomain like
# ree.example.com, www.ree.example.com would just fail the challenge.
DOTS="$(echo "$DOMAIN" | tr -cd '.' | wc -c)"
[ "$DOTS" -eq 1 ] && CERT_ARGS+=(-d "www.$DOMAIN")

if certbot certonly --webroot -w /var/www/certbot "${CERT_ARGS[@]}" \
     --non-interactive --agree-tos --register-unsafely-without-email \
     --keep-until-expiring; then
  SSL_OK=1
  echo "   ✅ SSL certificate issued for: ${CERT_ARGS[*]}"
  echo "      /etc/letsencrypt/live/$DOMAIN/"
else
  SSL_OK=0
  echo "   ⚠ SSL issue nahi hua. Aam taur pe DNS abhi propagate nahi hua hota."
  echo "     Existing site pe koi asar NAHI pada — sirf hamara cert pending hai."
  echo ""
  echo "     DNS theek karke ye dobara chalao:"
  echo "       certbot certonly --webroot -w /var/www/certbot ${CERT_ARGS[*]}"
  echo ""
  echo "     💡 Agar Cloudflare proxy (orange cloud) ON hai to use DNS-only (grey)"
  echo "        karo, ya DNS-01 wildcard use karo: bash deploy/wildcard-cert.sh $DOMAIN <email>"
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
