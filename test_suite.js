/**
 * test_suite.js
 * Comprehensive Verification & End-to-End Test Suite for
 * Carlos Ghosn Classroom Decision Simulation & Live AI Stakeholder Web App
 * (Harvard Business School Case 9-122-051)
 *
 * Runs 67 simulated student requests, tests real-time WebSocket, HTTP fallback,
 * AI cross-examination engine, exports, reset, and client-side asset integrity.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { io: ioClient } = require('socket.io-client');

// Import server & ai_engine modules
const { app, server, calculateStats, runCohortSimulation, state } = require('./server');
const { generateAiChallenge, getDeterministicFallback } = require('./ai_engine');

const TEST_PORT = 3000;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Test Report Tracker
const testResults = {
  passed: 0,
  failed: 0,
  assertions: []
};

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    testResults.assertions.push({ status: 'PASS', message });
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
  } else {
    testResults.failed++;
    testResults.assertions.push({ status: 'FAIL', message });
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${message}`);
  }
}

// HTTP request helper
function httpRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { ...headers }
    };

    let postData = null;
    if (body) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function runTestSuite() {
  console.log('\n======================================================================');
  console.log(' STARTING CARLOS GHOSN MBA DECISION SIMULATION VERIFICATION SUITE');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: ASSET & DEPENDENCY VERIFICATION
  // -------------------------------------------------------------------------
  console.log('[SECTION 1] Static Asset & Syntax Verification');

  const requiredFiles = [
    'package.json',
    'server.js',
    'ai_engine.js',
    'public/index.html',
    'public/student.css',
    'public/student.js',
    'public/presenter.html',
    'public/presenter.css',
    'public/presenter.js',
    'public/qrcode.min.js'
  ];

  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    assert(fs.existsSync(fullPath), `Asset exists: ${file} (${fs.existsSync(fullPath) ? fs.statSync(fullPath).size + ' bytes' : 0})`);
  });

  // Verify DOM element consistency between HTML and JS
  const studentHtml = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
  const studentJs = fs.readFileSync(path.join(__dirname, 'public/student.js'), 'utf8');
  const presenterHtml = fs.readFileSync(path.join(__dirname, 'public/presenter.html'), 'utf8');
  const presenterJs = fs.readFileSync(path.join(__dirname, 'public/presenter.js'), 'utf8');

  // Key IDs for Clean Student View
  const studentExpectedIds = [
    'minimalHeader', 'levelIndicator', 'storyCard', 'endCard',
    'animationOverlay', 'animationStage'
  ];
  studentExpectedIds.forEach(id => {
    assert(studentHtml.includes(`id="${id}"`), `Student HTML contains essential element #${id}`);
  });

  // Key IDs for Presenter View (exact matching with presenter.html and presenter.js)
  const presenterExpectedIds = [
    'qrcode-container', 'join-url-input', 'connected-count',
    'kpi-l1-stay-pct', 'kpi-l5-escape-pct',
    'kpi-changers-count', 'kpi-changers-pct', 'kpi-inflection-badge',
    'btn-simulate', 'btn-trigger-challenge', 'btn-open-rubric',
    'btn-export-dropdown', 'btn-reset-session', 'modal-rubric'
  ];
  presenterExpectedIds.forEach(id => {
    assert(presenterHtml.includes(`id="${id}"`), `Presenter HTML contains essential element #${id}`);
  });

  // Check 5-level decision tree & animations defined in student.js
  assert(studentJs.includes('DECISION_TREE'), 'student.js defines DECISION_TREE object');
  assert(studentJs.includes('Saikawa') || studentJs.includes('Double Standard'), 'student.js includes Saikawa double standard in Level 2');
  assert(studentJs.includes('conviction rate') || studentJs.includes('Due Process'), 'student.js includes conviction rate / Due Process in Level 3');
  assert(studentJs.includes('audio box') || studentJs.includes('Carole'), 'student.js includes audio box / spousal denial in Level 4');
  assert(studentJs.includes('Kelly') || studentJs.includes('Verdict'), 'student.js includes Kelly / Verdict in Level 5');
  assert(studentJs.includes('show3DHouseAnimation'), 'student.js includes 3D House Arrest animation');
  assert(studentJs.includes('show3DAeroplaneAnimation'), 'student.js includes 3D Flying Aeroplane animation');

  // -------------------------------------------------------------------------
  // SECTION 2: SERVER STARTUP & REST ROUTE VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n[SECTION 2] Server Startup & REST Endpoints');

  // Wait for server to be ready
  await sleep(600);

  // 1. GET /api/network-info
  const netRes = await httpRequest('GET', '/api/network-info');
  assert(netRes.statusCode === 200, 'GET /api/network-info returns 200 OK');
  assert(netRes.json && netRes.json.lanIp, `GET /api/network-info detected active LAN IP: ${netRes.json ? netRes.json.lanIp : 'N/A'}`);
  assert(netRes.json && netRes.json.port, `GET /api/network-info returned port: ${netRes.json ? netRes.json.port : 'N/A'}`);
  assert(netRes.json && netRes.json.fullUrl.startsWith('http://'), `GET /api/network-info returns fullUrl: ${netRes.json ? netRes.json.fullUrl : 'N/A'}`);

  // 2. GET / (Student Mobile View)
  const studentViewRes = await httpRequest('GET', '/');
  assert(studentViewRes.statusCode === 200, 'GET / returns 200 OK');
  assert(studentViewRes.body.includes('Carlos Ghosn'), 'GET / HTML contains title "Carlos Ghosn"');
  assert(studentViewRes.body.includes('student.js'), 'GET / HTML links student.js');

  // 3. GET /presenter (Classroom Dashboard)
  const presenterRes = await httpRequest('GET', '/presenter');
  assert(presenterRes.statusCode === 200, 'GET /presenter returns 200 OK');
  assert(presenterRes.body.includes('Executive Command Center') || presenterRes.body.includes('Classroom Projector Dashboard') || presenterRes.body.includes('PRESENTATION COMMAND CENTER'), 'GET /presenter HTML contains dashboard title');
  assert(presenterRes.body.includes('presenter.js'), 'GET /presenter HTML links presenter.js');

  // 4. GET /live-counter (Slide-Matched Live Tally Screen)
  const liveCounterRes = await httpRequest('GET', '/live-counter');
  assert(liveCounterRes.statusCode === 200, 'GET /live-counter returns 200 OK');
  assert(liveCounterRes.body.includes('stayCount'), 'GET /live-counter HTML contains #stayCount');
  assert(liveCounterRes.body.includes('escapeCount'), 'GET /live-counter HTML contains #escapeCount');

  // -------------------------------------------------------------------------
  // SECTION 3: AI ENGINE & DETERMINISTIC FALLBACK VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n[SECTION 3] AI Engine & Deterministic HBS Fallback Verification');

  // Test STAY fallback
  const stayFallback = getDeterministicFallback({ decision: 'STAY' });
  assert(stayFallback && stayFallback.includes('42-month') && stayFallback.includes('>99% conviction rate'), 'STAY fallback contains verified HBS 42-month and 99% conviction facts');

  // Test ESCAPE fallback
  const escapeFallback = getDeterministicFallback({ decision: 'ESCAPE' });
  assert(escapeFallback && escapeFallback.includes('SEC') && escapeFallback.includes('$140M'), 'ESCAPE fallback contains verified HBS SEC $140M and audio box facts');

  // Test keyword-specific matching in fallback
  const saikawaFallback = getDeterministicFallback({ decision: 'STAY', defenseText: 'Saikawa double standard is totally unfair!' });
  assert(saikawaFallback.includes('Saikawa') || saikawaFallback.includes('Equity'), 'Keyword fallback matches Saikawa / Adams\' Equity Theory');

  const caroleFallback = getDeterministicFallback({ decision: 'ESCAPE', defenseText: 'I want to reunite with Carole and my family.' });
  assert(caroleFallback.includes('Carole') || caroleFallback.includes('Lebanon'), 'Keyword fallback matches Carole / spousal isolation');

  // Test /api/ai/challenge endpoint
  const aiChallengeRes = await httpRequest('POST', '/api/ai/challenge', {
    decision: 'STAY',
    defenseText: 'I must stay to defend my honor in court.'
  });
  assert(aiChallengeRes.statusCode === 200, 'POST /api/ai/challenge returns 200 OK');
  assert(aiChallengeRes.json && aiChallengeRes.json.challengeText.length > 30, `AI Challenge generated response (${aiChallengeRes.json ? aiChallengeRes.json.source : 'error'})`);

  // -------------------------------------------------------------------------
  // SECTION 4: WEBSOCKET & REAL-TIME EVENT VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n[SECTION 4] WebSocket Real-Time Event & Broadcasting Verification');

  const socketUrl = BASE_URL;
  const testSocket = ioClient(socketUrl, { transports: ['websocket'] });

  await new Promise((resolve) => {
    testSocket.on('connect', () => {
      assert(testSocket.connected, 'Socket.io client connected via native WebSocket transport');
      resolve();
    });
  });

  // Test join_student event
  let stateUpdateReceived = null;
  testSocket.on('state_update', (data) => {
    stateUpdateReceived = data;
  });

  testSocket.emit('join_student', { studentId: 'EXEC-TEST-001' });
  await sleep(200);
  assert(stateUpdateReceived !== null, 'Server emitted state_update after join_student');
  assert(state.students['EXEC-TEST-001'] !== undefined, 'Server state contains EXEC-TEST-001');

  // Test submit_vote event via socket
  testSocket.emit('submit_vote', { studentId: 'EXEC-TEST-001', level: 'L1', choice: 'STAY' });
  await sleep(200);
  assert(state.students['EXEC-TEST-001'].votes.L1 === 'STAY', 'Server recorded L1 STAY vote via WebSocket');

  // Test submit_defense event via socket
  let newDefenseReceived = null;
  testSocket.on('new_defense', (data) => {
    newDefenseReceived = data;
  });

  testSocket.emit('submit_defense', {
    studentId: 'EXEC-TEST-001',
    decision: 'STAY',
    defenseText: 'Principles must supersede self-interest in executive leadership.'
  });
  await sleep(200);
  assert(newDefenseReceived && newDefenseReceived.studentId === 'EXEC-TEST-001', 'Server broadcasted new_defense event via WebSocket');
  assert(state.feed.length > 0 && state.feed[0].studentId === 'EXEC-TEST-001', 'Server feed updated with student defense');

  testSocket.disconnect();

  // -------------------------------------------------------------------------
  // SECTION 5: HTTP POLLING FALLBACK VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n[SECTION 5] Resilient HTTP Polling Fallback API Verification');

  // Test POST /api/join
  const httpJoinRes = await httpRequest('POST', '/api/join', { studentId: 'EXEC-HTTP-002' });
  assert(httpJoinRes.statusCode === 200, 'POST /api/join returns 200 OK');
  assert(httpJoinRes.json && httpJoinRes.json.studentId === 'EXEC-HTTP-002', 'POST /api/join registered student');

  // Test POST /api/vote
  const httpVoteRes = await httpRequest('POST', '/api/vote', {
    studentId: 'EXEC-HTTP-002',
    level: 'L1',
    choice: 'ESCAPE'
  });
  assert(httpVoteRes.statusCode === 200, 'POST /api/vote returns 200 OK');
  assert(state.students['EXEC-HTTP-002'].votes.L1 === 'ESCAPE', 'POST /api/vote successfully updated state');

  // Test POST /api/defense
  const httpDefRes = await httpRequest('POST', '/api/defense', {
    studentId: 'EXEC-HTTP-002',
    defenseText: 'Hostage justice made a fair defense impossible.',
    decision: 'ESCAPE'
  });
  assert(httpDefRes.statusCode === 200, 'POST /api/defense returns 200 OK');
  assert(httpDefRes.json && httpDefRes.json.entry.defenseText.includes('Hostage justice'), 'POST /api/defense recorded entry');

  // Test GET /api/state
  const httpStateRes = await httpRequest('GET', '/api/state');
  assert(httpStateRes.statusCode === 200, 'GET /api/state returns 200 OK');
  assert(httpStateRes.json && httpStateRes.json.stats.totalStudents >= 2, 'GET /api/state returns current stats for polling clients');

  // -------------------------------------------------------------------------
  // SECTION 6: 67-STUDENT COHORT SIMULATION & METRICS VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n[SECTION 6] 67-Student Cohort Simulation & Behavioral Analytics Verification');

  // First reset to clean slate
  const resetBeforeSim = await httpRequest('POST', '/api/reset');
  assert(resetBeforeSim.statusCode === 200, 'POST /api/reset cleared state before cohort run');

  // Trigger Cohort Simulation via POST /api/simulate (instant mode for test speed)
  const simRes = await httpRequest('POST', '/api/simulate?instant=true');
  assert(simRes.statusCode === 200, 'POST /api/simulate?instant=true returns 200 OK');
  assert(simRes.json && simRes.json.studentsCount === 67, 'Cohort simulation generated exactly 67 students');

  const stats = simRes.json.stats;

  // Metric 1: Total Student Count
  assert(stats.totalStudents === 67, `Metric 1 - Total Students is 67 (actual: ${stats.totalStudents})`);

  // Metric 2: Initial Decision (Level 1)
  // Expected: ~68.7% Stay (46 students), ~31.3% Escape (21 students)
  assert(stats.initialDecision.stayCount === 46, `Metric 2A - L1 Stay Count: 46 (actual: ${stats.initialDecision.stayCount})`);
  assert(stats.initialDecision.escapeCount === 21, `Metric 2B - L1 Escape Count: 21 (actual: ${stats.initialDecision.escapeCount})`);
  assert(stats.initialDecision.stayPct === 69, `Metric 2C - L1 Stay Pct: 69% (actual: ${stats.initialDecision.stayPct}%)`);
  assert(stats.initialDecision.escapePct === 31, `Metric 2D - L1 Escape Pct: 31% (actual: ${stats.initialDecision.escapePct}%)`);
  assert(stats.initialDecision.majority === 'STAY', 'Metric 2E - L1 Majority is STAY');

  // Metric 3: Final Verdict (Level 5)
  // Expected: ~35.8% Stay (24 students), ~64.2% Escape (43 students)
  assert(stats.finalVerdict.stayCount === 24, `Metric 3A - L5 Stay Count: 24 (actual: ${stats.finalVerdict.stayCount})`);
  assert(stats.finalVerdict.escapeCount === 43, `Metric 3B - L5 Escape Count: 43 (actual: ${stats.finalVerdict.escapeCount})`);
  assert(stats.finalVerdict.stayPct === 36, `Metric 3C - L5 Stay Pct: 36% (actual: ${stats.finalVerdict.stayPct}%)`);
  assert(stats.finalVerdict.escapePct === 64, `Metric 3D - L5 Escape Pct: 64% (actual: ${stats.finalVerdict.escapePct}%)`);
  assert(stats.finalVerdict.majority === 'ESCAPE', 'Metric 3E - L5 Majority is ESCAPE');

  // Metric 4: Mind-Changers (Cognitive Shift)
  // Group 1: 2 switched at L2 (Escape->Stay), 1 switched at L3 (Escape->Stay) = 3
  // Group 2: 14 switched at L2 (Stay->Escape), 6 switched at L3 (Stay->Escape), 5 switched at L4 (Stay->Escape) = 25
  // Total mind changers = 3 + 25 = 28 students (41.8% -> 42%)
  assert(stats.mindChangers.count === 28, `Metric 4A - Mind-Changers count: 28 (actual: ${stats.mindChangers.count})`);
  assert(stats.mindChangers.pct === 42, `Metric 4B - Mind-Changers percentage: 42% (actual: ${stats.mindChangers.pct}%)`);

  // Metric 5: Primary OB Inflection Point
  // L2 Net switch: 14 - 2 = +12 to ESCAPE
  // L3 Net switch: 6 - 0 = +6 to ESCAPE
  // L4 Net switch: 5 - 0 = +5 to ESCAPE
  // Best inflection point must be L2
  assert(stats.primaryInflectionPoint.level === 'L2', `Metric 5A - Primary Inflection Point level: L2 (actual: ${stats.primaryInflectionPoint.level})`);
  assert(stats.primaryInflectionPoint.netSwitch === 12, `Metric 5B - Primary Inflection Point net switch: +12 (actual: +${stats.primaryInflectionPoint.netSwitch})`);
  assert(stats.primaryInflectionPoint.obTheory.includes("Adams' Equity Theory"), `Metric 5C - Primary Inflection OB Theory is Adams' Equity Theory (actual: ${stats.primaryInflectionPoint.obTheory})`);

  // Metric 6: Student Defenses in Feed
  const feedRes = await httpRequest('GET', '/api/state');
  assert(feedRes.json.feed.length === 12, `Metric 6 - 12 diverse student defenses loaded in feed (actual: ${feedRes.json.feed.length})`);
  assert(feedRes.json.feed.every(item => item.rebuttal !== null), 'Every simulated defense has an HBS AI cross-examination rebuttal');

  // -------------------------------------------------------------------------
  // SECTION 7: EXPORT & RESET VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n[SECTION 7] Session Export (.JSON / .TXT) & Reset Verification');

  // Test Export JSON
  const exportJsonRes = await httpRequest('GET', '/api/export?format=json');
  assert(exportJsonRes.statusCode === 200, 'GET /api/export?format=json returns 200 OK');
  assert(exportJsonRes.headers['content-type'].includes('application/json'), 'Export JSON Content-Type is application/json');
  assert(exportJsonRes.json && exportJsonRes.json.students.length === 67, 'Export JSON contains full 67 student records');
  assert(exportJsonRes.json.kpi.initialDecision.stayCount === 46, 'Export JSON contains correct initial decision KPI');
  assert(exportJsonRes.json.teamRubricAudit.toolUsed === 'Google Gemini 2.5 Flash', 'Export JSON includes Team Rubric Audit details');

  // Test Export TXT
  const exportTxtRes = await httpRequest('GET', '/api/export?format=txt');
  assert(exportTxtRes.statusCode === 200, 'GET /api/export?format=txt returns 200 OK');
  assert(exportTxtRes.headers['content-type'].includes('text/plain'), 'Export TXT Content-Type is text/plain');
  assert(exportTxtRes.body.includes('THE FINAL 48 HOURS: STAY OR ESCAPE?'), 'Export TXT contains header title');
  assert(exportTxtRes.body.includes('Total Connected Students: 67 / 67'), 'Export TXT contains connected student count');
  assert(exportTxtRes.body.includes('Primary OB Inflection Point: LEVEL 2'), 'Export TXT contains Primary Inflection Point');
  assert(exportTxtRes.body.includes('GROUP 4 OB RECOMMENDATIONS & RUBRIC OVERRIDE AUDIT'), 'Export TXT contains Rubric Audit section');

  // Test POST /api/reset
  const resetRes = await httpRequest('POST', '/api/reset');
  assert(resetRes.statusCode === 200, 'POST /api/reset returns 200 OK');
  assert(resetRes.json.success === true, 'POST /api/reset confirms success');

  const afterResetState = await httpRequest('GET', '/api/state');
  assert(afterResetState.json.stats.totalStudents === 0, 'After reset, total students is 0');
  assert(afterResetState.json.feed.length === 0, 'After reset, feed length is 0');

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(' VERIFICATION SUMMARY');
  console.log('======================================================================');
  console.log(` Total Assertions: ${testResults.passed + testResults.failed}`);
  console.log(` \x1b[32mPassed:\x1b[0m           ${testResults.passed}`);
  console.log(` \x1b[31mFailed:\x1b[0m           ${testResults.failed}`);

  if (testResults.failed === 0) {
    console.log('\n \x1b[32m✔ ALL VERIFICATION CHECKS PASSED PERFECTLY!\x1b[0m\n');
  } else {
    console.log(`\n \x1b[31m✘ ${testResults.failed} CHECKS FAILED! Review details above.\x1b[0m\n`);
  }

  // Cleanup: exit
  process.exit(testResults.failed === 0 ? 0 : 1);
}

// Run the verification suite
runTestSuite().catch(err => {
  console.error('[FATAL ERROR IN TEST SUITE]', err);
  process.exit(1);
});
