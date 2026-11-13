/**
 * presenter.js
 * Carlos Ghosn MBA Decision Simulation: The Final 48 Hours: Stay or Escape?
 * Classroom Projector Dashboard Controller (1920x1080)
 */

(function () {
  'use strict';

  // State Containers
  let socket = null;
  let qrcodeInstance = null;
  let lastStats = null;
  let currentFeed = [];
  let isPollingFallbackActive = false;
  let pollingIntervalId = null;
  let activeJoinUrl = '';
  let typewriterTimeoutId = null;

  // DOM Elements
  const el = {
    // Header
    socketPulse: document.getElementById('socket-pulse'),
    connectionStatusText: document.getElementById('connection-status-text'),
    connectedCount: document.getElementById('connected-count'),
    headerInflectionBadge: document.getElementById('header-inflection-badge'),
    btnSimulate: document.getElementById('btn-simulate'),
    btnTriggerChallenge: document.getElementById('btn-trigger-challenge'),
    btnOpenRubric: document.getElementById('btn-open-rubric'),
    btnExportDropdown: document.getElementById('btn-export-dropdown'),
    exportMenu: document.getElementById('export-menu'),
    btnResetSession: document.getElementById('btn-reset-session'),
    btnOpenSettings: document.getElementById('btn-open-settings'),

    // QR & Network
    joinUrlInput: document.getElementById('join-url-input'),
    btnCopyUrl: document.getElementById('btn-copy-url'),
    btnRefreshQr: document.getElementById('btn-refresh-qr'),
    qrcodeContainer: document.getElementById('qrcode-container'),
    joinUrlLink: document.getElementById('join-url-link'),
    copyStatus: document.getElementById('copy-status'),

    // Progress Bars
    cohortCompletionBadge: document.getElementById('cohort-completion-badge'),
    l1CountsLabel: document.getElementById('l1-counts-label'),
    l1SplitStay: document.getElementById('l1-split-stay'),
    l1SplitEscape: document.getElementById('l1-split-escape'),
    l2CountsLabel: document.getElementById('l2-counts-label'),
    l2SplitStay: document.getElementById('l2-split-stay'),
    l2SplitEscape: document.getElementById('l2-split-escape'),
    l3CountsLabel: document.getElementById('l3-counts-label'),
    l3SplitStay: document.getElementById('l3-split-stay'),
    l3SplitEscape: document.getElementById('l3-split-escape'),
    l4CountsLabel: document.getElementById('l4-counts-label'),
    l4SplitStay: document.getElementById('l4-split-stay'),
    l4SplitEscape: document.getElementById('l4-split-escape'),
    l5CountsLabel: document.getElementById('l5-counts-label'),
    l5SplitStay: document.getElementById('l5-split-stay'),
    l5SplitEscape: document.getElementById('l5-split-escape'),

    // Ticker
    tickerFeed: document.getElementById('ticker-feed'),

    // KPIs
    kpiL1StayPct: document.getElementById('kpi-l1-stay-pct'),
    kpiL1StayVal: document.getElementById('kpi-l1-stay-val'),
    kpiL1EscapeVal: document.getElementById('kpi-l1-escape-val'),
    kpiL5EscapePct: document.getElementById('kpi-l5-escape-pct'),
    kpiL5StayVal: document.getElementById('kpi-l5-stay-val'),
    kpiL5EscapeVal: document.getElementById('kpi-l5-escape-val'),
    kpiDeltaNote: document.getElementById('kpi-delta-note'),
    kpiChangersCount: document.getElementById('kpi-changers-count'),
    kpiChangersPct: document.getElementById('kpi-changers-pct'),
    kpiInflectionLevel: document.getElementById('kpi-inflection-level'),
    kpiInflectionLens: document.getElementById('kpi-inflection-lens'),
    kpiInflectionNet: document.getElementById('kpi-inflection-net'),
    kpiInflectionBadge: document.getElementById('kpi-inflection-badge'),

    // Evolution Chart Columns
    colL1: document.getElementById('col-l1'),
    colL2: document.getElementById('col-l2'),
    colL3: document.getElementById('col-l3'),
    colL4: document.getElementById('col-l4'),
    colL5: document.getElementById('col-l5'),
    l2InflectionBadge: document.getElementById('l2-inflection-badge'),
    l3InflectionBadge: document.getElementById('l3-inflection-badge'),
    l4InflectionBadge: document.getElementById('l4-inflection-badge'),

    l1BarStay: document.getElementById('l1-bar-stay'),
    l1BarEscape: document.getElementById('l1-bar-escape'),
    l1BarStayLabel: document.getElementById('l1-bar-stay-label'),
    l1BarEscapeLabel: document.getElementById('l1-bar-escape-label'),
    l1FootStay: document.getElementById('l1-foot-stay'),
    l1FootEscape: document.getElementById('l1-foot-escape'),

    l2BarStay: document.getElementById('l2-bar-stay'),
    l2BarEscape: document.getElementById('l2-bar-escape'),
    l2BarStayLabel: document.getElementById('l2-bar-stay-label'),
    l2BarEscapeLabel: document.getElementById('l2-bar-escape-label'),
    l2FootStay: document.getElementById('l2-foot-stay'),
    l2FootEscape: document.getElementById('l2-foot-escape'),

    l3BarStay: document.getElementById('l3-bar-stay'),
    l3BarEscape: document.getElementById('l3-bar-escape'),
    l3BarStayLabel: document.getElementById('l3-bar-stay-label'),
    l3BarEscapeLabel: document.getElementById('l3-bar-escape-label'),
    l3FootStay: document.getElementById('l3-foot-stay'),
    l3FootEscape: document.getElementById('l3-foot-escape'),

    l4BarStay: document.getElementById('l4-bar-stay'),
    l4BarEscape: document.getElementById('l4-bar-escape'),
    l4BarStayLabel: document.getElementById('l4-bar-stay-label'),
    l4BarEscapeLabel: document.getElementById('l4-bar-escape-label'),
    l4FootStay: document.getElementById('l4-foot-stay'),
    l4FootEscape: document.getElementById('l4-foot-escape'),

    l5BarStay: document.getElementById('l5-bar-stay'),
    l5BarEscape: document.getElementById('l5-bar-escape'),
    l5BarStayLabel: document.getElementById('l5-bar-stay-label'),
    l5BarEscapeLabel: document.getElementById('l5-bar-escape-label'),
    l5FootStay: document.getElementById('l5-foot-stay'),
    l5FootEscape: document.getElementById('l5-foot-escape'),

    // AI Challenge & Defenses
    aiModelBadge: document.getElementById('ai-model-badge'),
    aiChallengeTextBox: document.getElementById('ai-challenge-text-box'),
    btnReChallenge: document.getElementById('btn-re-challenge'),
    aiStatusNote: document.getElementById('ai-status-note'),
    defensesCountBadge: document.getElementById('defenses-count-badge'),
    defensesList: document.getElementById('defenses-list'),
    rebuttalStage: document.getElementById('rebuttal-stage'),
    rebuttalTargetId: document.getElementById('rebuttal-target-id'),
    rebuttalSourceBadge: document.getElementById('rebuttal-source-badge'),
    typewriterText: document.getElementById('typewriter-text'),

    // Modals
    modalRubric: document.getElementById('modal-rubric'),
    btnCloseRubricModal: document.getElementById('btn-close-rubric-modal'),
    modalSettings: document.getElementById('modal-settings'),
    btnCloseSettingsModal: document.getElementById('btn-close-settings-modal'),
    settingsGeminiKey: document.getElementById('settings-gemini-key'),
    btnSaveKey: document.getElementById('btn-save-key'),
    btnToggleFullscreen: document.getElementById('btn-toggle-fullscreen'),
    btnTestOffline: document.getElementById('btn-test-offline'),
    settingsNetworkDebug: document.getElementById('settings-network-debug'),
    modalResetConfirm: document.getElementById('modal-reset-confirm'),
    btnCloseResetModal: document.getElementById('btn-close-reset-modal'),
    btnCancelReset: document.getElementById('btn-cancel-reset'),
    btnConfirmReset: document.getElementById('btn-confirm-reset'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  // -------------------------------------------------------------------------
  // 1. Toast Notification Utility
  // -------------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = 'ℹ️';
    if (type === 'success') {
      icon = '✅';
      toast.style.borderColor = '#10B981';
    } else if (type === 'warn') {
      icon = '⚠️';
      toast.style.borderColor = '#F59E0B';
    } else if (type === 'error') {
      icon = '❌';
      toast.style.borderColor = '#EF4444';
    }
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3500);
  }

  // -------------------------------------------------------------------------
  // 2. Real-Time Telemetry Ticker
  // -------------------------------------------------------------------------
  function addTickerItem(text, type = 'info') {
    const timeStr = new Date().toTimeString().split(' ')[0];
    const item = document.createElement('div');
    item.className = `ticker-item ${type}`;
    item.innerHTML = `
      <span class="ticker-time">${timeStr}</span>
      <span class="ticker-content">${text}</span>
    `;
    el.tickerFeed.insertBefore(item, el.tickerFeed.firstChild);

    // Keep ticker tidy
    while (el.tickerFeed.children.length > 35) {
      el.tickerFeed.removeChild(el.tickerFeed.lastChild);
    }
  }

  // -------------------------------------------------------------------------
  // 3. QR Code Generation & Network Resolution
  // -------------------------------------------------------------------------
  function renderQrCode(url) {
    if (!url || typeof url !== 'string') return;
    activeJoinUrl = url.trim();

    try {
      if (typeof QRCode !== 'undefined') {
        el.qrcodeContainer.innerHTML = '';
        qrcodeInstance = new QRCode(el.qrcodeContainer, {
          text: activeJoinUrl,
          width: 220,
          height: 220,
          colorDark: '#0B1120',
          colorLight: '#FFFFFF',
          correctLevel: QRCode.CorrectLevel.H
        });
      } else {
        // Fallback display if script fails
        el.qrcodeContainer.innerHTML = `<div style="color:#000; font-size:12px; padding:20px; text-align:center;">QR Engine Loading...<br><b>${activeJoinUrl}</b></div>`;
      }
    } catch (err) {
      console.warn('[QR] Error generating QR code:', err);
      el.qrcodeContainer.innerHTML = `<div style="color:#000; font-size:12px; padding:10px;">${activeJoinUrl}</div>`;
    }

    el.joinUrlLink.textContent = activeJoinUrl;
    el.joinUrlLink.href = activeJoinUrl;
    el.joinUrlInput.value = activeJoinUrl;
  }

  async function fetchNetworkInfo() {
    try {
      const res = await fetch('/api/network-info');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      
      const fullUrl = data.fullUrl || `http://${data.lanIp || 'localhost'}:${data.port || 3000}`;
      renderQrCode(fullUrl);

      if (el.settingsNetworkDebug) {
        el.settingsNetworkDebug.textContent = JSON.stringify(data, null, 2);
      }
      addTickerItem(`LAN Gateway connected: ${fullUrl}`, 'info');
    } catch (err) {
      console.warn('[Network] Failed to fetch LAN info, falling back to window.location:', err);
      const fallbackUrl = window.location.origin;
      renderQrCode(fallbackUrl);
    }
  }

  // -------------------------------------------------------------------------
  // 4. Typewriter Animation Helper
  // -------------------------------------------------------------------------
  function runTypewriter(text, onComplete) {
    if (typewriterTimeoutId) clearTimeout(typewriterTimeoutId);
    el.typewriterText.textContent = '';
    let i = 0;
    const speed = 20; // ms per char

    function typeNext() {
      if (i < text.length) {
        el.typewriterText.textContent += text.charAt(i);
        i++;
        typewriterTimeoutId = setTimeout(typeNext, speed);
      } else {
        if (onComplete) onComplete();
      }
    }
    typeNext();
  }

  // -------------------------------------------------------------------------
  // 5. State Renderer & KPI Engine
  // -------------------------------------------------------------------------
  function updateDashboardUI(stats, feed) {
    if (!stats) return;
    lastStats = stats;
    currentFeed = feed || currentFeed;

    const total = stats.totalStudents || 0;
    el.connectedCount.textContent = `${total} / 67`;

    // 1. Per-Level Progress Bars
    const levels = ['L1', 'L2', 'L3', 'L4', 'L5'];
    let totalVotesCast = 0;

    levels.forEach(lvl => {
      const st = stats.levelStats ? stats.levelStats[lvl] : { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 };
      totalVotesCast += (st.totalVotes || 0);

      const countLabel = el[`${lvl.toLowerCase()}CountsLabel`];
      const splitStay = el[`${lvl.toLowerCase()}SplitStay`];
      const splitEscape = el[`${lvl.toLowerCase()}SplitEscape`];

      if (countLabel) {
        countLabel.textContent = `${st.totalVotes || 0} / ${Math.max(total, 67)} (${st.stayPct}% STAY | ${st.escapePct}% ESCAPE)`;
      }
      if (splitStay) splitStay.style.width = `${st.stayPct || 0}%`;
      if (splitEscape) splitEscape.style.width = `${st.escapePct || 0}%`;
    });

    const completionRate = total > 0 ? Math.round((totalVotesCast / (total * 5)) * 100) : 0;
    el.cohortCompletionBadge.textContent = `${completionRate}% COMPLETE`;

    // 2. KPI Summary Cards
    // KPI 1: Initial Decision L1
    const l1 = stats.initialDecision || (stats.levelStats ? stats.levelStats.L1 : { stayPct: 0, escapePct: 0, stayCount: 0, escapeCount: 0 });
    el.kpiL1StayPct.textContent = `${l1.stayPct || 0}%`;
    el.kpiL1StayVal.textContent = `${l1.stayCount || 0} (${l1.stayPct || 0}%)`;
    el.kpiL1EscapeVal.textContent = `${l1.escapeCount || 0} (${l1.escapePct || 0}%)`;

    // KPI 2: Final Verdict L5
    const l5 = stats.finalVerdict || (stats.levelStats ? stats.levelStats.L5 : { stayPct: 0, escapePct: 0, stayCount: 0, escapeCount: 0 });
    el.kpiL5EscapePct.textContent = `${l5.escapePct || 0}%`;
    el.kpiL5StayVal.textContent = `${l5.stayCount || 0} (${l5.stayPct || 0}%)`;
    el.kpiL5EscapeVal.textContent = `${l5.escapeCount || 0} (${l5.escapePct || 0}%)`;

    const deltaEscape = (l5.escapePct || 0) - (l1.escapePct || 0);
    if (deltaEscape > 0) {
      el.kpiDeltaNote.innerHTML = `Cognitive Shift: <b style="color:#F87171;">+${deltaEscape}% migration to ESCAPE</b>`;
    } else if (deltaEscape < 0) {
      el.kpiDeltaNote.innerHTML = `Cognitive Shift: <b style="color:#60A5FA;">+${Math.abs(deltaEscape)}% migration to STAY</b>`;
    } else {
      el.kpiDeltaNote.textContent = 'Zero net shift across cohort';
    }

    // KPI 3: Mind-Changers
    const changers = stats.mindChangers || { count: 0, pct: 0 };
    el.kpiChangersCount.textContent = changers.count || 0;
    el.kpiChangersPct.textContent = `(${changers.pct || 0}%)`;

    // KPI 4: Primary OB Inflection Point
    const inflection = stats.primaryInflectionPoint || { level: 'L2', levelNumber: 2, netSwitch: 0, obTheory: "Adams' Equity Theory" };
    el.kpiInflectionLevel.textContent = `LEVEL ${inflection.levelNumber || 2}`;
    el.kpiInflectionLens.textContent = inflection.obTheory || "Adams' Equity Theory & Referent Comparisons";
    el.kpiInflectionNet.innerHTML = `Highest net surge: <b style="color:#F59E0B;">+${inflection.netSwitch || 0} to ESCAPE</b>`;
    el.kpiInflectionBadge.textContent = inflection.level || 'L2';
    el.headerInflectionBadge.textContent = `${inflection.level || 'L2'}: +${inflection.netSwitch || 0} ESC`;

    // Highlight Column in Evolution Chart
    ['colL2', 'colL3', 'colL4'].forEach(colName => {
      if (el[colName]) el[colName].classList.remove('highlight-inflection');
    });
    ['l2InflectionBadge', 'l3InflectionBadge', 'l4InflectionBadge'].forEach(badgeName => {
      if (el[badgeName]) el[badgeName].style.display = 'none';
    });

    const activeColKey = `col${inflection.level}`;
    const activeBadgeKey = `${inflection.level ? inflection.level.toLowerCase() : 'l2'}InflectionBadge`;
    if (el[activeColKey]) el[activeColKey].classList.add('highlight-inflection');
    if (el[activeBadgeKey]) el[activeBadgeKey].style.display = 'block';

    // 3. Live Evolution Chart Bar Heights & Labels
    levels.forEach(lvl => {
      const st = stats.levelStats ? stats.levelStats[lvl] : { stayCount: 0, escapeCount: 0, stayPct: 0, escapePct: 0 };
      const stayBar = el[`${lvl.toLowerCase()}BarStay`];
      const escBar = el[`${lvl.toLowerCase()}BarEscape`];
      const stayLabel = el[`${lvl.toLowerCase()}BarStayLabel`];
      const escLabel = el[`${lvl.toLowerCase()}BarEscapeLabel`];
      const footStay = el[`${lvl.toLowerCase()}FootStay`];
      const footEscape = el[`${lvl.toLowerCase()}FootEscape`];

      if (stayBar) stayBar.style.height = `${Math.max(4, st.stayPct)}%`;
      if (escBar) escBar.style.height = `${Math.max(4, st.escapePct)}%`;
      if (stayLabel) stayLabel.textContent = `${st.stayPct}%`;
      if (escLabel) escLabel.textContent = `${st.escapePct}%`;
      if (footStay) footStay.textContent = `${st.stayCount}`;
      if (footEscape) footEscape.textContent = `${st.escapeCount}`;
    });

    // 4. Student Defenses Feed
    renderDefensesFeed(currentFeed);
  }

  // -------------------------------------------------------------------------
  // 6. Student Defenses List & Rebuttal Trigger
  // -------------------------------------------------------------------------
  function renderDefensesFeed(feed) {
    if (!feed || !Array.isArray(feed)) return;
    el.defensesCountBadge.textContent = `${feed.length} SUBMITTED`;

    if (feed.length === 0) {
      el.defensesList.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); font-size: 12px; padding: 20px 0;">
          No student defenses submitted yet. In Level 5, students write a 1-sentence defense to defend their choice.
        </div>
      `;
      return;
    }

    el.defensesList.innerHTML = '';
    feed.forEach(item => {
      const card = document.createElement('div');
      card.className = 'defense-card';
      card.setAttribute('data-feed-id', item.id);

      const isStay = (item.decision || '').toUpperCase() === 'STAY';
      const badgeClass = isStay ? 'badge-stay' : 'badge-escape';

      card.innerHTML = `
        <div class="defense-meta-row">
          <span class="defense-exec-id">${item.studentId || 'EXEC-CONSULTANT'}</span>
          <span class="defense-choice-badge ${badgeClass}">${item.decision || 'VOTE'}</span>
        </div>
        <div class="defense-quote">"${item.defenseText || ''}"</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
          <span style="font-size:9px; color:var(--text-dim); font-family:var(--font-mono);">${new Date(item.timestamp || Date.now()).toLocaleTimeString()}</span>
          <span style="font-size:10px; color:#A855F7; font-weight:700;">Click to Cross-Examine ❯</span>
        </div>
      `;

      card.addEventListener('click', () => {
        triggerDefenseCrossExamination(item, card);
      });

      el.defensesList.appendChild(card);
    });
  }

  async function triggerDefenseCrossExamination(item, cardElement) {
    // Highlight selected card
    document.querySelectorAll('.defense-card').forEach(c => c.classList.remove('active-cross-examine'));
    if (cardElement) cardElement.classList.add('active-cross-examine');

    el.rebuttalStage.style.display = 'flex';
    el.rebuttalTargetId.textContent = `CROSS-EXAMINING ${item.studentId} (${item.decision})`;
    el.rebuttalSourceBadge.textContent = 'GENERATING AI REBUTTAL...';
    el.typewriterText.textContent = 'Formulating cross-examination challenge from Skeptical Nissan Board perspective...';

    try {
      const res = await fetch('/api/ai/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedId: item.id,
          decision: item.decision,
          defenseText: item.defenseText,
          apiKey: el.settingsGeminiKey ? el.settingsGeminiKey.value.trim() : null
        })
      });

      const data = await res.json();
      if (data && data.challengeText) {
        el.rebuttalSourceBadge.textContent = data.source === 'gemini' ? 'GEMINI 2.5 FLASH' : 'HBS DETERMINISTIC ENGINE';
        runTypewriter(data.challengeText);
        addTickerItem(`AI Cross-examined ${item.studentId} (${item.decision})`, 'defense');
      }
    } catch (err) {
      console.warn('[AI Rebuttal] Failed to query API, using local fallback:', err);
      const fallback = item.rebuttal || "Considering Japan's >99% conviction rate, 130 days detention without counsel, and Saikawa's uncharged resignation, does your argument truly address the institutional reality of this case?";
      el.rebuttalSourceBadge.textContent = 'OFFLINE HBS FALLBACK';
      runTypewriter(fallback);
    }
  }

  // -------------------------------------------------------------------------
  // 7. General Gemini Stakeholder Challenge Trigger
  // -------------------------------------------------------------------------
  async function triggerGeneralAiChallenge() {
    el.btnTriggerChallenge.disabled = true;
    el.btnReChallenge.disabled = true;
    el.aiChallengeTextBox.textContent = 'Generating live stakeholder cross-examination challenge...';
    el.aiStatusNote.textContent = 'Querying AI Engine...';

    // Determine current majority
    let majority = 'ESCAPE';
    if (lastStats && lastStats.finalVerdict) {
      majority = lastStats.finalVerdict.majority;
    } else if (lastStats && lastStats.initialDecision) {
      majority = lastStats.initialDecision.majority;
    }

    try {
      const res = await fetch('/api/ai/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          majorityDecision: majority,
          apiKey: el.settingsGeminiKey ? el.settingsGeminiKey.value.trim() : null
        })
      });

      const data = await res.json();
      if (data && data.challengeText) {
        el.aiChallengeTextBox.textContent = `"${data.challengeText}"`;
        el.aiModelBadge.textContent = data.source === 'gemini' ? 'Gemini 2.5 Flash' : 'HBS Case Fallback';
        el.aiStatusNote.textContent = `Target: Cohort Majority (${majority}) · Grounded in HBS 9-122-051`;
        addTickerItem(`Gemini Board Challenge issued to cohort (${majority} majority)`, 'defense');
        showToast('AI Stakeholder Challenge updated!', 'success');
      }
    } catch (err) {
      console.warn('[AI Challenge] Error:', err);
      const fallback = majority === 'ESCAPE'
        ? "You believe leaving Japan is justified because Ghosn perceived the process as unfair. Yet Ghosn settled U.S. SEC fraud charges over $140M in concealed compensation (paying a $1M fine and accepting a 10-year officer ban) and faced allegations of transferring $17M in personal investment losses to Nissan. Does escaping in an audio box while on bail undermine his claim that he wants justice and destroy executive accountability?"
        : "You believe staying in Japan is the best way to prove his innocence. But considering the potential 42-month legal process, the >99% conviction rate, 70+ boxes of withheld documents, and complete separation from his wife—while Greg Kelly waited nearly two years just for a hearing and Hiroto Saikawa resigned without charges—are you overlooking the human and procedural reality of this decision?";
      el.aiChallengeTextBox.textContent = `"${fallback}"`;
      el.aiModelBadge.textContent = 'HBS Case Fallback';
      el.aiStatusNote.textContent = `Target: Cohort Majority (${majority}) · Offline Mode`;
    } finally {
      el.btnTriggerChallenge.disabled = false;
      el.btnReChallenge.disabled = false;
    }
  }

  // -------------------------------------------------------------------------
  // 8. 67-Student Rehearsal Simulation Trigger
  // -------------------------------------------------------------------------
  async function triggerSimulation() {
    el.btnSimulate.disabled = true;
    el.btnSimulate.innerHTML = '<span>⏳ Simulating 67 Students...</span>';
    showToast('Starting 3-second animated rehearsal simulation of 67 students...', 'info');
    addTickerItem('Rehearsal Mode triggered: generating 67 realistic student trajectories...', 'stay');

    try {
      const res = await fetch('/api/simulate', { method: 'POST' });
      const data = await res.json();
      if (data && data.success) {
        showToast('67-Student Rehearsal Simulation Complete!', 'success');
        addTickerItem('Rehearsal completed: 67 students populated across L1-L5', 'escape');
        if (data.stats) updateDashboardUI(data.stats, currentFeed);
      }
    } catch (err) {
      console.error('[Simulate] Failed:', err);
      showToast('Simulation request failed. Check server connection.', 'error');
    } finally {
      setTimeout(() => {
        el.btnSimulate.disabled = false;
        el.btnSimulate.innerHTML = '<span>⚡ Rehearsal Mode (Simulate 67)</span>';
      }, 1500);
    }
  }

  // -------------------------------------------------------------------------
  // 9. Session Reset Action
  // -------------------------------------------------------------------------
  async function resetClassroomSession() {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data && data.success) {
        showToast('Classroom session reset to clean slate.', 'warn');
        addTickerItem('Session reset: all votes and student entries cleared', 'warn');
        el.rebuttalStage.style.display = 'none';
        el.aiChallengeTextBox.textContent = '"Awaiting cohort vote convergence. Click \'Generate Live Challenge\' to cross-examine the classroom majority under Japanese corporate governance realities."';
        fetchLatestState();
      }
    } catch (err) {
      console.error('[Reset Error]', err);
      showToast('Reset failed. Check server.', 'error');
    }
  }

  // -------------------------------------------------------------------------
  // 10. HTTP Polling Fallback (1.5s Interval)
  // -------------------------------------------------------------------------
  async function fetchLatestState() {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data && data.stats) {
        updateDashboardUI(data.stats, data.feed);
      }
    } catch (err) {
      // Server down or offline
    }
  }

  function startHttpPollingFallback() {
    if (isPollingFallbackActive) return;
    isPollingFallbackActive = true;
    el.connectionStatusText.textContent = 'POLLING FALLBACK (1.5s)';
    el.socketPulse.classList.remove('offline');
    el.socketPulse.style.backgroundColor = '#F59E0B'; // Amber for polling

    if (pollingIntervalId) clearInterval(pollingIntervalId);
    pollingIntervalId = setInterval(fetchLatestState, 1500);
  }

  function stopHttpPollingFallback() {
    if (!isPollingFallbackActive) return;
    isPollingFallbackActive = false;
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    el.connectionStatusText.textContent = 'LIVE WEBSOCKET';
    el.socketPulse.style.backgroundColor = '#10B981'; // Green for WS
  }

  // -------------------------------------------------------------------------
  // 11. Socket.IO Connection & Event Handlers
  // -------------------------------------------------------------------------
  function setupSocket() {
    if (typeof io === 'undefined') {
      console.warn('[Socket.IO] io client not found, starting HTTP polling fallback.');
      startHttpPollingFallback();
      return;
    }

    try {
      socket = io({
        transports: ['websocket', 'polling'],
        reconnectionDelay: 1000,
        reconnectionDelayMax: 3000
      });

      socket.on('connect', () => {
        stopHttpPollingFallback();
        el.socketPulse.classList.remove('offline');
        addTickerItem('WebSocket established with command server', 'info');
        socket.emit('get_state');
      });

      socket.on('disconnect', () => {
        el.socketPulse.classList.add('offline');
        startHttpPollingFallback();
        addTickerItem('WebSocket disconnected, falling back to HTTP polling...', 'warn');
      });

      socket.on('connect_error', () => {
        startHttpPollingFallback();
      });

      socket.on('state_update', (data) => {
        if (data && data.stats) {
          updateDashboardUI(data.stats, data.feed);
        }
      });

      socket.on('new_defense', (entry) => {
        addTickerItem(`New defense from ${entry.studentId} (${entry.decision}): "${entry.defenseText.substring(0, 40)}..."`, 'defense');
      });

      socket.on('ai_rebuttal_result', (data) => {
        if (data && data.challengeText) {
          el.rebuttalStage.style.display = 'flex';
          el.rebuttalSourceBadge.textContent = data.source === 'gemini' ? 'GEMINI 2.5 FLASH' : 'HBS DETERMINISTIC ENGINE';
          runTypewriter(data.challengeText);
        }
      });

      socket.on('session_reset', () => {
        fetchLatestState();
      });

    } catch (e) {
      console.warn('[Socket.io] Initialization error, starting HTTP polling fallback:', e);
      startHttpPollingFallback();
    }
  }

  // -------------------------------------------------------------------------
  // 12. Event Listeners & Modal Controls
  // -------------------------------------------------------------------------
  function bindEventListeners() {
    // URL input live change
    el.joinUrlInput.addEventListener('input', (e) => {
      renderQrCode(e.target.value);
    });

    el.btnRefreshQr.addEventListener('click', () => {
      renderQrCode(el.joinUrlInput.value);
      showToast('QR Code regenerated!', 'success');
    });

    el.btnCopyUrl.addEventListener('click', () => {
      if (navigator.clipboard && el.joinUrlInput.value) {
        navigator.clipboard.writeText(el.joinUrlInput.value).then(() => {
          el.copyStatus.style.display = 'inline';
          setTimeout(() => { el.copyStatus.style.display = 'none'; }, 2000);
          showToast('Join URL copied to clipboard!', 'success');
        });
      }
    });

    // Toolbar buttons
    el.btnSimulate.addEventListener('click', triggerSimulation);
    el.btnTriggerChallenge.addEventListener('click', triggerGeneralAiChallenge);
    el.btnReChallenge.addEventListener('click', triggerGeneralAiChallenge);

    // Export dropdown toggle
    el.btnExportDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = el.exportMenu.style.display === 'block';
      el.exportMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      el.exportMenu.style.display = 'none';
    });

    // Reset modals
    el.btnResetSession.addEventListener('click', () => {
      el.modalResetConfirm.style.display = 'flex';
    });
    el.btnCloseResetModal.addEventListener('click', () => {
      el.modalResetConfirm.style.display = 'none';
    });
    el.btnCancelReset.addEventListener('click', () => {
      el.modalResetConfirm.style.display = 'none';
    });
    el.btnConfirmReset.addEventListener('click', () => {
      el.modalResetConfirm.style.display = 'none';
      resetClassroomSession();
    });

    // Rubric modal
    el.btnOpenRubric.addEventListener('click', () => {
      el.modalRubric.style.display = 'flex';
    });
    el.btnCloseRubricModal.addEventListener('click', () => {
      el.modalRubric.style.display = 'none';
    });

    // Settings modal
    el.btnOpenSettings.addEventListener('click', () => {
      el.modalSettings.style.display = 'flex';
    });
    el.btnCloseSettingsModal.addEventListener('click', () => {
      el.modalSettings.style.display = 'none';
    });

    // Save API key
    el.btnSaveKey.addEventListener('click', async () => {
      const key = el.settingsGeminiKey.value.trim();
      try {
        const res = await fetch('/api/settings/apikey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key })
        });
        const data = await res.json();
        if (data && data.success) {
          showToast(key ? 'Gemini API Key saved!' : 'Gemini Key cleared, using fallback.', 'success');
        }
      } catch (err) {
        showToast('Failed to save API key on server.', 'error');
      }
    });

    // Fullscreen toggle
    el.btnToggleFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          showToast(`Error enabling full-screen mode: ${err.message}`, 'error');
        });
      } else {
        document.exitFullscreen();
      }
    });

    // Test fallback challenge
    el.btnTestOffline.addEventListener('click', () => {
      triggerGeneralAiChallenge();
      el.modalSettings.style.display = 'none';
    });

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        el.modalRubric.style.display = 'none';
        el.modalSettings.style.display = 'none';
        el.modalResetConfirm.style.display = 'none';
      }
    });
  }

  // -------------------------------------------------------------------------
  // 13. Initialization
  // -------------------------------------------------------------------------
  async function init() {
    bindEventListeners();
    await fetchNetworkInfo();
    setupSocket();
    fetchLatestState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
