# 🌐 Deployment Guide — cPanel vs VPS

**Short answer: VPS pe deploy karo. cPanel is app ke liye sahi nahi hai.**

Neeche pura reason + step-by-step setup diya hai.

---

## 1. Ye app actually hai kya?

Ye sirf ek static website nahi hai. Ye ek **long-running Node.js (Express 5) server** hai:

| Feature | File | Deployment pe asar |
|---|---|---|
| Express server, port `3000` | `server.js` | Ek process 24×7 chalna chahiye |
| Telegram webhook receiver | `POST /api/telegram-webhook` | **HTTPS zaroori** + public IP + process hamesha zinda |
| Realtime dashboard (SSE) | `GET /api/admin/events-stream` | Long-lived open connection — proxy buffering off chahiye |
| File-based JSON database | `db.js` → `data.json` | Disk pe **write** permission chahiye |
| Avatar image upload (multer) | `public/uploads/` | Disk pe write + persistence |
| Outbound API calls | `services/telegram.js`, `services/metaCapi.js` | `api.telegram.org` + `graph.facebook.com` pe **outbound network open** chahiye |

Matlab: sirf files upload karna kaafi nahi — ek **daemon process** chahiye jo band na ho.

---

## 2. cPanel kyu NAHI ❌

cPanel shared hosting par Node.js apps "Setup Node.js App" (CloudLinux + **Passenger**) se chalti hain. Is app ke liye Passenger me ye problems aayengi:

1. **Process on-demand start/stop hota hai.** Passenger idle hone par app ko kill kar deta hai aur sirf request aane par wake karta hai.
   - → **Telegram webhook fail hoga / late hoga.** Jab Telegram `chat_join_request` bhejta hai, tab tak app soti hui hoti hai — cold start me 2-8 second lagte hain. Telegram webhook ka timeout chhota hota hai, aur aapka **Meta CAPI Lead event fire hi nahi hoga**. Pura "0-Fake-Click" system isi pe depend karta hai.
   - → **SSE realtime feed tootega.** Dashboard ka live stream har idle cycle pe disconnect ho jayega.
2. **Port control nahi milta.** Passenger apna khud ka socket/port inject karta hai; aap Nginx config, custom headers, ya timeouts set nahi kar sakte.
3. **`data.json` + `uploads/` risk.** Shared hosting par app directory aksar read-only ya deploy pe reset ho jaati hai. Aapka pura lead history (events/sessions) **ud sakta hai**.
4. **Outbound network restrictions.** Bahut se shared hosts `api.telegram.org` / `graph.facebook.com` pe outbound calls block ya throttle karte hain.
5. **No PM2 / systemd / cron control.** Crash hone par auto-restart, log rotation, zero-downtime reload — kuch nahi milega.
6. **Node version limit.** CloudLinux par jo versions available hain unhi me phas jaoge (Express 5 ko Node ≥ 18 chahiye).

> **cPanel kab chalega?** Sirf tab jab aap is app ko pura static bana do — yaani Node server hata ke sirf HTML/CSS/JS upload karo. Lekin phir Telegram webhook, Meta CAPI, admin dashboard, analytics — **sab khatam**. Is app ka 90% value server-side hai, isliye cPanel = feature loss.

---

## 3. VPS kyu HAAN ✅

| Zaroorat | VPS deta hai |
|---|---|
| 24×7 chalne wala process | **PM2** / systemd daemon — kabhi band nahi hota |
| HTTPS webhook | **Nginx + Let's Encrypt** free SSL |
| SSE long connections | Nginx `proxy_buffering off` — aap khud control karte ho |
| Disk writes (`data.json`, uploads) | Pura filesystem aapka, koi quota/reset nahi |
| Outbound API calls | Koi restriction nahi |
| Crash recovery | `pm2 resurrect` + auto-restart + boot pe start |
| Logs & debugging | `pm2 logs`, full SSH access |

