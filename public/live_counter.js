/**
 * LIVE REAL-TIME TELEMETRY COUNTER
 * Carlos Ghosn MBA Decision Simulation
 */

(function () {
  'use strict';

  let currentStay = 0;
  let currentEscape = 0;

  function updateDisplay(stats) {
    if (!stats) return;

    // Flexible student counter (base target 67, dynamically scales if 68, 70+ join)
    const totalStudents = stats.totalStudents || 0;
    const targetCohort = Math.max(67, totalStudents);
    const connectedText = `${totalStudents} / ${targetCohort} Joined`;
    const connEl = document.getElementById('connectedCount');
    if (connEl) connEl.textContent = connectedText;

    const cohortPill = document.getElementById('cohortPill');
    if (cohortPill) {
      cohortPill.textContent = `LIVE CLASSROOM TELEMETRY · ${targetCohort} CONSULTANTS`;
    }

    // Determine counts: prioritize Level 5 final verdict if any Level 5 votes exist
    const l5 = stats.finalVerdict || (stats.levelStats && stats.levelStats.L5);
    const hasL5Votes = l5 && ((l5.stayCount || 0) + (l5.escapeCount || 0) > 0);

    let stayCount = 0;
    let escapeCount = 0;
    let stayPct = 0;
    let escapePct = 0;
    let activeLevelName = 'Level 1 of 5';

    if (hasL5Votes) {
      stayCount = l5.stayCount || 0;
      escapeCount = l5.escapeCount || 0;
      stayPct = l5.stayPct || 0;
      escapePct = l5.escapePct || 0;
      activeLevelName = 'Level 5 (Final Verdict: Stay vs Escape)';
    } else {
      const lvlStats = stats.levelStats || stats.levels || {};
      for (let lvl = 5; lvl >= 1; lvl--) {
        const lvlKey = `L${lvl}`;
        const st = lvlStats[lvlKey];
        if (st && ((st.totalVotes || 0) > 0 || (st.stayCount || 0) + (st.escapeCount || 0) > 0)) {
          stayCount = st.stayCount !== undefined ? st.stayCount : (st.stay || 0);
          escapeCount = st.escapeCount !== undefined ? st.escapeCount : (st.escape || 0);
          stayPct = st.stayPct || 0;
          escapePct = st.escapePct || 0;
          activeLevelName = lvl === 5 ? 'Level 5 (Final Verdict)' : `Level ${lvl} of 5`;
          break;
        }
      }
    }

    // Animate Stay Counter
    animateNumber('stayCount', currentStay, stayCount);
    currentStay = stayCount;
    document.getElementById('stayPct').textContent = `${stayPct}%`;
    document.getElementById('stayBar').style.width = `${stayPct}%`;

    // Animate Escape Counter
    animateNumber('escapeCount', currentEscape, escapeCount);
    currentEscape = escapeCount;
    document.getElementById('escapePct').textContent = `${escapePct}%`;
    document.getElementById('escapeBar').style.width = `${escapePct}%`;

    // Footer stats
    if (stats.mindChangers) {
      document.getElementById('mindChangersVal').textContent = 
        `${stats.mindChangers.count} Students (${stats.mindChangers.pct}%) changed mind`;
    }

    if (stats.primaryInflectionPoint) {
      const infl = stats.primaryInflectionPoint;
      document.getElementById('inflectionPointVal').textContent = 
        `${infl.level}: ${infl.obTheory || infl.lens || infl.name || 'Inflection Point'}`;
    }

    document.getElementById('activeLevelVal').textContent = activeLevelName;
  }

  function animateNumber(elementId, startVal, endVal) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (startVal === endVal) {
      el.textContent = endVal;
      return;
    }

    const duration = 500;
    const startTime = performance.now();

    function step(timestamp) {
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const val = Math.floor(startVal + (endVal - startVal) * progress);
      el.textContent = val;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = endVal;
      }
    }

    requestAnimationFrame(step);
  }

  // -------------------------------------------------------------------------
  // RESET SESSION HANDLING
  // -------------------------------------------------------------------------
  const modalResetPin = document.getElementById('modalResetPin');
  const inputResetPin = document.getElementById('inputResetPin');
  const btnResetCounter = document.getElementById('btnResetCounter');
  const btnCancelResetPin = document.getElementById('btnCancelResetPin');
  const btnConfirmResetPin = document.getElementById('btnConfirmResetPin');
  const resetErrorMsg = document.getElementById('resetErrorMsg');

  function showResetModal() {
    if (modalResetPin) {
      modalResetPin.style.display = 'flex';
      if (inputResetPin) {
        inputResetPin.value = '';
        inputResetPin.focus();
      }
      if (resetErrorMsg) resetErrorMsg.style.display = 'none';
    }
  }

  function hideResetModal() {
    if (modalResetPin) modalResetPin.style.display = 'none';
    if (resetErrorMsg) resetErrorMsg.style.display = 'none';
  }

  async function executeReset(pin) {
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-presenter-pin': pin || ''
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (pin) sessionStorage.setItem('presenterPin', pin);
        hideResetModal();
        currentStay = 0;
        currentEscape = 0;
        // Immediate visual reset
        updateDisplay({
          totalStudents: 0,
          levelStats: {
            L1: { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 },
            L5: { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 }
          },
          finalVerdict: { stayCount: 0, escapeCount: 0, stayPct: 0, escapePct: 0, majority: 'STAY' },
          mindChangers: { count: 0, pct: 0 },
          primaryInflectionPoint: { level: 'Level 2', obTheory: "Adams' Equity Theory (Saikawa Double Standard)" }
        });
        pollState();
      } else {
        if (resetErrorMsg) {
          resetErrorMsg.textContent = data.error || 'Invalid Presenter PIN.';
          resetErrorMsg.style.display = 'block';
        } else {
          showResetModal();
        }
      }
    } catch (e) {
      alert('Error resetting session: ' + e.message);
    }
  }

  if (btnResetCounter) {
    btnResetCounter.addEventListener('click', () => {
      const savedPin = sessionStorage.getItem('presenterPin');
      if (savedPin) {
        if (confirm('Are you sure you want to reset all classroom votes and counts back to zero?')) {
          executeReset(savedPin);
        }
      } else {
        showResetModal();
      }
    });
  }

  if (btnCancelResetPin) {
    btnCancelResetPin.addEventListener('click', hideResetModal);
  }

  if (btnConfirmResetPin) {
    btnConfirmResetPin.addEventListener('click', () => {
      const enteredPin = inputResetPin ? inputResetPin.value.trim() : '';
      executeReset(enteredPin);
    });
  }

  if (inputResetPin) {
    inputResetPin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const enteredPin = inputResetPin.value.trim();
        executeReset(enteredPin);
      }
    });
  }

  // Socket.io Connection
  if (typeof io !== 'undefined') {
    try {
      const socket = io({
        transports: ['websocket', 'polling']
      });

      socket.on('state_update', (data) => {
        if (data && data.stats) updateDisplay(data.stats);
      });

      socket.on('session_reset', () => {
        currentStay = 0;
        currentEscape = 0;
        updateDisplay({
          totalStudents: 0,
          levelStats: {
            L1: { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 },
            L5: { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 }
          },
          finalVerdict: { stayCount: 0, escapeCount: 0, stayPct: 0, escapePct: 0, majority: 'STAY' },
          mindChangers: { count: 0, pct: 0 },
          primaryInflectionPoint: { level: 'Level 2', obTheory: "Adams' Equity Theory (Saikawa Double Standard)" }
        });
      });
    } catch (e) {
      console.warn('Socket error in live counter', e);
    }
  }

  // 1-Second HTTP Polling Fallback
  function pollState() {
    fetch('/api/state')
      .then(r => r.json())
      .then(data => {
        if (data && data.stats) updateDisplay(data.stats);
      })
      .catch(() => {});
  }

  setInterval(pollState, 1000);
  pollState();

})();
