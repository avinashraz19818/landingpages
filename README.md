# 🚀 0-Fake-Click Meta Ads to Telegram Tracking System

Ek advanced, ultra-high conversion landing page aur real-time analytics system jo Meta (Facebook / Instagram) ads me hone wale **fake clicks aur bot leads ko 100% khatam (0 Fake Click)** karta hai.

---

## 💡 "0 Fake Click" Ka Asli Secret (Ye Kaise Kaam Karta Hai?)

### ❌ Purana / Normal Tareeqa (Jis wajah se paise waste hote hain):
1. User Meta Ad dekhta hai -> Landing page par click karta hai.
2. Landing page par user "Join Telegram" button dabata hai.
3. Website ka normal Meta Pixel turant `Lead` event fire kar deta hai.
4. **Nateeja:** 60% se 80% log Telegram kholte hi nahi, back kar lete hain, ya Telegram me "Join" nahi dabate. Meta algorithm ko lagta hai fake clicker hi real customer hai, aur aapka ad spend barbad ho jata hai!

### ✅ Hamara 0-Fake-Click Advanced System (Screenshot 1 jaisa exact 1:1 match):
1. **Visitor Capture:** User Meta Ad se landing page par aata hai. System uska `fbclid`, `_fbc`, `_fbp`, IP address, aur user-agent capture karta hai.
2. **Dynamic Invite Link:** Jab user landing page par tap karta hai (ya auto-countdown complete hota hai), server Telegram Bot API ke zariye ek **Unique Single-Use Join Request Invite Link** (`creates_join_request=true`) generate karta hai.
3. **REAL User Join Request in Telegram:** User Telegram app me jata hai aur official **"Request to Join Channel"** button dabata hai.
4. **Instant Webhook Arrival:** Telegram turant hamare server ko `chat_join_request` update bhejta hai with user name & ID.
5. **Server-Side Meta CAPI Fire:** Server matching session dhundh kar seedhe Meta ke server ko **Meta Conversions API (CAPI)** ke zariye `Lead` event bhejta hai!
6. **Result:** **100% Real Joins = 100% Pixel Hits! 0 Fake Clicks!**
7. **Auto-Approval:** Telegram Bot naye user ko turant auto-approve kar sakta hai aur welcome gift message bhi bhej sakta hai!

---

## 🎨 12 Visual Themes (With Image Preview Gallery)

Ab dashboard me sirf naam nahi, balki **har design ka visual image card preview** dikhta hai! Aap card par click karke turant live preview me dekh sakte hain:

1. ⚡ **Tactical Cyber Radar** (*Sureshot By Ree style*): Lime neon `#ccff00`, rotating crosshair HUD, corner brackets, 3 stat tiles.
2. 💖 **Dual Button VIP Radar** (*Ree Army style*): Pink + Golden dual CTA button stack, live 58s avatar countdown circle, orbiting dots.
3. 🌿 **Emerald Forest & Sun Gold** (*Jatin K style*): Deep forest green background, intense golden-amber sun glow button, cyan verified check.
4. 🔴 **Cyberpunk Neon Red** (*Ashu Bamane style*): Dark cyber grid, crimson red spinning avatar halo, glowing member badge.
5. 🌐 **Electric Cyan RGB Grid** (*Asla Bhai style*): RGB rainbow gradient avatar ring, neon electric sky-blue join button.
6. 🟣 **Royal Purple Velvet** (*The Lal Bhai style*): Luxury royal magenta glow, rocket slide button.
7. ⚪ **Frosted Glass White** (*Alone Souvik style*): Clean Apple-grade frosted glassmorphism card with soft shadows.
8. 🟩 **Matrix Terminal Green**: Obsidian black, phosphor terminal green code aesthetics, hacker grid.
9. 🪙 **Binance Gold VIP**: Jet black carbon finish, luxury 24K crypto gold accents.
10. 🌅 **Miami Synthwave Sunset**: Neon pink to vibrant orange sunset gradient, retro futuristic glow.
11. 🕶️ **Stealth Carbon VIP**: Matte gunmetal gray, minimalist monochromatic platinum button.
12. 🔥 **Blazing Phoenix Fire**: Molten lava black, burning aura, high-CTR flame gradient CTA button.

---

## 📊 Analytics Dashboard (Screenshot 1 Match)

