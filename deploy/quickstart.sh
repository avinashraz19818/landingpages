#!/usr/bin/env bash
# =====================================================================
#  ONE-SHOT server setup for the 0-Fake-Click system
#
#  Fresh Ubuntu 22.04 / 24.04 VPS  ->  fully working HTTPS site.
#
#  Usage:
#     bash quickstart.sh <domain> [--no-wildcard] [--branch <name>]
#
#  Example:
#     bash quickstart.sh devlopedwithzayro.site
#
#  What it does:
#    1. Node.js 22 LTS, PM2, Nginx, certbot, UFW
#    2. Clones the app to /opt/app and starts it under PM2
#    3. Nginx reverse proxy (SSE-tuned) + Let's Encrypt SSL
#    4. Optional wildcard cert via Cloudflare DNS API, so you can add
#       unlimited client subdomains later with no certificate wait
#    5. Verifies everything and prints your next steps
#
#  Safe to re-run — it picks up where it left off.
# =====================================================================
set -uo pipefail

DOMAIN="${1:-}"
WILDCARD=1
BRANCH="${BRANCH:-arena/f58d4212-landingpages}"
REPO="https://github.com/avinashraz19818/landingpages.git"
APP_DIR="${APP_DIR:-/opt/app}"
WANT_PORT=""

shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --no-wildcard) WILDCARD=0; shift ;;
    --branch)      BRANCH="${2:-}"; shift 2 ;;
    --app-dir)     APP_DIR="${2:-}"; shift 2 ;;
    --port)        WANT_PORT="${2:-}"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

[ -n "$DOMAIN" ] || { echo "Usage: bash quickstart.sh <domain> [--no-wildcard] [--branch <name>] [--app-dir <path>] [--port <n>]"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "❌ Run as root:  sudo bash quickstart.sh $DOMAIN"; exit 1; }

DOMAIN="$(echo "$DOMAIN" | sed -e 's#^https\?://##' -e 's#^www\.##' -e 's#/.*$##')"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   0-Fake-Click System — One-Shot Server Setup                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "   Domain   : $DOMAIN"
echo "   Branch   : $BRANCH"
echo "   App dir  : $APP_DIR"
echo "   Wildcard : $([ $WILDCARD -eq 1 ] && echo 'yes (Cloudflare DNS API)' || echo 'no')"
echo "   Server IP: $(curl -fsS -4 ifconfig.me 2>/dev/null || echo 'unknown')"
echo ""

# TLD heads-up — .site/.xyz/.top are distrusted by Meta's ad review
case ".$DOMAIN" in
  *.site|*.xyz|*.top|*.icu|*.click|*.online|*.shop|*.live)
    echo "⚠️  NOTE ON YOUR TLD: $DOMAIN"
    echo "   Saste TLD (.site/.xyz/.top) Meta ads me zyada reject hote hain aur"
    echo "   domain jaldi blocklist hota hai. Setup chal jaayega, lekin jab real"
    echo "   ad spend karo tab client ke liye .com ya .in lena better rahega."
    echo ""
    ;;
esac

# ---------------------------------------------------------------------
# 0. Sanity-check DNS BEFORE we build anything on top of it
# ---------------------------------------------------------------------
echo "▶ [0/7] DNS check..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1
apt-get install -y curl git dnsutils ca-certificates gnupg ufw >/dev/null 2>&1

MY_IP="$(curl -fsS -4 ifconfig.me 2>/dev/null || echo '')"
DNS_IP="$(dig +short A "$DOMAIN" @1.1.1.1 2>/dev/null | tail -1)"

if [ -z "$DNS_IP" ]; then
  echo "   ⚠ '$DOMAIN' ka koi A record resolve nahi ho raha."
  echo "     Cloudflare me DNS → Records me A record add karo:"
  echo "       Type A | Name @ | Content <VPS IP> | Proxy: DNS only (grey)"
  echo "     Aage badh rahe hain — SSL step fail hoga to DNS fix karke dobara chalana."
