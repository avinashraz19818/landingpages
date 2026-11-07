# 🏢 Multi-Client (Agency) Setup — Domain Strategy + Architecture

Aap is system ko **multiple clients** ke liye chalana chahte ho. Ye guide batata hai:
1. **Kaun sa domain kharido** (aur kaun sa bilkul nahi)
2. Architecture kaise banega
3. Ek-ek client kaise add karna hai

---

## ⚠️ Pehle ye samajh lo: ye app SINGLE-TENANT hai

Maine code check kiya — ek install me sirf **ek** client chalta hai:

```
db.js:5   const DB_FILE = path.join(__dirname, 'data.json');   ← ek hi file
data.json → { settings: {...} }                                ← ek hi global settings object
```

`server.js` me `req.hostname` ya koi tenant routing **kahin nahi** hai. Matlab ek hi install me 5 clients ka bot token / pixel store karne ki jagah hi nahi hai.

### Aur ek hard technical limit:
> **Ek Telegram bot sirf EK webhook URL set kar sakta hai.**
> `setWebhook` dobara call karne se purana webhook **replace** ho jaata hai.

Iska matlab: **har client ka apna alag Telegram bot + apna alag channel hona zaroori hai** — chahe aap code kuch bhi kar lo. Ye Telegram ki limit hai, app ki nahi.

### ✅ Iska sahi solution: ek VPS par N isolated instances

Har client ke liye:
- Alag folder, alag `data.json`
- Alag internal port (3001, 3002, 3003...)
- Alag PM2 process (`zfc-ree`, `zfc-jatin`...)
- Alag domain + alag SSL certificate
- Alag Telegram bot, alag Meta pixel

**Ek client ka kuch bhi bigadega to dusre clients pe zero asar.** Ye agency setup ke liye sabse safe model hai.

Repo me iske liye ready-made tooling hai:
- `deploy/add-client.sh` — ek command me pura client provision
- `deploy/clients.json` — client registry
- `deploy/client-nginx.conf` — per-client Nginx vhost template
- `deploy/nginx-confd-zfc.conf` — shared rate-limit config

---

## 🌍 DOMAIN STRATEGY — sabse important decision

### ❌ Option A: Ek root domain + sab clients subdomain pe

```
myagency.com
├── ree.myagency.com      ← client 1
├── jatin.myagency.com    ← client 2
└── asla.myagency.com     ← client 3
```

**Sasta** (ek hi domain), **wildcard SSL ek command me**. Lekin is niche me ye **khatarnaak** hai:

1. **Meta domain verification `eTLD+1` level pe hoti hai** — yaani `myagency.com` par. Saare clients ka reputation **ek hi domain pe stack** ho jaata hai.
2. **Ek client ka ad policy violation = pura root domain flag.** Ye trading-tips/Telegram niche Meta ki high-scrutiny category me aata hai. Landing page reject hona, domain blocklist hona — common hai. Ek client ne galat kiya to **saare clients ke ads band**.
3. **Client ka data aapke domain pe** — client chhod ke gaya to uska pixel/CAPI history aapke domain se chipki rahegi, aur wo apne Business Manager me domain verify nahi kar payega.
4. Ad click karne wale user ko `ree.myagency.com` dikhega — trust kam, CTR kam.

> Subdomain sirf tab theek hai jab **saare clients aapke khud ke** hon (aap hi ad account owner ho) aur aap risk accept karte ho.

---

### ✅ Option B (RECOMMENDED): Har client ka apna alag domain

```
sureshotree.com      ← client 1 (in ke naam pe)
jatintrading.in      ← client 2
aslabhai.com         ← client 3
+
zfcpanel.com         ← SIRF aapka private ops domain (ads me kabhi use nahi hoga)
```

**Fayde:**
| Fayda | Detail |
|---|---|
| 🛡️ **Reputation isolation** | Ek client ka domain ban hua to baaki clients bilkul safe |
| 🏷️ **Client ka brand** | URL me client ka naam → zyada trust → better CTR |
| ✅ **Client apna domain verify kar sakta hai** | Unke Business Manager me, unke ad account ke saath — jo actually sahi bhi hai |
| 🔄 **Rotate kar sakte ho** | Domain flag ho gaya to naya domain lagao, purana chhodo |
| 💰 **Client se billable** | Domain ka paisa client se lo — aapka cost zero |