### Minimum specs
- **1 vCPU / 1 GB RAM** — is app ke liye kaafi hai (Node + Nginx ≈ 150-250 MB)
- **Ubuntu 22.04 LTS ya 24.04 LTS**
- Storage: 10-20 GB SSD
- Cost: ₹400-800/month (Hostinger / DigitalOcean / Vultr / AWS Lightsail)

---

## 4. VPS Setup — Step by Step

Repo me ready-made files hain `deploy/` folder me:
- `deploy/setup-vps.sh` — ek hi command me pura server ready
- `deploy/ecosystem.config.js` — PM2 config
- `deploy/nginx.conf` — Nginx reverse proxy (SSE + uploads ke saath)

### Step 0 — DNS
Apne domain ka **A record** VPS ke public IP pe point karo:
```
A   yourdomain.com       →  123.45.67.89
A   www.yourdomain.com   →  123.45.67.89
```
Propagate hone me 5 min – 2 ghante lag sakte hain.

### Step 1 — SSH karo
```bash
ssh root@123.45.67.89
```

### Step 2 — One-shot setup script
```bash
apt update && apt install -y git curl
cd /opt
git clone https://github.com/avinashraz19818/landingpages.git app
cd app
bash deploy/setup-vps.sh yourdomain.com
```

Script ye sab khud karega:
1. Node.js 22 LTS install (NodeSource)
2. `npm install --production`
3. PM2 install + app start + boot pe autostart
4. Nginx install + reverse proxy config (SSE tuned)
5. UFW firewall (sirf 22, 80, 443 open)
6. Let's Encrypt SSL certificate (certbot)

### Step 3 — Verify
```bash
pm2 status
curl -I https://yourdomain.com
curl -I https://yourdomain.com/admin
pm2 logs zero-fake-click --lines 50
```

### Step 4 — App ke andar settings bharo
Browser me `https://yourdomain.com/admin` kholo:

1. **Bot & Meta CAPI Setup** tab →
   - Telegram Bot Token (`@BotFather` se mila hua)
   - Channel ID (`@channelname` ya `-100xxxxxxxxxx`)
   - **"Test Bot & Channel"** dabao → green aana chahiye
2. **Public URL** me `https://yourdomain.com` daalo (ye Meta CAPI ke `event_source_url` me jaata hai — galat rakhoge to Meta attribution match nahi hoga)
3. **"Set Webhook"** dabao → webhook `https://yourdomain.com/api/telegram-webhook` pe set ho jayega
4. **Meta Pixel** tab → Pixel ID + CAPI access token + test event code (`TEST12345`)
5. **"Send Test Event to Meta"** → Meta Events Manager ke *Test Events* me event dikhna chahiye
6. **Simulator** tab → "Simulate 1 Real Lead & CAPI Hit" se pura funnel check karo

> ⚠️ **Bot ko channel ka Admin banana zaroori hai**, permissions ke saath:
> *Invite Users via Links* ✅ + *Manage Chat* ✅

### Step 5 — Webhook confirm karo
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```
`"url": "https://yourdomain.com/api/telegram-webhook"` aur `"pending_update_count": 0` dikhna chahiye.

---

## 5. Daily commands (cheat sheet)

```bash
pm2 status                      # app chal rahi hai ya nahi
pm2 logs zero-fake-click        # live logs
pm2 restart zero-fake-click     # restart
pm2 reload zero-fake-click      # zero-downtime reload

# Code update karna ho:
cd /opt/app && git pull && npm install --production && pm2 reload zero-fake-click

# SSL renew (certbot khud cron se karta hai, manual check):
certbot renew --dry-run

