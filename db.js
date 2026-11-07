const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

// Default initial state
const defaultData = {
  settings: {
    // General / Landing page settings
    pageTitle: 'SURESHOT BY REE',
    titleHighlight: 'REE', // highlighted word with custom color
    channelUsername: 'sureshotree',
    subText: 'Official Telegram Channel',
    topPillText: 'LIVE NOW',
    membersCount: '35,000+',
    badgeText: 'Members',
    description: 'Free Daily Tips & Strategies • Join the Fastest-Growing Community',
    buttonText: 'JOIN TELEGRAM',
    buttonSubtext: 'Tap to open the channel',
    step1Text: 'Pehle tap karo Join',
    step2Text: 'Phir tap karo Request to Join',
    brandingText: 'Ads managed by ⚡ 0-Fake-Click PRO 💀',
    theme: 'tactical-lime', // 'tactical-lime' | 'ree-army' | 'emerald-gold' | 'cyber-red' | 'blue-grid' | 'purple-luxury' | 'clean-glass'
    language: 'hi', // 'hi', 'en', 'bn', 'gu'
    avatarUrl: '/uploads/default-avatar.svg',
    
    // Advanced UI controls (Matching all screenshots)
    layoutStyle: 'tactical-box', // 'standard' | 'dual-button' | 'tactical-box'
    enableCornerBrackets: true,
    enableRadarCrosshair: true,
    enableCircleCountdownBadge: true,
    circleCountdownNumber: 58,
    verifiedBadgeType: 'blue', // 'blue' | 'green' | 'none'
    
    // Dual Button Stack (Ree Army style)
    enableDualButtons: false,
    secondButtonText: 'Join Telegram Now',
    secondButtonColor: 'golden', // 'golden' | 'pink' | 'emerald'
    
    // Countdown settings
    enableCountdown: true,
    countdownSeconds: 2,
    countdownText: 'Telegram khul raha hai {s}s mein...',
    pauseButtonText: 'Ruko / Pause',
    
    // Trust Badges & 3-Box Stats
    showBadges: true,
    stat1Top: '100%',
    stat1Bottom: 'FREE',
    stat2Top: 'Instant',
    stat2Bottom: 'ACCESS',
    stat3Top: 'Daily',
    stat3Bottom: 'UPDATES',
    badge1: '100% Free',
    badge2: 'Instant Access',
    badge3: 'Daily Updates',

    // Sound & Haptics
    enableHaptics: true,

    // Telegram Bot & Channel
    telegramBotToken: '',
    telegramChatId: '', // e.g. -1001234567890 or @channelname
    autoApprove: true, // auto approve chat join requests
    sendWelcomeMessage: false,
    welcomeMessageText: 'Welcome to the channel! Check pinned message for today\'s gift.',
    
    // Meta (Facebook) Pixel & CAPI
    metaPixelId: '',
    metaCapiToken: '',
    metaTestEventCode: '', // e.g. TEST12345 (optional)
    metaEventName: 'Lead', // Lead | CompleteRegistration | Subscribe
    
    // System
    adminPassword: 'admin',
    publicUrl: 'http://localhost:3000'
  },
  
  // Stored links & sessions
  // key: inviteLinkId or sessionId
  sessions: {},
  
  // Historical events log
  events: [
    /*
      {
        id: 'evt_xxx',
        type: 'LINK_GENERATED' | 'JOIN_REQUEST' | 'PIXEL_FIRED' | 'MEMBER_APPROVED' | 'CAPI_ERROR',
        timestamp: ISO string,
        sessionId: string,
        inviteLink: string,
        telegramUser: { id, firstName, username },
        metaResponse: object,
        ip: string,
        userAgent: string,
        fbclid: string,
        utm: object
      }
    */
  ]
};

class Database {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          settings: { ...defaultData.settings, ...parsed.settings },
          sessions: parsed.sessions || {},
          events: parsed.events || []
        };
      }
    } catch (e) {
      console.error('Error loading db, resetting to default:', e.message);
    }
    this.save(defaultData);
    return defaultData;
  }

  save(dataToSave = this.data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving db:', e.message);
    }
  }

  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }

  saveSession(sessionId, sessionData) {
    this.data.sessions[sessionId] = {
      ...(this.data.sessions[sessionId] || {}),
      ...sessionData,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.sessions[sessionId];
  }

  getSession(sessionId) {
    return this.data.sessions[sessionId];
  }

  findSessionByInviteLink(inviteLink) {
    if (!inviteLink) return null;
    const cleanLink = inviteLink.trim();
    for (const id in this.data.sessions) {
      const s = this.data.sessions[id];
      if (s.inviteLink && (s.inviteLink === cleanLink || cleanLink.includes(s.inviteLink) || s.inviteLink.includes(cleanLink))) {
        return { sessionId: id, ...s };
      }
      if (s.inviteLinkName && cleanLink.includes(s.inviteLinkName)) {
        return { sessionId: id, ...s };
      }
    }
    return null;
  }

  findSessionByInviteName(inviteName) {
    if (!inviteName) return null;
    for (const id in this.data.sessions) {
      const s = this.data.sessions[id];
      if (s.inviteLinkName && s.inviteLinkName === inviteName) {
        return { sessionId: id, ...s };
      }
    }
    return null;
  }

  addEvent(event) {
    const fullEvent = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      timestamp: new Date().toISOString(),
      ...event
    };
    this.data.events.unshift(fullEvent); // newest first
    // keep max 5000 recent events
    if (this.data.events.length > 5000) {
      this.data.events.pop();
    }
    this.save();
    return fullEvent;
  }

  getEvents(limit = 100) {
    return this.data.events.slice(0, limit);
  }

  clearAllData() {
    this.data.sessions = {};
    this.data.events = [];
    this.save();
  }
}

module.exports = new Database();