elif [ -n "$MY_IP" ] && [ "$DNS_IP" != "$MY_IP" ]; then
  echo "   ⚠ DNS $DNS_IP pe point kar raha hai, lekin ye server $MY_IP hai."
  echo "     Dono same hone chahiye. Cloudflare record theek karo."
  echo "     (Agar Cloudflare proxy ORANGE hai to Cloudflare ka IP dikhega —"
  echo "      us case me record ko DNS-only GREY karo, ya ignore karo.)"
else
  echo "   ✅ DNS sahi: $DOMAIN → $DNS_IP"
fi

NS="$(dig +short NS "$DOMAIN" @1.1.1.1 2>/dev/null | head -2 | tr '\n' ' ')"
if echo "$NS" | grep -qi cloudflare; then
  echo "   ✅ Nameservers Cloudflare pe hain"
else
  echo "   ℹ Nameservers: ${NS:-<none>} (Cloudflare pe nahi lag rahe — abhi propagate ho raha hoga?)"
fi
echo ""

# ---------------------------------------------------------------------
# 1. Get the app code
# ---------------------------------------------------------------------
echo "▶ [1/7] App code laa rahe hain..."

if [ -d "$APP_DIR/.git" ]; then
  # Already one of ours — verify the remote actually matches before touching it.
  REMOTE_NOW="$(git -C "$APP_DIR" config --get remote.origin.url 2>/dev/null || echo '')"
  if [ "$REMOTE_NOW" = "$REPO" ]; then
    cd "$APP_DIR"
    git fetch --all -q >/dev/null 2>&1
    git checkout "$BRANCH" -q >/dev/null 2>&1 \
      || git checkout -b "$BRANCH" "origin/$BRANCH" -q >/dev/null 2>&1
    git pull --ff-only -q >/dev/null 2>&1 || echo "   (pull skipped — local changes hain)"
    echo "   ✅ $APP_DIR updated"
  else
    echo "   🔴 $APP_DIR ek git repo hai lekin DUSRE project ka:"
    echo "        remote: ${REMOTE_NOW:-<none>}"
    echo "      Isliye chheda nahi. --app-dir do ya us folder ko khud hatao."
    exit 1
  fi

elif [ -e "$APP_DIR" ]; then
  # Something is there but it is not a git checkout. Refuse to delete it:
  # on a shared box this could be the other running site's code.
  echo "   🔴 $APP_DIR pehle se maujood hai aur git repo NAHI hai."
  echo "      Is server pe dusri site chal rahi ho sakti hai, isliye delete nahi kar rahe."
  echo ""
  echo "      Andar ye hai:"
  ls -la "$APP_DIR" 2>/dev/null | head -10 | sed 's/^/        /'
  echo ""
  echo "      Do options:"
  echo "        1. Dusri jagah install karo:"
  echo "             bash quickstart.sh $DOMAIN --app-dir /opt/zayro"
  echo "        2. Agar ye folder bekaar hai, khud hatao:"
  echo "             rm -rf $APP_DIR"
  echo "           phir ye script dobara chalao."
  exit 1

else
  # Genuinely absent — safe to create.
  if git clone -b "$BRANCH" --depth 1 "$REPO" "$APP_DIR" >/dev/null 2>&1; then
    echo "   ✅ cloned branch '$BRANCH'"
  elif git clone --depth 1 "$REPO" "$APP_DIR" >/dev/null 2>&1; then
    echo "   ⚠ branch '$BRANCH' nahi mila — default branch clone kiya"
    BRANCH="(default)"
  else
    echo "   ❌ Clone fail. Repo URL / internet check karo."; exit 1
  fi
fi
cd "$APP_DIR"

# ---------------------------------------------------------------------
# 2. Run the main VPS setup (Node, PM2, Nginx, SSL, firewall)
# ---------------------------------------------------------------------
echo ""
echo "▶ [2/7] Base stack + app + Nginx + SSL..."
if [ ! -f deploy/setup-vps.sh ]; then
  echo "   ❌ deploy/setup-vps.sh nahi mila. Galat branch clone hua?"; exit 1
fi

