/**
 * CARLOS GHOSN MBA DECISION SIMULATION
 * Student Mobile View ('/') - Clean Minimalist Experience
 * Features:
 * - Warm Light Beige Aesthetic
 * - Short & Punchy Story Text
 * - Two Clear Choices: "Stay in Japan" vs "Escape to Lebanon"
 * - 3D Animation after EVERY selection:
 *   * Stay: 3D Tokyo House Arrest (Carlos inside under surveillance)
 *   * Escape: 3D Aeroplane Flying (Private jet banking through 3D clouds)
 * - Seamless synchronization with Presenter Dashboard
 */

(function () {
  'use strict';

  const STORAGE_KEY_ID = 'ghosn_exec_id';
  const STORAGE_KEY_STATE = 'ghosn_student_clean_v2';
  const POLL_INTERVAL_MS = 1500;

  // ---------------------------------------------------------------------------
  // 1. SHORT & PUNCHY 5-LEVEL DECISION TREE
  // ---------------------------------------------------------------------------
  const DECISION_TREE = {
    1: {
      tag: 'December 2019 · Tokyo',
      title: 'The Accusation',
      situation: 'You are Carlos Ghosn, former CEO of Nissan, held under 24/7 camera surveillance on $14M bail. Japanese prosecutors accuse you of financial misconduct, but you claim it is a corporate coup to block a Renault-Nissan merger.',
      question: 'What should Carlos Ghosn do?',
      staySubtext: 'Fight the charges in Tokyo court',
      escapeSubtext: 'Flee the country secretly'
    },
    2: {
      tag: 'The Double Standard',
      title: 'Unequal Justice',
      routes: {
        A: { // If L1 was STAY
          situation: 'Your successor, Nissan CEO Hiroto Saikawa, admitted taking $440,000 in improper compensation. Saikawa was allowed to quietly resign with zero criminal charges—while you face up to 15 years in prison.',
          question: 'What would you do now?',
          staySubtext: 'Stay and prove your innocence',
          escapeSubtext: 'Reject this double standard and leave'
        },
        B: { // If L1 was ESCAPE
          situation: 'Escaping forfeits your $14M bail, brands you an international fugitive, and leaves your American colleague Greg Kelly behind in a Japanese jail alone.',
          question: 'Would you continue with the escape?',
          staySubtext: 'Cancel escape and stand trial',
          escapeSubtext: 'Continue with the escape plan'
        }
      }
    },
    3: {
      tag: 'Due Process',
      title: 'The Odds of Justice',
      routes: {
        A: { // If L2 was STAY
          situation: 'Japan has a >99% conviction rate. Prosecutors are withholding 70+ boxes of defense evidence, and after 130 days in detention, your trial still has no official start date.',
          question: 'Would you still stay in Japan?',
          staySubtext: 'Keep faith in the court',
          escapeSubtext: 'Abandon a rigged trial'
        },
        B: { // If L2 was ESCAPE
          situation: 'Collaborators estimate a 67% chance of escape. But many steps cannot be tested beforehand. If caught, you return to a maximum-security prison cell.',
          question: 'Would you trust the escape plan?',
          staySubtext: 'Too risky — cancel and stay',
          escapeSubtext: 'Accept the risk and continue'
        }
      }
    },
    4: {
      tag: 'December 29, 2019',
      title: 'The Final Hours',
      routes: {
        A: { // If L3 was STAY
          situation: 'The Tokyo court denies you any contact with your wife Carole for Christmas. Lawyers warn that non-overlapping trials will trap you in Japan for up to 42 months of solitary waiting.',
          question: 'What is your final move?',
          staySubtext: 'Endure the 42-month trial',
          escapeSubtext: 'Leave before it gets worse'
        },
        B: { // If L3 was ESCAPE
          situation: 'You are hidden in an Osaka hotel room. Two large audio speaker boxes and a private jet to Istanbul are waiting at Kansai Airport.',
          question: 'Do you commit to the escape?',
          staySubtext: 'Abandon plan and stay in Japan',
          escapeSubtext: 'Climb into the audio box'
        }
      }
    },
    5: {
      tag: 'Historical Outcome',
      title: 'The Verdict in Hindsight',
      situation: 'Carlos Ghosn smuggled himself onto the jet inside an audio box and escaped to Beirut. He regained his personal freedom—but Interpol issued a Red Notice, his wife faces an arrest warrant, and he can never leave Lebanon. Meanwhile, Greg Kelly stayed and waited nearly 2 years just for a hearing.',
      question: 'Knowing the real outcome, what should Carlos Ghosn have done?',
      staySubtext: 'Stay in Japan and fight',
      escapeSubtext: 'Escape to Lebanon'
    }
  };

  // ---------------------------------------------------------------------------
  // 2. STATE MANAGEMENT & ANONYMOUS IDENTIFIER
  // ---------------------------------------------------------------------------
  function getOrGenerateStudentId() {
    let id = localStorage.getItem(STORAGE_KEY_ID);
    if (!id || !/^EXEC-\d{3,4}$/.test(id)) {
      const num = Math.floor(100 + Math.random() * 900);
      id = `EXEC-${num}`;
      localStorage.setItem(STORAGE_KEY_ID, id);
    }
    return id;
  }

  let state = {
    studentId: getOrGenerateStudentId(),
    currentLevel: 1,
    choices: {}, // { 1: 'STAY', 2: 'ESCAPE', ... }
    defenseText: '',
    hasSubmittedDefense: false,
    isConnected: false,
    isTransitioning: false
  };

  function loadPersistedState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentLevel) state.currentLevel = parsed.currentLevel;
        if (parsed.choices) state.choices = parsed.choices;
        if (parsed.defenseText) state.defenseText = parsed.defenseText;
        if (parsed.hasSubmittedDefense) state.hasSubmittedDefense = parsed.hasSubmittedDefense;
      }
    } catch (e) {
      console.warn('Could not load local state', e);
    }
  }

  function savePersistedState() {
    try {
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify({
        currentLevel: state.currentLevel,
        choices: state.choices,
        defenseText: state.defenseText,
        hasSubmittedDefense: state.hasSubmittedDefense
      }));
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // 3. NETWORKING (SOCKET.IO + HTTP POLLING FALLBACK)
  // ---------------------------------------------------------------------------
  let socket = null;

  function initNetworking() {
    if (typeof io !== 'undefined') {
      try {
        socket = io({
          transports: ['websocket', 'polling'],
          timeout: 5000,
          reconnectionAttempts: 10
        });

        socket.on('connect', () => {
          state.isConnected = true;
          syncRegistration();
        });

        socket.on('session_reset', () => {
          handleSessionReset();
        });
      } catch (e) {
        startPolling();
      }
    } else {
      startPolling();
    }
  }

  function startPolling() {
    setInterval(() => {
      fetch('/api/state')
        .then(r => r.json())
        .catch(() => {});
    }, POLL_INTERVAL_MS);
  }

  function syncRegistration() {
    const payload = {
      studentId: state.studentId,
      currentLevel: state.currentLevel,
      choices: state.choices,
      defenseText: state.defenseText
    };

    if (socket && state.isConnected) {
      socket.emit('join_student', payload);
    } else {
      fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
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

    if (socket && state.isConnected) {
      socket.emit('submit_vote', payload);
    } else {
      fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }
  }

  function transmitDefense(defenseText) {
    const payload = {
      studentId: state.studentId,
      defenseText: defenseText,
      decision: state.choices[5] || 'ESCAPE',
      timestamp: Date.now()
    };

    if (socket && state.isConnected) {
      socket.emit('submit_defense', payload);
    } else {
      fetch('/api/defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }
  }

  function handleSessionReset() {
    state.choices = {};
    state.currentLevel = 1;
    state.defenseText = '';
    state.hasSubmittedDefense = false;
    savePersistedState();
    renderUI();
  }

  // ---------------------------------------------------------------------------
  // 4. UI RENDERING
  // ---------------------------------------------------------------------------
  function renderUI() {
    renderProgressBar();
    const storyCard = document.getElementById('storyCard');
    const endCard = document.getElementById('endCard');

    if (state.currentLevel <= 5) {
      if (storyCard) storyCard.style.display = 'flex';
      if (endCard) endCard.style.display = 'none';
      renderLevel(state.currentLevel);
    } else {
      if (storyCard) storyCard.style.display = 'none';
      if (endCard) endCard.style.display = 'flex';
      renderEndScreen();
    }
  }

  function renderProgressBar() {
    const segments = document.querySelectorAll('.progress-segment');
    segments.forEach((seg, idx) => {
      const lvl = idx + 1;
      seg.className = 'progress-segment';
      if (lvl < state.currentLevel) {
        seg.classList.add('completed');
      } else if (lvl === state.currentLevel) {
        seg.classList.add('active');
      }
    });

    const indicator = document.getElementById('levelIndicator');
    if (indicator) {
      if (state.currentLevel <= 5) {
        indicator.textContent = `Level ${state.currentLevel} of 5`;
      } else {
        indicator.textContent = `Verdict Reached`;
      }
    }
  }

  function renderLevel(level) {
    const card = document.getElementById('storyCard');
    if (!card) return;

    const data = DECISION_TREE[level];
    if (!data) return;

    let situation = '';
    let question = data.question;
    let staySubtext = data.staySubtext || 'Fight in court';
    let escapeSubtext = data.escapeSubtext || 'Flee Tokyo';

    if (level === 1 || level === 5) {
      situation = data.situation;
    } else {
      const prevChoice = state.choices[level - 1] || 'STAY';
      const routeKey = prevChoice === 'STAY' ? 'A' : 'B';
      const route = data.routes[routeKey];
      situation = route.situation;
      question = route.question;
      staySubtext = route.staySubtext;
      escapeSubtext = route.escapeSubtext;
    }

    card.innerHTML = `
      <div class="story-header">
        <span class="story-tag">${data.tag}</span>
        <h1 class="story-title">${data.title}</h1>
      </div>

      <p class="story-body">${situation}</p>

      <div class="question-prompt">${question}</div>

      <div class="options-container">
        <button class="btn-choice btn-stay" id="btnStay">
          <div class="btn-content">
            <span class="btn-label">Stay in Japan</span>
            <span class="btn-subtext">${staySubtext}</span>
          </div>
          <span class="btn-icon">🏛</span>
        </button>

        <button class="btn-choice btn-escape" id="btnEscape">
          <div class="btn-content">
            <span class="btn-label">Escape to Lebanon</span>
            <span class="btn-subtext">${escapeSubtext}</span>
          </div>
          <span class="btn-icon">✈</span>
        </button>
      </div>
    `;

    document.getElementById('btnStay').addEventListener('click', () => handleChoice('STAY'));
    document.getElementById('btnEscape').addEventListener('click', () => handleChoice('ESCAPE'));
  }

  // ---------------------------------------------------------------------------
  // 5. 3D TRANSITION ANIMATIONS (EVERY SELECTION)
  // ---------------------------------------------------------------------------
  function handleChoice(choice) {
    if (state.isTransitioning) return;
    state.isTransitioning = true;

    const currentLvl = state.currentLevel;
    const prevChoice = currentLvl > 1 ? state.choices[currentLvl - 1] : null;

    // Record Choice
    state.choices[currentLvl] = choice;
    savePersistedState();
    transmitVote(currentLvl, choice, prevChoice);

    // Trigger 3D Animation for Choice
    if (choice === 'STAY') {
      show3DHouseAnimation(() => {
        advanceLevel();
      });
    } else {
      show3DAeroplaneAnimation(() => {
        advanceLevel();
      });
    }
  }

  function advanceLevel() {
    state.currentLevel++;
    state.isTransitioning = false;
    savePersistedState();
    renderUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 3D Tokyo House Arrest Animation
  function show3DHouseAnimation(callback) {
    const overlay = document.getElementById('animationOverlay');
    const stage = document.getElementById('animationStage');
    if (!overlay || !stage) return callback();

    stage.innerHTML = `
      <div class="house-3d-scene">
        <div class="room-floor"></div>
        <div class="room-wall-back">
          <div class="cctv-camera">
            <div class="cctv-lens"></div>
            <div class="cctv-light"></div>
          </div>
          <div class="window-frame">
            <div class="window-bars">
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
              <div class="bar"></div>
            </div>
          </div>
        </div>
        <div class="ghosn-silhouette">
          <div class="ghosn-head"></div>
          <div class="ghosn-torso"></div>
          <div class="ghosn-legs">
            <div class="ghosn-leg"></div>
            <div class="ghosn-leg"></div>
          </div>
        </div>
      </div>
      <div class="animation-title">Staying in Tokyo</div>
      <div class="animation-subtext">24/7 Police Surveillance · House Arrest</div>
    `;

    overlay.style.display = 'flex';

    setTimeout(() => {
      overlay.style.display = 'none';
      callback();
    }, 1800);
  }

  // 3D Flying Aeroplane Animation (Ultra-Crisp Vector with GPU Redraw Fix)
  function show3DAeroplaneAnimation(callback) {
    const overlay = document.getElementById('animationOverlay');
    const stage = document.getElementById('animationStage');
    if (!overlay || !stage) return callback();

    stage.innerHTML = `
      <div class="plane-3d-scene">
        <div class="sky-backdrop">
          <div class="cloud-layer" style="width: 140px; height: 38px; top: 24px; left: 16px;"></div>
          <div class="cloud-layer" style="width: 170px; height: 46px; bottom: 36px; right: -10px; animation-delay: -1s;"></div>
          <div class="speed-particle" style="top: 55px; left: 20px;"></div>
          <div class="speed-particle" style="top: 135px; left: 60px; animation-delay: -0.4s;"></div>
          <div class="speed-particle" style="top: 195px; left: 15px; animation-delay: -0.7s;"></div>
        </div>

        <div class="jet-wrapper">
          <div class="jet-trail"></div>
          <div class="jet-trail-2"></div>
          <!-- Ultra-Crisp Precision Vector Jet Model -->
          <svg class="jet-svg" viewBox="0 0 360 180" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
            <defs>
              <linearGradient id="fuselageGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#FFFFFF" />
                <stop offset="55%" stop-color="#F1F5F9" />
                <stop offset="100%" stop-color="#CBD5E1" />
              </linearGradient>
              <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#F8FAFC" />
                <stop offset="100%" stop-color="#94A3B8" />
              </linearGradient>
              <linearGradient id="engineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#38BDF8" />
                <stop offset="100%" stop-color="#0284C7" />
              </linearGradient>
            </defs>

            <!-- Shadow underneath for 3D depth -->
            <ellipse cx="180" cy="155" rx="110" ry="14" fill="rgba(15, 23, 42, 0.18)" />

            <!-- Left Swept Wing (Far Wing) -->
            <polygon points="175,76 80,18 96,16 200,74" fill="#94A3B8" stroke="#64748B" stroke-width="1.5" />

            <!-- Jet Turbofan Engine (Far) -->
            <rect x="110" y="58" width="48" height="15" rx="7.5" fill="#334155" />
            <ellipse cx="158" cy="65.5" rx="5" ry="7.5" fill="url(#engineGlow)" />

            <!-- Main Aerodynamic Fuselage -->
            <path d="M330,88 C310,75 220,68 110,70 C70,71 35,77 20,88 C35,99 70,105 110,106 C220,108 310,101 330,88 Z" fill="url(#fuselageGrad)" stroke="#64748B" stroke-width="2" />

            <!-- Nose Cone -->
            <path d="M330,88 C318,80 300,77 285,76 L285,100 C300,99 318,96 330,88 Z" fill="#E2E8F0" opacity="0.6" />

            <!-- Cockpit Windshield -->
            <polygon points="295,83 270,78 268,88 290,88" fill="#0284C7" stroke="#38BDF8" stroke-width="1" />
            <line x1="280" y1="79" x2="279" y2="88" stroke="#F8FAFC" stroke-width="1.5" />

            <!-- Passenger Cabin Windows (Warm Executive Glow) -->
            <circle cx="245" cy="85" r="3" fill="#FBBF24" />
            <circle cx="232" cy="85" r="3" fill="#FBBF24" />
            <circle cx="219" cy="85" r="3" fill="#FBBF24" />
            <circle cx="206" cy="85" r="3" fill="#FBBF24" />
            <circle cx="193" cy="85" r="3" fill="#FBBF24" />
            <circle cx="180" cy="85" r="3" fill="#FBBF24" />
            <circle cx="167" cy="85" r="3" fill="#FBBF24" />

            <!-- Right Swept Wing (Near Wing with 3D Bevel) -->
            <polygon points="195,96 85,160 105,162 225,98" fill="url(#wingGrad)" stroke="#475569" stroke-width="2" />
            <!-- Wingtip Navigation Light (Red on Port) -->
            <circle cx="87" cy="161" r="3" fill="#EF4444" />

            <!-- T-Tail Vertical Stabilizer -->
            <polygon points="65,72 25,20 42,18 85,70" fill="#E2E8F0" stroke="#64748B" stroke-width="1.5" />
            <!-- Horizontal Stabilizer -->
            <polygon points="40,24 15,16 28,14 55,22" fill="#94A3B8" />

            <!-- Jet Turbofan Engine (Near) -->
            <rect x="115" y="88" width="54" height="18" rx="9" fill="#1E293B" stroke="#475569" stroke-width="1.5" />
            <ellipse cx="169" cy="97" rx="6" ry="9" fill="url(#engineGlow)" />
            <ellipse cx="115" cy="97" rx="3" ry="9" fill="#0F172A" />

            <!-- Executive Livery Stripe -->
            <path d="M280,90 Q180,92 60,86" stroke="#DC2626" stroke-width="2.5" fill="none" opacity="0.85" />
          </svg>
        </div>
      </div>
      <div class="animation-title">Escape Flight Active</div>
      <div class="animation-subtext">Tokyo ➔ Osaka ➔ Istanbul ➔ Beirut</div>
    `;

    overlay.style.display = 'flex';

    setTimeout(() => {
      overlay.style.display = 'none';
      callback();
    }, 1800);
  }

  // ---------------------------------------------------------------------------
  // 6. CLEAN END SCREEN
  // ---------------------------------------------------------------------------
  function renderEndScreen() {
    const endCard = document.getElementById('endCard');
    if (!endCard) return;

    const finalChoice = state.choices[5] || 'ESCAPE';
    const isStay = finalChoice === 'STAY';

    endCard.innerHTML = `
      <div class="verdict-badge ${isStay ? 'stay' : 'escape'}">
        Your Final Verdict: ${isStay ? 'Stayed in Japan' : 'Escaped to Lebanon'}
      </div>

      <h2 class="end-title">Simulation Complete</h2>
      
      <p class="end-summary">
        ${isStay 
          ? 'You chose to remain in Japan to fight the allegations in court, accepting the severe risks of pre-trial detention and a 99% conviction rate.'
          : 'You chose to flee Tokyo secretly to Lebanon, reclaiming your personal freedom while accepting the permanent status of an international fugitive.'}
      </p>

      <div class="defense-box-container">
        <label style="font-size: 13px; font-weight: 700; color: #52525B; text-align: left;">
          In one sentence, why did you make this decision?
        </label>
        <textarea 
          class="defense-input" 
          id="defenseInput" 
          placeholder="e.g. Due process was impossible in a system with 99% conviction..."
          maxlength="140"
          ${state.hasSubmittedDefense ? 'disabled' : ''}
        >${state.defenseText || ''}</textarea>

        <button class="btn-submit-defense" id="btnSubmitDefense" ${state.hasSubmittedDefense ? 'disabled style="background: #10B981;"' : ''}>
          ${state.hasSubmittedDefense ? '✓ Transmitted to Classroom Screen' : 'Submit to Classroom Screen'}
        </button>
      </div>

      <button class="btn-replay" id="btnReplay">Restart Simulation</button>
    `;

    const submitBtn = document.getElementById('btnSubmitDefense');
    const input = document.getElementById('defenseInput');
    const replayBtn = document.getElementById('btnReplay');

    if (submitBtn && input && !state.hasSubmittedDefense) {
      submitBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
          state.defenseText = text;
          state.hasSubmittedDefense = true;
          savePersistedState();
          transmitDefense(text);
          submitBtn.textContent = '✓ Transmitted to Classroom Screen';
          submitBtn.style.background = '#10B981';
          submitBtn.disabled = true;
          input.disabled = true;
        }
      });
    }

    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        handleSessionReset();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 7. INITIALIZATION
  // ---------------------------------------------------------------------------
  loadPersistedState();
  initNetworking();
  renderUI();

})();
