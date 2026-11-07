# ☁️ Apna Domain Cloudflare Se Connect Karna — Complete Guide

Aapke paas ek domain already hai. Ye guide use Cloudflare se connect karti hai aur
phir is app ke saath live karti hai.

**Time:** ~20 minute kaam, phir nameserver propagate hone me 15 min – 24 ghante
(zyadatar 1 ghante ke andar ho jaata hai).

**Cost:** ₹0 — Cloudflare ka Free plan hi kaafi hai.

---

## 📋 Pehle ye 3 cheezein haath me rakho

| Cheez | Kaha se milega |
|---|---|
| 1. Domain ka registrar login | Jaha se domain kharida (GoDaddy / Hostinger / BigRock / Namecheap) |
| 2. VPS ka public IP | VPS provider ke dashboard me (jaise `123.45.67.89`) |
| 3. Ek email address | Cloudflare account + Let's Encrypt renewal alerts ke liye |

> ⚠️ **VPS ka IP pehle milna zaroori hai.** DNS record me wahi IP daalna hai. Agar
> VPS abhi nahi liya, to pehle VPS lo (2 GB RAM, Ubuntu 24.04) — `DEPLOYMENT.md` section 3 dekho.

---

# PART 1 — Domain ko Cloudflare me add karna

### Step 1.1 — Cloudflare account banao
1. https://dash.cloudflare.com/sign-up pe jao
2. Email + password se free account banao
3. Email verify karo

### Step 1.2 — Domain add karo
1. Dashboard me **"Add a domain"** (ya `+ Add` button) pe click karo
2. Apna domain likho — **sirf root domain, `www` ke bina**:
   ```
   ✅ yourdomain.com
   ❌ www.yourdomain.com
   ❌ https://yourdomain.com
   ```
3. **Continue** dabao

### Step 1.3 — FREE plan select karo
Plan page pe **sabse neeche scroll karo** — Cloudflare free plan ko chhupa ke rakhta hai.

```
Free  →  $0/month  →  [Continue]
```

> Pro/Business plan ki zaroorat NAHI hai. Free plan me hi DNS + wildcard SSL + sab mil jaata hai.

### Step 1.4 — Existing DNS records review karo
Cloudflare aapke domain ke purane DNS records scan karke dikhayega.

- Agar domain **naya/khaali** hai → koi record nahi dikhega, seedha Continue
- Agar domain pe **pehle se website/email** chal raha hai → **kuch bhi delete mat karo**, sab rehne do

**Continue** dabao.

### Step 1.5 — Cloudflare ke 2 NAMESERVERS note karo ⭐

Ye sabse important step hai. Cloudflare aapko 2 nameserver dega, jaise:

```
anna.ns.cloudflare.com
bob.ns.cloudflare.com
```

**Inhe copy karke kahin likh lo.** (Har account ke liye alag hote hain — ye sirf example hai.)

Cloudflare ab bolega: *"Ab apne registrar pe jaakar nameserver badlo."*

---

# PART 2 — Registrar pe Nameserver badalna

Ab apne domain registrar ke panel me jaao aur **purane nameserver hata kar Cloudflare wale daalo**.

> 🔴 **Ye step skip kiya to kuch bhi kaam nahi karega.** Cloudflare tab tak "Pending" pe atka rahega.

### GoDaddy
```
My Products → apne domain ke saamne "DNS" → Nameservers → "Change Nameservers"
→ "I'll use my own nameservers" select karo
→ Cloudflare ke 2 nameserver daalo → Save
```
GoDaddy warning dega — ignore karo, ye normal hai.

### Hostinger
```
hPanel → Domains → apna domain → Manage → left me "Nameservers"
→ "Change nameservers" select karo
→ Cloudflare ke 2 nameserver daalo → Save
```

### BigRock
```
My Account → Domain Management → apna domain → Name Server Management
→ Cloudflare ke 2 nameserver daalo → Save Changes
```

### Namecheap
```
Domain List → apne domain ke saamne "Manage" → "Nameservers" section
→ dropdown se "Custom DNS" select karo
→ Cloudflare ke 2 nameserver daalo → green tick (Save) dabao
```

### Koi dusra registrar ho to
Domain ke **DNS / Nameserver settings** dhundo, "Custom" ya "External nameservers"
select karo, aur Cloudflare ke 2 nameserver daalo.

---

### ✅ Nameserver verify karna

Terminal/komputer pe ye command chalao:

```bash
dig +short NS yourdomain.com
```