# Pick a Node port that is not already taken. On a box that already runs
# something (another Node app, a panel, jaiclub5vip.site) hardcoding 3000
# would either fail to bind or kill the neighbour.
if [ -n "$WANT_PORT" ]; then
  NODE_PORT="$WANT_PORT"
  echo "   port $NODE_PORT (--port se diya gaya)"
else
  NODE_PORT=3000
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ss -tln 2>/dev/null | grep -q ":$NODE_PORT " \
       || netstat -tln 2>/dev/null | grep -q ":$NODE_PORT "; then
      echo "   ⚠ port $NODE_PORT busy — aage badh rahe hain"
      NODE_PORT=$((NODE_PORT + 1))
    else
      break
    fi
  done
  echo "   ✅ free port mila: $NODE_PORT"
fi

# setup-vps.sh reads both of these from the environment.
APP_DIR="$APP_DIR" PORT="$NODE_PORT" bash deploy/setup-vps.sh "$DOMAIN"
SETUP_RC=$?
echo ""

# ---------------------------------------------------------------------
# 3. Wildcard cert (optional) — unlimited client subdomains
# ---------------------------------------------------------------------
if [ $WILDCARD -eq 1 ]; then
  echo "▶ [3/7] Wildcard SSL (Cloudflare DNS API)..."
  echo ""
  echo "   Ye ek certificate banayega jo '$DOMAIN' AUR '*.$DOMAIN' dono cover"
  echo "   karega — matlab baad me jitne chaaho client subdomain add karo,"
  echo "   SSL ke liye kuch nahi karna padega."
  echo ""
  read -r -p "   Wildcard cert abhi banana hai? [Y/n] " yn
  case "${yn:-Y}" in
    [nN]*) echo "   ⏭ Skipped. Baad me:  bash deploy/wildcard-cert.sh $DOMAIN <email>" ;;
    *)
      read -r -p "   Email for Let's Encrypt: " EMAIL
      if [ -n "$EMAIL" ]; then
        bash deploy/wildcard-cert.sh "$DOMAIN" "$EMAIL" || \
          echo "   ⚠ Wildcard fail — apex cert pe site chalu rahegi. Baad me dobara try karo."
      else
        echo "   ⏭ Email khaali — wildcard skip. Baad me:  bash deploy/wildcard-cert.sh $DOMAIN <email>"
      fi
      ;;
  esac
else
  echo "▶ [3/7] Wildcard SSL skipped (--no-wildcard)"
fi
echo ""

# ---------------------------------------------------------------------
# 4. Make sure PM2 + Nginx survive a reboot
# ---------------------------------------------------------------------
echo "▶ [4/7] Boot persistence..."
command -v pm2 >/dev/null 2>&1 && { pm2 save >/dev/null 2>&1; echo "   ✅ pm2 saved"; }
systemctl enable nginx >/dev/null 2>&1 && echo "   ✅ nginx enabled on boot"
echo ""

# ---------------------------------------------------------------------
# 5. Firewall
# ---------------------------------------------------------------------
echo "▶ [5/7] Firewall..."
# Adding these two rules is safe whether UFW is on or off.
ufw allow OpenSSH      >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
echo "   ✅ rules added: 22 (SSH), 80/443 (Nginx)"

# Do NOT force-enable UFW. This box may already host another site whose
# ports we know nothing about (database, panel, mail, custom service);
# enabling the firewall would silently block them.
if ufw status 2>/dev/null | grep -qi "Status: active"; then
  echo "   ✅ UFW pehle se active tha — sirf rules add hue, kuch block nahi hua."
else
  echo "   ⏭ UFW INACTIVE hai — enable NAHI kiya."
  echo "     Is server pe dusri site chal rahi hai, isliye bina jaane firewall"
  echo "     on karna uske ports block kar sakta tha."
  echo "     Baad me khud on karna ho to pehle check karo:  bash deploy/inspect-server.sh"
  echo "     phir:  ufw status  →  ufw allow <port>  →  ufw enable"
fi
echo ""

# ---------------------------------------------------------------------
# 6. Verify
# ---------------------------------------------------------------------
echo "▶ [6/7] Verification..."
sleep 2

