// 0-Fake-Click Admin Dashboard & Control Center Script (Ultra-Pro)

const THEME_LIST = [
  { id: 'tactical-lime', name: 'Tactical Cyber Radar', tag: 'Sureshot By Ree (Lime HUD)' },
  { id: 'ree-army', name: 'Dual Button VIP Radar', tag: 'Ree Army (Dual Stack)' },
  { id: 'emerald-gold', name: 'Emerald Forest & Sun Gold', tag: 'Jatin K (Green & Gold)' },
  { id: 'cyber-red', name: 'Cyberpunk Neon Red', tag: 'Ashu Bamane (Red Glow)' },
  { id: 'blue-grid', name: 'Electric Cyan RGB Grid', tag: 'Asla Bhai (RGB Matrix)' },
  { id: 'purple-luxury', name: 'Royal Purple Velvet', tag: 'The Lal Bhai (Magenta)' },
  { id: 'clean-glass', name: 'Frosted Glass White', tag: 'Alone Souvik (Apple Clean)' },
  { id: 'matrix-hacker', name: 'Matrix Terminal Green', tag: 'Terminal Hacker Green' },
  { id: 'crypto-gold', name: 'Binance Gold VIP', tag: 'Crypto Gold & Black' },
  { id: 'hyper-sunset', name: 'Miami Synthwave Sunset', tag: 'Pink & Orange Neon' },
  { id: 'midnight-stealth', name: 'Stealth Carbon VIP', tag: 'Minimalist Platinum' },
  { id: 'fire-phoenix', name: 'Blazing Phoenix Fire', tag: 'Molten Lava Flame' }
];

function renderThemeGallery(activeTheme) {
  const container = document.getElementById('themeGalleryGrid');
  if (!container) return;

  container.innerHTML = THEME_LIST.map(t => {
    const isActive = t.id === activeTheme;
    return `
      <div class="theme-card-item ${isActive ? 'active' : ''}" id="themeCard_${t.id}" onclick="selectTheme('${t.id}')">
        <span class="theme-selected-badge"><i class="fa-solid fa-check"></i> ACTIVE</span>
        <img src="/previews/${t.id}.svg" alt="${t.name}" class="theme-card-img" onerror="this.src='/uploads/default-avatar.svg'">
        <div class="theme-card-info">
          <div class="theme-card-title">${t.name}</div>
          <div class="theme-card-tag">${t.tag}</div>
        </div>
      </div>
    `;
  }).join('');
}

function selectTheme(themeId) {
  document.querySelectorAll('.theme-card-item').forEach(card => card.classList.remove('active'));
  const targetCard = document.getElementById(`themeCard_${themeId}`);
  if (targetCard) targetCard.classList.add('active');

  const select = document.getElementById('custTheme');
  if (select) select.value = themeId;

  // Auto configure dual buttons for ree-army theme
  const dualSelect = document.getElementById('custDualButtons');
  if (themeId === 'ree-army' && dualSelect) {
    dualSelect.value = 'true';
  }

  updateLivePreview();
}

function onThemeSelectChange() {
  const theme = document.getElementById('custTheme').value;
  selectTheme(theme);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');

  const content = document.getElementById(`tab-${tabId}`);
  if (content) content.classList.add('active');

  if (tabId === 'customizer') {
    const iframe = document.getElementById('previewIframe');
    if (iframe) iframe.src = '/?no_timer=1&t=' + Date.now();
  }
}

function fmt(num) {
  return Number(num || 0).toLocaleString();
}

// Chart.js init & update
function updateHourlyChart(points) {
  const ctx = document.getElementById('hourlyChart');
  if (!ctx) return;

  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const dataPoints = points || Array(24).fill(0);

  if (hourlyChartInstance) {
    hourlyChartInstance.data.datasets[0].data = dataPoints;
    hourlyChartInstance.update();
  } else {
    hourlyChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Leads / Clicks Activity',
          data: dataPoints,
          borderColor: '#ccff00',
          backgroundColor: 'rgba(204, 255, 0, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#ccff00',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { size: 10 } }
          }
        }
      }
    });
  }
}

