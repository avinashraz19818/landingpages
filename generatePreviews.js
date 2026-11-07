const fs = require('fs');
const path = require('path');

const previewDir = path.join(__dirname, 'public', 'previews');
if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

const themes = [
  {
    id: 'tactical-lime',
    name: 'Tactical Cyber Radar',
    tag: 'Sureshot By Ree Style',
    bg: '#05080c',
    card: '#090e15',
    accent: '#ccff00',
    btn: '#ccff00',
    btnText: '#000',
    hasCrosshair: true,
    hasCorner: true,
    btnShape: 'rect'
  },
  {
    id: 'ree-army',
    name: 'Dual Button VIP Radar',
    tag: 'Ree Army Style',
    bg: '#09070f',
    card: '#100c1a',
    accent: '#f43f5e',
    btn: '#f43f5e',
    btn2: '#f59e0b',
    btnText: '#fff',
    hasDual: true,
    has58Badge: true,
    btnShape: 'rect'
  },
  {
    id: 'emerald-gold',
    name: 'Emerald Forest & Sun Gold',
    tag: 'Jatin K Style',
    bg: '#040d07',
    card: '#07150c',
    accent: '#10b981',
    btn: '#f59e0b',
    btnText: '#000',
    btnShape: 'pill'
  },
  {
    id: 'cyber-red',
    name: 'Cyberpunk Neon Red',
    tag: 'Ashu Bamane Style',
    bg: '#06070a',
    card: '#0d0f15',
    accent: '#ff1e27',
    btn: '#ff1e27',
    btnText: '#fff',
    btnShape: 'pill'
  },
  {
    id: 'blue-grid',
    name: 'Electric Cyan RGB Grid',
    tag: 'Asla Bhai Style',
    bg: '#07090e',
    card: '#0c101a',
    accent: '#0ea5e9',
    btn: '#0284c7',
    btnText: '#fff',
    btnShape: 'pill'
  },
  {
    id: 'purple-luxury',
    name: 'Royal Purple Velvet',
    tag: 'The Lal Bhai Style',
    bg: '#0d0914',
    card: '#130d1d',
    accent: '#e11d48',
    btn: '#f43f5e',
    btnText: '#fff',
    btnShape: 'pill'
  },
  {
    id: 'clean-glass',
    name: 'Frosted Glass White',
    tag: 'Alone Souvik Style',
    bg: '#dce5ed',
    card: '#ffffff',
    accent: '#0284c7',
    btn: '#0284c7',
    btnText: '#fff',
    btnShape: 'pill'
  },
  {
    id: 'matrix-hacker',
    name: 'Matrix Terminal Green',
    tag: 'Hacker Cyber Style',
    bg: '#020d06',
    card: '#04170b',
    accent: '#00ff66',
    btn: '#00ff66',
    btnText: '#000',
    btnShape: 'rect'
  },
  {
    id: 'crypto-gold',
    name: 'Binance Gold VIP',
    tag: 'Crypto Wealth Style',
    bg: '#0b0b0b',
    card: '#141414',
    accent: '#f3ba2f',
    btn: '#f3ba2f',
    btnText: '#000',
    btnShape: 'pill'
  },
  {
    id: 'hyper-sunset',
    name: 'Miami Synthwave Sunset',
    tag: 'Neon Glow Style',
    bg: '#120524',
    card: '#1a0c33',
    accent: '#ec4899',
    btn: 'url(#grad-sunset)',
    btnText: '#fff',
    btnShape: 'rect'
  },
  {
    id: 'midnight-stealth',
    name: 'Stealth Carbon VIP',
    tag: 'Minimalist Dark Style',
    bg: '#0a0a0a',
    card: '#161616',
    accent: '#94a3b8',
    btn: '#ffffff',
    btnText: '#000',
    btnShape: 'pill'
  },
  {
    id: 'fire-phoenix',
    name: 'Blazing Phoenix Fire',
    tag: 'Molten Lava Style',
    bg: '#140602',
    card: '#1f0d06',
    accent: '#ff4500',
    btn: 'url(#grad-fire)',
    btnText: '#fff',
    btnShape: 'rect'
  }
];

