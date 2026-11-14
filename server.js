/**
 * server.js
 * Carlos Ghosn MBA Decision Simulation: The Final 48 Hours: Stay or Escape?
 * (HBS Case 9-122-051)
 * 
 * Features:
 * - Express + Socket.IO with WebSocket + HTTP Polling fallback
 * - Auto LAN IPv4 detection for classroom QR codes (GET /api/network-info)
 * - In-memory session state with debounced JSON backup (no API keys written to disk)
 * - Real-time voting, aggregation, mind-changers, and primary OB inflection point calculation
 * - AI Cross-Examination Engine (Gemini 2.5 Flash + deterministic HBS fallback)
 * - Real-time AI interaction logging (aiLog) + Presenter override notes
 * - PRESENTER_PIN protected admin endpoints
 * - Input validation, sanitization (XSS prevention), and rate limiting
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { generateAiChallenge, getDeterministicFallback } = require('./ai_engine');

const app = express();
const server = http.createServer(app);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io setup with CORS and HTTP polling fallback support
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const STATE_FILE = path.join(__dirname, 'session_state.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Disable aggressive browser caching for HTML, JS, and CSS so classroom updates apply immediately
app.use((req, res, next) => {
  if (req.url.endsWith('.html') || req.url.endsWith('.js') || req.url.endsWith('.css') || req.url === '/' || req.url === '/presenter' || req.url === '/live-counter') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Serve static files
app.use(express.static(PUBLIC_DIR));

// Validation & Sanitization Helpers
const ID_PATTERN = /^EXEC-[0-9]{3,4}$/;

function cleanText(value, max = 140) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

// In-Memory Runtime State
let runtimeApiKey = null;
const studentDefenseCooldown = new Map(); // studentId -> timestamp
let lastPresenterAiCall = 0;

let state = {
  students: {},       // { [studentId]: { studentId, joinedAt, lastActive, votes: { L1..L5 }, defense } }
  feed: [],           // [ { id, studentId, decision, defenseText, timestamp, rebuttal } ]
  aiLog: [],          // [ { id, time, trigger, decision, input, output, source, model, teamNote } ]
  activeSockets: 0
};

// ---------------------------------------------------------------------------
// 1. Persistence & State Recovery (API Key Never Saved to Disk)
// ---------------------------------------------------------------------------
function loadStateFromDisk() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        state.students = parsed.students || {};
        state.feed = parsed.feed || [];
        state.aiLog = Array.isArray(parsed.aiLog) ? parsed.aiLog : [];
        console.log(`[State] Restored ${Object.keys(state.students).length} students, ${state.feed.length} defenses, and ${state.aiLog.length} AI log entries.`);
      }
    }
  } catch (err) {
    console.warn('[State] Failed to read session_state.json, starting with fresh state:', err.message);
  }
}

let saveTimeout = null;
function debouncedSaveState() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const payload = {
        students: state.students,
        feed: state.feed,
        aiLog: state.aiLog,
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      console.error('[State] Error saving session_state.json:', err.message);
    }
  }, 400);
}

function logAi(entry) {
  const record = Object.assign({
    id: `AI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    time: new Date().toISOString(),
    teamNote: ''
  }, entry);
  state.aiLog.push(record);
  if (state.aiLog.length > 300) state.aiLog.shift();
  debouncedSaveState();
  return record;
}

loadStateFromDisk();

// ---------------------------------------------------------------------------
// 2. Active LAN IP & Network Info Helper
// ---------------------------------------------------------------------------
function getActiveLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        let score = 1;
        const lowerName = name.toLowerCase();
        if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wlan')) score += 10;
        if (lowerName.includes('ethernet') || lowerName.includes('eth') || lowerName.includes('local')) score += 8;
        if (lowerName.includes('virtual') || lowerName.includes('vethernet') || lowerName.includes('wsl') || lowerName.includes('vmware')) score -= 6;
        if (addr.address.startsWith('192.168.')) score += 4;
        else if (addr.address.startsWith('10.')) score += 3;
        else if (addr.address.startsWith('172.')) score += 2;
        candidates.push({ ip: addr.address, score, name });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].ip;
  }
  return 'localhost';
}

// ---------------------------------------------------------------------------
// 3. Presenter Security Middleware
// ---------------------------------------------------------------------------
function requirePin(req, res, next) {
  const pin = req.get('x-presenter-pin') || (req.body && req.body.pin) || req.query.pin;
  if (!process.env.PRESENTER_PIN || pin !== process.env.PRESENTER_PIN) {
    return res.status(401).json({ error: 'Presenter PIN required.' });
  }
  next();
}

// ---------------------------------------------------------------------------
// 4. Analytics & KPI Calculation Engine
// ---------------------------------------------------------------------------
const OB_THEORIES = {
  L1: "Baseline Distributive Framing (Legal Defense vs Immediate Flight)",
  L2: "Adams' Equity Theory & Referent Comparisons (Saikawa $440k Double Standard)",
  L3: "Procedural Justice & Risk Perception (>99% Conviction Rate & Indefinite Detention)",
  L4: "Interpersonal and Informational Justice & Risk Perception",
  L5: "Hindsight Verdict & Accountability (Beirut Reality vs Kelly Counterfactual)"
};

function calculateStats(studentsObj = state.students) {
  const studentList = Object.values(studentsObj);
  const totalStudents = studentList.length;

  const levelStats = {
    L1: { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 },
    L2: { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 },
    L3: { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 },
    L4: { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 },
    L5: { stayCount: 0, escapeCount: 0, totalVotes: 0, stayPct: 0, escapePct: 0 }
  };

  studentList.forEach(student => {
    const votes = student.votes || {};
    ['L1', 'L2', 'L3', 'L4', 'L5'].forEach(lvl => {
      const choice = votes[lvl];
      if (choice === 'STAY') levelStats[lvl].stayCount++;
      else if (choice === 'ESCAPE') levelStats[lvl].escapeCount++;
    });
  });

  ['L1', 'L2', 'L3', 'L4', 'L5'].forEach(lvl => {
    const st = levelStats[lvl];
    st.totalVotes = st.stayCount + st.escapeCount;
    st.stayPct = st.totalVotes > 0 ? Math.round((st.stayCount / st.totalVotes) * 100) : 0;
    st.escapePct = st.totalVotes > 0 ? Math.round((st.escapeCount / st.totalVotes) * 100) : 0;
  });

  // Calculate Mind-Changers
  let mindChangersCount = 0;
  studentList.forEach(student => {
    const votes = student.votes || {};
    const sequence = ['L1', 'L2', 'L3', 'L4', 'L5']
      .map(lvl => votes[lvl])
      .filter(v => v === 'STAY' || v === 'ESCAPE');
    
    if (sequence.length >= 2) {
      let changed = false;
      for (let i = 1; i < sequence.length; i++) {
        if (sequence[i] !== sequence[i - 1]) {
          changed = true;
          break;
        }
      }
      if (changed) mindChangersCount++;
    }
  });

  const mindChangersPct = totalStudents > 0 ? Math.round((mindChangersCount / totalStudents) * 100) : 0;

  // Calculate Primary OB Inflection Point (among L2, L3, L4)
  const transitions = {
    L2: { stayToEscape: 0, escapeToStay: 0, netSwitchToEscape: 0 },
    L3: { stayToEscape: 0, escapeToStay: 0, netSwitchToEscape: 0 },
    L4: { stayToEscape: 0, escapeToStay: 0, netSwitchToEscape: 0 }
  };

  studentList.forEach(student => {
    const v = student.votes || {};
    if (v.L1 && v.L2) {
      if (v.L1 === 'STAY' && v.L2 === 'ESCAPE') transitions.L2.stayToEscape++;
      if (v.L1 === 'ESCAPE' && v.L2 === 'STAY') transitions.L2.escapeToStay++;
    }
    if (v.L2 && v.L3) {
      if (v.L2 === 'STAY' && v.L3 === 'ESCAPE') transitions.L3.stayToEscape++;
      if (v.L2 === 'ESCAPE' && v.L3 === 'STAY') transitions.L3.escapeToStay++;
    }
    if (v.L3 && v.L4) {
      if (v.L3 === 'STAY' && v.L4 === 'ESCAPE') transitions.L4.stayToEscape++;
      if (v.L3 === 'ESCAPE' && v.L4 === 'STAY') transitions.L4.escapeToStay++;
    }
  });

  ['L2', 'L3', 'L4'].forEach(lvl => {
    transitions[lvl].netSwitchToEscape = transitions[lvl].stayToEscape - transitions[lvl].escapeToStay;
  });

  let bestLevel = 'L2';
  let maxNet = transitions.L2.netSwitchToEscape;
  ['L3', 'L4'].forEach(lvl => {
    if (transitions[lvl].netSwitchToEscape > maxNet) {
      maxNet = transitions[lvl].netSwitchToEscape;
      bestLevel = lvl;
    }
  });

  const primaryInflectionPoint = {
    level: bestLevel,
    levelNumber: parseInt(bestLevel.replace('L', ''), 10),
    netSwitch: maxNet,
    grossSwitchToEscape: transitions[bestLevel].stayToEscape,
    obTheory: OB_THEORIES[bestLevel],
    allTransitions: transitions
  };

  const initialDecision = {
    stayCount: levelStats.L1.stayCount,
    escapeCount: levelStats.L1.escapeCount,
    stayPct: levelStats.L1.stayPct,
    escapePct: levelStats.L1.escapePct,
    majority: levelStats.L1.escapeCount >= levelStats.L1.stayCount ? 'ESCAPE' : 'STAY'
  };

  const finalVerdict = {
    stayCount: levelStats.L5.stayCount,
    escapeCount: levelStats.L5.escapeCount,
    stayPct: levelStats.L5.stayPct,
    escapePct: levelStats.L5.escapePct,
    majority: levelStats.L5.escapeCount >= levelStats.L5.stayCount ? 'ESCAPE' : 'STAY'
  };

  return {
    totalStudents,
    levelStats,
    initialDecision,
    finalVerdict,
    mindChangers: {
      count: mindChangersCount,
      pct: mindChangersPct
    },
    primaryInflectionPoint
  };
}

// ---------------------------------------------------------------------------
// 5. Client View & Public Utility Routes
// ---------------------------------------------------------------------------
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

app.get('/', (req, res) => {
  const file = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.send('<html><body><h2>The Final 48 Hours</h2></body></html>');
});

app.get('/presenter', (req, res) => {
  const file = path.join(PUBLIC_DIR, 'presenter.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.send('<html><body><h2>Classroom Projector Dashboard</h2></body></html>');
});

app.get('/live-counter', (req, res) => {
  const file = path.join(PUBLIC_DIR, 'live_counter.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.redirect('/presenter');
});

// GET /api/network-info
app.get('/api/network-info', (req, res) => {
  const activePort = server.address() ? server.address().port : 3000;
  const lanIp = getActiveLanIp();
  res.json({
    lanIp,
    port: activePort,
    fullUrl: `http://${lanIp}:${activePort}`,
    allInterfaces: os.networkInterfaces()
  });
});

// GET /api/state
app.get('/api/state', (req, res) => {
  const stats = calculateStats();
  res.json({
    stats,
    feed: state.feed,
    activeSockets: state.activeSockets,
    hasApiKey: !!(runtimeApiKey || process.env.GEMINI_API_KEY)
  });
});

// POST /api/auth/verify-pin
app.post('/api/auth/verify-pin', requirePin, (req, res) => {
  res.json({ ok: true });
});

// POST /api/join
app.post('/api/join', (req, res) => {
  const { studentId } = req.body || {};
  const cleanId = String(studentId || '').trim().toUpperCase();

  if (!cleanId || !ID_PATTERN.test(cleanId)) {
    return res.status(400).json({ error: 'Invalid id.' });
  }

  if (!state.students[cleanId]) {
    state.students[cleanId] = {
      studentId: cleanId,
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      votes: {},
      defense: null
    };
  } else {
    state.students[cleanId].lastActive = new Date().toISOString();
  }

  debouncedSaveState();
  const stats = calculateStats();
  io.emit('state_update', { stats, feed: state.feed });
  res.json({ success: true, studentId: cleanId, stats });
});

// POST /api/vote (Requires prior join)
app.post('/api/vote', (req, res) => {
  const { studentId, level, choice } = req.body || {};
  const cleanId = String(studentId || '').trim().toUpperCase();

  if (!cleanId || !ID_PATTERN.test(cleanId)) {
    return res.status(400).json({ error: 'Invalid id.' });
  }

  if (!state.students[cleanId]) {
    return res.status(400).json({ error: 'Must join session before voting.' });
  }

  const lvlKey = typeof level === 'string' && level.startsWith('L') ? level.toUpperCase() : `L${level}`;
  const cleanChoice = String(choice || '').trim().toUpperCase();

  if (!['L1', 'L2', 'L3', 'L4', 'L5'].includes(lvlKey)) {
    return res.status(400).json({ error: 'level must be L1 through L5.' });
  }
  if (!['STAY', 'ESCAPE'].includes(cleanChoice)) {
    return res.status(400).json({ error: 'choice must be STAY or ESCAPE.' });
  }

  state.students[cleanId].votes[lvlKey] = cleanChoice;
  state.students[cleanId].lastActive = new Date().toISOString();

  debouncedSaveState();
  const stats = calculateStats();
  io.emit('state_update', { stats, feed: state.feed });
  res.json({ success: true, studentId: cleanId, level: lvlKey, choice: cleanChoice, stats });
});

// POST /api/defense (Per-student rate limited to 30s)
app.post('/api/defense', (req, res) => {
  const { studentId, defenseText, decision } = req.body || {};
  const cleanId = String(studentId || '').trim().toUpperCase();

  if (!cleanId || !ID_PATTERN.test(cleanId)) {
    return res.status(400).json({ error: 'Invalid id.' });
  }

  const cleanDef = cleanText(defenseText, 140);
  if (!cleanDef) {
    return res.status(400).json({ error: 'defenseText is required.' });
  }

  const now = Date.now();
  const lastTime = studentDefenseCooldown.get(cleanId) || 0;
  if (now - lastTime < 30000) {
    return res.status(429).json({ error: 'Defense submission rate limit: wait 30 seconds.' });
  }
  studentDefenseCooldown.set(cleanId, now);

  const cleanDecision = (decision || (state.students[cleanId] && state.students[cleanId].votes.L5) || 'STAY').toUpperCase();

  if (state.students[cleanId]) {
    state.students[cleanId].defense = cleanDef;
    state.students[cleanId].lastActive = new Date().toISOString();
  }

  const entry = {
    id: `def-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    studentId: cleanId,
    decision: cleanDecision,
    defenseText: cleanDef,
    timestamp: new Date().toISOString(),
    rebuttal: null
  };

  state.feed.unshift(entry);
  if (state.feed.length > 50) state.feed.pop();

  debouncedSaveState();
  const stats = calculateStats();
  io.emit('new_defense', entry);
  io.emit('state_update', { stats, feed: state.feed });
  res.json({ success: true, entry, stats });
});

// ---------------------------------------------------------------------------
// 6. Protected Presenter API Endpoints
// ---------------------------------------------------------------------------

// POST /api/ai/challenge (Protected + Rate limited to 1 call per 3s)
app.post('/api/ai/challenge', requirePin, async (req, res) => {
  const now = Date.now();
  if (now - lastPresenterAiCall < 3000) {
    return res.status(429).json({ error: 'AI challenge rate limit: max 1 request every 3 seconds.' });
  }
  lastPresenterAiCall = now;

  const { decision, majorityDecision, defenseText, apiKey, feedId, mode } = req.body || {};
  const cleanDefense = cleanText(defenseText, mode === 'recommendation' ? 240 : 140);
  const keyToUse = apiKey ? cleanText(apiKey, 200) : (runtimeApiKey || process.env.GEMINI_API_KEY);

  try {
    const result = await generateAiChallenge({
      decision,
      majorityDecision,
      defenseText: cleanDefense,
      apiKey: keyToUse,
      mode: mode || 'class-defense'
    });

    if (feedId) {
      const match = state.feed.find(item => item.id === feedId);
      if (match) {
        match.rebuttal = result.challengeText;
        match.rebuttalSource = result.source;
        debouncedSaveState();
      }
    }

    const logRecord = logAi({
      trigger: mode || 'class-defense',
      decision: decision || majorityDecision || null,
      input: cleanDefense,
      output: result.challengeText,
      source: result.source,
      model: result.model
    });

    io.emit('ai_rebuttal_result', { feedId, logId: logRecord.id, ...result });
    res.json({ success: true, logId: logRecord.id, ...result });
  } catch (err) {
    console.error('[AI Challenge] Error:', err.message);
    const fallback = getDeterministicFallback({
      decision,
      majorityDecision,
      defenseText: cleanDefense,
      mode: mode || 'class-defense'
    });

    const logRecord = logAi({
      trigger: mode || 'class-defense',
      decision: decision || majorityDecision || null,
      input: cleanDefense,
      output: fallback,
      source: 'fallback',
      model: 'hbs-deterministic-engine'
    });

    res.json({
      success: true,
      challengeText: fallback,
      source: 'fallback',
      model: 'hbs-deterministic-engine',
      logId: logRecord.id,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/ai/note (Attach presenter override note onto aiLog entry)
app.post('/api/ai/note', requirePin, (req, res) => {
  const { logId, teamNote } = req.body || {};
  if (!logId) {
    return res.status(400).json({ error: 'logId is required.' });
  }
  const cleanNote = cleanText(teamNote, 500);
  const match = state.aiLog.find(item => item.id === logId);
  if (!match) {
    return res.status(404).json({ error: 'AI log entry not found.' });
  }
  match.teamNote = cleanNote;
  debouncedSaveState();
  res.json({ success: true, ok: true, record: match });
});

// POST /api/settings/apikey (Runtime in-memory only)
app.post('/api/settings/apikey', requirePin, (req, res) => {
  const { apiKey } = req.body || {};
  runtimeApiKey = apiKey ? cleanText(apiKey, 200) : null;
  res.json({ success: true, hasKey: !!runtimeApiKey });
});

// POST /api/reset (Protected)
app.post('/api/reset', requirePin, (req, res) => {
  state.students = {};
  state.feed = [];
  state.aiLog = [];
  if (fs.existsSync(STATE_FILE)) {
    try {
      fs.unlinkSync(STATE_FILE);
    } catch (e) {}
  }
  const stats = calculateStats();
  io.emit('session_reset');
  io.emit('state_update', { stats, feed: [] });
  res.json({ success: true, message: 'Classroom session reset to clean slate.' });
});

// ---------------------------------------------------------------------------
// 7. 67-Student Realistic Simulation Engine (Rehearsal Mode)
// ---------------------------------------------------------------------------
const SAMPLE_DEFENSES = [
  { text: "Saikawa walked free after admitting to $440k in unearned pay while Ghosn faced 15 years; Adams' Equity Theory reveals an indefensible referent imbalance.", decision: "ESCAPE" },
  { text: "A 99% conviction rate, 130 days in detention with daily interrogation without a lawyer, and withheld evidence means procedural justice was completely nonexistent in Tokyo.", decision: "ESCAPE" },
  { text: "Fleeing while on bail forfeits the moral high ground and permanently confirms public perception of the SEC deferred compensation charges.", decision: "STAY" },
  { text: "Carole's visitation denial and 42 months of non-overlapping trials crossed the line into psychological hostage justice under loss aversion.", decision: "ESCAPE" },
  { text: "Staying to clear your name was the only honorable course, but the Japanese legal architecture made a fair trial structurally impossible.", decision: "ESCAPE" },
  { text: "Greg Kelly stayed in Tokyo on $640k bail and waited 2 years without a hearing; leaving him behind destroyed executive solidarity.", decision: "STAY" },
  { text: "Overconfidence bias led Ghosn to believe Lebanon would mean freedom, but an Interpol Red Notice and Carole's warrant created an extradition prison.", decision: "STAY" },
  { text: "The political coup to halt the Renault-Nissan merger weaponized prosecutors; staying would have validated a corporate ambush.", decision: "ESCAPE" },
  { text: "Western executive pay expectations violated Japan's 16:1 norm; fleeing to Beirut confirms an inability to accept Japanese governance accountability.", decision: "STAY" },
  { text: "Interpersonal disrespect from daily interrogation and holiday isolation made escape a basic act of human self-preservation.", decision: "ESCAPE" },
  { text: "The SEC $140M settlement proved financial misconduct was real; escape was self-exile to avoid an inevitable guilty verdict.", decision: "STAY" },
  { text: "With withheld recordings and judges penalized for acquittals, staying was not noble bravery—it was procedural suicide.", decision: "ESCAPE" }
];

async function runCohortSimulation(animated = true) {
  state.students = {};
  state.feed = [];

  const totalSimStudents = 67;
  const studentList = [];

  for (let i = 1; i <= totalSimStudents; i++) {
    const sId = `EXEC-${100 + i}`;
    studentList.push({
      studentId: sId,
      joinedAt: new Date(Date.now() - (67 - i) * 1000).toISOString(),
      lastActive: new Date().toISOString(),
      votes: {},
      defense: null
    });
  }

  studentList.forEach((s, idx) => {
    if (idx < 21) {
      if (idx < 2) {
        s.votes = { L1: 'ESCAPE', L2: 'STAY', L3: 'STAY', L4: 'STAY', L5: 'STAY' };
      } else if (idx < 3) {
        s.votes = { L1: 'ESCAPE', L2: 'ESCAPE', L3: 'STAY', L4: 'STAY', L5: 'STAY' };
      } else {
        s.votes = { L1: 'ESCAPE', L2: 'ESCAPE', L3: 'ESCAPE', L4: 'ESCAPE', L5: 'ESCAPE' };
      }
    } else {
      if (idx >= 21 && idx < 35) {
        s.votes = { L1: 'STAY', L2: 'ESCAPE', L3: 'ESCAPE', L4: 'ESCAPE', L5: 'ESCAPE' };
      } else if (idx >= 35 && idx < 41) {
        s.votes = { L1: 'STAY', L2: 'STAY', L3: 'ESCAPE', L4: 'ESCAPE', L5: 'ESCAPE' };
      } else if (idx >= 41 && idx < 46) {
        s.votes = { L1: 'STAY', L2: 'STAY', L3: 'STAY', L4: 'ESCAPE', L5: 'ESCAPE' };
      } else {
        s.votes = { L1: 'STAY', L2: 'STAY', L3: 'STAY', L4: 'STAY', L5: 'STAY' };
      }
    }
    state.students[s.studentId] = s;
  });

  SAMPLE_DEFENSES.forEach((sample, idx) => {
    const assignedStudent = studentList[idx * 5];
    if (assignedStudent) {
      assignedStudent.defense = sample.text;
      const rebuttal = getDeterministicFallback({
        decision: sample.decision,
        defenseText: sample.text
      });

      const entry = {
        id: `def-sim-${idx + 1}`,
        studentId: assignedStudent.studentId,
        decision: sample.decision,
        defenseText: sample.text,
        timestamp: new Date(Date.now() - (12 - idx) * 4000).toISOString(),
        rebuttal: rebuttal,
        rebuttalSource: 'fallback'
      };
      state.feed.push(entry);
    }
  });

  debouncedSaveState();
  const stats = calculateStats();

  if (animated) {
    for (let step = 1; step <= 5; step++) {
      const partialStudents = {};
      studentList.forEach(s => {
        const partialVotes = {};
        for (let l = 1; l <= step; l++) {
          partialVotes[`L${l}`] = s.votes[`L${l}`];
        }
        partialStudents[s.studentId] = { ...s, votes: partialVotes };
      });
      const partialStats = calculateStats(partialStudents);
      io.emit('state_update', { stats: partialStats, feed: state.feed.slice(0, step * 2) });
      await new Promise(r => setTimeout(r, 600));
    }
  }

  io.emit('state_update', { stats, feed: state.feed });
  return stats;
}

// POST /api/simulate (Protected)
app.post('/api/simulate', requirePin, async (req, res) => {
  try {
    const stats = await runCohortSimulation(req.query.instant !== 'true');
    res.json({
      success: true,
      message: 'Simulated 67 students across L1-L5 successfully.',
      stats,
      studentsCount: 67
    });
  } catch (err) {
    console.error('[Simulate Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 8. Session Export Engine (JSON & Executive TXT with Real aiLog)
// ---------------------------------------------------------------------------
app.get('/api/export', requirePin, (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();
  const stats = calculateStats();
  const timestamp = new Date().toISOString();

  if (format === 'txt') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="carlos_ghosn_simulation_${Date.now()}.txt"`);

    let txt = '';
    txt += '================================================================================\n';
    txt += '  THE FINAL 48 HOURS: STAY OR ESCAPE? (CARLOS GHOSN HBS CASE 9-122-051)\n';
    txt += '  CLASSROOM DECISION SIMULATION & LIVE BEHAVIORAL TELEMETRY REPORT\n';
    txt += '================================================================================\n\n';
    txt += `Generated: ${timestamp}\n`;
    txt += `Total Connected Students: ${stats.totalStudents} / 67\n`;
    txt += `Host Server LAN Address: http://${getActiveLanIp()}:${server.address() ? server.address().port : 3000}\n\n`;

    txt += '--------------------------------------------------------------------------------\n';
    txt += '1. EXECUTIVE KPI SUMMARY & BEHAVIORAL INFLECTION\n';
    txt += '--------------------------------------------------------------------------------\n';
    txt += `Initial Decision (Level 1): STAY ${stats.initialDecision.stayPct}% (${stats.initialDecision.stayCount})  |  ESCAPE ${stats.initialDecision.escapePct}% (${stats.initialDecision.escapeCount})\n`;
    txt += `Final Verdict    (Level 5): STAY ${stats.finalVerdict.stayPct}% (${stats.finalVerdict.stayCount})  |  ESCAPE ${stats.finalVerdict.escapePct}% (${stats.finalVerdict.escapeCount})\n`;
    txt += `Mind-Changers (Cognitive Shift): ${stats.mindChangers.count} students (${stats.mindChangers.pct}% of cohort switched decisions at least once)\n`;
    txt += `Primary OB Inflection Point: LEVEL ${stats.primaryInflectionPoint.levelNumber} (${stats.primaryInflectionPoint.level})\n`;
    txt += `   OB Lens: ${stats.primaryInflectionPoint.obTheory}\n`;
    txt += `   Net Shift to Escape: +${stats.primaryInflectionPoint.netSwitch} students\n\n`;

    txt += '--------------------------------------------------------------------------------\n';
    txt += '2. LEVEL-BY-LEVEL VOTING TRAJECTORY\n';
    txt += '--------------------------------------------------------------------------------\n';
    ['L1', 'L2', 'L3', 'L4', 'L5'].forEach(lvl => {
      const st = stats.levelStats[lvl];
      txt += `[${lvl}] ${OB_THEORIES[lvl]}\n`;
      txt += `     STAY:   ${st.stayPct}% (${st.stayCount} votes)\n`;
      txt += `     ESCAPE: ${st.escapePct}% (${st.escapeCount} votes)\n`;
      txt += `     Total:  ${st.totalVotes} votes\n\n`;
    });

    txt += '--------------------------------------------------------------------------------\n';
    txt += '3. STUDENT DEFENSES & AI STAKEHOLDER CROSS-EXAMINATIONS\n';
    txt += '--------------------------------------------------------------------------------\n';
    if (state.feed.length === 0) {
      txt += 'No student defenses submitted in this session.\n\n';
    } else {
      state.feed.forEach((item, index) => {
        txt += `[#${index + 1}] Student ID: ${item.studentId} | Decision: ${item.decision}\n`;
        txt += `     Defense: "${item.defenseText}"\n`;
        if (item.rebuttal) {
          txt += `     AI Nissan Board Rebuttal: "${item.rebuttal}"\n`;
        }
        txt += '\n';
      });
    }

    txt += '--------------------------------------------------------------------------------\n';
    txt += '4. AI INTERACTION LOG\n';
    txt += '--------------------------------------------------------------------------------\n';
    if (state.aiLog.length === 0) {
      txt += 'No AI cross-examinations recorded in this session.\n';
    } else {
      state.aiLog.forEach((entry, idx) => {
        txt += `[#${idx + 1}] ID: ${entry.id} | Time: ${entry.time} | Trigger: ${entry.trigger}\n`;
        txt += `     Decision: ${entry.decision || 'N/A'} | Source: ${entry.source} (${entry.model || 'N/A'})\n`;
        txt += `     Input: "${entry.input || ''}"\n`;
        txt += `     AI Output: "${entry.output || ''}"\n`;
        if (entry.teamNote) {
          txt += `     Presenter Team Note: "${entry.teamNote}"\n`;
        }
        txt += '\n';
      });
    }
    txt += '================================================================================\n';

    return res.send(txt);
  }

  // JSON format
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="carlos_ghosn_simulation_${Date.now()}.json"`);
  res.json({
    sessionTitle: "The Final 48 Hours: Stay or Escape? (Carlos Ghosn HBS Case 9-122-051)",
    exportTimestamp: timestamp,
    kpi: {
      initialDecision: stats.initialDecision,
      finalVerdict: stats.finalVerdict,
      mindChangers: stats.mindChangers,
      primaryInflectionPoint: stats.primaryInflectionPoint
    },
    levelStats: stats.levelStats,
    students: Object.values(state.students),
    feed: state.feed,
    aiLog: state.aiLog
  });
});

// ---------------------------------------------------------------------------
// 9. Socket.IO Real-Time Dispatcher
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  state.activeSockets++;
  const stats = calculateStats();
  socket.emit('state_update', { stats, feed: state.feed });

  socket.on('disconnect', () => {
    state.activeSockets = Math.max(0, state.activeSockets - 1);
  });

  socket.on('get_state', () => {
    socket.emit('state_update', { stats: calculateStats(), feed: state.feed });
  });

  socket.on('join_student', (payload) => {
    const studentId = payload && payload.studentId ? String(payload.studentId).trim().toUpperCase() : null;
    if (studentId && ID_PATTERN.test(studentId)) {
      if (!state.students[studentId]) {
        state.students[studentId] = {
          studentId,
          joinedAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          votes: {},
          defense: null
        };
      } else {
        state.students[studentId].lastActive = new Date().toISOString();
      }
      debouncedSaveState();
      io.emit('state_update', { stats: calculateStats(), feed: state.feed });
      socket.emit('join_confirmed', { studentId, student: state.students[studentId] });
    }
  });

  socket.on('submit_vote', (payload) => {
    const { studentId, level, choice } = payload || {};
    const cleanId = String(studentId || '').trim().toUpperCase();

    if (cleanId && ID_PATTERN.test(cleanId) && state.students[cleanId]) {
      const lvlKey = typeof level === 'string' && level.startsWith('L') ? level.toUpperCase() : `L${level}`;
      const cleanChoice = String(choice || '').trim().toUpperCase();

      if (['L1', 'L2', 'L3', 'L4', 'L5'].includes(lvlKey) && ['STAY', 'ESCAPE'].includes(cleanChoice)) {
        state.students[cleanId].votes[lvlKey] = cleanChoice;
        state.students[cleanId].lastActive = new Date().toISOString();
        debouncedSaveState();
        io.emit('state_update', { stats: calculateStats(), feed: state.feed });
      }
    }
  });

  socket.on('submit_defense', (payload) => {
    const { studentId, defenseText, decision } = payload || {};
    const cleanId = String(studentId || '').trim().toUpperCase();

    if (cleanId && ID_PATTERN.test(cleanId) && defenseText) {
      const cleanDef = cleanText(defenseText, 140);
      const now = Date.now();
      const lastTime = studentDefenseCooldown.get(cleanId) || 0;
      if (now - lastTime < 30000) return; // rate limit
      studentDefenseCooldown.set(cleanId, now);

      const cleanDecision = (decision || (state.students[cleanId] && state.students[cleanId].votes.L5) || 'STAY').toUpperCase();

      if (state.students[cleanId]) {
        state.students[cleanId].defense = cleanDef;
        state.students[cleanId].lastActive = new Date().toISOString();
      }

      const entry = {
        id: `def-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: cleanId,
        decision: cleanDecision,
        defenseText: cleanDef,
        timestamp: new Date().toISOString(),
        rebuttal: null
      };

      state.feed.unshift(entry);
      if (state.feed.length > 50) state.feed.pop();

      debouncedSaveState();
      io.emit('new_defense', entry);
      io.emit('state_update', { stats: calculateStats(), feed: state.feed });
    }
  });

  socket.on('request_ai_rebuttal', async (payload) => {
    if (!process.env.PRESENTER_PIN || !payload || payload.pin !== process.env.PRESENTER_PIN) {
      return;
    }

    const { studentId, defenseText, decision, apiKey, feedId, mode } = payload || {};
    const cleanDefense = cleanText(defenseText, mode === 'recommendation' ? 240 : 140);
    const keyToUse = apiKey ? cleanText(apiKey, 200) : (runtimeApiKey || process.env.GEMINI_API_KEY);

    try {
      const result = await generateAiChallenge({
        decision,
        defenseText: cleanDefense,
        apiKey: keyToUse,
        mode: mode || 'class-defense'
      });

      if (feedId) {
        const match = state.feed.find(item => item.id === feedId);
        if (match) {
          match.rebuttal = result.challengeText;
          match.rebuttalSource = result.source;
          debouncedSaveState();
        }
      }

      const logRecord = logAi({
        trigger: mode || 'class-defense',
        decision: decision || null,
        input: cleanDefense,
        output: result.challengeText,
        source: result.source,
        model: result.model
      });

      io.emit('ai_rebuttal_result', { feedId, studentId, logId: logRecord.id, ...result });
      io.emit('state_update', { stats: calculateStats(), feed: state.feed });
    } catch (err) {
      console.error('[Socket AI Rebuttal Error]', err.message);
    }
  });

  socket.on('simulate_cohort', async (payload) => {
    if (!process.env.PRESENTER_PIN || !payload || payload.pin !== process.env.PRESENTER_PIN) {
      return;
    }
    try {
      await runCohortSimulation(true);
    } catch (e) {
      console.error('[Simulate Cohort Socket Error]', e);
    }
  });

  socket.on('reset_session', (payload) => {
    if (!process.env.PRESENTER_PIN || !payload || payload.pin !== process.env.PRESENTER_PIN) {
      return;
    }
    state.students = {};
    state.feed = [];
    state.aiLog = [];
    if (fs.existsSync(STATE_FILE)) {
      try { fs.unlinkSync(STATE_FILE); } catch (e) {}
    }
    io.emit('session_reset');
    io.emit('state_update', { stats: calculateStats(), feed: [] });
  });
});

// ---------------------------------------------------------------------------
// 10. Server Startup with Automatic Port Fallback
// ---------------------------------------------------------------------------
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;

function startServer(portToTry) {
  server.removeAllListeners('error');
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Port] Port ${portToTry} is already in use. Retrying on port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('[Server Error]', err);
    }
  });

  server.listen(portToTry, () => {
    const actualPort = server.address().port;
    const lanIp = getActiveLanIp();
    console.log('======================================================================');
    console.log(' Carlos Ghosn MBA Decision Simulation: The Final 48 Hours');
    console.log(` Local Server:     http://localhost:${actualPort}`);
    console.log(` Classroom LAN IP: http://${lanIp}:${actualPort}`);
    console.log(` Student View:     http://${lanIp}:${actualPort}/`);
    console.log(` Presenter Screen: http://${lanIp}:${actualPort}/presenter`);
    console.log('======================================================================');
  });
}

startServer(DEFAULT_PORT);

module.exports = { app, server, calculateStats, runCohortSimulation, state, requirePin };
