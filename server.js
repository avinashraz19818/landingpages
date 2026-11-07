const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
require('dotenv').config();

const db = require('./db');
const auth = require('./services/auth');
const telegramService = require('./services/telegram');
const metaCapiService = require('./services/metaCapi');
const analyticsService = require('./services/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS & JSON parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// SSE Client Connections for Real-Time Live Stream
const sseClients = new Set();
function broadcastLiveUpdate(event) {
  const data = JSON.stringify(event);
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Helper: Extract real Client IP
function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

// Helper: Bot user-agent detector
function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  const botKeywords = ['bot', 'crawler', 'spider', 'facebookexternalhit', 'facebot', 'googlebot', 'bingbot', 'yandex', 'duckduckbot', 'twitterbot'];
  return botKeywords.some(keyword => ua.includes(keyword));
}

// -------------------------------------------------------------
// PUBLIC LANDING PAGE APIS
// -------------------------------------------------------------

// Get Page Configuration
app.get('/api/page-config', (req, res) => {
  const settings = db.getSettings();
  
  // Return all customization options for landing page
  const publicConfig = {
    pageTitle: settings.pageTitle,
    titleHighlight: settings.titleHighlight,
    channelUsername: settings.channelUsername,
    subText: settings.subText,
    topPillText: settings.topPillText,
    membersCount: settings.membersCount,
    badgeText: settings.badgeText,
    description: settings.description,
    buttonText: settings.buttonText,
    buttonSubtext: settings.buttonSubtext,
    step1Text: settings.step1Text,
    step2Text: settings.step2Text,
    brandingText: settings.brandingText,
    theme: settings.theme,
    language: settings.language,
    avatarUrl: settings.avatarUrl,
    
    layoutStyle: settings.layoutStyle,
    enableCornerBrackets: settings.enableCornerBrackets,
    enableRadarCrosshair: settings.enableRadarCrosshair,
    enableCircleCountdownBadge: settings.enableCircleCountdownBadge,
    circleCountdownNumber: settings.circleCountdownNumber,
    verifiedBadgeType: settings.verifiedBadgeType,
    
    enableDualButtons: settings.enableDualButtons,
    secondButtonText: settings.secondButtonText,
    secondButtonColor: settings.secondButtonColor,
    
    enableCountdown: settings.enableCountdown,
    countdownSeconds: settings.countdownSeconds,
    countdownText: settings.countdownText,
    pauseButtonText: settings.pauseButtonText,
    
    showBadges: settings.showBadges,
    stat1Top: settings.stat1Top,
    stat1Bottom: settings.stat1Bottom,
    stat2Top: settings.stat2Top,
    stat2Bottom: settings.stat2Bottom,
    stat3Top: settings.stat3Top,
    stat3Bottom: settings.stat3Bottom,
    badge1: settings.badge1,
    badge2: settings.badge2,
    badge3: settings.badge3,
    
    enableHaptics: settings.enableHaptics,
    metaPixelId: settings.metaPixelId
  };
  res.json({ success: true, config: publicConfig });
});

// Generate Unique Invite Link (0-Fake-Click Tracker)
app.post('/api/generate-link', async (req, res) => {
  try {
    const settings = db.getSettings();
    const { fbclid, fbc, fbp, utm = {}, sessionId: clientSessionId } = req.body;
    
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = getClientIp(req);

    // Bot Filter: If it's a known crawler, do not treat as genuine user lead
    if (isBot(userAgent)) {
      return res.json({
        success: true,
        sessionId: 'bot_ignore',
        inviteLink: `https://t.me/${(settings.channelUsername || 'telegram').replace('@', '')}`
      });
    }

    const sessionId = clientSessionId || 'req_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    let inviteLink = '';
    let linkName = `ref_${sessionId.substring(0, 20)}`;

    if (settings.telegramBotToken && settings.telegramChatId) {
      try {
        const tgResult = await telegramService.createJoinRequestLink(
          settings.telegramBotToken,
          settings.telegramChatId,
          linkName
        );
        inviteLink = tgResult.invite_link;
      } catch (tgErr) {
        console.warn('Telegram link creation warning:', tgErr.message);
        inviteLink = `https://t.me/${(settings.channelUsername || 'telegram').replace('@', '')}?start=${sessionId}`;
      }
    } else {
      const cleanUsername = (settings.channelUsername || 'telegram').replace('@', '');
      inviteLink = `https://t.me/${cleanUsername}?start=${sessionId}`;
    }

    // Save session in database
    const sessionData = {
      sessionId,
      inviteLink,
      inviteLinkName: linkName,
      fbclid: fbclid || '',
      fbc: fbc || '',
      fbp: fbp || '',
      ip,
      userAgent,
      utm,
      status: 'LINK_GENERATED',
      createdAt: new Date().toISOString()
    };
    db.saveSession(sessionId, sessionData);

    // Record Event
    const event = db.addEvent({
      type: 'LINK_GENERATED',
      sessionId,
      inviteLink,
      ip,
      userAgent,
      fbclid,
      utm
    });

    broadcastLiveUpdate({ type: 'EVENT_ADDED', event, stats: analyticsService.getDashboardStats() });

    res.json({
      success: true,
      sessionId,
      inviteLink,
      deepLink: inviteLink.startsWith('https://t.me/') 
        ? inviteLink.replace('https://t.me/', 'tg://resolve?domain=')
        : inviteLink
    });
  } catch (error) {
    console.error('Error generating link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// TELEGRAM WEBHOOK (THE MAGIC: Real Join Request Detector)
// -------------------------------------------------------------

app.post('/api/telegram-webhook', async (req, res) => {
  // ---------------------------------------------------------------
  // Verify this update really came from Telegram.
  // Without this, anyone could POST a fake chat_join_request and make
  // the server fire bogus Lead events at the client's Meta pixel.
  // ---------------------------------------------------------------
  const webhookSecret = db.getSettings().telegramWebhookSecret;
  if (webhookSecret) {
    const received = String(req.headers['x-telegram-bot-api-secret-token'] || '');
    const expected = String(webhookSecret);

    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!ok) {
      console.warn(`🛡️  Rejected Telegram webhook with bad secret from ${getClientIp(req)}`);
      return res.status(403).send('Forbidden');
    }
  } else {
    console.warn('⚠️  telegramWebhookSecret is empty — webhook is accepting unverified calls.');
  }

  res.status(200).send('OK');

  try {
    const update = req.body;
    console.log('Received Telegram Update:', JSON.stringify(update, null, 2));

    if (update.chat_join_request) {
      const joinReq = update.chat_join_request;
      const chat = joinReq.chat;
      const user = joinReq.from;
      const inviteLinkObj = joinReq.invite_link;
      const settings = db.getSettings();

      const inviteLinkUrl = inviteLinkObj?.invite_link || '';
      const inviteLinkName = inviteLinkObj?.name || '';

      console.log(`[REAL JOIN] User ${user.first_name} (@${user.username || user.id}) requested to join channel ${chat.title}`);

      let session = db.findSessionByInviteName(inviteLinkName);
      if (!session && inviteLinkUrl) {
        session = db.findSessionByInviteLink(inviteLinkUrl);
      }

      const sessionId = session ? session.sessionId : 'unknown_session';

      // 1. Log JOIN_REQUEST Event
      const joinEvent = db.addEvent({
        type: 'JOIN_REQUEST',
        sessionId,
        inviteLink: inviteLinkUrl,
        telegramUser: {
          id: user.id,
          firstName: user.first_name,
          username: user.username || ''
        },
        ip: session?.ip || 'Webhook-IP',
        userAgent: session?.userAgent || 'TelegramApp',
        fbclid: session?.fbclid,
        utm: session?.utm
      });

      broadcastLiveUpdate({ type: 'EVENT_ADDED', event: joinEvent, stats: analyticsService.getDashboardStats() });

      // 2. TRIGGER META CONVERSIONS API (CAPI) - 100% Real, 0 Fake Click!
      if (settings.metaPixelId && settings.metaCapiToken) {
        const capiResult = await metaCapiService.fireEvent({
          pixelId: settings.metaPixelId,
          capiToken: settings.metaCapiToken,
          eventName: settings.metaEventName || 'Lead',
          testEventCode: settings.metaTestEventCode,
          eventSourceUrl: `${settings.publicUrl}/?ref=${sessionId}`,
          ip: session?.ip,
          userAgent: session?.userAgent,
          fbc: session?.fbc,
          fbp: session?.fbp,
          fbclid: session?.fbclid,
          externalId: user.id.toString(),
          customData: {
            channel_name: chat.title,
            telegram_user: user.username || user.first_name,
            lead_type: 'verified_telegram_join'
          }
        });

        const pixelEvent = db.addEvent({
          type: 'PIXEL_FIRED',
          sessionId,
          metaResponse: capiResult,
          status: capiResult.success ? 'SUCCESS' : 'FAILED',
          ip: session?.ip,
          fbclid: session?.fbclid,
          telegramUser: {
            id: user.id,
            firstName: user.first_name
          }
        });

        broadcastLiveUpdate({ type: 'EVENT_ADDED', event: pixelEvent, stats: analyticsService.getDashboardStats() });
      }

      // 3. Auto-Approve Member if configured
      if (settings.autoApprove && settings.telegramBotToken) {
        const approved = await telegramService.approveJoinRequest(
          settings.telegramBotToken,
          chat.id,
          user.id
        );

        if (approved) {
          const approvedEvent = db.addEvent({
            type: 'MEMBER_APPROVED',
            sessionId,
            telegramUser: {
              id: user.id,
              firstName: user.first_name
            }
          });
          broadcastLiveUpdate({ type: 'EVENT_ADDED', event: approvedEvent, stats: analyticsService.getDashboardStats() });
        }
      }

      // 4. Send Welcome DM message if configured
      if (settings.sendWelcomeMessage && settings.welcomeMessageText && settings.telegramBotToken) {
        await telegramService.sendMessage(
          settings.telegramBotToken,
          user.id,
          settings.welcomeMessageText
        );
      }
    }
  } catch (err) {
    console.error('Error handling Telegram Webhook:', err);
  }
});

// -------------------------------------------------------------
// ADMIN AUTHENTICATION
// -------------------------------------------------------------

/**
 * Settings fields that must NEVER leave the server in a response.
 * Before this guard existed, GET /api/admin/settings returned the Telegram
 * bot token and Meta CAPI access token in plaintext to anyone on the internet.
 */
const SECRET_FIELDS = [
  'telegramBotToken',
  'metaCapiToken',
  'metaTestEventCode',
  'adminPassword',
  'sessionSecret',
  'telegramWebhookSecret'
];

/** Fields an admin may rotate, but never through the generic settings POST. */
const SYSTEM_ONLY_FIELDS = ['sessionSecret', 'telegramWebhookSecret'];

/** Replace secrets with a masked preview so the UI can show "saved ✓". */
function sanitizeSettings(settings) {
  const out = { ...settings };
  SECRET_FIELDS.forEach(field => { delete out[field]; });

  out.secrets = {
    telegramBotToken: {
      set: Boolean(settings.telegramBotToken),
      masked: auth.maskSecret(settings.telegramBotToken)
    },
    metaCapiToken: {
      set: Boolean(settings.metaCapiToken),
      masked: auth.maskSecret(settings.metaCapiToken)
    },
    metaTestEventCode: {
      set: Boolean(settings.metaTestEventCode),
      masked: auth.maskSecret(settings.metaTestEventCode)
    },
    telegramWebhookSecret: {
      set: Boolean(settings.telegramWebhookSecret),
      masked: auth.maskSecret(settings.telegramWebhookSecret)
    },
    adminPassword: {
      set: Boolean(settings.adminPassword),
      // Warn loudly while the shipped default is still in use
      isDefault: settings.adminPassword === 'admin'
    }
  };

  return out;
}

/** Paths reachable without a session cookie. */
const PUBLIC_ADMIN_PATHS = new Set([
  '/api/admin/login',
  '/api/admin/logout',
  '/api/admin/status'
]);

// Registered BEFORE every /api/admin/* route below, so the whole dashboard
// API surface is locked down by default (including the SSE stream — the
// session travels in an httpOnly cookie because EventSource cannot set headers).
app.use('/api/admin', (req, res, next) => {
  const fullPath = (req.originalUrl || '').split('?')[0];
  if (PUBLIC_ADMIN_PATHS.has(fullPath)) return next();

  const settings = db.getSettings();
  const token = auth.readToken(req) || req.headers['x-admin-token'] || '';

  if (!auth.verifySessionToken(token, settings.sessionSecret)) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  return next();
});

// Login
app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);

  const guard = auth.checkLoginAllowed(ip);
  if (guard.blocked) {
    return res.status(429).json({
      success: false,
      error: `Too many failed attempts. Try again in ${guard.retryAfterSeconds}s.`,
      code: 'RATE_LIMITED',
      retryAfterSeconds: guard.retryAfterSeconds
    });
  }

  const password = (req.body || {}).password;
  const stored = db.getSettings().adminPassword;
  const result = auth.verifyPassword(password, stored);

  if (!result.ok) {
    const remaining = auth.registerFailedLogin(ip);
    return res.status(401).json({
      success: false,
      error: `Wrong password. ${Math.max(0, remaining)} attempt(s) left before a 10 minute lockout.`,
      code: 'BAD_PASSWORD'
    });
  }

  // Upgrade a legacy plaintext password to a salted hash on first success
  if (result.needsUpgrade && result.upgraded) {
    db.updateSettings({ adminPassword: result.upgraded });
    console.log('🔐 Admin password upgraded from plaintext to salted hash.');
  }

  auth.clearLoginAttempts(ip);

  const token = auth.createSessionToken(db.getSettings().sessionSecret);
  res.setHeader('Set-Cookie', auth.sessionCookie(token, {
    maxAgeSeconds: Math.floor(auth.SESSION_TTL_MS / 1000)
  }));

  console.log(`🔓 Admin login success from ${ip}`);
  return res.json({ success: true, message: 'Logged in' });
});

// Logout
app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', auth.sessionCookie('', {}));
  res.json({ success: true, message: 'Logged out' });
});