**Nuksaan:** har domain ka alag SSL (certbot automatically handle karta hai) aur thoda zyada management — jo `add-client.sh` already automate kar deta hai.

---

### 🔥 Option C: High-risk clients ke liye 2-3 "burner" domains

Agar koi client aggressive ads chala raha hai aur domain baar-baar flag ho raha hai:

```
sureshotree.com      ← primary
sureshotree-v2.com   ← backup (ready, DNS already pointed)
sureshotree-live.in  ← backup 2
```

Primary block hote hi admin panel me **Public URL** badlo aur dusre domain pe shift kar do. Downtime ~5 minute. Iske liye `add-client.sh` me `--alias` use kar sakte ho ya alag slug se doosra instance bana sakte ho.

---

## 💡 Mera final recommendation aapke liye

```
1 domain  →  aapka private OPS domain     (zfcpanel.com jaisa kuch)
              - sirf aapke internal use ke liye
              - Meta ads me KABHI nahi jaayega
              - yahan se aap sab clients ko manage karoge

N domains →  ek per client                  (client ke naam pe)
              - yahi Meta ads me jaayega
              - client ke Business Manager me verify hoga
              - client se paise lo
```

**Ops domain kyu alag?** Kyunki aapko chahiye ki aapke saare clients ke ad-domain ek dusre se aur aapke khud ke infrastructure se **completely disconnected** hon. Meta ke paas koi link nahi hona chahiye jo ye dikhaye ki 10 alag-alag "independent" channels actually ek hi agency se chal rahe hain — warna ek ban = sab ban.

---

## 🏷️ KAUN SA TLD KHARIDO?

### ✅ Best
| TLD | Price (approx) | Kab le |
|---|---|---|
| **`.com`** | ₹900–1,200/yr | **Default choice.** Meta + users sabse zyada trust karte hain. Ad approval rate best. |
| **`.in`** | ₹450–700/yr (1st yr), renewal ₹800–1,000 | Audience **sirf India** ho to best value. Meta India me `.in` bilkul accept karta hai. |
| **`.co.in`** | ₹600–900/yr | `.in` ka alternative, thoda zyada "business" look |

### ❌ BILKUL MAT LO (Meta ads ke liye)
| TLD | Kyu nahi |
|---|---|
| `.xyz`, `.top`, `.click`, `.icu`, `.site`, `.online`, `.shop`, `.live` | Pehle saal ₹100–300 me milte hain, **renewal ₹1,000–3,500**. Aur ye TLDs spam se bhare hue hain → **Meta ka trust score low** → ad rejection rate high → domain jaldi blocklist. Sasta padta hai, mehnga pad jaata hai. |
| Free domains (`.tk`, `.ml`, `.ga`, `.cf`) | Meta turant reject. Freenom waise bhi band ho chuka hai. |

### 🔎 Renewal price hamesha check karo
Bahut se registrar pehle saal ₹99 me `.com` dete hain aur renewal ₹2,500 lete hain. **Hamesha renewal rate dekho.**

---

## 🛒 KAHA SE KHARIDO (Registrar)

| Registrar | Kaisa hai | Kiske liye |
|---|---|---|
| **Cloudflare Registrar** ⭐ | **At-cost pricing** — koi markup nahi, renewal bhi same price. Free WHOIS privacy. `.com` ~$10.44/yr (~₹880) | Best long-term. DNS bhi Cloudflare pe hi ho to sabse clean. |
| **Porkbun** | Bahut sasta, free WHOIS privacy, clean UI | Cloudflare ke baad best option |
| **Namecheap** | Reliable, achhi support, thoda markup | Safe default |
| **Hostinger / BigRock / GoDaddy India** | INR billing, India GST invoice mil jaata hai | Agar aapko **GST invoice** chahiye business expense ke liye |

> **Meri salah:** Cloudflare pe DNS + Cloudflare Registrar se domain. 10 clients ke liye ye sabse sasta padega aur renewal me koi jhatka nahi lagega. GST invoice zaroori hai to BigRock/Hostinger lo.

---

## ☁️ DNS: Cloudflare free plan

Saare domains ka DNS Cloudflare pe rakho:
- Free wildcard SSL, free DDoS protection, fast DNS
- Ek hi dashboard se saare clients ke domains manage

### ⚠️ Cloudflare proxy (orange cloud) pe 2 dhyan dene wali baatein:

