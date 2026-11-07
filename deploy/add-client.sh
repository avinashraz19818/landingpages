#!/usr/bin/env bash
# =====================================================================
#  Multi-client manager for the 0-Fake-Click system
#
#  Provisions one fully isolated app instance per client on a single
#  VPS: own folder, own port, own data.json, own PM2 process, own
#  Nginx vhost, own SSL certificate.
#
#  Usage:
#    bash deploy/add-client.sh add    <slug> <domain> [options]
#        --label "Name"     human-readable client name
#        --alias <host>     extra server_name (defaults to www.<domain>
#                           for apex domains, none for subdomains)
#        --port <n>         force a specific internal Node port
#        --wildcard         reuse the apex wildcard cert instead of
#                           issuing a new one. Use this when clients are
#                           subdomains of one domain and you have already
#                           run deploy/wildcard-cert.sh — adding a client
#                           then needs no certificate wait at all.
#                           Subdomains only; rejected for an apex domain.
#        --cert <name>      like --wildcard but names the cert dir under
#                           /etc/letsencrypt/live/ explicitly, for odd
#                           layouts such as a.b.example.co.in
#    bash deploy/add-client.sh list
#    bash deploy/add-client.sh update <slug>|--all
#    bash deploy/add-client.sh logs   <slug>
#    bash deploy/add-client.sh backup [--all]
#    bash deploy/add-client.sh remove <slug>
#
#  Registry: /opt/zfc-clients/clients.json
# =====================================================================
set -euo pipefail

REPO_DEFAULT="https://github.com/avinashraz19818/landingpages.git"
CLIENTS_DIR="${CLIENTS_DIR:-/opt/zfc-clients}"
REGISTRY="$CLIENTS_DIR/clients.json"
BASE_PORT="${BASE_PORT:-3001}"
NGINX_TEMPLATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/client-nginx.conf"

log()  { echo -e "$@"; }
die()  { echo -e "❌ $*" >&2; exit 1; }
need_root() { [ "$(id -u)" -eq 0 ] || die "Run as root (sudo)."; }

# ---------------------------------------------------------------------
# Registry helpers (node is already installed — no jq dependency)
# ---------------------------------------------------------------------
ensure_registry() {
  mkdir -p "$CLIENTS_DIR"
  if [ ! -f "$REGISTRY" ]; then
    cat > "$REGISTRY" <<EOF
{
  "repo": "$REPO_DEFAULT",
  "clientsDir": "$CLIENTS_DIR",
  "basePort": $BASE_PORT,
  "clients": []
}
EOF
    log "   created registry $REGISTRY"
  fi
}