// Render Metrics on Dashboard
function renderStats(stats) {
  if (!stats) return;

  document.getElementById('todayDateLabel').textContent = stats.todayDate || 'Today';
  document.getElementById('yesterdayDateLabel').textContent = stats.yesterdayDate || 'Yesterday';

  // Today
  document.getElementById('todayJoinRequests').textContent = fmt(stats.today.joinRequests);
  document.getElementById('todayPixelHits').textContent = fmt(stats.today.pixelHits);
  document.getElementById('todayLinksGen').textContent = fmt(stats.today.linksGenerated);
  document.getElementById('todayApproved').textContent = fmt(stats.today.approvedMembers);

  // Yesterday
  document.getElementById('yesterdayJoinRequests').textContent = fmt(stats.yesterday.joinRequests);
  document.getElementById('yesterdayPixelHits').textContent = fmt(stats.yesterday.pixelHits);
  document.getElementById('yesterdayLinksGen').textContent = fmt(stats.yesterday.linksGenerated);
  document.getElementById('yesterdayApproved').textContent = fmt(stats.yesterday.approvedMembers);

  // Lifetime
  document.getElementById('lifetimeRequests').textContent = fmt(stats.lifetime.totalRequests);
  document.getElementById('lifetimePixelFired').textContent = fmt(stats.lifetime.totalPixelFired);
  document.getElementById('lifetimeLinks').textContent = fmt(stats.lifetime.totalLinks);
  document.getElementById('lifetimeApproved').textContent = fmt(stats.lifetime.totalApproved);

  // Daily Table
  const tbody = document.getElementById('dailyBreakdownBody');
  if (stats.dailyBreakdown && stats.dailyBreakdown.length > 0) {
    tbody.innerHTML = stats.dailyBreakdown.map(day => {
      const accuracy = day.joinRequests > 0 
        ? ((day.pixelHits / day.joinRequests) * 100).toFixed(0) + '%'
        : '100%';
      return `
        <tr>
          <td><strong>${day.displayDate}</strong></td>
          <td style="color: #38bdf8; font-weight: 700;">${fmt(day.linksGenerated)}</td>
          <td style="color: #34d399; font-weight: 700;">${fmt(day.joinRequests)}</td>
          <td style="color: #d8b4fe; font-weight: 700;">${fmt(day.pixelHits)}</td>
          <td style="color: #ccff00; font-weight: 700;">${fmt(day.approvedMembers)}</td>
          <td><span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-weight: 700;">${accuracy} Verified</span></td>
        </tr>
      `;
    }).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">No daily data yet.</td></tr>`;
  }

  // Campaign Breakdown Table
  const campBody = document.getElementById('campaignBreakdownBody');
  if (campBody && stats.campaignBreakdown && stats.campaignBreakdown.length > 0) {
    campBody.innerHTML = stats.campaignBreakdown.map(c => {
      const rate = c.clicks > 0 ? ((c.leads / c.clicks) * 100).toFixed(1) + '%' : '0%';
      return `
        <tr>
          <td><strong style="color:#38bdf8">${c.campaign}</strong></td>
          <td style="color:#cbd5e1; font-weight:700;">${fmt(c.clicks)}</td>
          <td style="color:#34d399; font-weight:700;">${fmt(c.leads)}</td>
          <td style="color:#d8b4fe; font-weight:700;">${fmt(c.pixelFired)}</td>
          <td><span style="background: rgba(204, 255, 0, 0.15); color: #ccff00; padding: 2px 8px; border-radius: 4px; font-weight: 800;">${rate}</span></td>
        </tr>
      `;
    }).join('');
  }

  // Update Chart
  if (stats.hourlyPoints) {
    updateHourlyChart(stats.hourlyPoints);
  }

  // Recent Events
  if (stats.recentEvents) {
    renderRecentEvents(stats.recentEvents);
  }
}