1. **SSE stream:** Cloudflare free plan pe **100 second** ka HTTP timeout hota hai. Dashboard ka realtime feed har 100s pe disconnect hoga aur `EventSource` khud reconnect kar lega — kaam chalta rahega, bas ek chhota gap aayega. Agar bilkul smooth chahiye to admin hostname ko **DNS-only (grey cloud)** pe rakho.

2. **SSL mode:** Cloudflare dashboard me SSL/TLS mode **"Full (strict)"** hi rakho. "Flexible" pe redirect loop aayega kyunki Nginx HTTPS pe force-redirect karta hai.

3. **Client IP:** Cloudflare proxy on hone par bhi `X-Forwarded-For` sahi aata hai, aur app ka `getClientIp()` usi ko padhta hai — isliye Meta CAPI me IP matching sahi rahegi. Ye important hai, warna CAPI event match nahi honge.

---

## 📐 ARCHITECTURE — ek VPS, N clients

```
                        Internet
                            │
                    ┌───────▼────────┐
                    │  Cloudflare    │   DNS + proxy (optional)
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │     Nginx      │   :80 / :443  (SSL yahan terminate hota hai)
                    │  vhost router  │
                    └───┬────┬───┬───┘
        Host header se  │    │   │
        route karta hai │    │   │
        ┌───────────────┘    │   └───────────────┐
        │                    │                   │
┌───────▼───────┐   ┌────────▼──────┐   ┌────────▼──────┐
│ zfc-ree       │   │ zfc-jatin     │   │ zfc-asla      │
│ :3001         │   │ :3002         │   │ :3003         │
│               │   │               │   │               │
│ data.json     │   │ data.json     │   │ data.json     │
│ bot token A   │   │ bot token B   │   │ bot token C   │
│ pixel A       │   │ pixel B       │   │ pixel C       │
└───────────────┘   └───────────────┘   └───────────────┘
  sureshotree.com     jatintrading.in      aslabhai.com

/opt/zfc-clients/
├── clients.json          ← registry (kaun sa client, kaun sa port)
├── ree/                  ← pura app clone, apna data.json
├── jatin/
└── backups/              ← add-client.sh backup yahan likhta hai
```

**Har box 100% isolated hai.** Node port sirf `127.0.0.1` pe bind hota hai — bahar se koi direct `:3001` hit nahi kar sakta, sirf Nginx ke through.

---

## 🖥️ VPS SIZING — kitne clients kitne RAM me

Har Node instance idle pe **~60–90 MB** RAM leta hai.

| VPS | RAM | Kitne clients | Approx cost |
|---|---|---|---|
| Small | 1 GB | **5–8 clients** | ₹400–600/mo |
| Medium ⭐ | 2 GB | **12–20 clients** | ₹700–1,200/mo |
| Large | 4 GB | **30–45 clients** | ₹1,500–2,500/mo |
| XL | 8 GB | **60+ clients** | ₹3,000–5,000/mo |

> **2 GB RAM wala VPS best starting point hai** — 15 clients tak aaram se, aur ₹800/mo ke aas-paas. Jab 12+ clients ho jaayein tab 4 GB pe upgrade kar lo (VPS resize downtime ke bina ho jaata hai).

**CPU:** 1 vCPU chalta hai, lekin 2 vCPU lo to better — Meta CAPI + Telegram API calls ke waqt spike aata hai.

**Providers:** Hostinger VPS (India, INR billing), DigitalOcean, Vultr, AWS Lightsail, Contabo (sabse sasta).

---

## 🚀 EK-EK CLIENT KAISE ADD KARE

### Step 1 — Pehli baar VPS ready karo (ek hi baar)

```bash
ssh root@YOUR_VPS_IP
apt update && apt install -y git curl
git clone https://github.com/avinashraz19818/landingpages.git /opt/app
cd /opt/app
bash deploy/setup-vps.sh zfcpanel.com        # aapka OPS domain
```

Ye Node 22, PM2, Nginx, firewall aur SSL install kar dega.

### Step 2 — Naya client add karo (har client ke liye)

**Pehle:** client ka domain kharido aur uska **A record VPS IP pe point karo**. DNS propagate hone do (5 min – 2 ghante).

Phir:

```bash
cd /opt/app

bash deploy/add-client.sh add ree sureshotree.com --label "Sureshot By Ree"
```