reg() { node -e "
  const fs=require('fs');
  const r=JSON.parse(fs.readFileSync('$REGISTRY','utf8'));
  process.stdout.write(String((() => { $1 })() ?? ''));
"; }

list_clients() {
  node -e "
    const fs=require('fs');
    if (!fs.existsSync('$REGISTRY')) { console.log(''); process.exit(0); }
    const r=JSON.parse(fs.readFileSync('$REGISTRY','utf8'));
    console.log((r.clients||[]).map(c=>c.slug).join('\n'));
  "
}

client_field() { # <slug> <field>
  node -e "
    const fs=require('fs');
    const r=JSON.parse(fs.readFileSync('$REGISTRY','utf8'));
    const c=(r.clients||[]).find(x=>x.slug==='$1');
    if(!c){process.exit(0);}
    const v=c['$2'];
    console.log(Array.isArray(v)?v.join(' '):(v??''));
  "
}

next_port() {
  node -e "
    const fs=require('fs');
    const r=JSON.parse(fs.readFileSync('$REGISTRY','utf8'));
    const used=new Set((r.clients||[]).map(c=>c.port).filter(Boolean));
    let p=r.basePort||$BASE_PORT;
    while(used.has(p)) p++;
    console.log(p);
  "
}

register_client() { # <json object>
  node -e "
    const fs=require('fs');
    const r=JSON.parse(fs.readFileSync('$REGISTRY','utf8'));
    r.clients=r.clients||[];
    const c=JSON.parse(process.argv[1]);
    const i=r.clients.findIndex(x=>x.slug===c.slug);
    if(i>=0) r.clients[i]=c; else r.clients.push(c);
    fs.writeFileSync('$REGISTRY', JSON.stringify(r,null,2)+'\n');
  " "$1"
}

unregister_client() { # <slug>
  node -e "
    const fs=require('fs');
    const r=JSON.parse(fs.readFileSync('$REGISTRY','utf8'));
    r.clients=(r.clients||[]).filter(x=>x.slug!=='$1');
    fs.writeFileSync('$REGISTRY', JSON.stringify(r,null,2)+'\n');
  "
}

# ---------------------------------------------------------------------
# ADD
# ---------------------------------------------------------------------
cmd_add() {
  need_root
  local slug="" domain="" label="" port="" alias_arg="" cert_override="" wildcard=0

  slug="${1:-}"; domain="${2:-}"
  [ -n "$slug" ] && [ -n "$domain" ] || die "Usage: add-client.sh add <slug> <domain> [--label \"Name\"] [--alias host] [--port N] [--wildcard] [--cert name]"
  shift 2 || true

  while [ $# -gt 0 ]; do
    case "$1" in
      --alias)    alias_arg="${2:-}"; shift 2 ;;
      --label)    label="${2:-}"; shift 2 ;;
      --port)     port="${2:-}"; shift 2 ;;
      --cert)     cert_override="${2:-}"; wildcard=1; shift 2 ;;
      --wildcard) wildcard=1; shift ;;
      *) die "Unknown option: $1" ;;
    esac
  done

  echo "$slug" | grep -Eq '^[a-z0-9][a-z0-9_-]{0,31}$' \
    || die "slug must be lowercase a-z 0-9 _ - and start with a letter/number (got: $slug)"

  ensure_registry
  [ -n "$(client_field "$slug" slug)" ] && die "Client '$slug' already exists. Use 'update $slug' or 'remove $slug' first."

  [ -n "$label" ] || label="$slug"
  [ -n "$port" ]  || port="$(next_port)"

  # Default alias: only add www. for an apex domain (yourdomain.com).
  # For a subdomain like ree.yourdomain.com, www.ree.yourdomain.com makes
  # no sense and would just fail the cert request.
  local aliases
  if [ -n "$alias_arg" ]; then
    aliases="$alias_arg"
  else
    local dots; dots="$(echo "$domain" | tr -cd '.' | wc -c)"
    if [ "$dots" -eq 1 ]; then aliases="www.$domain"; else aliases=""; fi
  fi

  # Which Let's Encrypt cert directory the vhost should point at.
  # --wildcard reuses the apex-domain cert created by wildcard-cert.sh,
  # so ree.yourdomain.com uses /etc/letsencrypt/live/yourdomain.com/
  local certname="$domain"
  if [ "$wildcard" -eq 1 ]; then
    # --wildcard only makes sense for a subdomain: ree.yourdomain.com reuses
    # the *.yourdomain.com cert. On an apex domain, stripping the first label
    # would leave garbage ("sureshotree.com" -> "com"), so reject it.
    local wdots; wdots="$(echo "$domain" | tr -cd '.' | wc -c)"
    if [ "$wdots" -lt 2 ]; then
      die "--wildcard sirf subdomain ke liye hai (jaise ree.yourdomain.com).
   '$domain' ek apex domain hai — iske liye --wildcard mat lagao, script
   apne aap per-domain Let's Encrypt cert issue kar dega."
    fi

    certname="$(echo "$domain" | cut -d. -f2-)"

    # --cert lets you override the cert dir name for unusual layouts
    # (e.g. a.b.example.co.in whose wildcard was issued for example.co.in)
    [ -n "$cert_override" ] && certname="$cert_override"

    if [ ! -f "/etc/letsencrypt/live/$certname/fullchain.pem" ]; then
      die "Wildcard cert nahi mila: /etc/letsencrypt/live/$certname/

   Pehle chalao:  bash deploy/wildcard-cert.sh $certname aapka@email.com

   Agar aapka wildcard cert kisi dusre naam se bana hai to --cert <name> do.
   Available certs:  certbot certificates"
    fi
  fi

  local appdir="$CLIENTS_DIR/$slug"
  local repo; repo="$(reg "return r.repo")"; repo="${repo:-$REPO_DEFAULT}"

  log "=============================================================="
  log " Adding client: <b>$label</b>"
  log "   slug    : $slug"
  log "   domain  : $domain  (aliases: ${aliases:-none})"
  log "   port    : $port"
  log "   cert    : $([ "$wildcard" -eq 1 ] && echo "wildcard ($certname)" || echo "per-domain ($domain)")"
  log "   appdir  : $appdir"
  log "=============================================================="

  # ---- 1. App code ----
  if [ ! -f "$appdir/server.js" ]; then
    log "▶ [1/6] Cloning app code..."
    rm -rf "$appdir"
    git clone --depth 1 "$repo" "$appdir" >/dev/null 2>&1 \
      || die "git clone failed from $repo — check the repo URL in $REGISTRY"
  else
    log "▶ [1/6] App code already present, reusing."
  fi
  cd "$appdir"

  # ---- 2. Per-client runtime state ----
  log "▶ [2/6] Preparing isolated data + env..."
  mkdir -p public/uploads /var/log/zfc-$slug /var/www/certbot
  if [ ! -f data.json ] && [ -f data.json.example ]; then
    cp data.json.example data.json
    # Pre-fill the public URL so Meta CAPI attribution is right from day one
    node -e "
      const fs=require('fs');const d=JSON.parse(fs.readFileSync('data.json','utf8'));
      d.settings.publicUrl='https://$domain';
      fs.writeFileSync('data.json', JSON.stringify(d,null,2)+'\n');
    "
    log "   seeded data.json (publicUrl = https://$domain)"
  fi
  chmod 600 data.json 2>/dev/null || true

  if [ ! -f .env ]; then
    printf 'PORT=%s\nNODE_ENV=production\n' "$port" > .env
  else
    sed -i "s/^PORT=.*/PORT=$port/" .env
  fi

  npm install --omit=dev --no-audit --no-fund >/dev/null

  # ---- 3. PM2 process ----
  log "▶ [3/6] Starting PM2 process zfc-$slug..."
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2 >/dev/null
  pm2 delete "zfc-$slug" >/dev/null 2>&1 || true

  # The app reads PORT from the environment, so export it for this call.
  # `fork` mode + 1 instance is mandatory: data.json is a single file and
  # cluster mode would corrupt it with concurrent writes.
  PORT="$port" NODE_ENV=production pm2 start server.js \
    --name "zfc-$slug" \
    --time \
    --max-memory-restart 400M \
    --error "/var/log/zfc-$slug/error.log" \
    --log   "/var/log/zfc-$slug/out.log" >/dev/null
  pm2 save >/dev/null

  # ---- 4. Nginx vhost ----
  log "▶ [4/6] Writing Nginx vhost..."
  [ -f "$NGINX_TEMPLATE" ] || die "Template not found: $NGINX_TEMPLATE"
  # Install the shared rate-limit zone once
  if [ ! -f /etc/nginx/conf.d/zfc.conf ]; then
    cp "$(dirname "$NGINX_TEMPLATE")/nginx-confd-zfc.conf" /etc/nginx/conf.d/zfc.conf
    log "   installed /etc/nginx/conf.d/zfc.conf"
  fi

  sed "s|__SLUG__|$slug|g; s|__DOMAIN__|$domain|g; s|__ALIASES__|$aliases|g; s|__PORT__|$port|g; s|__APPDIR__|$appdir|g; s|__CERTNAME__|$certname|g" \
    "$NGINX_TEMPLATE" > "/etc/nginx/sites-available/zfc-$slug.conf"

  # Until SSL exists, serve a plain HTTP vhost so certbot can validate
  cat > "/etc/nginx/sites-enabled/zfc-$slug.conf" <<EOF