function renderRecentEvents(events) {
  const feedList = document.getElementById('liveFeedList');
  if (!events || events.length === 0) {
    feedList.innerHTML = `<div style="color: #64748b; text-align: center; padding: 30px;">No events recorded yet.</div>`;
    return;
  }

  feedList.innerHTML = events.map(ev => {
    const timeStr = new Date(ev.timestamp).toLocaleTimeString();
    let detail = '';
    
    if (ev.type === 'LINK_GENERATED') {
      detail = `Generated link: <code style="color:#38bdf8">${ev.inviteLink || 'Direct link'}</code> | IP: ${ev.ip}`;
    } else if (ev.type === 'JOIN_REQUEST') {
      const u = ev.telegramUser || {};
      detail = `User <strong style="color:#34d399">${u.firstName || 'Telegram User'}</strong> (@${u.username || u.id}) requested to join!`;
    } else if (ev.type === 'PIXEL_FIRED') {
      const u = ev.telegramUser || {};
      const status = ev.status === 'SUCCESS' ? '<span style="color:#22c55e">✓ Meta 200 OK</span>' : '<span style="color:#ef4444">Failed</span>';
      detail = `Meta CAPI fired Lead for user ${u.firstName || ''} | Status: ${status}`;
    } else if (ev.type === 'MEMBER_APPROVED') {
      const u = ev.telegramUser || {};
      detail = `Bot Auto-Approved user ${u.firstName || ''}`;
    }

    return `
      <div class="event-item">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="event-type-badge badge-${ev.type}">${ev.type.replace('_', ' ')}</span>
          <span>${detail}</span>
        </div>
        <div style="color: #64748b; font-family: monospace; font-size: 11.5px; white-space: nowrap;">${timeStr}</div>
      </div>
    `;
  }).join('');
}

