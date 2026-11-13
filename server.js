/**
 * server.js
 * Carlos Ghosn MBA Decision Simulation: The Final 48 Hours: Stay or Escape?
 * (HBS Case 9-122-051)
 * 
 * Features:
 * - Express + Socket.IO with WebSocket + HTTP Polling fallback
 * - Auto LAN IPv4 detection for classroom QR codes (GET /api/network-info)
 * - In-memory session state with debounced JSON backup
 * - Real-time voting, aggregation, mind-changers, and primary OB inflection point calculation
 * - AI Cross-Examination Engine (Gemini 2.5 Flash + deterministic HBS fallback)
 * - 67-Student Rehearsal Simulation across L1-L5
 * - JSON and formatted TXT session export
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

// Serve static files
app.use(express.static(PUBLIC_DIR));

// Session State Structure
let state = {
  students: {},       // { [studentId]: { studentId, joinedAt, lastActive, votes: { L1, L2, L3, L4, L5 }, defense } }
  feed: [],           // [ { id, studentId, decision, defenseText, timestamp, rebuttal } ]
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  activeSockets: 0
};

// ---------------------------------------------------------------------------
// 1. Persistence & State Recovery
// ---------------------------------------------------------------------------
function loadStateFromDisk() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        state.students = parsed.students || {};
        state.feed = parsed.feed || [];
        if (parsed.geminiApiKey) state.geminiApiKey = parsed.geminiApiKey;
        console.log(`[State] Restored ${Object.keys(state.students).length} students and ${state.feed.length} feed entries from disk.`);
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
        geminiApiKey: state.geminiApiKey,
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      console.error('[State] Error saving session_state.json:', err.message);
    }
  }, 400);
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
// 3. Analytics & KPI Calculation Engine
// ---------------------------------------------------------------------------
const OB_THEORIES = {
  L1: "Baseline Distributive Framing (Legal Defense vs Immediate Flight)",
  L2: "Adams' Equity Theory & Referent Comparisons (Saikawa $440k Double Standard)",
  L3: "Procedural Justice & Risk Perception (>99% Conviction Rate & Indefinite Detention)",
  L4: "Interactional Justice & Prospect Theory (Carole Spousal Denial & 42-Month Trial Delay)",
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
// 4. Client View Routes
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  const file = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.send(`
    <html>
      <head><title>Carlos Ghosn Decision Simulation - Student View</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family:sans-serif; background:#0F172A; color:#F8FAFC; padding:2rem; text-align:center;">
        <h2>The Final 48 Hours: Stay or Escape?</h2>
        <p>Student UI is loading or initializing. Please refresh in a moment.</p>
      </body>
    </html>
  `);
});

app.get('/presenter', (req, res) => {
  const file = path.join(PUBLIC_DIR, 'presenter.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.send(`
    <html>
      <head><title>Carlos Ghosn Decision Simulation - Classroom Dashboard</title></head>
      <body style="font-family:sans-serif; background:#0F172A; color:#F8FAFC; padding:2rem; text-align:center;">
        <h2>Classroom Projector Dashboard</h2>
        <p>Presenter UI is loading or initializing. Please refresh in a moment.</p>
      </body>
    </html>
  `);
});

app.get('/live-counter', (req, res) => {
  const file = path.join(PUBLIC_DIR, 'live_counter.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.redirect('/presenter');
});

// ---------------------------------------------------------------------------
// 5. REST Endpoints
// ---------------------------------------------------------------------------

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
    hasApiKey: !!(state.geminiApiKey || process.env.GEMINI_API_KEY)
  });
});

// POST /api/join
app.post('/api/join', (req, res) => {
  const { studentId } = req.body;
  if (!studentId || typeof studentId !== 'string') {
    return res.status(400).json({ error: 'Valid studentId is required (e.g. EXEC-482).' });
  }

  const cleanId = studentId.trim().toUpperCase();
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

// POST /api/vote
app.post('/api/vote', (req, res) => {
  const { studentId, level, choice } = req.body;
  if (!studentId || !level || !choice) {
    return res.status(400).json({ error: 'studentId, level, and choice are required.' });
  }

  const cleanId = studentId.trim().toUpperCase();
  const lvlKey = typeof level === 'string' && level.startsWith('L') ? level.toUpperCase() : `L${level}`;
  const cleanChoice = choice.trim().toUpperCase();

  if (!['L1', 'L2', 'L3', 'L4', 'L5'].includes(lvlKey)) {
    return res.status(400).json({ error: 'level must be L1 through L5.' });
  }
  if (!['STAY', 'ESCAPE'].includes(cleanChoice)) {
    return res.status(400).json({ error: 'choice must be STAY or ESCAPE.' });
  }

  if (!state.students[cleanId]) {
    state.students[cleanId] = {
      studentId: cleanId,
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      votes: {},
      defense: null
    };
  }

  state.students[cleanId].votes[lvlKey] = cleanChoice;
  state.students[cleanId].lastActive = new Date().toISOString();

  debouncedSaveState();
  const stats = calculateStats();
  io.emit('state_update', { stats, feed: state.feed });
  res.json({ success: true, studentId: cleanId, level: lvlKey, choice: cleanChoice, stats });
});

// POST /api/defense
app.post('/api/defense', (req, res) => {
  const { studentId, defenseText, decision } = req.body;
  if (!studentId || !defenseText) {
    return res.status(400).json({ error: 'studentId and defenseText are required.' });
  }

  const cleanId = studentId.trim().toUpperCase();
  const cleanDecision = (decision || (state.students[cleanId] && state.students[cleanId].votes.L5) || 'STAY').toUpperCase();

  if (state.students[cleanId]) {
    state.students[cleanId].defense = defenseText.trim();
    state.students[cleanId].lastActive = new Date().toISOString();
  }

  const entry = {
    id: `def-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    studentId: cleanId,
    decision: cleanDecision,
    defenseText: defenseText.trim(),
    timestamp: new Date().toISOString(),
    rebuttal: null
  };

  state.feed.unshift(entry);
  if (state.feed.length > 50) state.feed.pop(); // keep latest 50

  debouncedSaveState();
  const stats = calculateStats();
  io.emit('new_defense', entry);
  io.emit('state_update', { stats, feed: state.feed });
  res.json({ success: true, entry, stats });
});

// POST /api/ai/challenge
app.post('/api/ai/challenge', async (req, res) => {
  const { decision, majorityDecision, defenseText, apiKey, feedId } = req.body;
  const keyToUse = apiKey || state.geminiApiKey || process.env.GEMINI_API_KEY;

  try {
    const result = await generateAiChallenge({
      decision,
      majorityDecision,
      defenseText,
      apiKey: keyToUse
    });

    if (feedId) {
      const match = state.feed.find(item => item.id === feedId);
      if (match) {
        match.rebuttal = result.challengeText;
        match.rebuttalSource = result.source;
        debouncedSaveState();
      }
    }

    io.emit('ai_rebuttal_result', { feedId, ...result });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[AI Challenge] Error:', err.message);
    const fallback = getDeterministicFallback({ decision, majorityDecision, defenseText });
    res.json({
      success: true,
      challengeText: fallback,
      source: 'fallback',
      model: 'hbs-deterministic-engine',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/settings/apikey
app.post('/api/settings/apikey', (req, res) => {
  const { apiKey } = req.body;
  state.geminiApiKey = apiKey ? apiKey.trim() : null;
  debouncedSaveState();
  res.json({ success: true, hasKey: !!state.geminiApiKey });
});

// POST /api/reset
app.post('/api/reset', (req, res) => {
  state.students = {};
  state.feed = [];
  if (fs.existsSync(STATE_FILE)) {
    try {
      fs.unlinkSync(STATE_FILE);
    } catch (e) {
      // ignore
    }
  }
  const stats = calculateStats();
  io.emit('session_reset');
  io.emit('state_update', { stats, feed: [] });
  res.json({ success: true, message: 'Classroom session reset to clean slate.' });
});

// ---------------------------------------------------------------------------
// 6. 67-Student Realistic Simulation Engine (Rehearsal Mode)
// ---------------------------------------------------------------------------
const SAMPLE_DEFENSES = [
  { text: "Saikawa walked free after admitting to $440k in unearned pay while Ghosn faced 15 years; Adams' Equity Theory reveals an indefensible referent imbalance.", decision: "ESCAPE" },
  { text: "A 99% conviction rate, 130 days without counsel, and withheld evidence means procedural justice was completely nonexistent in Tokyo.", decision: "ESCAPE" },
  { text: "Fleeing in an audio box forfeits the moral high ground and permanently confirms public perception of the SEC deferred compensation charges.", decision: "STAY" },
  { text: "Carole's visitation denial and 42 months of non-overlapping trials crossed the line into psychological hostage justice under prospect theory.", decision: "ESCAPE" },
  { text: "Staying to clear your name was the only honorable course, but the Japanese legal architecture made a fair trial structurally impossible.", decision: "ESCAPE" },
  { text: "Greg Kelly stayed in Tokyo on $640k bail and waited 2 years without a hearing; leaving him behind destroyed executive solidarity.", decision: "STAY" },
  { text: "Overconfidence bias led Ghosn to believe Lebanon would mean freedom, but an Interpol Red Notice and Carole's warrant created an extradition prison.", decision: "STAY" },
  { text: "The political coup to halt the Renault-Nissan merger weaponized prosecutors; staying would have validated a corporate ambush.", decision: "ESCAPE" },
  { text: "Western executive pay expectations violated Japan's 16:1 norm; fleeing to Beirut confirms an inability to accept Japanese governance accountability.", decision: "STAY" },
  { text: "Interactional disrespect from daily interrogation and holiday isolation made escape a basic act of human self-preservation.", decision: "ESCAPE" },
  { text: "The SEC $140M settlement proved financial misconduct was real; escape was self-exile to avoid an inevitable guilty verdict.", decision: "STAY" },
  { text: "With 70+ boxes withheld and judges penalized for acquittals, staying was not noble bravery—it was procedural suicide.", decision: "ESCAPE" }
];

async function runCohortSimulation(animated = true) {
  // Reset existing students
  state.students = {};
  state.feed = [];

  const totalSimStudents = 67;
  const studentList = [];

  // Generate 67 students with IDs EXEC-101 to EXEC-167
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

  // Pre-compute realistic trajectories:
  // L1: 46 STAY (68.7%), 21 ESCAPE (31.3%)
  // L2: Saikawa $440k double standard triggers major shift: 14 STAY switch to ESCAPE, 2 ESCAPE switch to STAY -> 34 STAY (50.7%), 33 ESCAPE (49.3%) (Net +12 switch to ESCAPE - Primary Inflection Point!)
  // L3: >99% conviction & 130 days detention: 6 STAY switch to ESCAPE, 1 ESCAPE switches to STAY -> 29 STAY (43.3%), 38 ESCAPE (56.7%)
  // L4: Spousal denial & 42-month trial delay: 5 STAY switch to ESCAPE -> 24 STAY (35.8%), 43 ESCAPE (64.2%)
  // L5: Converged verdict: 24 STAY (35.8%), 43 ESCAPE (64.2%)

  studentList.forEach((s, idx) => {
    // Determine cohort role
    if (idx < 21) {
      // Group 1 (starts ESCAPE at L1):
      if (idx < 2) {
        // 2 switch back to STAY at L2 (due to bail forfeiture and Kelly)
        s.votes.L1 = 'ESCAPE';
        s.votes.L2 = 'STAY';
        s.votes.L3 = 'STAY';
        s.votes.L4 = 'STAY';
        s.votes.L5 = 'STAY';
      } else if (idx === 2) {
        // 1 switches back to STAY at L3 (Procedural risk perception)
        s.votes.L1 = 'ESCAPE';
        s.votes.L2 = 'ESCAPE';
        s.votes.L3 = 'STAY';
        s.votes.L4 = 'STAY';
        s.votes.L5 = 'STAY';
      } else {
        s.votes.L1 = 'ESCAPE';
        s.votes.L2 = 'ESCAPE';
        s.votes.L3 = 'ESCAPE';
        s.votes.L4 = 'ESCAPE';
        s.votes.L5 = 'ESCAPE';
      }
    } else {
      // Group 2 (starts STAY at L1 - 46 students)
      const stayIdx = idx - 21; // 0 to 45
      if (stayIdx < 14) {
        // 14 switch to ESCAPE at Level 2 (Saikawa equity double standard)
        s.votes.L1 = 'STAY';
        s.votes.L2 = 'ESCAPE';
        s.votes.L3 = 'ESCAPE';
        s.votes.L4 = 'ESCAPE';
        s.votes.L5 = 'ESCAPE';
      } else if (stayIdx < 20) {
        // 6 switch to ESCAPE at Level 3 (Procedural Justice, 99% conviction)
        s.votes.L1 = 'STAY';
        s.votes.L2 = 'STAY';
        s.votes.L3 = 'ESCAPE';
        s.votes.L4 = 'ESCAPE';
        s.votes.L5 = 'ESCAPE';
      } else if (stayIdx < 25) {
        // 5 switch to ESCAPE at Level 4 (Interactional Justice, Carole & 42 months)
        s.votes.L1 = 'STAY';
        s.votes.L2 = 'STAY';
        s.votes.L3 = 'STAY';
        s.votes.L4 = 'ESCAPE';
        s.votes.L5 = 'ESCAPE';
      } else {
        // 21 remain STAY throughout
        s.votes.L1 = 'STAY';
        s.votes.L2 = 'STAY';
        s.votes.L3 = 'STAY';
        s.votes.L4 = 'STAY';
        s.votes.L5 = 'STAY';
      }
    }
  });

  // Assign sample defenses to matching students (6 STAY students and 6 ESCAPE students)
  const stayStudents = studentList.filter(s => s.votes.L5 === 'STAY');
  const escapeStudents = studentList.filter(s => s.votes.L5 === 'ESCAPE');
  let stayIdxDef = 0;
  let escapeIdxDef = 0;

  SAMPLE_DEFENSES.forEach(def => {
    let student = null;
    if (def.decision === 'STAY' && stayIdxDef < stayStudents.length) {
      student = stayStudents[stayIdxDef++];
    } else if (def.decision === 'ESCAPE' && escapeIdxDef < escapeStudents.length) {
      student = escapeStudents[escapeIdxDef++];
    }
    if (student) {
      student.defense = def.text;
    }
  });

  function populateSimulatedFeed() {
    state.feed = [];
    const withDefense = studentList.filter(s => s.defense);
    withDefense.forEach((s, i) => {
      state.feed.push({
        id: `def-sim-${i}`,
        studentId: s.studentId,
        decision: s.votes.L5,
        defenseText: s.defense,
        timestamp: new Date().toISOString(),
        rebuttal: getDeterministicFallback({ decision: s.votes.L5, defenseText: s.defense })
      });
    });
  }

  if (!animated) {
    // Instant populate
    studentList.forEach(s => {
      state.students[s.studentId] = s;
    });
    populateSimulatedFeed();
    debouncedSaveState();
    const stats = calculateStats();
    io.emit('state_update', { stats, feed: state.feed });
    return stats;
  }

  // Animated 3-second progression across L1 -> L5
  // Step 1: Register all students with L1 votes (0ms)
  studentList.forEach(s => {
    state.students[s.studentId] = {
      studentId: s.studentId,
      joinedAt: s.joinedAt,
      lastActive: new Date().toISOString(),
      votes: { L1: s.votes.L1 },
      defense: null
    };
  });
  io.emit('state_update', { stats: calculateStats(), feed: [] });

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Step 2: Level 2 votes (600ms)
  await sleep(600);
  studentList.forEach(s => {
    state.students[s.studentId].votes.L2 = s.votes.L2;
  });
  io.emit('state_update', { stats: calculateStats(), feed: [] });

  // Step 3: Level 3 votes (1200ms)
  await sleep(600);
  studentList.forEach(s => {
    state.students[s.studentId].votes.L3 = s.votes.L3;
  });
  io.emit('state_update', { stats: calculateStats(), feed: [] });

  // Step 4: Level 4 votes (1800ms)
  await sleep(600);
  studentList.forEach(s => {
    state.students[s.studentId].votes.L4 = s.votes.L4;
  });
  io.emit('state_update', { stats: calculateStats(), feed: [] });

  // Step 5: Level 5 votes + Defenses (2400ms - 3000ms)
  await sleep(600);
  studentList.forEach(s => {
    state.students[s.studentId].votes.L5 = s.votes.L5;
    if (s.defense) state.students[s.studentId].defense = s.defense;
  });

  populateSimulatedFeed();

  debouncedSaveState();
  const finalStats = calculateStats();
  io.emit('state_update', { stats: finalStats, feed: state.feed });
  return finalStats;
}

// POST /api/simulate
app.post('/api/simulate', async (req, res) => {
  try {
    const animated = req.query.instant !== 'true';
    const stats = await runCohortSimulation(animated);
    res.json({
      success: true,
      message: 'Simulated 67 realistic student trajectories across L1-L5.',
      stats,
      studentsCount: 67
    });
  } catch (err) {
    console.error('[Simulate Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 7. Session Export Engine (JSON & Executive TXT)
// ---------------------------------------------------------------------------
app.get('/api/export', (req, res) => {
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
    txt += '4. GROUP 4 OB RECOMMENDATIONS & RUBRIC OVERRIDE AUDIT\n';
    txt += '--------------------------------------------------------------------------------\n';
    txt += '- AI Tool Utilized: Google Gemini (gemini-2.5-flash) via Stakeholder Simulator.\n';
    txt += '- Strengthened Analysis: Identified that transparent cash bonuses still violate Japan\'s 16:1 CEO-to-worker pay ratio, leading to our Milestone-Vested Alliance Equity Escrow solution.\n';
    txt += '- Team Correction/Override: When the AI initially evaluated prosecutorial charges as neutral compliance, our team overrode it using Hiroto Saikawa\'s uncharged $440k resignation to demonstrate selective political weaponization.\n';
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
    teamRubricAudit: {
      toolUsed: "Google Gemini 2.5 Flash",
      howItStrengthenedAnalysis: "Warned that transparent Western cash pay still violates Japan's 16:1 CEO-to-worker norm, inspiring our milestone-vested Alliance equity escrow recommendation.",
      teamCorrectionOverride: "Overrode neutral compliance interpretation using Hiroto Saikawa ($440k excess pay resignation) and 2018 Renault merger political weaponization."
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Socket.IO Real-Time Dispatcher
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
    const studentId = payload && payload.studentId ? payload.studentId.trim().toUpperCase() : null;
    if (studentId) {
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
    if (studentId && level && choice) {
      const cleanId = studentId.trim().toUpperCase();
      const lvlKey = typeof level === 'string' && level.startsWith('L') ? level.toUpperCase() : `L${level}`;
      const cleanChoice = choice.trim().toUpperCase();

      if (['L1', 'L2', 'L3', 'L4', 'L5'].includes(lvlKey) && ['STAY', 'ESCAPE'].includes(cleanChoice)) {
        if (!state.students[cleanId]) {
          state.students[cleanId] = {
            studentId: cleanId,
            joinedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            votes: {},
            defense: null
          };
        }
        state.students[cleanId].votes[lvlKey] = cleanChoice;
        state.students[cleanId].lastActive = new Date().toISOString();
        debouncedSaveState();
        io.emit('state_update', { stats: calculateStats(), feed: state.feed });
      }
    }
  });

  socket.on('submit_defense', (payload) => {
    const { studentId, defenseText, decision } = payload || {};
    if (studentId && defenseText) {
      const cleanId = studentId.trim().toUpperCase();
      const cleanDecision = (decision || (state.students[cleanId] && state.students[cleanId].votes.L5) || 'STAY').toUpperCase();

      if (state.students[cleanId]) {
        state.students[cleanId].defense = defenseText.trim();
        state.students[cleanId].lastActive = new Date().toISOString();
      }

      const entry = {
        id: `def-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: cleanId,
        decision: cleanDecision,
        defenseText: defenseText.trim(),
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
    const { studentId, defenseText, decision, apiKey, feedId } = payload || {};
    const keyToUse = apiKey || state.geminiApiKey || process.env.GEMINI_API_KEY;

    try {
      const result = await generateAiChallenge({
        decision,
        defenseText,
        apiKey: keyToUse
      });

      if (feedId) {
        const match = state.feed.find(item => item.id === feedId);
        if (match) {
          match.rebuttal = result.challengeText;
          match.rebuttalSource = result.source;
          debouncedSaveState();
        }
      }

      io.emit('ai_rebuttal_result', { feedId, studentId, ...result });
      io.emit('state_update', { stats: calculateStats(), feed: state.feed });
    } catch (err) {
      console.error('[Socket AI Rebuttal Error]', err.message);
    }
  });

  socket.on('simulate_cohort', async () => {
    try {
      await runCohortSimulation(true);
    } catch (e) {
      console.error('[Simulate Cohort Socket Error]', e);
    }
  });

  socket.on('reset_session', () => {
    state.students = {};
    state.feed = [];
    if (fs.existsSync(STATE_FILE)) {
      try { fs.unlinkSync(STATE_FILE); } catch (e) {}
    }
    io.emit('session_reset');
    io.emit('state_update', { stats: calculateStats(), feed: [] });
  });
});

// ---------------------------------------------------------------------------
// 9. Server Startup with Automatic Port Fallback
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

module.exports = { app, server, calculateStats, runCohortSimulation, state };