server {
    listen 80;
    server_name $domain $aliases;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection        '';
        proxy_buffering                    off;
        proxy_read_timeout                 3600s;
    }
}
EOF
  nginx -t >/dev/null && systemctl reload nginx

  # ---- 5. SSL ----
  local ssl_ok=0

  if [ "$wildcard" -eq 1 ]; then
    # Certificate already exists (wildcard-cert.sh made it). Nothing to issue —
    # just switch the vhost on. This is the fast path for every new subdomain.
    log "▶ [5/6] Reusing wildcard cert for *.$certname..."
    cp "/etc/nginx/sites-available/zfc-$slug.conf" "/etc/nginx/sites-enabled/zfc-$slug.conf"
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx
      ssl_ok=1
      log "   ✅ SSL live for $domain (wildcard, no new certificate needed)"
    else
      log "   ⚠ nginx -t fail hua. Bootstrap HTTP config pe chhod diya hai."
      nginx -t 2>&1 | sed 's/^/     /' || true
    fi
  else
    log "▶ [5/6] Issuing SSL for $domain..."
    command -v certbot >/dev/null 2>&1 || {
      apt-get install -y certbot python3-certbot-nginx >/dev/null
    }

    local cert_args=(-d "$domain")
    for a in $aliases; do cert_args+=(-d "$a"); done

    if certbot certonly --webroot -w /var/www/certbot "${cert_args[@]}" \
         --non-interactive --agree-tos --register-unsafely-without-email >/dev/null 2>&1; then
      ssl_ok=1
      cp "/etc/nginx/sites-available/zfc-$slug.conf" "/etc/nginx/sites-enabled/zfc-$slug.conf"
      if nginx -t >/dev/null 2>&1; then
        systemctl reload nginx
        log "   ✅ SSL live for $domain"
      else
        log "   ⚠ full vhost failed nginx -t; left on the HTTP bootstrap config."
        nginx -t 2>&1 | sed 's/^/     /' || true
      fi
    else
      log "   ⚠ SSL not issued yet — DNS for $domain probably does not point at this VPS."
      log "     Site is live over HTTP. After fixing DNS run:"
      log "       certbot certonly --webroot -w /var/www/certbot ${cert_args[*]}"
      log "     then:  cp /etc/nginx/sites-available/zfc-$slug.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
      log ""
      log "     💡 Subdomain use kar rahe ho? Wildcard cert zyada aasan hai:"
      log "          bash deploy/wildcard-cert.sh $certname aapka@email.com"
      log "        phir is client ko dobara add karo --wildcard ke saath."
    fi
  fi

  # ---- 6. Registry ----
  log "▶ [6/6] Updating registry..."
  register_client "$(node -e "
    console.log(JSON.stringify({
      slug:'$slug', label:'$label', domain:'$domain',
      aliases:'$aliases'.split(' ').filter(Boolean),
      port:$port, appdir:'$appdir', ssl: $([ $ssl_ok -eq 1 ] && echo true || echo false),
      certname:'$certname', wildcard: $([ $wildcard -eq 1 ] && echo true || echo false),
      createdAt:new Date().toISOString()
    }));
  ")"

  log ""
  log "=============================================================="
  log " ✅ Client '$slug' provisioned"
  log ""
  log "   Landing page : https://$domain"
  log "   Admin panel  : https://$domain/admin   (default password: admin)"
  log "   Webhook URL  : https://$domain/api/telegram-webhook"
  log "   PM2 process  : zfc-$slug   (port $port)"
  log "   Data file    : $appdir/data.json"
  log ""
  log " 👉 NEXT for this client:"
  log "    1. Open /admin, change the password (default 'admin' is not safe)"
  log "    2. Enter THIS client's Telegram bot token + channel id -> save"
  log "    3. Set Public URL = https://$domain -> Set Webhook"
  log "    4. Enter THIS client's Meta Pixel ID + CAPI token -> Test"
  log "    5. Verify $domain in the CLIENT's Meta Business Manager"
  log "=============================================================="
}