check() { # <label> <url> <expected-substring>
  local out; out="$(curl -sk --max-time 12 "$2" 2>/dev/null || true)"
  if echo "$out" | grep -q "$3"; then echo "   ✅ $1"; else echo "   ❌ $1  ($2)"; fi
}

# The app reads PORT from .env; fall back to 3000. Kept deliberately simple —
# this is only for the verification readout below.
LOCAL_PORT="$(grep -m1 '^PORT=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')"
LOCAL_PORT="${LOCAL_PORT:-3000}"

PM2_ONLINE="$(pm2 jlist 2>/dev/null | grep -o '"status":"online"' | wc -l)"
PM2_ONLINE="${PM2_ONLINE:-0}"

printf "   %-34s %s\n" "PM2 processes online:" "$PM2_ONLINE"
printf "   %-34s %s\n" "Node on 127.0.0.1:$LOCAL_PORT" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://127.0.0.1:$LOCAL_PORT/" 2>/dev/null || echo 'DOWN')"
printf "   %-34s %s\n" "http://$DOMAIN" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 http://$DOMAIN/ 2>/dev/null || echo 'n/a')"
printf "   %-34s %s\n" "https://$DOMAIN" "$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 https://$DOMAIN/ 2>/dev/null || echo 'n/a')"
printf "   %-34s %s\n" "https://$DOMAIN/admin" "$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 https://$DOMAIN/admin 2>/dev/null || echo 'n/a')"
printf "   %-34s %s\n" "admin API locked (401 expected)" "$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 https://$DOMAIN/api/admin/settings 2>/dev/null || echo 'n/a')"
echo ""

# ---------------------------------------------------------------------
# 7. Next steps
# ---------------------------------------------------------------------
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   ✅ SETUP DONE                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "   📱 Landing page : https://$DOMAIN"
echo "   📊 Admin panel  : https://$DOMAIN/admin"
echo "   ⚡ Webhook URL  : https://$DOMAIN/api/telegram-webhook"
echo ""
echo "   🔑 Default admin password: admin"
echo ""
echo "──────────────────────────────────────────────────────────────"
echo "   AB YE KARO (order me):"
echo "──────────────────────────────────────────────────────────────"
echo "   1. https://$DOMAIN/admin kholo → password 'admin' se login"
echo "   2. 🔴 PASSWORD BADLO (default chhodna khatarnak hai)"
echo "   3. Telegram bot token + channel ID daalo → Save"
echo "   4. Public URL = https://$DOMAIN → 'Set Webhook' dabao"
echo "      (ye zaroori hai — naya webhook secret Telegram tak jaana chahiye)"
echo "   5. Meta Pixel ID + CAPI token → 'Send Test Event'"
echo "   6. '1-Click Lead Simulator' se funnel test karo"
echo ""
echo "──────────────────────────────────────────────────────────────"
echo "   NAYA CLIENT ADD KARNA HO (subdomain pe):"
echo "──────────────────────────────────────────────────────────────"
echo "   a) Cloudflare DNS me A record add karo:"
echo "        Type A | Name client1 | Content <VPS IP> | DNS only"
echo "   b) Server pe:"
echo "        cd $APP_DIR"
echo "        bash deploy/add-client.sh add client1 client1.$DOMAIN --label \"Client 1\" --wildcard"
echo "   c) https://client1.$DOMAIN/admin → us client ka bot + pixel bharo"
echo ""
echo "   Saare clients dekhne ke liye:  bash deploy/add-client.sh list"
echo ""
echo "──────────────────────────────────────────────────────────────"
echo "   ⚠ CLOUDFLARE ME 2 SETTING CHECK KARO:"
echo "──────────────────────────────────────────────────────────────"
echo "   • SSL/TLS mode = 'Full (strict)'  (Flexible = redirect LOOP)"
echo "   • DNS records  = grey cloud (DNS only), orange nahi"
echo "     Orange karoge to dashboard ka live feed har 100s pe katega."
echo ""
echo "   Useful commands:"
echo "     pm2 logs                     live logs"
echo "     pm2 list                     process status"
echo "     bash deploy/add-client.sh backup --all     data backup"
echo "╚══════════════════════════════════════════════════════════════╝"

exit $SETUP_RC