Script khud ye sab karega (~2-3 minute):
1. `/opt/zfc-clients/ree/` me app clone
2. Port auto-assign (3001, phir 3002, 3003...)
3. **Iska apna `data.json`** banayega, `publicUrl` = `https://sureshotree.com` pre-filled
4. PM2 process `zfc-ree` start + boot pe autostart
5. Nginx vhost likhega (SSE + webhook + rate-limit tuned)
6. **Let's Encrypt SSL** issue karega
7. Registry me entry add karega

Output me aapko us client ka admin URL aur webhook URL mil jaayega.

### Step 3 — Us client ki settings bharo

`https://sureshotree.com/admin` kholo:

1. 🔴 **Sabse pehle password badlo** (default `admin` hai)
2. **Is client ka** Telegram bot token daalo (har client ka **apna alag bot** — `@BotFather` se naya banao)
3. **Is client ka** channel ID → *Test Bot & Channel*
4. Public URL = `https://sureshotree.com` → **Set Webhook**
5. **Is client ka** Meta Pixel ID + CAPI token → *Send Test Event*
6. Landing page designer se us client ka theme/title/members count set karo

### Step 4 — Client ke Meta Business Manager me domain verify karwao

Ye **client ke** Business Manager me hona chahiye, aapke me nahi:
> Business Settings → Brand Safety → Domains → Add `sureshotree.com` → DNS record verify

Iske bina iOS 14+ users ke events prioritize nahi honge aur CAPI attribution weak rahegi.

### Aur clients — same command, bas slug/domain badlo:

```bash
bash deploy/add-client.sh add jatin jatintrading.in  --label "Jatin K Trading"
bash deploy/add-client.sh add asla  aslabhai.com     --label "Asla Bhai"
bash deploy/add-client.sh add lal   thelalbhai.in    --label "The Lal Bhai"
```

---

## 🔧 DAILY OPERATIONS

```bash
cd /opt/app

# Saare clients ka status ek nazar me
bash deploy/add-client.sh list
# SLUG           DOMAIN                       PORT    SSL       PM2
# ----------------------------------------------------------------------
# ree            sureshotree.com              3001    yes       online
# jatin          jatintrading.in              3002    yes       online
# asla           aslabhai.com                 3003    NO        online

# Code update — SAB clients pe ek saath
bash deploy/add-client.sh update --all

# Sirf ek client update
bash deploy/add-client.sh update ree

# Kisi client ke logs
bash deploy/add-client.sh logs jatin

# Saare clients ka data backup (data.json + uploads)
bash deploy/add-client.sh backup --all

# Client hatao (pehle backup leta hai)
bash deploy/add-client.sh remove asla
```

### 🔁 Backup cron zaroor lagao
Har client ka `data.json` = uska pura lead database + uske tokens.

```bash
crontab -e
# Roz raat 3:30 sab clients ka backup:
30 3 * * * cd /opt/app && bash deploy/add-client.sh backup --all >> /var/log/zfc-backup.log 2>&1
```

Backups `/opt/zfc-clients/backups/<date>/` me jaate hain. Inhe **VPS ke bahar bhi** copy karo (Google Drive / rclone / scp) — VPS gaya to backups bhi gaye.

### PM2 commands (direct)
```bash
pm2 list                    # saare processes
pm2 monit                   # live CPU/RAM monitor
pm2 logs                    # saare logs ek saath
pm2 restart zfc-ree         # ek client restart
pm2 reload --all            # sab zero-downtime reload
```

---

## 🔐 MULTI-CLIENT SECURITY — ye zaroor karo

Jab ek hi VPS pe 10 clients hote hain, to ek instance compromise hone ka matlab **saare clients ka data** khatre me. Isliye:

### 1. Har client ka admin password ALAG rakho
Default `admin` bilkul mat chhodna. Har client ke liye strong alag password. (Code me ab scrypt hashing + brute-force lockout hai, lekin weak password weak hi rahega.)

### 2. Admin panel ko IP-restrict karo (strongly recommended)
Public landing page khula rahe, lekin `/admin` sirf aapke IP se khule. Nginx vhost me:

```nginx
location /admin {
    allow YOUR_HOME_IP;
    allow YOUR_OFFICE_IP;
    deny all;
    proxy_pass http://zfc_ree;
    proxy_set_header Host $host;
}
```

Isse brute-force attack ka raasta hi band ho jaata hai.