# Backup:
cp /opt/app/data.json /root/backup-data-$(date +%F).json
tar czf /root/uploads-$(date +%F).tar.gz /opt/app/public/uploads
```

### 🔁 Backup zaroori hai
`data.json` = aapka pura lead database. Iska **daily cron backup** lagao:
```bash
crontab -e
# ye line add karo (roz raat 3:30):
30 3 * * * cp /opt/app/data.json /root/backups/data-$(date +\%F).json
```

---

## 6. ⚠️ Deploy se PEHLE 3 cheezein fix karo

Maine repo test karte waqt ye issues paaye. **Public internet pe jaane se pehle inhe theek karna zaroori hai**, warna real nuksaan ho sakta hai:

### 🔴 Issue 1 — Admin API par koi authentication nahi hai (CRITICAL)
`db.js` me `adminPassword: 'admin'` define hai, lekin `server.js` me **kahin use nahi hota**. Maine live test karke confirm kiya:

```bash
curl https://yourdomain.com/api/admin/settings
# → pura settings JSON, jisme telegramBotToken aur metaCapiToken PLAINTEXT me hain
```

Matlab internet pe **koi bhi insaan** aapka:
- Telegram bot token chura sakta hai (→ aapka channel takeover)
- Meta CAPI access token chura sakta hai (→ aapke pixel pe fake events bhej sakta hai, ad account ban risk)
- `/api/admin/clear-data` se **pura lead history delete** kar sakta hai
- `/api/admin/settings` se landing page content badal sakta hai

**Fix chahiye:** `/api/admin/*` routes pe password/session middleware + settings response se secret fields mask karna. *(Bolo to main implement kar deta hoon.)*

### 🟠 Issue 2 — `data.json` git me tracked hai
Live data (events, sessions, bot tokens) `data.json` me save hota hai, aur ye file **git me commit hai**. Isse:
- `git pull` karne par live data overwrite/conflict ho sakta hai
- Galti se `git push` kar diya to **bot token public GitHub pe leak** ho jayega

**Fix:** `data.json` ko `.gitignore` me daalo, aur ek clean `data.json.example` commit karo.

### 🟡 Issue 3 — Telegram webhook par koi secret verification nahi
`/api/telegram-webhook` har POST accept kar leta hai. Koi bhi fake `chat_join_request` bhej kar aapke Meta pixel pe **jhoothe Lead events** fire karwa sakta hai — jo is app ka pura maqsad hi kharab kar deta hai.

**Fix:** Telegram ke `setWebhook` me `secret_token` set karo, aur incoming request ka `X-Telegram-Bot-Api-Secret-Token` header verify karo. *(Ye bhi main kar sakta hoon.)*

---

## 7. Alternatives (agar VPS manage nahi karna)

Agar aapko server administration nahi karni, to ye PaaS options bhi chalenge — **cPanel se behtar**:

| Platform | Kaisa hai | Dhyan do |
|---|---|---|
| **Render** | Free tier available, auto HTTPS, easy | Free tier pe idle hoke so jaata hai → webhook late. Paid ($7/mo) lo |
| **Railway** | Bahut easy, always-on | ~$5/mo se shuru |
| **Fly.io** | Fast, global | Thoda CLI seekhna padega |
| **Vercel / Netlify** | ❌ **Nahi chalega** | Serverless hai — SSE stream + persistent `data.json` writes support nahi hote |

Lekin in sabme bhi **file-based `data.json` problem** rahegi (ephemeral filesystem → redeploy pe data gaya). Isliye **VPS + disk hi sabse reliable** hai. Agar PaaS chunna ho to pehle DB ko SQLite/Postgres me migrate karna padega.

---

## ✅ Final Recommendation

**VPS (Ubuntu 22.04/24.04, 1 GB RAM) + PM2 + Nginx + Let's Encrypt SSL.**

cPanel ko sirf tab use karo jab aapke paas **koi dusra static website** project ho — is Node app ke liye nahi.

Aur haan — **live karne se pehle upar ke 3 security fixes zaroor karwao**, khaas kar Issue 1. Warna aapke Telegram bot aur Meta ad account dono khatre me pad jayenge.