function prependRealtimeEvent(ev) {
  const feedList = document.getElementById('liveFeedList');
  const timeStr = new Date(ev.timestamp).toLocaleTimeString();
  let detail = '';
  
  if (ev.type === 'LINK_GENERATED') {
    detail = `Generated link: <code style="color:#38bdf8">${ev.inviteLink || 'Direct link'}</code> | IP: ${ev.ip}`;
  } else if (ev.type === 'JOIN_REQUEST') {
    const u = ev.telegramUser || {};
    detail = `User <strong style="color:#34d399">${u.firstName || 'Telegram User'}</strong> (@${u.username || u.id}) requested to join!`;
  } else if (ev.type === 'PIXEL_FIRED') {
    const u = ev.telegramUser || {};
    const status = ev.status === 'SUCCESS' ? '<span style="color:#22c55e">✓ Meta 200 OK</span>' : '<span style="color:#ef4444">Failed</span>';
    detail = `Meta CAPI fired Lead for user ${u.firstName || ''} | Status: ${status}`;
  } else if (ev.type === 'MEMBER_APPROVED') {
    const u = ev.telegramUser || {};
    detail = `Bot Auto-Approved user ${u.firstName || ''}`;
  }

  const div = document.createElement('div');
  div.className = 'event-item';
  div.style.animation = 'blink 0.5s ease 2';
  div.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span class="event-type-badge badge-${ev.type}">${ev.type.replace('_', ' ')}</span>
      <span>${detail}</span>
    </div>
    <div style="color: #64748b; font-family: monospace; font-size: 11.5px; white-space: nowrap;">${timeStr}</div>
  `;
  feedList.insertBefore(div, feedList.firstChild);
}

function initRealtimeStream() {
  const eventSource = new EventSource('/api/admin/events-stream');
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.stats) renderStats(data.stats);
      if (data.event) prependRealtimeEvent(data.event);
    } catch (e) {
      console.warn('SSE parse error:', e);
    }
  };
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    if (data.success) renderStats(data.stats);
  } catch (e) {
    console.error('Error fetching stats:', e);
  }
}

async function loadSettings() {
  try {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    if (data.success) {
      currentSettings = data.settings;
      populateSettingsForm(data.settings);
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }
}

/**
 * Secrets are never sent to the browser — only a masked preview.
 * So the input stays EMPTY and the placeholder shows what is saved.
 * Leaving it blank on save means "keep the existing value".
 */
function setSecretField(inputId, secretInfo, label) {
  const el = document.getElementById(inputId);
  if (!el) return;

  el.value = '';
  if (secretInfo && secretInfo.set) {
    el.placeholder = `${label} saved ✓  ${secretInfo.masked || ''}  — badalna ho to naya value likho, warna khali chhodo`;
    el.title = 'Saved. Blank = keep existing.';
  } else {
    el.placeholder = `${label} abhi set nahi hai — yahan likho`;
    el.title = '';
  }
}

function populateSettingsForm(s) {
  const sec = s.secrets || {};

  setSecretField('inputBotToken', sec.telegramBotToken, 'Bot token');
  document.getElementById('inputChatId').value = s.telegramChatId || '';
  document.getElementById('selectAutoApprove').value = String(s.autoApprove !== false);
  document.getElementById('inputPublicUrl').value = s.publicUrl || window.location.origin;

  document.getElementById('inputMetaPixelId').value = s.metaPixelId || '';
  setSecretField('inputMetaCapiToken', sec.metaCapiToken, 'CAPI token');
  setSecretField('inputTestEventCode', sec.metaTestEventCode, 'Test code');
  document.getElementById('selectMetaEventName').value = s.metaEventName || 'Lead';

  // Customizer tab
  document.getElementById('custTheme').value = s.theme || 'tactical-lime';
  renderThemeGallery(s.theme || 'tactical-lime');
  document.getElementById('custTitle').value = s.pageTitle || '';
  document.getElementById('custHighlight').value = s.titleHighlight || '';
  document.getElementById('custTopPill').value = s.topPillText || '';
  document.getElementById('custDualButtons').value = String(s.enableDualButtons === true);
  document.getElementById('custMembers').value = s.membersCount || '';
  document.getElementById('custDesc').value = s.description || '';
  document.getElementById('custBtnText').value = s.buttonText || '';
  document.getElementById('custBranding').value = s.brandingText || '';
}

async function saveAllSettings() {
  const val = id => (document.getElementById(id)?.value || '').trim();

  const payload = {
    telegramChatId: val('inputChatId'),
    autoApprove: document.getElementById('selectAutoApprove').value === 'true',
    publicUrl: val('inputPublicUrl'),
    metaPixelId: val('inputMetaPixelId'),
    metaEventName: document.getElementById('selectMetaEventName').value
  };

  // Secrets: only send when the admin actually typed something.
  // A blank field means "keep the value already stored on the server".
  const secretMap = {
    telegramBotToken: 'inputBotToken',
    metaCapiToken: 'inputMetaCapiToken',
    metaTestEventCode: 'inputTestEventCode'
  };
  Object.entries(secretMap).forEach(([field, elId]) => {
    const v = val(elId);
    if (v) payload[field] = v;
  });

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert('✓ Settings saved successfully!');
      // Refresh so masked placeholders reflect what is now stored
      currentSettings = data.settings;
      populateSettingsForm(data.settings);
    } else {
      alert('Save failed: ' + (data.error || 'unknown error'));
    }
  } catch (err) {
    alert('Failed to save settings: ' + err.message);
  }
}

async function saveCustomizerSettings() {
  const payload = {
    theme: document.getElementById('custTheme').value,
    pageTitle: document.getElementById('custTitle').value.trim(),
    titleHighlight: document.getElementById('custHighlight').value.trim(),
    topPillText: document.getElementById('custTopPill').value.trim(),
    enableDualButtons: document.getElementById('custDualButtons').value === 'true',
    membersCount: document.getElementById('custMembers').value.trim(),
    description: document.getElementById('custDesc').value.trim(),
    buttonText: document.getElementById('custBtnText').value.trim(),
    brandingText: document.getElementById('custBranding').value.trim()
  };

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert('✓ Landing page design updated and published!');
      updateLivePreview();
    }
  } catch (err) {
    alert('Failed to save customizer settings: ' + err.message);
  }
}

function updateLivePreview() {
  const theme = document.getElementById('custTheme').value;
  const title = encodeURIComponent(document.getElementById('custTitle').value);
  const highlight = encodeURIComponent(document.getElementById('custHighlight').value);
  const dual = document.getElementById('custDualButtons').value === 'true' ? '1' : '0';
  const iframe = document.getElementById('previewIframe');
  if (iframe) {
    iframe.src = `/?theme=${theme}&title=${title}&highlight=${highlight}&dual=${dual}&no_timer=1&t=${Date.now()}`;
  }
}

async function uploadAvatar() {
  const fileInput = document.getElementById('avatarFileInput');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Please select an image file first.');
    return;
  }
  const formData = new FormData();
  formData.append('avatar', fileInput.files[0]);

  try {
    const res = await fetch('/api/admin/upload-avatar', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      alert('✓ Avatar uploaded successfully!');
      updateLivePreview();
    }
  } catch (e) {
    alert('Upload failed: ' + e.message);
  }
}

/** Is a secret either typed in the form or already stored on the server? */
function secretAvailable(fieldKey, inputId) {
  const typed = (document.getElementById(inputId)?.value || '').trim();
  if (typed) return true;
  return Boolean(currentSettings?.secrets?.[fieldKey]?.set);
}

async function testBotConnection() {
  const token = document.getElementById('inputBotToken').value.trim();
  const chatId = document.getElementById('inputChatId').value.trim();
  const resDiv = document.getElementById('botTestResult');

  // Blank is fine now — the server falls back to the saved token.
  if (!token && !secretAvailable('telegramBotToken', 'inputBotToken')) {
    alert('Pehle Telegram Bot Token daal kar Settings save karo.');
    return;
  }
  resDiv.innerHTML = '<span style="color: #38bdf8;">Testing connection...</span>';
  try {
    const res = await fetch('/api/admin/test-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chatId })
    });
    const data = await res.json();
    if (data.success) {
      let msg = `<span style="color: #22c55e;">✓ Bot Connected: <strong>@${data.bot.username}</strong></span>`;
      if (data.chat) msg += `<br><span style="color: #22c55e;">✓ Channel Found: <strong>${data.chat.title}</strong></span>`;
      resDiv.innerHTML = msg;
    } else {
      resDiv.innerHTML = `<span style="color: #ef4444;">✗ Bot Error: ${data.error}</span>`;
    }
  } catch (e) {
    resDiv.innerHTML = `<span style="color: #ef4444;">✗ Connection failed: ${e.message}</span>`;
  }
}

async function setupWebhook() {
  const token = document.getElementById('inputBotToken').value.trim();
  const url = document.getElementById('inputPublicUrl').value.trim();
  const resDiv = document.getElementById('botTestResult');

  if (!token && !secretAvailable('telegramBotToken', 'inputBotToken')) {
    alert('Bot Token saved nahi hai. Pehle token daal kar Settings save karo.');
    return;
  }
  if (!url) {
    alert('Public URL zaroori hai (jaise https://yourdomain.com)');
    return;
  }
  resDiv.innerHTML = '<span style="color: #38bdf8;">Setting webhook...</span>';
  try {
    const res = await fetch('/api/admin/set-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, url })
    });
    const data = await res.json();
    if (data.success) {
      resDiv.innerHTML = `<span style="color: #22c55e;">✓ Webhook set to: <code>${data.webhookUrl}</code></span>`;
    } else {
      resDiv.innerHTML = `<span style="color: #ef4444;">✗ Error: ${data.error}</span>`;
    }
  } catch (e) {
    resDiv.innerHTML = `<span style="color: #ef4444;">✗ Failed: ${e.message}</span>`;
  }
}

async function testMetaCapi() {
  const pixelId = document.getElementById('inputMetaPixelId').value.trim();
  const capiToken = document.getElementById('inputMetaCapiToken').value.trim();
  const testEventCode = document.getElementById('inputTestEventCode').value.trim();
  const resDiv = document.getElementById('metaTestResult');

  // Blank CAPI token is fine — the server falls back to the saved one.
  if (!pixelId) {
    alert('Meta Pixel ID zaroori hai.');
    return;
  }
  if (!capiToken && !secretAvailable('metaCapiToken', 'inputMetaCapiToken')) {
    alert('CAPI Access Token saved nahi hai. Pehle token daal kar Settings save karo.');
    return;
  }
  resDiv.innerHTML = '<span style="color: #38bdf8;">Firing test event to Meta...</span>';
  try {
    const res = await fetch('/api/admin/test-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pixelId, capiToken, testEventCode })
    });
    const data = await res.json();
    if (data.success) {
      resDiv.innerHTML = `<span style="color: #22c55e;">✓ Meta CAPI Success! Events Received: ${data.events_received}. Trace ID: <code>${data.fbtrace_id}</code></span>`;
    } else {
      resDiv.innerHTML = `<span style="color: #ef4444;">✗ Meta CAPI Error: ${JSON.stringify(data.error)}</span>`;
    }
  } catch (e) {
    resDiv.innerHTML = `<span style="color: #ef4444;">✗ Request failed: ${e.message}</span>`;
  }
}

async function runSimulation() {
  const name = document.getElementById('simName').value.trim();
  const username = document.getElementById('simUsername').value.trim();
  const campaign = document.getElementById('simCampaign').value.trim();
  const resDiv = document.getElementById('simResult');

  resDiv.innerHTML = '<span style="color: #ccff00;">Running simulation through all stages...</span>';
  try {
    const res = await fetch('/api/admin/simulate-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, campaign })
    });
    const data = await res.json();
    if (data.success) {
      resDiv.innerHTML = `<span style="color: #22c55e;">✓ ${data.message} Check Analytics or Live Stream!</span>`;
      renderStats(data.stats);
    } else {
      resDiv.innerHTML = `<span style="color: #ef4444;">✗ Simulation error: ${data.error}</span>`;
    }
  } catch (e) {
    resDiv.innerHTML = `<span style="color: #ef4444;">✗ Failed: ${e.message}</span>`;
  }
}

async function clearAllData() {
  if (!confirm('Are you sure you want to reset all analytics and event logs?')) return;
  try {
    const res = await fetch('/api/admin/clear-data', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      renderStats(data.stats);
      alert('✓ Data reset successfully!');
    }
  } catch (e) {
    alert('Failed to reset data: ' + e.message);
  }
}

// =====================================================================
// AUTH GATE
// Every /api/admin/* endpoint now requires a valid httpOnly session
// cookie. This block shows a login screen until /api/admin/status
// confirms the session, and re-shows it if any call comes back 401.
// =====================================================================

let dashboardBooted = false;

function showLoginOverlay(message) {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  if (message) {
    const err = document.getElementById('loginError');
    err.textContent = message;
    err.style.display = 'block';
  }
  const input = document.getElementById('loginPassword');
  if (input) input.focus();
}

function hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'none';
  const err = document.getElementById('loginError');
  if (err) { err.textContent = ''; err.style.display = 'none'; }
}

/** Thin fetch interceptor: a 401 anywhere bounces the user back to login. */
const nativeFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const res = await nativeFetch(...args);
  const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
  if (res.status === 401 && !url.includes('/api/admin/login')) {
    dashboardBooted = false;
    showLoginOverlay('Session expire ho gaya. Dobara login karo.');
  }
  return res;
};

async function handleLogin(event) {
  event.preventDefault();

  const btn = document.getElementById('loginBtn');
  const errBox = document.getElementById('loginError');
  const password = document.getElementById('loginPassword').value;

  errBox.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

  try {
    const res = await nativeFetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('loginPassword').value = '';
      hideLoginOverlay();
      bootDashboard();
    } else {
      errBox.textContent = data.error || 'Login failed.';
      errBox.style.display = 'block';
    }
  } catch (e) {
    errBox.textContent = 'Server se connect nahi ho paya: ' + e.message;
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
  }

  return false;
}

async function logout() {
  if (!confirm('Logout karna hai?')) return;
  try { await nativeFetch('/api/admin/logout', { method: 'POST' }); } catch (e) {}
  dashboardBooted = false;
  showLoginOverlay();
}

/** Boot the dashboard only once per session. */
function bootDashboard() {
  if (dashboardBooted) return;
  dashboardBooted = true;
  loadStats();
  loadSettings();
  initRealtimeStream();
}

async function checkAuthAndBoot() {
  try {
    const res = await nativeFetch('/api/admin/status');
    const data = await res.json();

    const warn = document.getElementById('loginDefaultWarning');
    if (warn && data.usingDefaultPassword) warn.style.display = 'block';

    if (data.authenticated) {
      hideLoginOverlay();
      bootDashboard();
    } else {
      showLoginOverlay();
    }
  } catch (e) {
    showLoginOverlay('Status check fail: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuthAndBoot();
});