Ya browser me: https://dnschecker.org/#NS/yourdomain.com

**Jab Cloudflare active ho jayega, output aisa dikhega:**
```
anna.ns.cloudflare.com
bob.ns.cloudflare.com
```

Purane registrar ke nameserver (jaise `ns1.godaddy.com`) dikh rahe hain to abhi
propagate nahi hua — 15-30 minute ruk ke dobara check karo.

Cloudflare aapko **email bhi bhejega** jab domain "Active" ho jaayega.
Dashboard me status `Pending` se `Active` ho jaayega.

---

# PART 3 — DNS Records add karna (VPS pe point karna)

Cloudflare active hone ke baad: **Dashboard → apna domain → DNS → Records**

### Single client ke liye (2 records)

| Type | Name | Content | Proxy status |
|---|---|---|---|
| `A` | `@` | `YOUR_VPS_IP` | **DNS only** (grey cloud) |
| `A` | `www` | `YOUR_VPS_IP` | **DNS only** (grey cloud) |

### Multiple clients ke liye — ek hi domain pe subdomains ⭐

Aapke paas ek domain hai, isliye har client ko ek **subdomain** do:

| Type | Name | Content | Proxy status | Kaam |
|---|---|---|---|---|
| `A` | `panel` | `YOUR_VPS_IP` | DNS only (grey) | **Aapka** master admin panel |
| `A` | `ree` | `YOUR_VPS_IP` | DNS only (grey) | Client 1 ki landing page |
| `A` | `jatin` | `YOUR_VPS_IP` | DNS only (grey) | Client 2 ki landing page |
| `A` | `asla` | `YOUR_VPS_IP` | DNS only (grey) | Client 3 ki landing page |
| `A` | `www` | `YOUR_VPS_IP` | DNS only (grey) | Main site (optional) |

Isse URLs banenge:
```
https://ree.yourdomain.com      ← client 1 ka landing page (Meta ads me yahi jaayega)
https://ree.yourdomain.com/admin ← client 1 ka dashboard
https://panel.yourdomain.com    ← aapka khud ka panel
```

**Naya client add karna ho to bas ek `A` record add karo** — 2 minute ka kaam.

### 🩶 Grey cloud vs 🧡 Orange cloud — is app ke liye kya sahi?

Cloudflare me har record ke saamne ek cloud icon hota hai:

| | Kya karta hai | Is app ke liye |
|---|---|---|
| 🩶 **DNS only** (grey) | Sirf DNS resolve karta hai. Traffic seedha VPS pe jaata hai. | ✅ **Ye use karo.** Sab kuch perfectly kaam karta hai. |
| 🧡 **Proxied** (orange) | Traffic Cloudflare ke servers se ghuma ke laata hai (DDoS protection, IP chhupana) | ⚠️ Chalta hai, lekin neeche ki 2 dikkat aayengi |

**Orange cloud ke saath 2 problem:**

1. **Realtime dashboard ka SSE stream har 100 second pe disconnect hoga.**
   Cloudflare Free plan pe HTTP request ka **100 second** timeout hota hai.
   Dashboard ka live counter feed ek lambi open connection hai, isliye wo har
   100s pe katega aur dobara jud jaayega. Kaam chalta rahega, bas live feed me
   chhota gap aayega.

2. **SSL setup thoda uljha hua ho jaata hai** (Part 5 dekho).

**Meri salah:** shuru me **sab records grey (DNS only)** rakho. Meta ads ke traffic
pe DDoS ka koi khaas khatra nahi hota, aur grey cloud se sab kuch simple rehta hai.
Baad me zaroorat pade to sirf landing page subdomains ko orange kar lena —
`panel` wala hamesha grey rehne dena.

---

# PART 4 — Cloudflare ke 2 settings check karo

### 4.1 — SSL/TLS mode
Dashboard → **SSL/TLS → Overview**

```
✅ Full (strict)     ← YE select karo
❌ Flexible          ← redirect LOOP aayega
❌ Full              ← chalta hai par kam secure
❌ Off               ← HTTPS hi nahi chalega
```

> **Flexible kyu nahi?** Nginx HTTP → HTTPS pe force-redirect karta hai. Flexible mode
> me Cloudflare origin se HTTP pe baat karta hai → Nginx redirect karta hai → Cloudflare
> phir HTTP pe aata hai → **infinite redirect loop**. Browser pe `ERR_TOO_MANY_REDIRECTS`.