### 3. Har client ka webhook secret alag hota hai ✅
Ye already automatic hai — har instance apna `telegramWebhookSecret` khud generate karta hai. Koi ek client ka secret leak hua to baaki safe.

### 4. Firewall me sirf 22/80/443 khule hain ✅
Node ports (3001, 3002...) `127.0.0.1` pe hain — internet se directly reachable nahi. `setup-vps.sh` UFW laga deta hai.

### 5. Root SSH band karo, key-based login lagao
```bash
# /etc/ssh/sshd_config
PermitRootLogin prohibit-password
PasswordAuthentication no
```

### 6. Client ke tokens client ke instance me hi rahenge ✅
`data.json` ab gitignored hai — galti se `git push` karne se tokens leak nahi honge. Ye multi-client setup ke liye critical tha.

---

## 💰 TOTAL COST — 10 clients ka example

| Cheez | Cost |
|---|---|
| VPS 2 GB RAM (Hostinger/Contabo) | ₹800–1,200/mo |
| Ops domain `.com` (Cloudflare at-cost) | ₹880/yr |
| 10 × client domains `.com` | ₹8,800/yr — **client se vasool karo** |
| SSL certificates | ₹0 (Let's Encrypt) |
| Cloudflare DNS | ₹0 |
| **Aapka actual kharcha** | **~₹10,000/yr + ₹1,000/mo** |

10 clients se agar ₹3,000–5,000/mo bhi le rahe ho, to infrastructure cost **1% se kam** hai.

---

## ❓ Alternatives — kya multi-tenant refactor karwayein?

Ek instance me hi saare clients chalane ke liye code badalna padega: `data.json` ko tenants me split karna, hostname se tenant resolve karna, har tenant ka alag bot/pixel.

**Main iski salah NAHI dunga, kyu:**

1. **Telegram bot limit phir bhi laagu rahegi** — har client ka apna bot to chahiye hi. Refactor se ye problem solve nahi hoti.
2. **Blast radius** — abhi ek client ka crash sirf us client ko maar ta hai. Multi-tenant me ek bug = **saare clients ke ads band**. Jab aapke clients ka real ad spend chal raha ho, ye risk nahi lena chahiye.
3. **Shared `data.json` = concurrent write corruption.** Abhi bhi app har event pe pura file rewrite karta hai (`fs.writeFileSync`). 10 clients ek file pe likhenge to data corrupt hoga. Pehle SQLite/Postgres me migrate karna padega.
4. **Isolation hi selling point hai** — client ko aap confidently bol sakte ho "aapka data alag server process me hai".

**Refactor tabhi karo jab 40+ clients ho jaayein** aur VPS cost manage karna mushkil ho. Tab tak `add-client.sh` wala model better hai. Us point pe pehle DB ko Postgres me migrate karna, phir multi-tenancy add karna.

---

## ✅ CHECKLIST — naya client onboard karte waqt

```
□ Client ka domain kharida (.com ya .in — sasta TLD NAHI)
□ DNS A record → VPS IP, propagate ho gaya
□ bash deploy/add-client.sh add <slug> <domain> --label "<Name>"
□ https://<domain>/admin khula, SSL green 🔒
□ Admin password badla (default 'admin' nahi chhoda)
□ Naya Telegram bot banaya @BotFather se (purana bot REUSE nahi karna)
□ Bot ko client ke channel ka ADMIN banaya
     → Invite Users via Links ✅  Manage Chat ✅
□ Bot token + channel ID daala → "Test Bot & Channel" green
□ Public URL = https://<domain> → "Set Webhook" dabaya
□ curl getWebhookInfo se confirm kiya webhook set hai
□ Meta Pixel ID + CAPI token daala → "Send Test Event" → Events Manager me dikha
□ Client ke Meta Business Manager me domain VERIFY karwaya
□ Landing page designer se client ka theme/title/members set kiya
□ "1-Click Lead Simulator" se pura funnel test kiya
□ Real Telegram phone se join karke end-to-end test kiya
□ backup cron me ye client aa raha hai (list karke check)
```

---

**Short me:** har client ke liye **alag `.com` ya `.in` domain** lo (saste `.xyz`/`.top` TLD bilkul nahi), Cloudflare Registrar + Cloudflare DNS use karo, aur ek **2 GB VPS** pe `add-client.sh` se ek-ek client add karte jao. 15 clients tak ek hi VPS chalega.