# ---------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------
cmd_list() {
  ensure_registry
  local count; count="$(list_clients | grep -c . || true)"
  echo "=============================================================="
  echo " Registered clients: $count   (registry: $REGISTRY)"
  echo "=============================================================="
  if [ "$count" -eq 0 ]; then
    echo " (none yet — add one with: bash deploy/add-client.sh add <slug> <domain>)"
    return 0
  fi
  printf "%-14s %-28s %-7s %-9s %s\n" "SLUG" "DOMAIN" "PORT" "SSL" "PM2"
  echo "----------------------------------------------------------------------"
  while read -r slug; do
    [ -z "$slug" ] && continue
    local dom port ssl st
    dom="$(client_field "$slug" domain)"
    port="$(client_field "$slug" port)"
    ssl="$(client_field "$slug" ssl)"
    st="$(pm2 jlist 2>/dev/null | node -e "
      let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
        try{const a=JSON.parse(s);const p=a.find(x=>x.name==='zfc-$slug');
        console.log(p?p.pm2_env.status:'missing')}catch(e){console.log('unknown')}});
    ")"
    printf "%-14s %-28s %-7s %-9s %s\n" "$slug" "$dom" "$port" "$([ "$ssl" = "true" ] && echo yes || echo NO)" "$st"
  done <<< "$(list_clients)"
  echo "----------------------------------------------------------------------"
}

