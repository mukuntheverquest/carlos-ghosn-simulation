/**
 * LIVE REAL-TIME TELEMETRY COUNTER
 * Carlos Ghosn MBA Decision Simulation
 */

(function () {
  'use strict';

  let currentStay = 0;
  let currentEscape = 0;
  let currentConnected = 0;

  function updateDisplay(stats) {
    if (!stats) return;

    // Use current active level stats or final verdict if complete
    const totalStudents = stats.totalStudents || 0;
    const connectedText = `${totalStudents} / 67 Joined`;
    const connEl = document.getElementById('connectedCount');
    if (connEl) connEl.textContent = connectedText;

    // Determine counts from latest answered level
    let stayCount = 0;
    let escapeCount = 0;
    let stayPct = 0;
    let escapePct = 0;
    let activeLevelName = 'Level 1 of 5';

    // Check levels in reverse order to find the latest active progress
    for (let lvl = 5; lvl >= 1; lvl--) {
      const lvlKey = `L${lvl}`;
      if (stats.levels && stats.levels[lvlKey] && stats.levels[lvlKey].total > 0) {
        stayCount = stats.levels[lvlKey].stay;
        escapeCount = stats.levels[lvlKey].escape;
        stayPct = stats.levels[lvlKey].stayPct;
        escapePct = stats.levels[lvlKey].escapePct;
        activeLevelName = lvl === 5 ? 'Level 5 (Final Verdict)' : `Level ${lvl} of 5`;
        break;
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
      document.getElementById('inflectionPointVal').textContent = 
        `${stats.primaryInflectionPoint.level}: ${stats.primaryInflectionPoint.name}`;
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

    const duration = 600;
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
        updateDisplay({
          totalStudents: 0,
          levels: { L1: { stay: 0, escape: 0, stayPct: 0, escapePct: 0 } }
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
