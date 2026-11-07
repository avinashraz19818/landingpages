#!/usr/bin/env bash
# =====================================================================
#  Issue a Let's Encrypt WILDCARD certificate using the Cloudflare
#  DNS-01 challenge.
#
#  One certificate covers BOTH:
#      yourdomain.com
#      *.yourdomain.com
#
#  ...so every client subdomain (ree.yourdomain.com, jatin.yourdomain.com)
#  is already covered. Adding a client later needs NO new certificate.
#
#  Usage:
#    bash deploy/wildcard-cert.sh <domain> <email> [--token <cf_api_token>]
#
#  Without --token the script prompts (input hidden) and stores it in
#  /etc/letsencrypt/cloudflare.ini with 600 permissions.
#
#  The token needs only:  Zone -> DNS -> Edit  for that one zone.
# =====================================================================
set -euo pipefail

DOMAIN=""
EMAIL=""
TOKEN="${CF_API_TOKEN:-}"
INI_FILE="/etc/letsencrypt/cloudflare.ini"

die() { echo -e "❌ $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --token) TOKEN="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^#\{1,2\} \{0,1\}//'; exit 0 ;;
    *)
      if   [ -z "$DOMAIN" ]; then DOMAIN="$1"
      elif [ -z "$EMAIL" ];  then EMAIL="$1"
      else die "Unexpected argument: $1"
      fi
      shift ;;
  esac
done

[ "$(id -u)" -eq 0 ] || die "Run as root (sudo)."
[ -n "$DOMAIN" ] || die "Usage: bash deploy/wildcard-cert.sh <domain> <email> [--token <cf_api_token>]"

# Strip a leading www. or protocol if pasted by mistake — wildcard certs are
# issued against the apex domain.
DOMAIN="$(echo "$DOMAIN" | sed -e 's#^https\?://##' -e 's#^www\.##' -e 's#/.*$##')"

if [ -z "$EMAIL" ]; then
  read -r -p "Email for Let's Encrypt renewal notices: " EMAIL
fi
[ -n "$EMAIL" ] || die "Email is required (Let's Encrypt sends expiry warnings)."

echo "=============================================================="
echo " Wildcard SSL via Cloudflare DNS-01"
echo "   Domain  : $DOMAIN  +  *.$DOMAIN"
echo "   Email   : $EMAIL"
echo "=============================================================="

# ---------- 1. Install certbot + Cloudflare DNS plugin ---------------
echo "▶ [1/5] Installing certbot + Cloudflare DNS plugin..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y certbot python3-certbot-dns-cloudflare nginx >/dev/null

if ! certbot plugins 2>/dev/null | grep -q dns-cloudflare; then
  die "certbot dns-cloudflare plugin install hua nahi. Try: apt-get install -y python3-certbot-dns-cloudflare"
fi
echo "   ✅ dns-cloudflare plugin ready"

# ---------- 2. Store the API token securely --------------------------
echo "▶ [2/5] Configuring Cloudflare credentials..."
if [ -z "$TOKEN" ] && [ -f "$INI_FILE" ]; then
  echo "   $INI_FILE already exists — reusing stored token."
elif [ -z "$TOKEN" ]; then
  echo ""
  echo "   Cloudflare API token chahiye. Banane ka tareeqa:"
  echo "     dash.cloudflare.com → My Profile → API Tokens → Create Token"
  echo "     Permission : Zone → DNS → Edit"
  echo "     Zone       : Include → Specific zone → $DOMAIN"
  echo ""
  read -r -s -p "   Paste API token (input hidden): " TOKEN
  echo ""
  [ -n "$TOKEN" ] || die "Token khaali hai."
fi

if [ ! -f "$INI_FILE" ] || ! grep -q "dns_cloudflare_api_token" "$INI_FILE" 2>/dev/null; then
  mkdir -p /etc/letsencrypt
  umask 077
  cat > "$INI_FILE" <<EOF
# Cloudflare API credentials for certbot DNS-01 challenges.
# Permission needed: Zone -> DNS -> Edit (for $DOMAIN only).
dns_cloudflare_api_token = $TOKEN
EOF
  chmod 600 "$INI_FILE"
  echo "   ✅ token stored in $INI_FILE (chmod 600)"
else
  echo "   ✅ existing token file kept"
fi

# ---------- 3. Verify DNS actually resolves to this machine ----------
echo "▶ [3/5] Sanity-checking DNS..."
if command -v dig >/dev/null 2>&1; then
  NS="$(dig +short NS "$DOMAIN" @1.1.1.1 2>/dev/null | head -2 | tr '\n' ' ')"
  if echo "$NS" | grep -qi cloudflare; then
    echo "   ✅ nameservers Cloudflare pe hain: $NS"
  else
    echo "   ⚠ nameservers abhi Cloudflare pe NAHI hain: ${NS:-<empty>}"
    echo "     DNS-01 challenge phir bhi chal sakta hai agar Cloudflare zone me"
    echo "     domain add ho chuka hai — aage badh rahe hain."
  fi
fi

# ---------- 4. Issue the wildcard certificate ------------------------
echo "▶ [4/5] Issuing wildcard certificate (DNS-01)..."
mkdir -p /var/www/certbot

if certbot certonly \
     --dns-cloudflare \
     --dns-cloudflare-credentials "$INI_FILE" \
     --dns-cloudflare-propagation-seconds 30 \
     -d "$DOMAIN" -d "*.$DOMAIN" \
     --non-interactive --agree-tos --keep-until-expiring \
     -m "$EMAIL" \
     --no-eff-email; then
  echo "   ✅ Certificate issued"
else
  echo ""
  die "Certificate issue nahi hua. Common reasons:
  • API token me Zone→DNS→Edit permission nahi hai
  • Token galat zone ke liye restricted hai
  • Domain Cloudflare me add hi nahi hua
  • DNS propagate nahi hua (15-30 min ruko, dobara chalao)

  Debug ke liye:  certbot certificates"
fi

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
echo "   cert : $CERT_DIR/fullchain.pem"
echo "   key  : $CERT_DIR/privkey.pem"

# ---------- 5. Confirm auto-renewal works ----------------------------
echo "▶ [5/5] Verifying auto-renewal..."
if certbot renew --cert-name "$DOMAIN" --dry-run >/dev/null 2>&1; then
  echo "   ✅ dry-run renewal passed — cert khud renew hoga (DNS API se)"
else
  echo "   ⚠ dry-run renewal fail hua. Manual check karo:"
  echo "       certbot renew --cert-name $DOMAIN --dry-run"
fi

systemctl list-timers 2>/dev/null | grep -q certbot \
  && echo "   ✅ certbot systemd timer active" \
  || echo "   ℹ certbot timer nahi mila — cron laga lo:  0 4 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'"

cat <<SUMMARY

==============================================================
 ✅ WILDCARD SSL READY

   Certificate : $DOMAIN  +  *.$DOMAIN
   Location    : $CERT_DIR
   Auto-renew  : configured (DNS-01, no downtime)

 👉 Ab clients add karo — SSL already covered hai, koi naya
    certificate nahi banega:

      cd /opt/app
      bash deploy/add-client.sh add ree   ree.$DOMAIN   --label "Client 1" --wildcard
      bash deploy/add-client.sh add jatin jatin.$DOMAIN --label "Client 2" --wildcard

 📌 Cloudflare dashboard me SSL/TLS mode "Full (strict)" rakho,
    warna redirect loop aayega.
==============================================================
SUMMARY