# ---------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------
cmd_update() {
  need_root
  local target="${1:-}"; [ -n "$target" ] || die "Usage: update <slug>|--all"
  ensure_registry

  local slugs
  if [ "$target" = "--all" ]; then slugs="$(list_clients)"; else slugs="$target"; fi

  while read -r slug; do
    [ -z "$slug" ] && continue
    local appdir; appdir="$(client_field "$slug" appdir)"
    [ -d "$appdir" ] || { log "⚠ $slug: $appdir missing, skipped"; continue; }

    log "▶ Updating $slug ($appdir)..."
    cd "$appdir"

    # data.json is gitignored, so a pull never touches live lead data
    git pull --ff-only >/dev/null 2>&1 || { log "   ⚠ git pull failed for $slug"; continue; }
    npm install --omit=dev --no-audit --no-fund >/dev/null
    pm2 reload "zfc-$slug" >/dev/null 2>&1 || pm2 restart "zfc-$slug" >/dev/null 2>&1 || true
    log "   ✅ $slug updated"
  done <<< "$slugs"
  pm2 save >/dev/null
}

# ---------------------------------------------------------------------
# LOGS
# ---------------------------------------------------------------------
cmd_logs() {
  local slug="${1:-}"; [ -n "$slug" ] || die "Usage: logs <slug>"
  pm2 logs "zfc-$slug" --lines 100
}

# ---------------------------------------------------------------------
# BACKUP
# ---------------------------------------------------------------------
cmd_backup() {
  need_root
  ensure_registry
  local target=""; [ "${1:-}" = "--all" ] && target="--all"
  local stamp; stamp="$(date +%F-%H%M)"
  local outdir="$CLIENTS_DIR/backups/$stamp"
  mkdir -p "$outdir"

  local slugs
  if [ -n "$target" ] || [ -z "${1:-}" ]; then slugs="$(list_clients)"; else slugs="$1"; fi

  while read -r slug; do
    [ -z "$slug" ] && continue
    local appdir; appdir="$(client_field "$slug" appdir)"
    [ -f "$appdir/data.json" ] || continue
    cp "$appdir/data.json" "$outdir/$slug-data.json"
    [ -d "$appdir/public/uploads" ] && \
      tar czf "$outdir/$slug-uploads.tar.gz" -C "$appdir/public" uploads 2>/dev/null || true
    log "   ✅ backed up $slug"
  done <<< "$slugs"

  cp "$REGISTRY" "$outdir/clients.json"
  log "📦 Backup written to $outdir"
  log "   Tip: cron it —  30 3 * * * bash $(pwd)/deploy/add-client.sh backup --all"
}

# ---------------------------------------------------------------------
# REMOVE
# ---------------------------------------------------------------------
cmd_remove() {
  need_root
  local slug="${1:-}"; [ -n "$slug" ] || die "Usage: remove <slug>"
  ensure_registry
  local appdir dom
  appdir="$(client_field "$slug" appdir)"
  dom="$(client_field "$slug" domain)"
  [ -n "$appdir" ] || die "No client '$slug' in registry."

  read -r -p "⚠ This stops and deletes client '$slug' ($dom) including $appdir/data.json. Type the slug to confirm: " ans
  [ "$ans" = "$slug" ] || die "Cancelled."

  cmd_backup "$slug" >/dev/null 2>&1 || true

  pm2 delete "zfc-$slug" >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
  rm -f "/etc/nginx/sites-enabled/zfc-$slug.conf" "/etc/nginx/sites-available/zfc-$slug.conf"
  nginx -t >/dev/null 2>&1 && systemctl reload nginx
  certbot delete --cert-name "$dom" --non-interactive >/dev/null 2>&1 || true
  rm -rf "$appdir"
  unregister_client "$slug"
  log "✅ Client '$slug' removed (a backup was taken first)."
}

# ---------------------------------------------------------------------
usage() {
  # Print the comment banner at the top of this file, up to its closing rule.
  # Uses awk rather than a hardcoded line range so it cannot drift.
  awk 'NR==1 {next} /^# =====/ {n++; if (n==2) exit; next} n==1 {sub(/^# ?/, ""); print}' "${BASH_SOURCE[0]}"
}

case "${1:-}" in
  add)    shift; cmd_add "$@" ;;
  list|ls) cmd_list ;;
  update) shift; cmd_update "$@" ;;
  logs)   shift; cmd_logs "$@" ;;
  backup) shift; cmd_backup "$@" ;;
  remove|rm) shift; cmd_remove "$@" ;;
  *) usage; exit 1 ;;
esac