### 4.2 — "Always Use HTTPS"
Dashboard → **SSL/TLS → Edge Certificates → Always Use HTTPS**

- **ON** kar do (achha hai — `http://` khud `https://` pe chala jaayega)
- Lekin **pehle Part 5 (SSL certificate) complete karo**, warna site khulegi hi nahi

---

# PART 5 — SSL Certificate (HTTPS) lagana

Do tareeqe hain. **Multiple clients ke liye Option B (wildcard) best hai.**

## Option A — Simple (certbot, HTTP challenge)

Har subdomain ke liye alag certificate. `add-client.sh` ye **khud** kar deta hai —
aapko kuch nahi karna:

```bash
cd /opt/app
bash deploy/add-client.sh add ree ree.yourdomain.com --label "Sureshot By Ree"
# → script apne aap Let's Encrypt SSL issue kar dega
```

Bas DNS record pehle add kar chuke ho (Part 3), tabhi ye chalega.

## Option B — ⭐ WILDCARD certificate (ek cert = saare subdomains)

**Ye aapke liye best hai** kyunki aapke paas ek hi domain hai aur clients badhte
jaayenge. Ek certificate me `yourdomain.com` aur `*.yourdomain.com` **dono** cover
ho jaate hain — matlab jitne chaaho subdomain banao, SSL ke liye kuch nahi karna.

Ye Cloudflare ke **DNS API** se banta hai (HTTP challenge se wildcard nahi milta).

### Step 5B.1 — Cloudflare API Token banao

1. Cloudflare dashboard → top-right **profile icon** → **My Profile**
2. Left menu → **API Tokens**
3. **"Create Token"** → neeche scroll → **"Get started"** (Custom token)
4. Ye settings bharo:

| Field | Value |
|---|---|
| Token name | `certbot-dns-yourdomain` |
| Permissions → 1 | **Zone** → **DNS** → **Edit** |
| Zone Resources | **Include** → **Specific zone** → `yourdomain.com` |
| Client IP Address Filtering | **khaali chhod do** (VPS ka IP nahi pata hoga abhi) |

5. **Continue to summary** → **Create Token**
6. 🔴 **Token turant copy karke safe rakho** — ye sirf EK BAAR dikhta hai!
   ```
   jaise: v1.0-abc123def456...  (lamba string)
   ```

### Step 5B.2 — Wildcard cert script chalao

VPS pe SSH karo aur:

```bash
cd /opt/app
bash deploy/wildcard-cert.sh yourdomain.com aapka@email.com
```

Script ye karega:
1. `certbot` + `python3-certbot-dns-cloudflare` install
2. Aapse API token maangega (secure file me save karega, permission `600`)
3. `yourdomain.com` + `*.yourdomain.com` ke liye wildcard cert issue karega
4. Auto-renewal setup karega (renewal bhi DNS API se hoga — koi dikkat nahi)

### Step 5B.3 — Clients add karo

Ab jab bhi naya client add karo, **SSL already covered hai**:

```bash
bash deploy/add-client.sh add ree   ree.yourdomain.com   --label "Client 1" --wildcard
bash deploy/add-client.sh add jatin jatin.yourdomain.com --label "Client 2" --wildcard
```

`--wildcard` flag se script naya cert maangne ki koshish nahi karega, balki pehle se
bane wildcard cert ko use karega. Naya client = **sirf 2 minute**, koi SSL wait nahi.

---

# PART 6 — Verify karo ki sab chal raha hai

### 6.1 — DNS sahi hai?
```bash
dig +short ree.yourdomain.com
# → aapka VPS IP aana chahiye
```

### 6.2 — HTTPS chal raha hai?
Browser me `https://ree.yourdomain.com` kholo → 🔒 lock icon dikhna chahiye.

Ya command se:
```bash
curl -I https://ree.yourdomain.com
# → HTTP/2 200  aana chahiye
```

### 6.3 — Certificate sahi hai?
```bash
echo | openssl s_client -servername ree.yourdomain.com -connect ree.yourdomain.com:443 2>/dev/null \
  | openssl x509 -noout -subject -dates -ext subjectAltName
```
Wildcard cert me `DNS:*.yourdomain.com` dikhna chahiye.

### 6.4 — Cloudflare status
Dashboard → Overview → **Active** dikhna chahiye (Pending nahi).

---

# 🧯 Troubleshooting

### "Cloudflare Pending pe atka hai"
→ **Part 2 nahi kiya.** Registrar pe nameserver badle nahi. `dig +short NS yourdomain.com`
chalao — Cloudflare ke nameserver aane chahiye. Purane aa rahe hain to 30 min – 24 ghante ruko.

