const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const db = require('./db');
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
// ADMIN & DASHBOARD APIS
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

// Settings
app.get('/api/admin/settings', (req, res) => {
  res.json({ success: true, settings: db.getSettings() });
});

// Update Settings
app.post('/api/admin/settings', (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    broadcastLiveUpdate({ type: 'SETTINGS_UPDATED', settings: updated });
    res.json({ success: true, settings: updated });
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
  broadcastLiveUpdate({ type: 'SETTINGS_UPDATED', settings: db.getSettings() });
  res.json({ success: true, avatarUrl });
});

// Test Telegram Bot
app.post('/api/admin/test-bot', async (req, res) => {
  try {
    const { token, chatId } = req.body;
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
    const { token, url } = req.body;
    const webhookUrl = `${url.trim().replace(/\/$/, '')}/api/telegram-webhook`;
    const result = await telegramService.setWebhook(token, webhookUrl);
    res.json({ success: true, result, webhookUrl });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Test Meta CAPI
app.post('/api/admin/test-meta', async (req, res) => {
  try {
    const { pixelId, capiToken, testEventCode } = req.body;
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
