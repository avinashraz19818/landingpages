// 0-Fake-Click Client Tracking & Redirection Engine (Ultra-Pro Edition)

(function () {
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function setCookie(name, value, days = 90) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const fbclid = urlParams.get('fbclid') || '';
  const utmSource = urlParams.get('utm_source') || '';
  const utmCampaign = urlParams.get('utm_campaign') || '';
  const utmMedium = urlParams.get('utm_medium') || '';

  // Meta cookies attribution
  let fbc = getCookie('_fbc');
  if (fbclid && !fbc) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
    setCookie('_fbc', fbc);
  }

  let fbp = getCookie('_fbp');
  if (!fbp) {
    fbp = `fb.1.${Date.now()}.${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    setCookie('_fbp', fbp);
  }

  let currentConfig = null;
  let countdownTimer = null;
  let circleTimer = null;
  let timeLeft = 2;
  let circleSeconds = 58;
  let isPaused = false;
  let isRedirecting = false;

  // DOM Elements
  const channelTitleEl = document.getElementById('channelTitle');
  const channelSubtitleEl = document.getElementById('channelSubtitle');
  const membersTextEl = document.getElementById('membersText');
  const channelDescEl = document.getElementById('channelDesc');
  const avatarImgEl = document.getElementById('avatarImg');
  const topPillEl = document.getElementById('topPill');
  const topPillTextEl = document.getElementById('topPillText');
  const hudCornerTLEl = document.getElementById('hudCornerTL');
  const hudCornerBREl = document.getElementById('hudCornerBR');
  const tacticalCrosshairEl = document.getElementById('tacticalCrosshair');
  const orbitRadarEl = document.getElementById('orbitRadar');
  const circleCountdownBadgeEl = document.getElementById('circleCountdownBadge');
  const verifiedBadgeEl = document.getElementById('verifiedBadge');
  
  const tacticalBtnWrapper = document.getElementById('tacticalBtnWrapper');
  const btnJoinTelegram = document.getElementById('btnJoinTelegram');
  const btnTextEl = document.getElementById('btnText');
  const btnSubtextEl = document.getElementById('btnSubtext');
  
  const dualButtonsWrapper = document.getElementById('dualButtonsWrapper');
  const btnDualPink = document.getElementById('btnDualPink');
  const btnDualOrange = document.getElementById('btnDualOrange');
  const dualBtn1Text = document.getElementById('dualBtn1Text');
  const dualBtn2Text = document.getElementById('dualBtn2Text');
  
  const statsBoxesGrid = document.getElementById('statsBoxesGrid');
  const stat1TopEl = document.getElementById('stat1Top');
  const stat1BottomEl = document.getElementById('stat1Bottom');
  const stat2TopEl = document.getElementById('stat2Top');
  const stat2BottomEl = document.getElementById('stat2Bottom');
  const stat3TopEl = document.getElementById('stat3Top');
  const stat3BottomEl = document.getElementById('stat3Bottom');

  const countdownBox = document.getElementById('countdownBox');
  const countdownLabel = document.getElementById('countdownLabel');
  const btnPauseTimer = document.getElementById('btnPauseTimer');
  const brandingTextEl = document.getElementById('brandingText');

  async function loadConfig() {
    try {
      const res = await fetch('/api/page-config');
      const data = await res.json();
      if (data.success) {
        currentConfig = data.config;
        applyConfig(currentConfig);
      }
    } catch (e) {
      console.warn('Config load fallback:', e);
    }
  }

  function applyConfig(cfg) {
    const activeTheme = urlParams.get('theme') || cfg.theme || 'tactical-lime';
    document.body.className = `theme-${activeTheme}`;

    // Title & Highlight logic
    const rawTitle = urlParams.get('title') || cfg.pageTitle || 'SURESHOT BY REE';
    const highlightWord = urlParams.get('highlight') || cfg.titleHighlight || '';
    if (highlightWord && rawTitle.includes(highlightWord)) {
      const parts = rawTitle.split(highlightWord);
      channelTitleEl.innerHTML = `${parts[0]}<span class="title-highlight">${highlightWord}</span>${parts[1] || ''}`;
    } else {
      channelTitleEl.textContent = rawTitle;
    }

    if (cfg.subText) channelSubtitleEl.textContent = cfg.subText;
    if (cfg.topPillText) topPillTextEl.textContent = cfg.topPillText;
    if (cfg.membersCount) membersTextEl.textContent = `${cfg.membersCount} ${cfg.badgeText || 'Members'}`;
    if (cfg.description) channelDescEl.textContent = cfg.description;
    if (cfg.buttonText) btnTextEl.textContent = cfg.buttonText;
    if (cfg.buttonSubtext) btnSubtextEl.textContent = cfg.buttonSubtext;
    if (cfg.avatarUrl) avatarImgEl.src = cfg.avatarUrl;
    if (cfg.brandingText) brandingTextEl.textContent = cfg.brandingText;

    // HUD & Crosshair
    if (activeTheme === 'ree-army') {
      tacticalCrosshairEl.style.display = 'none';
      orbitRadarEl.style.display = 'block';
    } else if (cfg.enableRadarCrosshair === false) {
      tacticalCrosshairEl.style.display = 'none';
      orbitRadarEl.style.display = 'none';
    }

    if (cfg.enableCornerBrackets === false || activeTheme === 'clean-glass') {
      hudCornerTLEl.style.display = 'none';
      hudCornerBREl.style.display = 'none';
    }

    // Live Circle Countdown Badge on Avatar
    if (cfg.enableCircleCountdownBadge !== false && !urlParams.get('no_badge')) {
      circleCountdownBadgeEl.style.display = 'flex';
      circleSeconds = parseInt(cfg.circleCountdownNumber) || 58;
      startCircleCountdown();
    } else {
      circleCountdownBadgeEl.style.display = 'none';
    }

    // Dual Buttons vs Single Tactical Button
    const showDual = urlParams.get('dual') === '1' || cfg.enableDualButtons === true || activeTheme === 'ree-army';
    if (showDual) {
      tacticalBtnWrapper.style.display = 'none';
      dualButtonsWrapper.style.display = 'flex';
      if (cfg.buttonText) dualBtn1Text.textContent = cfg.buttonText;
      if (cfg.secondButtonText) dualBtn2Text.textContent = cfg.secondButtonText;
    } else {
      tacticalBtnWrapper.style.display = 'block';
      dualButtonsWrapper.style.display = 'none';
    }

    // 3-Box Stats
    if (cfg.stat1Top) stat1TopEl.textContent = cfg.stat1Top;
    if (cfg.stat1Bottom) stat1BottomEl.textContent = cfg.stat1Bottom;
    if (cfg.stat2Top) stat2TopEl.textContent = cfg.stat2Top;
    if (cfg.stat2Bottom) stat2BottomEl.textContent = cfg.stat2Bottom;
    if (cfg.stat3Top) stat3TopEl.textContent = cfg.stat3Top;
    if (cfg.stat3Bottom) stat3BottomEl.textContent = cfg.stat3Bottom;

    // Meta Pixel PageView only (NEVER Lead on click!)
    if (cfg.metaPixelId && window.fbq) {
      try {
        window.fbq('init', cfg.metaPixelId);
        window.fbq('track', 'PageView');
      } catch (err) {
        console.warn('Pixel init warning:', err);
      }
    }

    // Auto Countdown
    if (cfg.enableCountdown && !urlParams.get('no_timer')) {
      timeLeft = parseInt(cfg.countdownSeconds) || 2;
      startCountdown(cfg);
    } else {
      countdownBox.style.display = 'none';
    }
  }

  function startCircleCountdown() {
    circleCountdownBadgeEl.textContent = circleSeconds;
    circleTimer = setInterval(() => {
      circleSeconds--;
      if (circleSeconds <= 0) {
        circleSeconds = 60;
      }
      circleCountdownBadgeEl.textContent = circleSeconds;
    }, 1000);
  }

  function startCountdown(cfg) {
    countdownBox.style.display = 'flex';
    updateCountdownText(cfg);

    btnPauseTimer.onclick = () => {
      isPaused = !isPaused;
      if (isPaused) {
        btnPauseTimer.textContent = 'Chalu / Resume';
        btnPauseTimer.style.background = '#22c55e';
      } else {
        btnPauseTimer.textContent = cfg.pauseButtonText || 'Ruko / Pause';
        btnPauseTimer.style.background = '';
      }
    };

    countdownTimer = setInterval(() => {
      if (isPaused || isRedirecting) return;
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(countdownTimer);
        countdownLabel.textContent = 'Opening Telegram...';
        handleJoinAction();
      } else {
        updateCountdownText(cfg);
      }
    }, 1000);
  }

  function updateCountdownText(cfg) {
    const template = cfg.countdownText || 'Telegram khul raha hai {s}s mein...';
    countdownLabel.textContent = template.replace('{s}', timeLeft);
  }

  async function handleJoinAction() {
    if (isRedirecting) return;
    isRedirecting = true;
    if (countdownTimer) clearInterval(countdownTimer);

    // Haptic vibration feedback for mobile users
    if (navigator.vibrate) {
      try { navigator.vibrate(40); } catch(e) {}
    }

    btnTextEl.textContent = 'OPENING TELEGRAM...';
    btnJoinTelegram.style.opacity = '0.85';
    btnJoinTelegram.style.pointerEvents = 'none';

    try {
      const response = await fetch('/api/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fbclid,
          fbc,
          fbp,
          utm: {
            source: utmSource,
            campaign: utmCampaign,
            medium: utmMedium
          }
        })
      });

      const result = await response.json();
      if (result.success && result.inviteLink) {
        const inviteUrl = result.inviteLink;
        setTimeout(() => {
          window.location.href = inviteUrl;
        }, 150);
      } else {
        window.location.href = 'https://t.me';
      }
    } catch (err) {
      console.error('Join redirect error:', err);
      window.location.href = 'https://t.me';
    }
  }

  // Bind Buttons
  btnJoinTelegram.addEventListener('click', (e) => {
    e.preventDefault();
    handleJoinAction();
  });

  if (btnDualPink) {
    btnDualPink.addEventListener('click', (e) => {
      e.preventDefault();
      handleJoinAction();
    });
  }

  if (btnDualOrange) {
    btnDualOrange.addEventListener('click', (e) => {
      e.preventDefault();
      handleJoinAction();
    });
  }

  loadConfig();
})();