// Session status (also tells the UI whether the default password is still set)
app.get('/api/admin/status', (req, res) => {
  const settings = db.getSettings();
  const token = auth.readToken(req) || req.headers['x-admin-token'] || '';

  res.json({
    success: true,
    authenticated: auth.verifySessionToken(token, settings.sessionSecret),
    usingDefaultPassword: settings.adminPassword === 'admin',
    webhookSecretSet: Boolean(settings.telegramWebhookSecret),
    telegramBotTokenSet: Boolean(settings.telegramBotToken),
    metaCapiTokenSet: Boolean(settings.metaCapiToken)
  });
});

// Change password (requires the current one; invalidates all sessions)
app.post('/api/admin/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const settings = db.getSettings();

  const check = auth.verifyPassword(currentPassword, settings.adminPassword);
  if (!check.ok) {
    return res.status(403).json({ success: false, error: 'Current password is incorrect' });
  }

  const next = String(newPassword || '');
  if (next.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'New password must be at least 8 characters long'
    });
  }

  db.updateSettings({
    adminPassword: auth.hashPassword(next),
    // Rotating the signing key instantly logs out every existing session,
    // including any that an attacker may already hold.
    sessionSecret: auth.generateSecret(32)
  });

  res.setHeader('Set-Cookie', auth.sessionCookie('', {}));
  console.log('🔑 Admin password changed; all sessions invalidated.');
  return res.json({ success: true, message: 'Password changed. Please log in again.' });
});