themes.forEach(t => {
  const isLight = t.id === 'clean-glass';
  const textColor = isLight ? '#0f172a' : '#ffffff';
  const subtextColor = isLight ? '#64748b' : '#94a3b8';

  let cornerSvg = '';
  if (t.hasCorner) {
    cornerSvg = `
      <path d="M 20 30 L 20 20 L 30 20" stroke="${t.accent}" stroke-width="2" fill="none" />
      <path d="M 220 270 L 220 280 L 210 280" stroke="${t.accent}" stroke-width="2" fill="none" />
    `;
  }

  let radarSvg = '';
  if (t.hasCrosshair) {
    radarSvg = `
      <circle cx="120" cy="90" r="42" fill="none" stroke="${t.accent}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.8"/>
      <line x1="120" y1="42" x2="120" y2="52" stroke="${t.accent}" stroke-width="2"/>
      <line x1="120" y1="128" x2="120" y2="138" stroke="${t.accent}" stroke-width="2"/>
      <line x1="72" y1="90" x2="82" y2="90" stroke="${t.accent}" stroke-width="2"/>
      <line x1="158" y1="90" x2="168" y2="90" stroke="${t.accent}" stroke-width="2"/>
    `;
  } else {
    radarSvg = `<circle cx="120" cy="90" r="40" fill="none" stroke="${t.accent}" stroke-width="2" opacity="0.8"/>`;
  }

  let badge58 = '';
  if (t.has58Badge) {
    badge58 = `
      <circle cx="154" cy="62" r="12" fill="#0f131c" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="154" y="66" fill="#fff" font-size="9" font-weight="900" text-anchor="middle" font-family="sans-serif">58</text>
    `;
  }

  let buttonSvg = '';
  const btnRadius = t.btnShape === 'pill' ? '18' : '8';
  if (t.hasDual) {
    buttonSvg = `
      <rect x="25" y="190" width="190" height="28" rx="8" fill="${t.btn}" />
      <text x="120" y="208" fill="${t.btnText}" font-size="11" font-weight="bold" font-style="italic" text-anchor="middle" font-family="serif">Join Telegram Now</text>
      <rect x="25" y="225" width="190" height="28" rx="8" fill="${t.btn2}" />
      <text x="120" y="243" fill="${t.btnText}" font-size="11" font-weight="bold" font-style="italic" text-anchor="middle" font-family="serif">Join Telegram Now</text>
    `;
  } else {
    buttonSvg = `
      <rect x="25" y="200" width="190" height="36" rx="${btnRadius}" fill="${t.btn}" />
      <circle cx="45" cy="218" r="10" fill="#000" opacity="0.3"/>
      <text x="125" y="223" fill="${t.btnText}" font-size="12" font-weight="bold" text-anchor="middle" font-family="sans-serif">JOIN TELEGRAM</text>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300" width="240" height="300">
  <defs>
    <linearGradient id="grad-sunset" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ec4899" />
      <stop offset="100%" stop-color="#f97316" />
    </linearGradient>
    <linearGradient id="grad-fire" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff4500" />
      <stop offset="100%" stop-color="#ff8c00" />
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="240" height="300" fill="${t.bg}"/>
  <!-- Card Container -->
  <rect x="10" y="10" width="220" height="280" rx="20" fill="${t.card}" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/>
  ${cornerSvg}
  <!-- Top Badge -->
  <rect x="75" y="22" width="90" height="18" rx="9" fill="rgba(0,0,0,0.3)" stroke="${t.accent}" stroke-width="1"/>
  <circle cx="85" cy="31" r="3" fill="${t.accent}"/>
  <text x="122" y="34" fill="${textColor}" font-size="8.5" font-weight="800" text-anchor="middle" font-family="sans-serif">LIVE CHANNEL</text>
  <!-- Avatar Area -->
  ${radarSvg}
  <circle cx="120" cy="90" r="34" fill="#2d3748"/>
  <circle cx="120" cy="80" r="14" fill="#cbd5e1"/>
  <path d="M96 118 C96 102, 107 98, 120 98 C133 98, 144 102, 144 118 Z" fill="#cbd5e1"/>
  <!-- Verified Badge -->
  <circle cx="146" cy="114" r="8" fill="#10b981"/>
  <path d="M143 114 L145 116 L149 112" stroke="#fff" stroke-width="1.5" fill="none"/>
  ${badge58}
  <!-- Title & Sub -->
  <text x="120" y="148" fill="${textColor}" font-size="14" font-weight="900" text-anchor="middle" font-family="sans-serif">${t.name.split(' ')[0]} <tspan fill="${t.accent}">${t.name.split(' ')[1] || ''}</tspan></text>
  <text x="120" y="165" fill="${subtextColor}" font-size="9" text-anchor="middle" font-family="sans-serif">35,000+ Members • 100% Free</text>
  <text x="120" y="180" fill="${subtextColor}" font-size="8.5" text-anchor="middle" font-family="sans-serif">Daily Signals &amp; Market Mentorship</text>
  <!-- Button(s) -->
  ${buttonSvg}
  <!-- Bottom mini stats -->
  <rect x="25" y="260" width="58" height="18" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)"/>
  <text x="54" y="272" fill="${textColor}" font-size="8" font-weight="bold" text-anchor="middle" font-family="sans-serif">100% FREE</text>
  <rect x="91" y="260" width="58" height="18" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)"/>
  <text x="120" y="272" fill="${textColor}" font-size="8" font-weight="bold" text-anchor="middle" font-family="sans-serif">INSTANT</text>
  <rect x="157" y="260" width="58" height="18" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)"/>
  <text x="186" y="272" fill="${textColor}" font-size="8" font-weight="bold" text-anchor="middle" font-family="sans-serif">DAILY</text>
</svg>`;

  fs.writeFileSync(path.join(previewDir, `${t.id}.svg`), svg, 'utf8');
});

console.log('All 12 theme preview SVGs generated successfully!');