### "ERR_TOO_MANY_REDIRECTS" (redirect loop)
→ SSL/TLS mode **"Flexible"** pe hai. **"Full (strict)"** karo. (Part 4.1)

### "522 Connection Timed Out" / "521 Web Server Is Down"
→ Cloudflare orange (proxied) hai lekin VPS pe Nginx/app nahi chal raha.
```bash
ssh root@VPS_IP
systemctl status nginx        # nginx chal raha hai?
pm2 list                      # app online hai?
ufw status                    # port 80 aur 443 open hain?
```

### "SSL certificate error" / browser 🔒 nahi dikha raha
→ Cert issue nahi hua. Check karo:
```bash
sudo certbot certificates                    # kya cert bana hai?
ls /etc/letsencrypt/live/                    # folder hai?
```
DNS record sahi point ho raha hai ya nahi — `dig +short ree.yourdomain.com`.

### Webhook kaam nahi kar raha (joins count nahi ho rahe)
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```
- `"url"` sahi hona chahiye
- `"last_error_message"` me kuch hai to wahi problem hai
- Yaad rakho: **security fix ke baad "Set Webhook" dobara dabana zaroori hai**

### certbot HTTP challenge fail ho raha hai (orange cloud ke saath)
→ Record ko temporarily **grey (DNS only)** karo, cert issue karo, phir orange kar do.
Ya wildcard wala **Option B** use karo — usme ye problem hi nahi aati (DNS API se banta hai).

---

# ✅ Checklist

```
PART 1 — Cloudflare
  □ dash.cloudflare.com pe free account banaya
  □ "Add a domain" me root domain daala (www ke bina)
  □ FREE plan select kiya (page ke sabse neeche)
  □ Existing DNS records delete NAHI kiye
  □ Cloudflare ke 2 nameservers copy kar liye

PART 2 — Registrar
  □ Registrar panel me nameserver section dhunda
  □ Purane nameserver hata kar Cloudflare wale daale
  □ dig +short NS yourdomain.com → cloudflare nameserver aa rahe hain
  □ Cloudflare dashboard me status "Active" ho gaya

PART 3 — DNS Records
  □ VPS ka IP pata kiya
  □ A record: panel  → VPS IP (grey cloud)
  □ A record: <client1> → VPS IP (grey cloud)
  □ A record: <client2> → VPS IP (grey cloud)
  □ dig +short <subdomain> → VPS IP aa raha hai

PART 4 — Cloudflare settings
  □ SSL/TLS mode = "Full (strict)"
  □ Always Use HTTPS = ON (SSL banne ke baad)

PART 5 — SSL
  □ API Token banaya (Zone → DNS → Edit, specific zone)
  □ Token safe jagah copy kiya (sirf ek baar dikhta hai)
  □ bash deploy/wildcard-cert.sh yourdomain.com email
  □ Wildcard cert issue ho gaya

PART 6 — App
  □ bash deploy/add-client.sh add <slug> <sub>.yourdomain.com --wildcard
  □ https://<sub>.yourdomain.com khul raha hai, 🔒 green
  □ /admin pe login karke default password badla
  □ "Set Webhook" dabaya (security fix ke baad zaroori hai)
  □ getWebhookInfo se webhook confirm kiya
```

---

## 📌 Ek zaroori baat (multi-client + ek domain)

Aapke paas abhi **ek domain** hai, to sab clients subdomain pe chalenge. Ye **shuru karne
ke liye bilkul theek hai** — 2-4 clients tak koi dikkat nahi.

Lekin dhyan rakho: **Meta ka domain verification `eTLD+1` level pe hota hai**, yaani
`yourdomain.com` par. Saare subdomains ka reputation **ek hi domain pe** stack hoga.
Is trading-tips/Telegram niche me Meta strict hai — agar ek client ke landing page pe
policy violation hua, to **pura `yourdomain.com` flag ho sakta hai** aur saare clients
ke ads band ho sakte hain.

**Practical plan:**
1. Abhi ek domain se shuru karo, 2-3 clients test karo
2. Jaise hi koi client serious ho (achha ad spend), uska **apna alag `.com` ya `.in`**
   dilwao — paisa client se vasool karo
3. `MULTI-CLIENT.md` me poori domain strategy likhi hai

---

**Agla kadam:** `DEPLOYMENT.md` section 4 se VPS setup karo, phir is guide ka Part 3–5.
