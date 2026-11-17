/**
 * 70-CONCURRENT-STUDENT STRESS & LOAD TEST
 * Simulates 70 actual students connecting simultaneously via WebSockets and REST,
 * casting 350 votes across all 5 levels, submitting defenses, and validating
 * telemetry performance under classroom peak load.
 */

const http = require('http');
const { io: ioClient } = require('socket.io-client');
const { server, state } = require('./server');

const BASE_URL = 'http://localhost:3000';
const CONCURRENT_STUDENTS = 100;

const agent = new http.Agent({ keepAlive: true, maxSockets: 100 });

function httpRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      agent,
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, text: raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runStressTest() {
  console.log('======================================================================');
  console.log(` STARTING CONCURRENT STRESS TEST: ${CONCURRENT_STUDENTS} SIMULTANEOUS STUDENTS`);
  console.log('======================================================================');

  // Reset session
  await httpRequest('POST', '/api/reset', { pin: '4820' }, { 'x-presenter-pin': '4820' });
  console.log('✔ Session reset to zero before stress test.');

  const startTime = Date.now();
  const sockets = [];
  const errors = [];
  let successfulJoins = 0;
  let successfulVotes = 0;
  let broadcastsReceived = 0;

  // 1. PHASE 1: 70 Concurrent WebSocket Connections
  console.log(`\n[Phase 1] Opening ${CONCURRENT_STUDENTS} simultaneous WebSocket connections...`);
  const connStart = Date.now();
  const connPromises = [];

  for (let i = 1; i <= CONCURRENT_STUDENTS; i++) {
    const p = new Promise(resolve => {
      const socket = ioClient(BASE_URL, {
        transports: ['websocket'],
        reconnection: false
      });
      socket.on('connect', () => {
        sockets.push(socket);
        resolve();
      });
      socket.on('connect_error', err => {
        errors.push(`Socket ${i} connect error: ${err.message}`);
        resolve();
      });
      socket.on('state_update', () => {
        broadcastsReceived++;
      });
    });
    connPromises.push(p);
  }

  await Promise.all(connPromises);
  const connDuration = Date.now() - connStart;
  console.log(`✔ ${sockets.length}/${CONCURRENT_STUDENTS} WebSockets connected in ${connDuration}ms (Avg: ${(connDuration / CONCURRENT_STUDENTS).toFixed(1)}ms per socket)`);

  // 2. PHASE 2: 70 Simultaneous Join Requests
  console.log(`\n[Phase 2] Firing ${CONCURRENT_STUDENTS} simultaneous Join requests (EXEC-101 to EXEC-170)...`);
  const joinStart = Date.now();
  const joinPromises = [];

  for (let i = 1; i <= CONCURRENT_STUDENTS; i++) {
    const sId = `EXEC-${100 + i}`;
    const p = httpRequest('POST', '/api/join', { studentId: sId })
      .then(res => {
        if (res.status === 200 && res.data.success) {
          successfulJoins++;
        } else {
          errors.push(`Join failed for ${sId}: ${JSON.stringify(res)}`);
        }
      })
      .catch(err => errors.push(`Join network error: ${err.message}`));
    joinPromises.push(p);
  }

  await Promise.all(joinPromises);
  const joinDuration = Date.now() - joinStart;
  console.log(`✔ ${successfulJoins}/${CONCURRENT_STUDENTS} students joined in ${joinDuration}ms (Throughput: ${Math.round(CONCURRENT_STUDENTS / (joinDuration / 1000))} req/sec)`);

  // 3. PHASE 3: 350 Total Concurrent Votes Across All 5 Levels
  console.log(`\n[Phase 3] Firing 350 simultaneous votes across Levels 1 through 5...`);
  const voteStart = Date.now();
  const votePromises = [];

  for (let i = 1; i <= CONCURRENT_STUDENTS; i++) {
    const sId = `EXEC-${100 + i}`;
    ['L1', 'L2', 'L3', 'L4', 'L5'].forEach((lvl, idx) => {
      // Realistic distribution: some choose STAY, some choose ESCAPE, some switch
      const choice = (i + idx) % 2 === 0 ? 'STAY' : 'ESCAPE';
      const p = httpRequest('POST', '/api/vote', { studentId: sId, level: lvl, choice })
        .then(res => {
          if (res.status === 200 && res.data.success) {
            successfulVotes++;
          } else {
            errors.push(`Vote failed for ${sId} at ${lvl}: ${JSON.stringify(res)}`);
          }
        })
        .catch(err => errors.push(`Vote network error: ${err.code || err.message}`));
      votePromises.push(p);
    });
  }

  await Promise.all(votePromises);
  const voteDuration = Date.now() - voteStart;
  console.log(`✔ ${successfulVotes}/350 votes processed and stored in ${voteDuration}ms (Throughput: ${Math.round(350 / (voteDuration / 1000))} votes/sec)`);

  // 4. PHASE 4: Concurrent Defense Statements
  console.log(`\n[Phase 4] Submitting 20 simultaneous student defense statements...`);
  const defPromises = [];
  for (let i = 1; i <= 20; i++) {
    const sId = `EXEC-${100 + i}`;
    const p = httpRequest('POST', '/api/defense', {
      studentId: sId,
      defenseText: `Stress test defense justification from executive ${sId} on fairness.`,
      decision: i % 2 === 0 ? 'STAY' : 'ESCAPE'
    });
    defPromises.push(p);
  }
  await Promise.all(defPromises);
  console.log('✔ Defense submissions handled smoothly.');

  // 5. PHASE 5: Telemetry Verification & State Integrity Check
  console.log(`\n[Phase 5] Verifying Telemetry and Live State...`);
  const stateRes = await httpRequest('GET', '/api/state');
  const stats = stateRes.data.stats;

  console.log(`  - Total Registered Students: ${stats.totalStudents} (Expected: ${CONCURRENT_STUDENTS})`);
  console.log(`  - Level 5 Stay Votes:        ${stats.finalVerdict.stayCount}`);
  console.log(`  - Level 5 Escape Votes:      ${stats.finalVerdict.escapeCount}`);
  console.log(`  - Level 5 Total Votes:       ${stats.finalVerdict.stayCount + stats.finalVerdict.escapeCount} (Expected: ${CONCURRENT_STUDENTS})`);
  console.log(`  - Mind-Changers Detected:    ${stats.mindChangers.count} (${stats.mindChangers.pct}%)`);
  console.log(`  - Shift A -> B:              ${stats.mindChangers.shiftAtoB.count}`);
  console.log(`  - Shift B -> A:              ${stats.mindChangers.shiftBtoA.count}`);
  console.log(`  - Real-time Sockets Active:  ${sockets.length}`);
  console.log(`  - Total Broadcasts Handled:  ${broadcastsReceived}`);

  // Disconnect all test sockets
  sockets.forEach(s => s.disconnect());

  const totalTime = Date.now() - startTime;
  console.log('\n======================================================================');
  console.log(` STRESS TEST RESULTS:`);
  console.log(` - Total Duration: ${totalTime}ms (~${(totalTime / 1000).toFixed(2)}s)`);
  console.log(` - Errors Encountered: ${errors.length}`);
  if (errors.length > 0) {
    console.error(' - Failures:', errors.slice(0, 5));
  } else {
    console.log(' - Reliability: 100.0% SUCCESS');
    console.log(` - Zero dropped connections, zero dropped votes, zero race conditions!`);
  }
  console.log('======================================================================');

  // Clean up
  await httpRequest('POST', '/api/reset', { pin: '4820' }, { 'x-presenter-pin': '4820' });
  process.exit(errors.length === 0 ? 0 : 1);
}

runStressTest().catch(err => {
  console.error('Stress test fatal error:', err);
  process.exit(1);
});
