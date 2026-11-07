#!/usr/bin/env bash
# =====================================================================
#  READ-ONLY server inspection — safe to run on a live production box.
#
#  This script CHANGES NOTHING. It only reads and prints.
#
#  Run this BEFORE quickstart.sh on any VPS that already hosts another
#  site, so you know exactly what could be disturbed:
#
#     bash deploy/inspect-server.sh
#
#  It reports: what is listening on which port, existing Nginx vhosts
#  and which domains they serve, whether the default site is in use,
#  existing SSL certificates, firewall rules, control panel presence,
#  and whether /opt/app is already occupied.
# =====================================================================

set -uo pipefail

line() { printf '%s\n' "──────────────────────────────────────────────────────────────"; }
head2() { echo ""; line; echo "  $1"; line; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   SERVER INSPECTION  —  READ ONLY, kuch bhi change nahi hoga ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "   Host     : $(hostname 2>/dev/null || echo '?')"
echo "   Date     : $(date)"
echo "   OS       : $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || uname -s)"
echo "   Kernel   : $(uname -r)"
echo "   Public IP: $(curl -fsS -4 --max-time 8 ifconfig.me 2>/dev/null || echo 'unknown')"
echo "   Uptime   :$(uptime 2>/dev/null | sed 's/^ *//')"

# ---------------------------------------------------------------------
head2 "1. KYA-KYA CHAL RAHA HAI (processes)"
# ---------------------------------------------------------------------
for svc in nginx apache2 httpd caddy node pm2 mysql mariadb php-fpm docker litespeed lsphp; do
  if pgrep -x "$svc" >/dev/null 2>&1 || pgrep -f "$svc" >/dev/null 2>&1; then
    n=$(pgrep -fc "$svc" 2>/dev/null || echo '?')
    echo "   🟢 RUNNING : $svc  ($n process)"
  fi
done

echo ""
echo "   Control panel detect:"
found_panel=0
[ -d /usr/local/cpanel ]   && { echo "     ⚠ cPanel/WHM installed"; found_panel=1; }
[ -d /usr/local/directadmin ] && { echo "     ⚠ DirectAdmin installed"; found_panel=1; }
[ -f /etc/init.d/cyberpanel ] || [ -d /usr/local/CyberCP ] && { echo "     ⚠ CyberPanel installed"; found_panel=1; }
[ -d /www/server/panel ]   && { echo "     ⚠ aaPanel/BT-Panel installed"; found_panel=1; }
[ -d /usr/local/lsws ]     && { echo "     ⚠ LiteSpeed (OpenLiteSpeed) installed"; found_panel=1; }
[ -d /opt/hestia ]         && { echo "     ⚠ HestiaCP installed"; found_panel=1; }
[ -d /usr/local/psa ]      && { echo "     ⚠ Plesk installed"; found_panel=1; }
[ "$found_panel" -eq 0 ]   && echo "     ✅ koi control panel nahi mila (plain VPS lagta hai)"

if [ "$found_panel" -eq 1 ]; then
  echo ""
  echo "     🔴 RUKO — control panel wala server hai."
  echo "        Nginx/SSL ko manually chhedna existing sites tod sakta hai."
  echo "        Site panel ke through hi manage karo, ya naya VPS lo."
fi

# ---------------------------------------------------------------------
head2 "2. KAUN SE PORTS USE HO RAHE HAIN  ⭐ (conflict yahi se pata chalega)"
# ---------------------------------------------------------------------
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | awk 'NR>1 {print "   " $4 "\t" $6}' | sort -u
else
  netstat -tlnp 2>/dev/null | awk 'NR>3 {print "   " $4 "\t" $7}' | sort -u
fi

echo ""
echo "   Port conflict check for our app:"
for p in 3000 3001 3002; do
  if ss -tln 2>/dev/null | grep -q ":$p " || netstat -tln 2>/dev/null | grep -q ":$p "; then
    echo "     🔴 port $p  BUSY — ye use nahi kar sakte"
  else
    echo "     🟢 port $p  FREE"
  fi
done

# ---------------------------------------------------------------------
head2 "3. NGINX — EXISTING SITES  ⭐ (sabse important)"
# ---------------------------------------------------------------------
if command -v nginx >/dev/null 2>&1; then
  echo "   nginx version: $(nginx -v 2>&1 | sed 's#nginx version: ##')"
  echo "   config test  : $(nginx -t 2>&1 | tail -1 | sed 's/^/     /')"
  echo ""

  echo "   sites-enabled/ :"
  if ls /etc/nginx/sites-enabled/ >/dev/null 2>&1; then
    for f in /etc/nginx/sites-enabled/*; do
      [ -e "$f" ] || continue
      tgt=""
      [ -L "$f" ] && tgt=" -> $(readlink -f "$f")"
      echo "     • $(basename "$f")$tgt"
    done
  else
    echo "     (folder nahi hai)"
  fi

  echo ""
  echo "   conf.d/ :"
  if ls /etc/nginx/conf.d/*.conf >/dev/null 2>&1; then
    for f in /etc/nginx/conf.d/*.conf; do echo "     • $(basename "$f")"; done
  else
    echo "     (koi .conf nahi)"
  fi

  echo ""
  echo "   🔍 KAUN SE DOMAINS SERVE HO RAHE HAIN:"
  echo "      (note: -R use ho raha hai kyunki sites-enabled/ me sirf symlinks hote hain;"
  echo "       grep -r unhe follow nahi karta aur khaali result deta hai)"
  grep -RhE '^[[:space:]]*server_name' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null \
    | sed 's/^[[:space:]]*server_name[[:space:]]*//; s/;.*$//' \
    | tr ' ' '\n' | grep -v '^$' | sort -u | sed 's/^/     • /'

  echo ""
  echo "   ⚠ 'default_server' kaha set hai (ye hatana DANGEROUS ho sakta hai):"
  grep -Rn "default_server" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ /etc/nginx/nginx.conf 2>/dev/null \
    | sed 's/^/     /' || echo "     (kahin nahi mila)"

  echo ""
  if [ -e /etc/nginx/sites-enabled/default ]; then
    echo "   🔴 /etc/nginx/sites-enabled/default EXIST KARTA HAI."
    echo "      Agar koi dusri site ispe depend karti hai to ise hatane se wo band ho jaayegi."
    echo "      Hum ise NAHI hatayenge (safe mode)."
    echo "      Isme ye domains hain:"
    grep -E '^[[:space:]]*server_name' /etc/nginx/sites-enabled/default 2>/dev/null | sed 's/^/        /' || echo "        (server_name nahi — catch-all default hai)"
  else
    echo "   🟢 sites-enabled/default nahi hai — koi conflict nahi."
  fi
else
  echo "   ⚠ nginx installed NAHI hai."
  echo "     To existing site kisi aur cheez se chal rahi hai — Apache/LiteSpeed/caddy/panel."
  echo "     🔴 Nginx install karne se port 80/443 pe conflict ho sakta hai!"
  echo ""
  echo "     Abhi 80/443 pe kaun hai:"
  ss -tlnp 2>/dev/null | grep -E ':80 |:443 ' | sed 's/^/       /' || echo "       (koi nahi)"
fi

# Apache check
if command -v apache2ctl >/dev/null 2>&1 || command -v httpd >/dev/null 2>&1; then
  echo ""
  echo "   ⚠ Apache bhi installed hai:"
  apache2ctl -S 2>/dev/null | sed 's/^/     /' || httpd -S 2>/dev/null | sed 's/^/     /' || true
fi

# ---------------------------------------------------------------------
head2 "4. SSL CERTIFICATES (jo pehle se bane hain)"
# ---------------------------------------------------------------------
if command -v certbot >/dev/null 2>&1; then
  certbot certificates 2>/dev/null | grep -E "Certificate Name|Domains|Expiry" | sed 's/^/   /' || echo "   (koi cert nahi)"
else
  echo "   certbot installed nahi"
fi
if [ -d /etc/letsencrypt/live ] && ls /etc/letsencrypt/live >/dev/null 2>&1; then
  echo ""
  echo "   /etc/letsencrypt/live/ :"
  for d in /etc/letsencrypt/live/*/; do [ -d "$d" ] && echo "     • $(basename "$d")"; done
fi
echo ""
echo "   Nginx ke SSL cert paths:"
grep -RhoE "ssl_certificate[[:space:]]+[^;]+" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null \
  | sed 's/^/     /' | sort -u || echo "     (koi nahi)"

# ---------------------------------------------------------------------
head2 "5. FIREWALL"
# ---------------------------------------------------------------------
if command -v ufw >/dev/null 2>&1; then
  echo "   UFW status:"
  ufw status verbose 2>/dev/null | sed 's/^/     /' || echo "     (read nahi ho paya)"
else
  echo "   ufw installed nahi"
fi
echo ""
echo "   iptables INPUT rules:"
iptables -S INPUT 2>/dev/null | head -20 | sed 's/^/     /' || echo "     (read nahi ho paya)"

# ---------------------------------------------------------------------
head2 "6. /opt/app AUR DISK"
# ---------------------------------------------------------------------
if [ -e /opt/app ]; then
  echo "   🔴 /opt/app PEHLE SE EXIST KARTA HAI:"
  ls -la /opt/app 2>/dev/null | head -15 | sed 's/^/     /'
  echo ""
  echo "     Isliye quickstart.sh --safe-app-dir use karo, warna ye delete ho jaayega."
else
  echo "   🟢 /opt/app khaali hai — safe."
fi
echo ""
echo "   /opt me kya-kya hai:"
ls -la /opt 2>/dev/null | sed 's/^/     /'
echo ""
echo "   Disk usage:"
df -h / 2>/dev/null | sed 's/^/     /'
echo ""
echo "   RAM:"
free -h 2>/dev/null | sed 's/^/     /'

# ---------------------------------------------------------------------
head2 "7. PM2 (agar pehle se kuch chal raha hai)"
# ---------------------------------------------------------------------
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null | sed 's/^/   /'
  echo ""
  echo "   ⚠ Naam 'zero-fake-click' se takra raha hai kya?"
  pm2 jlist 2>/dev/null | grep -o '"name":"[^"]*"' | sed 's/^/     /' || true
else
  echo "   pm2 installed nahi — fresh install hoga, koi conflict nahi."
fi

# ---------------------------------------------------------------------
head2 "8. JAICLUB5VIP.SITE KAISE SERVE HO RAHA HAI?"
# ---------------------------------------------------------------------
echo "   🔍 Existing domain ke config dhundh rahe hain..."
hit=0
for pat in /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/apache2 /etc/httpd /usr/local/lsws/conf /www/server/panel/vhost; do
  [ -d "$pat" ] || continue
  while IFS= read -r f; do
    echo "     📄 $f"
    hit=1
  done < <(grep -rl "jaiclub5vip" "$pat" 2>/dev/null)
done
[ "$hit" -eq 0 ] && echo "     (kahin nahi mila — domain shayad is server pe nahi, ya panel me hai)"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   INSPECTION KHATAM — kuch bhi change nahi hua               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "   👉 Is output ko copy karke mujhe bhejo, main bata dunga ki"
echo "      devlopedwithzayro.site ko safely kaise add karna hai bina"
echo "      jaiclub5vip.site ko chhede."
echo ""
