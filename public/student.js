/**
 * CARLOS GHOSN HBS CASE 9-122-051: THE FINAL 48 HOURS
 * Student Mobile View ('/') - High-Performance Responsive Client Engine
 * Dual-Mode Synchronization: Real-Time Socket.io + 1.5s HTTP Polling Fallback
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. CONSTANTS & OB THEORETICAL FRAMEWORKS
  // ---------------------------------------------------------------------------
  const STORAGE_KEY_ID = 'ghosn_exec_id';
  const STORAGE_KEY_STATE = 'ghosn_student_state_v1';
  const POLL_INTERVAL_MS = 1500;

  const OB_LENSES = {
    1: 'BASELINE MORAL & RISK FRAMING',
    2: "ADAMS' EQUITY THEORY & REFERENT COMPARISONS",
    3: 'PROCEDURAL JUSTICE & RISK PERCEPTION',
    4: 'INTERACTIONAL JUSTICE & LOSS AVERSION',
    5: 'HINDSIGHT VERDICT & COUNTERFACTUAL'
  };

  // Case Decision Tree (100% faithful to HBS Case 9-122-051 & Master Spec)
  const CASE_DECISION_TREE = {
    1: {
      title: 'The Crossroads',
      subtitle: 'December 2019 · Tokyo Under Surveillance',
      situation: 'It is December 2019. You are Carlos Ghosn, former Chairman and CEO of Renault, Nissan, and Mitsubishi. Accused by Japanese prosecutors of four counts of financial misconduct ($86M in underreported deferred compensation and three counts of breach of trust), you have been released on $14 million total bail ($9M + $4.7M). Your movements are monitored by security cameras and your communications are severely restricted. You proclaim your innocence and allege a politically motivated coup to block a Renault-Nissan merger.',
      question: 'What should Carlos Ghosn do?',
      options: {
        STAY: {
          label: 'Option A: Stay in Japan',
          description: 'Stay in Japan and fight the legal battle.',
          tag: 'LEGAL DEFENSE'
        },
        ESCAPE: {
          label: 'Option B: Leave Japan',
          description: 'Leave Japan and attempt to escape.',
          tag: 'TACTICAL EXFILTRATION'
        }
      }
    },
    2: {
      title: 'Reasons & Referent Comparisons',
      subtitle: 'Adams\' Equity Theory & Inequity Perception',
      routes: {
        A: { // If L1 was STAY
          badge: 'ROUTE A · PRIOR: STAYED IN JAPAN',
          situation: 'Your strongest motivation to stay is clearing your name: winning acquittal in a Japanese court is the most convincing way to prove your innocence, whereas leaving gives the impression that you have a weak case. <strong>However, you see a glaring double standard:</strong> In September 2019, your successor and chief accuser, Nissan CEO Hiroto Saikawa, admitted to receiving $440,000 in improper excess compensation alongside other Nissan executives—yet Saikawa was allowed to merely resign with ZERO criminal charges, while you face up to 15 years in prison.',
          question: 'What would you do now?',
          options: {
            STAY: {
              label: 'Option A: Stay in Japan',
              description: 'Stay in Japan and prove your innocence.',
              tag: 'CLEAR REPUTATION'
            },
            ESCAPE: {
              label: 'Option B: Leave Japan',
              description: 'Leave Japan and seek freedom elsewhere.',
              tag: 'REJECT DOUBLE STANDARD'
            }
          }
        },
        B: { // If L1 was ESCAPE
          badge: 'ROUTE B · PRIOR: CHOSE ESCAPE',
          situation: 'Escaping to Lebanon would reunite you with your wife and family and restore 60% to 70% of your previous freedom (compared to just 10% under Tokyo house arrest). <strong>However, the reputational and legal costs are severe:</strong> Leaving forfeits $14 million in bail, makes you look guilty in the court of public opinion, and leaves your former colleague Greg Kelly behind in Japan awaiting trial alone.',
          question: 'Would you continue with the escape plan?',
          options: {
            STAY: {
              label: 'Option A: Cancel Escape',
              description: 'Cancel the escape and stay in Japan.',
              tag: 'STAND BY KELLY / STAND TRIAL'
            },
            ESCAPE: {
              label: 'Option B: Continue Escape',
              description: 'Continue with the escape plan.',
              tag: 'SEEK EXTRATERRITORIAL SANCTUARY'
            }
          }
        }
      }
    },
    3: {
      title: 'The Risk & Procedural Justice',
      subtitle: '130 Days In Solitary · Due Process Doubts',
      routes: {
        A: { // If L2 was STAY
          badge: 'ROUTE A · PRIOR: STAYED IN JAPAN',
          situation: 'You have already spent 130 days in detention across two arrests, undergoing hours of daily interrogation without a lawyer present, during which prosecutors allegedly threatened your family to extract a confession. You learn Japan has a <strong>&gt;99% conviction rate</strong> (and judges can face career repercussions for acquittals in politically sensitive cases). Prosecutors are withholding thousands of files (70+ boxes in Kelly\'s case) while leaking to the press, and <strong>more than a year after your arrest, your trial still has no start date</strong>.',
          question: 'Would you still stay?',
          options: {
            STAY: {
              label: 'Option A: Stand Trial',
              description: 'Yes, I want to clear my name in Japan.',
              tag: 'FAITH IN ADJUDICATION'
            },
            ESCAPE: {
              label: 'Option B: Abandon Trial',
              description: 'No, I would leave Japan.',
              tag: 'REJECT RIGGED DUE PROCESS'
            }
          }
        },
        B: { // If L2 was ESCAPE
          badge: 'ROUTE B · PRIOR: CHOSE ESCAPE',
          situation: 'Your collaborators assure you the escape plan is 100% guaranteed, and you figure a <strong>two-in-three (67%) chance of success</strong> makes the risk worthwhile. However, many pieces of the plan are impossible to test beforehand, and ordinary traffic or security checks could expose you. If caught, you violate bail and return to prison (<strong>5% freedom</strong>) to await the start and end of both trials.',
          question: 'Would you trust the escape plan?',
          options: {
            STAY: {
              label: 'Option A: Cancel & Return',
              description: 'No, I would cancel it and stay in Japan.',
              tag: 'AVOID CATASTROPHIC 5% RISK'
            },
            ESCAPE: {
              label: 'Option B: Execute Exfiltration',
              description: 'Yes, I would take the risk and continue.',
              tag: 'ACCEPT 67% SUCCESS PROBABILITY'
            }
          }
        }
      }
    },
    4: {
      title: 'The Final Turning Point',
      subtitle: 'Interactional Justice & 42-Month Trial Timeline',
      routes: {
        A: { // If L3 was STAY
          badge: 'ROUTE A · PRIOR: STAYED IN JAPAN',
          situation: '<strong>December 2019 — The Last Straws:</strong> First, despite never charging your wife Carole, the court repeatedly denies your requests to see or speak to her before the holidays, and your lawyers warn you should prepare not to see her until the unscheduled trial begins. Second, the judge denies your request for your two trials to overlap—meaning the judicial process could take up to <strong>42 months</strong>. Calling this \'hostage justice\' a <em>\'well-organized, well-packaged slow death,\'</em> you see no end in sight.',
          question: 'What would you do?',
          options: {
            STAY: {
              label: 'Option A: Endure & Fight',
              description: 'Stay and continue fighting the legal battle.',
              tag: 'ENDURE 42-MONTH PROCESS'
            },
            ESCAPE: {
              label: 'Option B: Break Out',
              description: 'Leave Japan before things get worse.',
              tag: 'BREAK FREE FROM HOSTAGE JUSTICE'
            }
          }
        },
        B: { // If L3 was ESCAPE
          badge: 'ROUTE B · PRIOR: CHOSE ESCAPE',
          situation: '<strong>December 29, 2019 — The Escape Is Live:</strong> After being denied contact with your wife Carole and facing up to 42 months of non-overlapping trials, you travel by train to an Osaka hotel with two operatives and two large audio equipment boxes. A private jet to Istanbul is waiting at a nearby airport. There is no guarantee the plan will work, and the moment you board that plane out of Japan, you are officially violating your bail.',
          question: 'Do you commit to the escape?',
          options: {
            STAY: {
              label: 'Option A: Abort at Hotel',
              description: 'Abandon the plan and stay in Japan.',
              tag: 'LAST-CHANCE ABORT'
            },
            ESCAPE: {
              label: 'Option B: Board Private Jet',
              description: 'Board the plane and escape.',
              tag: 'BOARD VIA AUDIO BOX'
            }
          }
        }
      }
    },
    5: {
      title: 'The Final Verdict & Outcome',
      subtitle: 'Hindsight Bias, Red Notices & Counterfactuals',
      situation: 'All evidence has now played out in historical reality. Review the actual outcome and the counterfactual before casting your definitive executive vote.',
      outcomeActual: '<strong>The Actual Escape Outcome:</strong> Ghosn disappeared on Dec 29, 2019, landed in Beirut, and gave a world press conference on Jan 8, 2020. He reunited with his wife and regained 60–70% of his freedom. However, Interpol issued a Red Notice, Lebanon banned him from international travel, Japan issued an arrest warrant for his wife Carole days later, and Nissan sued him for $90M. In July 2020 hindsight, Ghosn admitted his objective odds of escape were below 50% (as low as 1-in-3)—distorted by Overconfidence Bias.',
      counterfactual: '<strong>The Counterfactual (Greg Kelly):</strong> Arrested the same day as Ghosn, Kelly stayed in Japan on $640k bail without a passport—still awaiting his first trial hearing nearly two years later (Sept 2020) while Japanese executives who received unearned pay merely resigned.',
      question: 'Knowing everything you now know, what should Carlos Ghosn have done?',
      options: {
        STAY: {
          label: 'Option A: Stay in Japan',
          description: 'Stay in Japan and fight the legal battle.',
          tag: 'LEGAL & ETHICAL ACCOUNTABILITY'
        },
        ESCAPE: {
          label: 'Option B: Leave Japan',
          description: 'Leave Japan and escape.',
          tag: 'JUSTIFIED ESCAPE FROM HOSTAGE SYSTEM'
        }
      }
    }
  };

  const FALLBACK_AI_CHALLENGES = {
    STAY: 'You believe staying in Japan is the best way to prove his innocence. But considering the potential 42-month legal process, the >99% conviction rate, 70+ boxes of withheld documents, and complete separation from his wife—while Greg Kelly waited nearly two years just for a hearing and Hiroto Saikawa resigned without charges—are you overlooking the human and procedural reality of this decision?',
    ESCAPE: 'You believe leaving Japan is justified because Ghosn perceived the process as unfair. Yet Ghosn settled U.S. SEC fraud charges over $140M in concealed compensation (paying a $1M fine and accepting a 10-year officer ban) and faced allegations of transferring $17M in personal investment losses to Nissan. Does escaping in an audio box while on bail undermine his claim that he wants justice and destroy executive accountability?'
  };

  // ---------------------------------------------------------------------------
  // 2. CLIENT APPLICATION STATE
  // ---------------------------------------------------------------------------
  const state = {
    studentId: '',
    currentLevel: 1,
    choices: {}, // { 1: 'STAY', 2: 'ESCAPE', ... }
    defenseText: '',
    hasSubmittedDefense: false,
    isTransitioning: false,
    isConnected: false,
    isPolling: false,
    aiRebuttalText: '',
    cohortStats: {
      totalStudents: 0,
      initialStayPct: 69,
      initialEscapePct: 31,
      finalStayPct: 36,
      finalEscapePct: 64,
      finalStayCount: 24,
      finalEscapeCount: 43,
      mindChangersCount: 27
    }
  };

  let socket = null;
  let pollingTimer = null;

  // ---------------------------------------------------------------------------
  // 3. INITIALIZATION & STORAGE
  // ---------------------------------------------------------------------------
  function init() {
    loadStudentId();
    loadPersistedState();
    setupNetworkSync();
    setupEventListeners();
    renderUI();
  }

  function generateRandomId() {
    const num = Math.floor(100 + Math.random() * 900);
    return `EXEC-${num}`;
  }

  function loadStudentId() {
    let savedId = localStorage.getItem(STORAGE_KEY_ID);
    if (!savedId || !savedId.trim()) {
      savedId = generateRandomId();
      localStorage.setItem(STORAGE_KEY_ID, savedId);
    }
    state.studentId = savedId;
  }

  function setStudentId(newId) {
    if (!newId || !newId.trim()) return;
    const cleanId = newId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    state.studentId = cleanId;
    localStorage.setItem(STORAGE_KEY_ID, cleanId);
    renderHUD();
    syncRegistration();
  }

  function loadPersistedState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.choices && typeof parsed.choices === 'object') {
          // Normalize choice keys to numbers 1..5
          Object.keys(parsed.choices).forEach(k => {
            const numKey = parseInt(k.replace('L', ''), 10);
            if (!isNaN(numKey)) state.choices[numKey] = parsed.choices[k];
          });
        }
        if (parsed.currentLevel) state.currentLevel = parsed.currentLevel;
        if (parsed.defenseText) state.defenseText = parsed.defenseText;
        if (parsed.hasSubmittedDefense) state.hasSubmittedDefense = parsed.hasSubmittedDefense;
        if (parsed.aiRebuttalText) state.aiRebuttalText = parsed.aiRebuttalText;
      }
    } catch (e) {
      console.warn('Could not parse saved student state:', e);
    }
  }

  function savePersistedState() {
    try {
      const payload = {
        choices: state.choices,
        currentLevel: state.currentLevel,
        defenseText: state.defenseText,
        hasSubmittedDefense: state.hasSubmittedDefense,
        aiRebuttalText: state.aiRebuttalText
      };
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(payload));
    } catch (e) {
      console.warn('Could not save student state:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. NETWORK SYNC (SOCKET.IO + 1.5S HTTP POLLING FALLBACK)
  // ---------------------------------------------------------------------------
  function setupNetworkSync() {
    if (typeof io !== 'undefined') {
      try {
        socket = io({
          reconnection: true,
          reconnectionAttempts: 20,
          reconnectionDelay: 1000,
          timeout: 5000
        });

        socket.on('connect', () => {
          state.isConnected = true;
          state.isPolling = false;
          updateConnectionStatus();
          syncRegistration();
        });

        socket.on('disconnect', () => {
          state.isConnected = false;
          state.isPolling = true;
          updateConnectionStatus();
          startPollingFallback();
        });

        // Server emits 'state_update' or 'session:update'
        socket.on('state_update', (data) => {
          if (data && data.stats) processServerStats(data.stats);
        });
        socket.on('session:update', (data) => {
          if (data && data.stats) processServerStats(data.stats);
        });

        // Server emits 'session_reset' or 'session:reset'
        socket.on('session_reset', () => handleSessionReset());
        socket.on('session:reset', () => handleSessionReset());

        socket.on('connect_error', () => {
          state.isConnected = false;
          state.isPolling = true;
          updateConnectionStatus();
          startPollingFallback();
        });
      } catch (err) {
        console.warn('Socket connection failure, fallback active:', err);
        startPollingFallback();
      }
    } else {
      startPollingFallback();
    }
  }

  function startPollingFallback() {
    if (pollingTimer) return;
    state.isPolling = true;
    updateConnectionStatus();
    pollServer();
    pollingTimer = setInterval(pollServer, POLL_INTERVAL_MS);
  }

  async function pollServer() {
    try {
      // Try GET /api/state first (from server.js), fallback to /api/session
      let res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) {
        res = await fetch('/api/session', { cache: 'no-store' });
      }

      if (res.ok) {
        const data = await res.json();
        if (data.stats) {
          processServerStats(data.stats);
        }
        state.isPolling = true;
        updateConnectionStatus();
      }
    } catch (e) {
      updateConnectionStatus(false);
    }
  }

  function processServerStats(serverStats) {
    if (!serverStats) return;

    if (typeof serverStats.totalStudents === 'number') {
      state.cohortStats.totalStudents = serverStats.totalStudents;
    }

    if (serverStats.initialDecision) {
      state.cohortStats.initialStayPct = serverStats.initialDecision.stayPct;
      state.cohortStats.initialEscapePct = serverStats.initialDecision.escapePct;
    }

    if (serverStats.finalVerdict) {
      state.cohortStats.finalStayPct = serverStats.finalVerdict.stayPct;
      state.cohortStats.finalEscapePct = serverStats.finalVerdict.escapePct;
      state.cohortStats.finalStayCount = serverStats.finalVerdict.stayCount;
      state.cohortStats.finalEscapeCount = serverStats.finalVerdict.escapeCount;
    }

    if (serverStats.mindChangers) {
      state.cohortStats.mindChangersCount = serverStats.mindChangers.count;
    }

    renderCohortStats();
  }

  function updateConnectionStatus(online = true) {
    const dot = document.getElementById('connStatusDot');
    if (!dot) return;
    if (!online) {
      dot.className = 'status-dot offline';
      dot.title = 'Offline (Local simulation engine active)';
      return;
    }
    if (state.isConnected) {
      dot.className = 'status-dot';
      dot.title = 'Live WebSocket Connected (Zero Latency)';
    } else if (state.isPolling) {
      dot.className = 'status-dot polling';
      dot.title = 'HTTP Polling Fallback Active (1.5s)';
    }
  }

  function syncRegistration() {
    const payload = {
      studentId: state.studentId,
      currentLevel: state.currentLevel,
      choices: state.choices,
      defenseText: state.defenseText
    };

    if (state.isConnected && socket) {
      socket.emit('join_student', payload);
      socket.emit('student:register', payload);
    } else {
      fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {
        fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      });
    }
  }

  function transmitVote(level, choice, previousChoice) {
    const payload = {
      studentId: state.studentId,
      level: `L${level}`,
      choice: choice,
      previousChoice: previousChoice,
      timestamp: Date.now()
    };

    if (state.isConnected && socket) {
      socket.emit('submit_vote', payload);
      socket.emit('student:vote', payload);
    } else {
      fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }
  }

  async function transmitDefense(defenseText) {
    const finalChoice = state.choices[5] || 'ESCAPE';
    const payload = {
      studentId: state.studentId,
      defenseText: defenseText,
      decision: finalChoice,
      timestamp: Date.now()
    };

    if (state.isConnected && socket) {
      socket.emit('submit_defense', payload);
      socket.emit('student:defense', payload);
    } else {
      fetch('/api/defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }

    // Also request dynamic AI challenge from server if possible
    try {
      const aiRes = await fetch('/api/ai/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: finalChoice,
          majorityDecision: state.cohortStats.finalEscapePct >= 50 ? 'ESCAPE' : 'STAY',
          defenseText: defenseText
        })
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (aiData.challengeText) {
          state.aiRebuttalText = aiData.challengeText;
          savePersistedState();
          const disp = document.getElementById('aiChallengeDisplay');
          if (disp) disp.textContent = `"${aiData.challengeText}"`;
        }
      }
    } catch (e) {
      // Offline fallback already displays
    }
  }

  function handleSessionReset() {
    state.choices = {};
    state.currentLevel = 1;
    state.defenseText = '';
    state.hasSubmittedDefense = false;
    state.aiRebuttalText = '';
    savePersistedState();
    renderUI();
  }

  // ---------------------------------------------------------------------------
  // 5. UI RENDERING & ROUTING
  // ---------------------------------------------------------------------------
  function renderUI() {
    renderHUD();
    const sceneCard = document.getElementById('sceneCard');
    const postSimStage = document.getElementById('postSimStage');

    if (state.currentLevel <= 5) {
      if (sceneCard) sceneCard.style.display = 'block';
      if (postSimStage) postSimStage.style.display = 'none';
      renderLevel(state.currentLevel);
    } else {
      if (sceneCard) sceneCard.style.display = 'none';
      if (postSimStage) postSimStage.style.display = 'flex';
      renderPostSimStage();
    }
  }

  function renderHUD() {
    // Executive ID
    const execDisplay = document.getElementById('execIdDisplay');
    if (execDisplay) execDisplay.textContent = state.studentId;

    // Level Progress Label
    const levelLabel = document.getElementById('levelProgressLabel');
    if (levelLabel) {
      if (state.currentLevel <= 5) {
        levelLabel.textContent = `LEVEL ${state.currentLevel} / 5`;
      } else {
        levelLabel.textContent = `VERDICT REACHED · STAKEHOLDER STAGE`;
      }
    }

    // Progress Bar Segments
    const segments = document.querySelectorAll('.progress-segment');
    segments.forEach((seg, idx) => {
      const lvl = idx + 1;
      seg.className = 'progress-segment';
      if (lvl < state.currentLevel) {
        seg.classList.add('completed');
        const choice = state.choices[lvl];
        if (choice === 'STAY') seg.classList.add('stay');
        if (choice === 'ESCAPE') seg.classList.add('escape');
      } else if (lvl === state.currentLevel) {
        seg.classList.add('active');
      }
    });

    // OB Lens Pill
    const lensText = document.getElementById('obLensText');
    if (lensText) {
      const activeLevel = Math.min(state.currentLevel, 5);
      lensText.textContent = OB_LENSES[activeLevel] || 'ORGANIZATIONAL BEHAVIOR';
    }

    // Breadcrumbs Trail
    const breadcrumbs = document.getElementById('breadcrumbsTrail');
    if (breadcrumbs) {
      breadcrumbs.innerHTML = '';
      const answeredLevels = Object.keys(state.choices).map(Number).sort((a, b) => a - b);
      if (answeredLevels.length === 0) {
        const initCrumb = document.createElement('span');
        initCrumb.className = 'breadcrumb-item';
        initCrumb.textContent = 'L1: PENDING';
        breadcrumbs.appendChild(initCrumb);
      } else {
        answeredLevels.forEach((lvl, idx) => {
          const choice = state.choices[lvl];
          const item = document.createElement('span');
          item.className = `breadcrumb-item ${choice.toLowerCase()}`;
          item.textContent = `L${lvl}: ${choice}`;
          breadcrumbs.appendChild(item);

          if (idx < answeredLevels.length - 1) {
            const arrow = document.createElement('span');
            arrow.className = 'breadcrumb-arrow';
            arrow.textContent = '➔';
            breadcrumbs.appendChild(arrow);
          }
        });
      }
    }
  }

  function renderLevel(level) {
    const card = document.getElementById('sceneCard');
    if (!card) return;

    const data = CASE_DECISION_TREE[level];
    if (!data) return;

    let routeBadge = '';
    let narrative = '';
    let question = data.question;
    let options = data.options;
    let narrativeClass = '';

    if (level === 1) {
      narrative = data.situation;
      routeBadge = '<span class="route-badge">BASELINE MORAL FRAMING</span>';
    } else if (level >= 2 && level <= 4) {
      const previousChoice = state.choices[level - 1] || 'STAY';
      const routeKey = previousChoice === 'STAY' ? 'A' : 'B';
      const routeData = data.routes[routeKey];

      narrative = routeData.situation;
      question = routeData.question;
      options = routeData.options;
      narrativeClass = routeKey === 'A' ? 'route-a-accent' : 'route-b-accent';
      routeBadge = `<span class="route-badge ${routeKey === 'A' ? 'route-a' : 'route-b'}">${routeData.badge}</span>`;
    } else if (level === 5) {
      routeBadge = '<span class="route-badge">FINAL HISTORICAL CONVERGENCE</span>';
    }

    let html = `
      <div class="card-badge-row">
        ${routeBadge}
        <span class="case-id-tag">HBS 9-122-051</span>
      </div>
      <h2 class="level-title">${data.title}</h2>
      <div class="level-subtitle">${data.subtitle}</div>
    `;

    if (level === 5) {
      html += `
        <div class="outcome-banner">
          <div class="outcome-header">
            <span>⚖</span>
            <span>Historical Evidence & Real Outcomes</span>
          </div>
          <div class="outcome-details">${data.outcomeActual}</div>
          <div class="counterfactual-box">${data.counterfactual}</div>
        </div>
      `;
    } else {
      html += `
        <div class="narrative-box ${narrativeClass}">
          <p class="narrative-text">${narrative}</p>
        </div>
      `;
    }

    html += `
      <div class="question-prompt">
        <span>➤</span>
        <span>${question}</span>
      </div>
      <div class="decision-grid">
        <button class="choice-btn stay-btn" data-choice="STAY" id="btnStay">
          <div class="btn-icon-wrapper">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div class="btn-text-content">
            <span class="btn-tag">${options.STAY.tag}</span>
            <span class="btn-title">${options.STAY.description}</span>
          </div>
          <span class="btn-arrow">➔</span>
        </button>

        <button class="choice-btn escape-btn" data-choice="ESCAPE" id="btnEscape">
          <div class="btn-icon-wrapper">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </div>
          <div class="btn-text-content">
            <span class="btn-tag">${options.ESCAPE.tag}</span>
            <span class="btn-title">${options.ESCAPE.description}</span>
          </div>
          <span class="btn-arrow">➔</span>
        </button>
      </div>
    `;

    card.innerHTML = html;

    // Attach choice handlers
    const stayBtn = document.getElementById('btnStay');
    const escapeBtn = document.getElementById('btnEscape');
    if (stayBtn) stayBtn.addEventListener('click', () => handleChoice('STAY'));
    if (escapeBtn) escapeBtn.addEventListener('click', () => handleChoice('ESCAPE'));
  }

  // ---------------------------------------------------------------------------
  // 6. CHOICE EXECUTION & CINEMATIC TRANSITIONS
  // ---------------------------------------------------------------------------
  function handleChoice(choice) {
    if (state.isTransitioning) return;
    state.isTransitioning = true;

    // Haptic pulse for touch devices
    if (navigator.vibrate) {
      navigator.vibrate(choice === 'STAY' ? 40 : [30, 40, 50]);
    }

    const currentLvl = state.currentLevel;
    const prevChoice = currentLvl > 1 ? state.choices[currentLvl - 1] : null;

    const btnId = choice === 'STAY' ? 'btnStay' : 'btnEscape';
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('selected');

    // Record Choice
    state.choices[currentLvl] = choice;
    savePersistedState();
    transmitVote(currentLvl, choice, prevChoice);

    // Branch transitions
    if (currentLvl === 1) {
      // 1.5s Level 1 Transition
      triggerLevel1Animation(choice, () => {
        advanceLevel();
      });
    } else if (currentLvl === 4 && choice === 'ESCAPE') {
      // 2.0s Level 4 Full Cinematic Escape Animation
      triggerLevel4EscapeCinematic(() => {
        advanceLevel();
      });
    } else {
      setTimeout(() => {
        advanceLevel();
      }, 350);
    }
  }

  function advanceLevel() {
    state.currentLevel++;
    state.isTransitioning = false;
    savePersistedState();
    renderUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Level 1 Transition Animation: Courtroom & Ticking Clock (STAY) vs Flight Radar (ESCAPE)
  function triggerLevel1Animation(choice, callback) {
    const overlay = document.getElementById('cinematicOverlay');
    const box = document.getElementById('cinematicBox');

    if (choice === 'STAY') {
      box.innerHTML = `
        <div class="courtroom-clock-container">
          <svg viewBox="0 0 140 140" width="140" height="140">
            <circle cx="70" cy="70" r="62" stroke="#3b82f6" stroke-width="3" fill="#0f172a" fill-opacity="0.9" />
            <circle cx="70" cy="70" r="54" stroke="#334155" stroke-width="1.5" stroke-dasharray="4,4" fill="none" />
            <line x1="70" y1="14" x2="70" y2="22" stroke="#60a5fa" stroke-width="3" />
            <line x1="126" y1="70" x2="118" y2="70" stroke="#60a5fa" stroke-width="3" />
            <line x1="70" y1="126" x2="70" y2="118" stroke="#60a5fa" stroke-width="3" />
            <line x1="14" y1="70" x2="22" y2="70" stroke="#60a5fa" stroke-width="3" />
            <g class="clock-hand">
              <line x1="70" y1="70" x2="70" y2="28" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round" />
              <circle cx="70" cy="70" r="5" fill="#ef4444" />
            </g>
            <g class="gavel-icon" transform="translate(48, 62)">
              <rect x="0" y="0" width="32" height="12" rx="3" fill="#3b82f6" />
              <rect x="12" y="12" width="8" height="24" rx="2" fill="#93c5fd" />
            </g>
          </svg>
        </div>
        <div class="cinematic-caption" style="color: #60a5fa;">PRE-TRIAL DETENTION CLOCK ACTIVE</div>
        <div class="cinematic-subcaption">&gt;99% CONVICTION RATE · TOKYO DISTRICT COURT</div>
      `;
    } else {
      box.innerHTML = `
        <div class="radar-container">
          <svg viewBox="0 0 140 140" width="140" height="140">
            <circle cx="70" cy="70" r="62" stroke="#ef4444" stroke-width="2" fill="#0f172a" />
            <circle cx="70" cy="70" r="42" stroke="#7f1d1d" stroke-width="1.5" fill="none" />
            <circle cx="70" cy="70" r="22" stroke="#7f1d1d" stroke-width="1.5" fill="none" />
            <line x1="70" y1="8" x2="70" y2="132" stroke="#991b1b" stroke-width="1" />
            <line x1="8" y1="70" x2="132" y2="70" stroke="#991b1b" stroke-width="1" />
            <g class="radar-sweep">
              <path d="M70,70 L132,70 A62,62 0 0,0 70,8 Z" fill="url(#sweepGrad)" opacity="0.4" />
              <line x1="70" y1="70" x2="132" y2="70" stroke="#f87171" stroke-width="2.5" />
            </g>
            <circle class="radar-blip" cx="95" cy="45" r="4.5" fill="#ef4444" />
            <defs>
              <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ef4444" stop-opacity="0" />
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0.5" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="cinematic-caption" style="color: #f87171;">EXFILTRATION VECTOR INITIALIZED</div>
        <div class="cinematic-subcaption">TOKYO ➔ OSAKA ➔ ISTANBUL ➔ BEIRUT</div>
      `;
    }

    overlay.classList.add('active');

    setTimeout(() => {
      overlay.classList.remove('active');
      if (callback) callback();
    }, 1500);
  }

  // Level 4 Cinematic Animation (2.0s): Tokyo -> Osaka -> audio boxes -> private jet -> Istanbul -> Beirut + Freedom Gauge 10% to 70%!
  function triggerLevel4EscapeCinematic(callback) {
    const overlay = document.getElementById('cinematicOverlay');
    const box = document.getElementById('cinematicBox');

    box.innerHTML = `
      <div style="font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: #ef4444; letter-spacing: 0.1em; text-transform: uppercase;">
        OPERATION EXFILTRATION // LIVE
      </div>
      <div class="escape-map-container">
        <svg viewBox="0 0 380 220" width="100%" height="100%">
          <rect width="380" height="220" fill="#090d16" />
          <line x1="40" y1="0" x2="40" y2="220" stroke="#1e293b" stroke-width="1" />
          <line x1="120" y1="0" x2="120" y2="220" stroke="#1e293b" stroke-width="1" />
          <line x1="200" y1="0" x2="200" y2="220" stroke="#1e293b" stroke-width="1" />
          <line x1="280" y1="0" x2="280" y2="220" stroke="#1e293b" stroke-width="1" />
          <line x1="0" y1="70" x2="380" y2="70" stroke="#1e293b" stroke-width="1" />
          <line x1="0" y1="140" x2="380" y2="140" stroke="#1e293b" stroke-width="1" />

          <!-- Arc from Tokyo/Osaka to Istanbul/Beirut -->
          <path class="flight-path-line" d="M 330,165 Q 260,30 180,60 T 60,110" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />

          <!-- Osaka KIX Node -->
          <circle cx="330" cy="165" r="5" fill="#38bdf8" />
          <text x="330" y="185" fill="#93c5fd" font-size="9" font-family="JetBrains Mono" font-weight="700" text-anchor="middle">OSAKA (KIX)</text>
          
          <!-- Audio Box Transfer -->
          <rect x="245" y="45" width="14" height="12" rx="2" fill="#f59e0b" />
          <text x="252" y="40" fill="#fcd34d" font-size="8" font-family="JetBrains Mono" font-weight="700" text-anchor="middle">AUDIO BOX</text>

          <!-- Istanbul Node -->
          <circle cx="140" cy="75" r="4.5" fill="#f59e0b" />
          <text x="140" y="93" fill="#fde68a" font-size="9" font-family="JetBrains Mono" font-weight="700" text-anchor="middle">ISTANBUL</text>

          <!-- Beirut Node -->
          <circle cx="60" cy="110" r="6" fill="#10b981" />
          <circle cx="60" cy="110" r="10" stroke="#10b981" stroke-width="1.5" fill="none" opacity="0.6" />
          <text x="60" y="132" fill="#6ee7b7" font-size="10" font-family="JetBrains Mono" font-weight="800" text-anchor="middle">BEIRUT</text>

          <!-- Jet Icon -->
          <g class="plane-marker">
            <polygon points="0,-7 5,6 0,4 -5,6" fill="#ffffff" />
          </g>
        </svg>
      </div>

      <!-- Animated Freedom Gauge: 10% to 70% -->
      <div class="freedom-gauge-wrapper">
        <div class="freedom-gauge-header">
          <span>FREEDOM GAUGE</span>
          <span id="freedomGaugeVal" style="color: #10b981;">10% ➔ 70%</span>
        </div>
        <div class="freedom-gauge-track">
          <div class="freedom-gauge-fill" id="freedomGaugeFill"></div>
        </div>
      </div>

      <div class="cinematic-caption" style="color: #38bdf8;">EXFILTRATION FLIGHT COMMITTED</div>
      <div class="cinematic-subcaption">AUDIO BOX LOADED · BOMBARDIER GLOBAL EXPRESS AIRBORNE</div>
    `;

    overlay.classList.add('active');

    setTimeout(() => {
      const fill = document.getElementById('freedomGaugeFill');
      if (fill) fill.classList.add('expanded');
    }, 150);

    setTimeout(() => {
      overlay.classList.remove('active');
      if (callback) callback();
    }, 2000);
  }

  // ---------------------------------------------------------------------------
  // 7. POST-LEVEL 5 DEFENSE & AI STAKEHOLDER STAGE
  // ---------------------------------------------------------------------------
  function renderPostSimStage() {
    const stage = document.getElementById('postSimStage');
    if (!stage) return;

    const finalChoice = state.choices[5] || 'ESCAPE';
    const profile = computeBehavioralProfile(state.choices);
    const aiChallengeText = state.aiRebuttalText || FALLBACK_AI_CHALLENGES[finalChoice] || FALLBACK_AI_CHALLENGES.ESCAPE;

    stage.innerHTML = `
      <div class="completion-card">
        <div class="profile-summary-header">
          <span class="profile-tag">${profile.tag}</span>
          <span class="case-id-tag">5/5 COMPLETE</span>
        </div>
        <h2 class="profile-archetype">${profile.title}</h2>
        <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">${profile.summary}</p>
        <div class="profile-trajectory-list">
          ${renderTrajectoryBadges()}
        </div>
      </div>

      <!-- AI Stakeholder Challenge Card -->
      <div class="ai-challenge-box">
        <div class="ai-challenge-header">
          <div class="ai-avatar">⚖</div>
          <div class="ai-role-title">Gemini AI Stakeholder Simulator</div>
        </div>
        <div class="ai-challenge-text" id="aiChallengeDisplay">
          "${aiChallengeText}"
        </div>
      </div>

      <!-- 1-Sentence Defense Box -->
      <div class="defense-card">
        <div class="defense-title">Executive Justification</div>
        <div class="defense-prompt">Why did you choose Stay or Escape? Did you change your mind during the 5 levels?</div>
        
        <textarea 
          class="defense-textarea" 
          id="defenseInput" 
          maxlength="280" 
          placeholder="Type your 1-sentence justification to transmit to the classroom screen..."
        >${state.defenseText || ''}</textarea>

        <div class="defense-controls">
          <span class="char-counter" id="defenseCounter">0 / 280</span>
          <button class="submit-defense-btn" id="submitDefenseBtn">
            <span>Transmit to Screen</span>
            <span>➔</span>
          </button>
        </div>

        <div class="defense-sent-badge ${state.hasSubmittedDefense ? 'visible' : ''}" id="defenseSentBadge">
          <span>✓</span>
          <span>Defense Transmitted to Classroom Screen (${state.studentId})</span>
        </div>
      </div>

      <!-- Live Classroom Cohort Stats -->
      <div class="stats-snapshot-card">
        <div class="stats-title">
          <span>Classroom Cohort Breakdown</span>
          <span id="cohortTotalLabel">${state.cohortStats.totalStudents || 67} Students</span>
        </div>
        <div class="cohort-bar">
          <div class="cohort-stay-segment" id="cohortStayBar" style="width: ${state.cohortStats.finalStayPct}%;">
            STAY ${state.cohortStats.finalStayPct}%
          </div>
          <div class="cohort-escape-segment" id="cohortEscapeBar" style="width: ${state.cohortStats.finalEscapePct}%;">
            ESCAPE ${state.cohortStats.finalEscapePct}%
          </div>
        </div>
        <div class="cohort-stats-legend">
          <span>Stay: ${state.cohortStats.finalStayCount || Math.round(state.cohortStats.finalStayPct * 0.67)}</span>
          <span>Escape: ${state.cohortStats.finalEscapeCount || Math.round(state.cohortStats.finalEscapePct * 0.67)}</span>
        </div>
      </div>

      <button class="retake-btn" id="retakeBtn">
        ↺ Re-evaluate Decision Simulation
      </button>
    `;

    setupDefenseHandlers();
  }

  function computeBehavioralProfile(choices) {
    const l1 = choices[1] || 'STAY';
    const l5 = choices[5] || 'ESCAPE';
    let switched = false;
    let switchLevel = null;

    for (let i = 2; i <= 5; i++) {
      if (choices[i] && choices[i] !== choices[i - 1]) {
        switched = true;
        if (!switchLevel) switchLevel = i;
      }
    }

    if (!switched && l1 === 'STAY') {
      return {
        tag: 'STEADFAST LEGALIST',
        title: 'The Unwavering Constitutionalist',
        summary: 'You maintained that judicial acquittal and reputational clearing in Japan outweighed all procedural violations and personal deprivation.'
      };
    } else if (!switched && l1 === 'ESCAPE') {
      return {
        tag: 'IMMEDIATE EVADER',
        title: 'The Realpolitik Fugitive',
        summary: 'You identified the 99% conviction rate and political detention as a non-starter from day one, refusing to submit to the Japanese court.'
      };
    } else if (l1 === 'STAY' && l5 === 'ESCAPE') {
      return {
        tag: 'CONVERTED DEFECTOR',
        title: 'The Pragmatic Realist',
        summary: `You started with faith in legal due process, but flipped to ESCAPE at Level ${switchLevel || 3} as the double standards and procedural delays mounted.`
      };
    } else {
      return {
        tag: 'MORAL REVISIONIST',
        title: 'The Duty-Bound Skeptic',
        summary: 'Despite initial impulses toward escape, you concluded that corporate accountability and standing with colleagues was paramount.'
      };
    }
  }

  function renderTrajectoryBadges() {
    const badges = [];
    for (let i = 1; i <= 5; i++) {
      const c = state.choices[i] || 'STAY';
      const color = c === 'STAY' ? 'stay' : 'escape';
      badges.push(`<span class="breadcrumb-item ${color}">L${i}: ${c}</span>`);
    }
    return badges.join('');
  }

  function setupDefenseHandlers() {
    const textarea = document.getElementById('defenseInput');
    const counter = document.getElementById('defenseCounter');
    const submitBtn = document.getElementById('submitDefenseBtn');
    const retakeBtn = document.getElementById('retakeBtn');

    if (textarea && counter) {
      counter.textContent = `${textarea.value.length} / 280`;
      textarea.addEventListener('input', () => {
        counter.textContent = `${textarea.value.length} / 280`;
        state.defenseText = textarea.value;
      });
    }

    if (submitBtn && textarea) {
      if (state.hasSubmittedDefense) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Transmitted ✓';
      }

      submitBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) {
          textarea.focus();
          return;
        }
        state.defenseText = text;
        state.hasSubmittedDefense = true;
        savePersistedState();
        await transmitDefense(text);

        const badge = document.getElementById('defenseSentBadge');
        if (badge) badge.classList.add('visible');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Transmitted ✓';
      });
    }

    if (retakeBtn) {
      retakeBtn.addEventListener('click', () => {
        if (confirm('Re-evaluate simulation from Level 1? Your Executive ID will be preserved.')) {
          state.choices = {};
          state.currentLevel = 1;
          state.defenseText = '';
          state.hasSubmittedDefense = false;
          state.aiRebuttalText = '';
          savePersistedState();
          renderUI();
        }
      });
    }
  }

  function renderCohortStats() {
    const stayBar = document.getElementById('cohortStayBar');
    const escapeBar = document.getElementById('cohortEscapeBar');
    const totalLabel = document.getElementById('cohortTotalLabel');

    if (stayBar && escapeBar) {
      const stayPct = Math.round(state.cohortStats.finalStayPct);
      const escapePct = 100 - stayPct;
      stayBar.style.width = `${stayPct}%`;
      stayBar.textContent = `STAY ${stayPct}%`;
      escapeBar.style.width = `${escapePct}%`;
      escapeBar.textContent = `ESCAPE ${escapePct}%`;
    }
    if (totalLabel && state.cohortStats.totalStudents) {
      totalLabel.textContent = `${state.cohortStats.totalStudents} Students`;
    }
  }

  // ---------------------------------------------------------------------------
  // 8. EVENT LISTENERS & MODALS
  // ---------------------------------------------------------------------------
  function setupEventListeners() {
    const execBtn = document.getElementById('execIdBtn');
    const modal = document.getElementById('execModal');
    const cancelBtn = document.getElementById('cancelExecModalBtn');
    const saveBtn = document.getElementById('saveExecModalBtn');
    const input = document.getElementById('execIdInput');

    if (execBtn && modal) {
      execBtn.addEventListener('click', () => {
        input.value = state.studentId;
        modal.classList.add('open');
        input.focus();
      });
    }

    if (cancelBtn && modal) {
      cancelBtn.addEventListener('click', () => {
        modal.classList.remove('open');
      });
    }

    if (saveBtn && modal && input) {
      saveBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (val) {
          setStudentId(val);
        }
        modal.classList.remove('open');
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
      });
    }
  }

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