// Rotate the Telegram webhook secret (then re-run "Set Webhook")
app.post('/api/admin/rotate-webhook-secret', (req, res) => {
  const secret = auth.generateSecret(24);
  db.updateSettings({ telegramWebhookSecret: secret });
  res.json({
    success: true,
    message: 'Webhook secret rotated. Click "Set Webhook" again so Telegram learns the new value.',
    masked: auth.maskSecret(secret)
  });
});

// -------------------------------------------------------------
// ADMIN & DASHBOARD APIS  (all below require a valid session)
// -------------------------------------------------------------

// SSE Real-time Feed
app.get('/api/admin/events-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', stats: analyticsService.getDashboardStats() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Full Stats
app.get('/api/admin/stats', (req, res) => {
  const stats = analyticsService.getDashboardStats();
  res.json({ success: true, stats });
});

// Settings (secrets are stripped and returned masked)
app.get('/api/admin/settings', (req, res) => {
  res.json({ success: true, settings: sanitizeSettings(db.getSettings()) });
});

// Update Settings
app.post('/api/admin/settings', (req, res) => {
  try {
    const payload = { ...(req.body || {}) };

    // System secrets have their own dedicated endpoints — never writable here.
    SYSTEM_ONLY_FIELDS.forEach(field => { delete payload[field]; });

    // For credential fields an empty input means "keep what is already saved",
    // because the UI only ever receives a masked preview, not the real value.
    ['telegramBotToken', 'metaCapiToken', 'metaTestEventCode', 'adminPassword'].forEach(field => {
      if (!(field in payload)) return;
      const value = String(payload[field] ?? '').trim();
      if (!value) {
        delete payload[field];
      } else if (field === 'adminPassword') {
        payload[field] = auth.hashPassword(value);
      }
    });

    const updated = db.updateSettings(payload);
    const safe = sanitizeSettings(updated);
    broadcastLiveUpdate({ type: 'SETTINGS_UPDATED', settings: safe });
    res.json({ success: true, settings: safe });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Avatar Upload
app.post('/api/admin/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded' });
  }
  const avatarUrl = `/uploads/${req.file.filename}`;
  db.updateSettings({ avatarUrl });
  broadcastLiveUpdate({ type: 'SETTINGS_UPDATED', settings: sanitizeSettings(db.getSettings()) });
  res.json({ success: true, avatarUrl });
});