Admin Dashboard par aapko milta hai:
- 🟢 **Aaj (Today):** Join Requests (Leads), Pixel Hits (Fired), Links Generated, Approved Members.
- 🟡 **Kal (Yesterday):** Join Requests (Leads), Pixel Hits (Fired), Links Generated, Approved Members.
- 🌐 **Lifetime Total:** Total Requests, Total Pixel Fired, Total Links, Total Approved.
- 📅 **Join Stats Per Day (Har Din Ka Hisaab):** Din-ba-din ka detailed table jisme conversion rate aur 100% match verification dikhta hai.
- ⚡ **Realtime Activity Feed:** Server-Sent Events (SSE) stream jisse live users ke aane par bina page refresh kiye counter aur notification flash hoti hai!
- 🧪 **1-Click Funnel Simulator:** Bina koi ad chalaye aap pura funnel simulate karke dekh sakte hain!

---

## 🌐 Live Deploy Karna Hai? (VPS / cPanel)

**Is app ko VPS pe deploy karo — cPanel shared hosting par ye theek se nahi chalega** (Telegram webhook, realtime SSE dashboard aur `data.json` writes ke liye ek 24×7 chalne wala process chahiye, jo cPanel ka Passenger provide nahi karta).

Poori guide, reasons aur ready-made config files (PM2 + Nginx + SSL + one-shot setup script) ke liye dekho:

👉 **[DEPLOYMENT.md](./DEPLOYMENT.md)** — `deploy/` folder me `setup-vps.sh`, `nginx.conf`, `ecosystem.config.js`

```bash
# VPS par ek hi command me pura setup:
git clone https://github.com/avinashraz19818/landingpages.git /opt/app
cd /opt/app && bash deploy/setup-vps.sh yourdomain.com
```

## 🏢 Multiple Clients Ke Liye Chalna Hai? (Agency Setup)

Ye app **single-tenant** hai — ek install me ek hi Telegram bot + ek hi Meta pixel chalta hai. Ek Telegram bot sirf **ek webhook URL** set kar sakta hai, isliye har client ka apna alag bot zaroori hai.

Iska solution: **ek VPS par N isolated instances** — har client ka apna folder, port, `data.json`, domain aur SSL. Ek client ka kuch bigda to baaki par zero asar.

👉 **[MULTI-CLIENT.md](./MULTI-CLIENT.md)** — domain strategy (kaun sa TLD lena hai, kaun sa nahi), VPS sizing, cost breakdown aur onboarding checklist

```bash
# Naya client add karo — pura provisioning automatic (app + PM2 + Nginx + SSL):
bash deploy/add-client.sh add ree sureshotree.com --label "Sureshot By Ree"

# Saare clients ka status / update / backup:
bash deploy/add-client.sh list
bash deploy/add-client.sh update --all
bash deploy/add-client.sh backup --all
```

> 💡 **Domain:** har client ke liye **alag `.com` ya `.in`** lo. Saste `.xyz`/`.top`/`.icu` TLD mat lena — Meta unhe trust nahi karta aur ad rejection rate high hota hai. Ek root domain pe saare clients subdomain me mat rakhna — ek policy violation se pura domain flag ho jaata hai.

---

## 🛠️ Kaise Start Karein (Quick Start)

### 1. Server Start Karein:
Folder me command prompt ya terminal kholein:
```bash
npm start
```
Ya Windows me seedhe **`start.bat`** par double click karein!

### 2. Browser me kholein:
- 📱 **Landing Page:** [http://localhost:3000](http://localhost:3000)
- 📊 **Admin Dashboard:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## ⚙️ Setup Guide:

### Telegram Bot Setup:
1. Telegram par `@BotFather` ke paas jayein aur `/newbot` likhkar apna bot banayein.
2. Bot Father aapko ek **Bot Token** dega.
3. Apne Telegram Channel ki settings me jayein -> **Administrators** -> Apne bot ko Admin banayein aur permissions dein:
   - *Invite Users via Links* (Zaroori)
   - *Manage Chat*
4. Admin Dashboard ke **"Bot & Meta CAPI Setup"** tab me Bot Token aur Channel ID daalein aur **"Test Bot & Channel"** button dabayein!
5. Jab aap isse live domain (VPS / Cloud / Render / VPS with HTTPS) par deploy karein, to apna HTTPS URL daalkar **"Set Webhook"** button dabayein!

### Meta Pixel & Conversions API Setup:
1. Meta Events Manager me jayein.
2. Apna **Pixel ID** copy karein.
3. **Settings** tab me neeche scroll karein -> Conversions API -> **"Generate access token"** par click karein aur token copy karein.
4. Testing ke liye Events Manager ke **"Test events"** tab me jo code dikhta hai (e.g. `TEST12345`), use Dashboard me daalkar **"Send Test Event to Meta"** dabayein aur Meta me live event check karein!

---

## 🧪 Testing with Simulator
Admin dashboard me **"1-Click Lead Simulator"** tab me jakar "Simulate 1 Real Lead & CAPI Hit" button dabayein. Aap dekhenge ki kaise ek second ke andar links generated, join requests, pixel hits, aur approved members ke numbers increment ho jate hain!