// Test Telegram Bot
// A blank token/chatId means "use the value already saved on the server" —
// the browser never receives the real secret, only a masked preview.
app.post('/api/admin/test-bot', async (req, res) => {
  try {
    const saved = db.getSettings();
    const token = String((req.body || {}).token || '').trim() || saved.telegramBotToken;
    const chatId = String((req.body || {}).chatId || '').trim() || saved.telegramChatId;

    const botInfo = await telegramService.testBot(token);
    let chatInfo = null;
    if (chatId) {
      chatInfo = await telegramService.testChannel(token, chatId);
    }
    res.json({ success: true, bot: botInfo, chat: chatInfo });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Set Webhook
app.post('/api/admin/set-webhook', async (req, res) => {
  try {
    const saved = db.getSettings();
    const body = req.body || {};
    const token = String(body.token || '').trim() || saved.telegramBotToken;
    const url = String(body.url || '').trim() || saved.publicUrl;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Bot token is not saved yet. Enter it once and save settings first.' });
    }
    if (!url) {
      return res.status(400).json({ success: false, error: 'Public URL is required (e.g. https://yourdomain.com)' });
    }

    const webhookUrl = `${url.replace(/\/$/, '')}/api/telegram-webhook`;

    // Pass the per-install secret so Telegram signs every update it sends us.
    const secret = saved.telegramWebhookSecret;
    const result = await telegramService.setWebhook(token, webhookUrl, secret);

    res.json({
      success: true,
      result,
      webhookUrl,
      secretConfigured: Boolean(secret),
      message: secret
        ? 'Webhook set with secret_token verification enabled.'
        : 'Webhook set (no secret available).'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Test Meta CAPI
app.post('/api/admin/test-meta', async (req, res) => {
  try {
    const saved = db.getSettings();
    const body = req.body || {};

    // Blank field => fall back to the credential already stored server-side.
    const pixelId = String(body.pixelId || '').trim() || saved.metaPixelId;
    const capiToken = String(body.capiToken || '').trim() || saved.metaCapiToken;
    const testEventCode = String(body.testEventCode || '').trim() || saved.metaTestEventCode;

    const result = await metaCapiService.testConnection(pixelId, capiToken, testEventCode);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 1-Click Simulator
app.post('/api/admin/simulate-lead', async (req, res) => {
  try {
    const settings = db.getSettings();
    const sessionId = 'sim_' + Date.now().toString(36);
    const mockUser = {
      id: Math.floor(100000000 + Math.random() * 900000000),
      first_name: req.body.name || 'Rahul Sharma',
      username: req.body.username || 'rahul_trader'
    };
    const mockIp = '49.36.128.' + Math.floor(Math.random() * 255);
    const mockFbclid = 'fbclid_sim_' + Math.random().toString(36).substr(2, 12);
    const mockCampaign = req.body.campaign || 'Meta_VIP_Trading_Set_1';

    // 1. Link Generated
    const linkEv = db.addEvent({
      type: 'LINK_GENERATED',
      sessionId,
      inviteLink: `https://t.me/+simLink${Date.now()}`,
      ip: mockIp,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      fbclid: mockFbclid,
      utm: { source: 'facebook_ads', campaign: mockCampaign }
    });

    // 2. Join Request
    const joinEv = db.addEvent({
      type: 'JOIN_REQUEST',
      sessionId,
      inviteLink: `https://t.me/+simLink${Date.now()}`,
      telegramUser: mockUser,
      ip: mockIp,
      userAgent: 'Telegram-iOS/10.0',
      fbclid: mockFbclid,
      utm: { source: 'facebook_ads', campaign: mockCampaign }
    });

    // 3. Pixel Fired
    let capiResult = { success: true, simulated: true };
    if (settings.metaPixelId && settings.metaCapiToken) {
      capiResult = await metaCapiService.fireEvent({
        pixelId: settings.metaPixelId,
        capiToken: settings.metaCapiToken,
        eventName: settings.metaEventName || 'Lead',
        testEventCode: settings.metaTestEventCode,
        eventSourceUrl: `${settings.publicUrl}/?ref=${sessionId}`,
        ip: mockIp,
        userAgent: 'Telegram-iOS/10.0',
        fbclid: mockFbclid,
        externalId: mockUser.id.toString(),
        customData: {
          simulated: true,
          campaign: mockCampaign
        }
      });
    }

    const pixelEv = db.addEvent({
      type: 'PIXEL_FIRED',
      sessionId,
      metaResponse: capiResult,
      status: capiResult.success ? 'SUCCESS' : 'FAILED',
      ip: mockIp,
      fbclid: mockFbclid,
      telegramUser: mockUser
    });

    // 4. Approved
    const approvedEv = db.addEvent({
      type: 'MEMBER_APPROVED',
      sessionId,
      telegramUser: mockUser
    });

    const currentStats = analyticsService.getDashboardStats();
    broadcastLiveUpdate({ type: 'EVENT_ADDED', event: approvedEv, stats: currentStats });

    res.json({
      success: true,
      message: 'Simulation completed! 1 Real Lead & CAPI Hit logged.',
      stats: currentStats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CSV Export for Excel
app.get('/api/admin/export-csv', (req, res) => {
  const events = db.getEvents(5000);
  let csv = 'ID,Type,Timestamp,Telegram User,Telegram ID,IP,FBCLID,Campaign\n';
  events.forEach(e => {
    const u = e.telegramUser || {};
    const user = (u.firstName || '').replace(/,/g, ' ');
    const uid = u.id || '';
    const ip = e.ip || '';
    const fb = e.fbclid || '';
    const camp = e.utm?.campaign || '';
    csv += `"${e.id}","${e.type}","${e.timestamp}","${user}","${uid}","${ip}","${fb}","${camp}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="0_fake_click_leads.csv"');
  res.send(csv);
});

// Clear Data
app.post('/api/admin/clear-data', (req, res) => {
  db.clearAllData();
  const freshStats = analyticsService.getDashboardStats();
  broadcastLiveUpdate({ type: 'DATA_CLEARED', stats: freshStats });
  res.json({ success: true, stats: freshStats });
});

// Serve Frontend
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 0-Fake-Click Meta -> Telegram System Running!`);
  console.log(`📱 Public Landing Page: http://localhost:${PORT}`);
  console.log(`📊 Analytics Dashboard: http://localhost:${PORT}/admin`);
  console.log(`⚡ Telegram Webhook:   http://localhost:${PORT}/api/telegram-webhook`);
  console.log(`====================================================`);
});
