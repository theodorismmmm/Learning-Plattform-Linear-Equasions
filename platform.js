'use strict';

/* ══════════════════════════════════════════════
   LICENSE SYSTEM
   ══════════════════════════════════════════════ */
const VALID_STUDENT_KEYS = [
  'STU-2024-ALPHA', 'STU-2024-BETA', 'STU-2024-GAMMA',
  'STU-2024-DELTA', 'STU-2024-EPSILON', 'STU-LEARN-001',
  'STU-LEARN-002', 'STU-LEARN-003', 'STU-LEARN-004', 'STU-LEARN-005'
];
const VALID_TEACHER_KEYS = [
  'TCH-MASTER-2024', 'TCH-PRO-ACCESS', 'TCH-SCHOOL-KEY',
  'TEACHER-ADMIN-1', 'TEACHER-ADMIN-2'
];

function validateKey(key) {
  const k = key.trim().toUpperCase();
  if (VALID_STUDENT_KEYS.includes(k)) return 'student';
  if (VALID_TEACHER_KEYS.includes(k)) return 'teacher';
  return null;
}

function checkStoredLicense() {
  const key  = localStorage.getItem('lp_license_key');
  const role = localStorage.getItem('lp_license_role');
  if (!key || !role) return false;
  if (validateKey(key) === role) return true;
  localStorage.removeItem('lp_license_key');
  localStorage.removeItem('lp_license_role');
  return false;
}

function activateLicense() {
  const input = document.getElementById('licenseInput');
  const errEl = document.getElementById('licenseErr');
  const key = input.value.trim().toUpperCase();
  if (!key) { errEl.textContent = 'Bitte gib einen Lizenzschlüssel ein.'; return; }
  const role = validateKey(key);
  if (!role) {
    errEl.textContent = '✗ Ungültiger Lizenzschlüssel. Wende dich an deinen Lehrer.';
    input.classList.add('anim-wrong');
    setTimeout(() => input.classList.remove('anim-wrong'), 500);
    return;
  }
  localStorage.setItem('lp_license_key', key);
  localStorage.setItem('lp_license_role', role);
  errEl.textContent = '';
  launchPlatform(role);
}

function deactivateLicense() {
  localStorage.removeItem('lp_license_key');
  localStorage.removeItem('lp_license_role');
  closeLicenseModal();
  // Reload to show gate
  location.reload();
}

/* ══════════════════════════════════════════════
   GAMIFICATION STATE
   ══════════════════════════════════════════════ */
const XP_LEVELS = [0, 100, 250, 500, 1000, 2000];

let state = {
  xp: 0,
  hearts: 5,
  streak: 0,
  lastActive: null,
  chapterProgress: {}   // { chapterIndex: { completed: [0,1,2,...] } }
};

function loadState() {
  try {
    state.xp      = parseInt(localStorage.getItem('lp_xp') || '0', 10);
    state.hearts  = parseInt(localStorage.getItem('lp_hearts') || '5', 10);
    state.streak  = parseInt(localStorage.getItem('lp_streak') || '0', 10);
    state.lastActive = localStorage.getItem('lp_last_active') || null;
    const cp = localStorage.getItem('lp_chapter_progress');
    state.chapterProgress = cp ? JSON.parse(cp) : {};
  } catch (e) { /* use defaults */ }
  updateStreak();
}

function saveState() {
  localStorage.setItem('lp_xp', String(state.xp));
  localStorage.setItem('lp_hearts', String(state.hearts));
  localStorage.setItem('lp_streak', String(state.streak));
  if (state.lastActive) localStorage.setItem('lp_last_active', state.lastActive);
  localStorage.setItem('lp_chapter_progress', JSON.stringify(state.chapterProgress));
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (!state.lastActive) { state.streak = 0; return; }
  const diff = Math.floor((Date.parse(today) - Date.parse(state.lastActive)) / 86400000);
  if (diff === 0) return;         // same day, keep streak
  if (diff === 1) return;         // yesterday, streak is maintained until we record today
  state.streak = 0;               // more than 1 day gap → reset streak
}

function recordActivity() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastActive !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (state.lastActive === yesterday) {
      state.streak += 1;
    } else if (!state.lastActive) {
      state.streak = 1;
    } else {
      state.streak = 1; // gap > 1 day, start fresh
    }
    state.lastActive = today;
    saveState();
  }
}

function getLevel() {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (state.xp >= XP_LEVELS[i]) return i + 1;
  }
  return 1;
}

function getXPForNextLevel() {
  const lvl = getLevel();
  return XP_LEVELS[lvl] || null; // null = max level
}

function addXP(amount) {
  state.xp += amount;
  saveState();
  renderHeader();
}

function loseHeart() {
  if (state.hearts > 0) { state.hearts--; saveState(); renderHeader(); }
  if (state.hearts === 0) showHeartsModal();
}

function restoreHearts() {
  state.hearts = 5; saveState(); renderHeader();
}

/* ══════════════════════════════════════════════
   CHAPTER DATA
   ══════════════════════════════════════════════ */
const CHAPTERS = [
  {
    id: 0,
    icon: '🗺️',
    title: 'Das Koordinatensystem',
    desc: 'Lerne die Grundlagen des Koordinatensystems kennen',
    xpReward: 50,
    exercises: [
      {
        type: 'multiple-choice',
        question: 'Wie nennt man die waagerechte (horizontale) Achse im Koordinatensystem?',
        options: ['x-Achse', 'y-Achse', 'z-Achse', 'Ursprung'],
        answer: 'x-Achse'
      },
      {
        type: 'true-false',
        question: 'Der Ursprung des Koordinatensystems hat die Koordinaten (0, 0).',
        answer: true,
        hint: 'Der Ursprung ist der Schnittpunkt von x-Achse und y-Achse – er liegt immer bei (0, 0)'
      },
      {
        type: 'multiple-choice',
        question: 'Ein Punkt hat die Koordinaten (3, 5).\nWas bedeutet die erste Zahl (3)?',
        options: ['den y-Wert (senkrecht)', 'den x-Wert (waagerecht)', 'den Abstand vom Ursprung', 'den Quadranten'],
        answer: 'den x-Wert (waagerecht)'
      },
      {
        type: 'coord-task',
        question: 'Das Koordinatensystem zeigt den Punkt A (4, 3).\nWelchen y-Wert hat der Punkt A?\n(Der Punkt ist im Graphen markiert)',
        functions: [],
        points: [{ x: 4, y: 3, label: 'A(4,3)' }],
        answer: 3,
        inputType: 'number',
        hint: 'Lies auf der senkrechten y-Achse ab: Der Punkt liegt bei y = 3'
      },
      {
        type: 'coord-task',
        question: 'Die Gerade y = x ist eingezeichnet.\nBei welchem y-Wert schneidet sie die y-Achse?\n(Setze x = 0 ein)',
        functions: ['x'],
        points: [{ x: 0, y: 0, label: '(0,0)' }],
        answer: 0,
        inputType: 'number',
        hint: 'Setze x = 0 ein: y = 0. Die Gerade schneidet die y-Achse bei y = 0'
      },
      {
        type: 'multiple-choice',
        question: 'In welchem Quadranten liegt der Punkt (−2, 4)?',
        options: ['1. Quadrant (x>0, y>0)', '2. Quadrant (x<0, y>0)', '3. Quadrant (x<0, y<0)', '4. Quadrant (x>0, y<0)'],
        answer: '2. Quadrant (x<0, y>0)'
      }
    ]
  },
  {
    id: 1,
    icon: '🎯',
    title: 'Was ist eine lineare Gleichung?',
    desc: 'Verstehe die Form y = mx + b',
    xpReward: 50,
    exercises: [
      {
        type: 'multiple-choice',
        question: 'Welche dieser Gleichungen ist eine lineare Gleichung?',
        options: ['y = x²', 'y = 2x + 3', 'y = √x', 'y = 1/x'],
        answer: 'y = 2x + 3'
      },
      {
        type: 'fill-blank',
        question: 'In y = 3x + 5 ist die Steigung ___ und der y-Achsenabschnitt ist ___',
        blanks: ['3', '5'],
        hint: 'y = mx + b → m ist die Steigung, b ist der y-Achsenabschnitt'
      },
      {
        type: 'multiple-choice',
        question: 'Was stellt „m" in y = mx + b dar?',
        options: ['y-Achsenabschnitt', 'Steigung', 'x-Wert', 'Konstante'],
        answer: 'Steigung'
      },
      {
        type: 'true-false',
        question: 'y = 4 ist eine lineare Gleichung.',
        answer: true,
        hint: 'y = 4 ist eine waagerechte Gerade – sie ist linear (Steigung = 0, y-Achsenabschnitt = 4)'
      },
      {
        type: 'multiple-choice',
        question: 'Wie sieht der Graph einer linearen Funktion aus?',
        options: [
          'Eine U-förmige Parabel',
          'Eine Gerade',
          'Eine wellenförmige Kurve',
          'Ein Kreis'
        ],
        answer: 'Eine Gerade'
      },
      {
        type: 'fill-blank',
        question: 'In y = −2x + 7 ist die Steigung ___',
        blanks: ['-2'],
        hint: 'Der Koeffizient von x ist die Steigung'
      }
    ]
  },
  {
    id: 2,
    icon: '📈',
    title: 'Steigung & y-Achsenabschnitt',
    desc: 'Berechne und bestimme Steigung und y-Achsenabschnitt',
    xpReward: 50,
    exercises: [
      {
        type: 'number-input',
        question: 'Berechne die Steigung zwischen den Punkten (0, 0) und (3, 6).\nSteigung = (y₂ − y₁) / (x₂ − x₁)',
        answer: 2,
        hint: 'Steigung = (6 − 0) / (3 − 0) = 6 / 3 = 2'
      },
      {
        type: 'multiple-choice',
        question: 'Was ist der y-Achsenabschnitt der Gleichung y = 5x − 3?',
        options: ['5', '-3', '3', '0'],
        answer: '-3'
      },
      {
        type: 'number-input',
        question: 'Eine Gerade verläuft durch (0, 4) mit der Steigung 2. Wie groß ist y bei x = 3?\ny = mx + b → y = 2(3) + 4',
        answer: 10,
        hint: 'y = 2 × 3 + 4 = 6 + 4 = 10'
      },
      {
        type: 'coord-task',
        question: 'Die Gerade y = x + 2 ist dargestellt. Wo schneidet sie die y-Achse?\n(Gib den y-Achsenabschnitt ein)',
        functions: ['x+2'],
        points: [],
        answer: 2,
        inputType: 'number',
        hint: 'Der y-Achsenabschnitt liegt bei x = 0. y = 0 + 2 = 2'
      },
      {
        type: 'number-input',
        question: 'Wie groß ist die Steigung einer waagerechten Geraden?',
        answer: 0,
        hint: 'Eine waagerechte Gerade hat keinen Anstieg (Steigung = 0/irgendwas = 0)'
      },
      {
        type: 'fill-blank',
        question: 'Steigung = (y₂ − y₁) / (___ − x₁)',
        blanks: ['x₂'],
        hint: 'Die Steigungsformel verwendet die Differenz der x-Werte im Nenner'
      }
    ]
  },
  {
    id: 3,
    icon: '📐',
    title: 'Lineare Gleichungen zeichnen',
    desc: 'Zeichne Geraden im Koordinatensystem',
    xpReward: 50,
    exercises: [
      {
        type: 'coord-task',
        question: 'Der Graph zeigt y = 2x − 1. Welchen y-Wert hat die Gerade bei x = 2?',
        functions: ['2*x-1'],
        points: [{ x: 2, y: 3, label: 'x=2' }],
        answer: 3,
        inputType: 'number',
        hint: 'y = 2(2) − 1 = 4 − 1 = 3'
      },
      {
        type: 'multiple-choice',
        question: 'Welche Gleichung beschreibt eine Gerade mit Steigung −1 durch (0, 3)?',
        options: ['y = x + 3', 'y = −x + 3', 'y = 3x − 1', 'y = −x − 3'],
        answer: 'y = −x + 3'
      },
      {
        type: 'coord-task',
        question: 'Der Graph zeigt y = 3x. Welchen y-Wert hat die Gerade bei x = 2?\n(Der Punkt bei x = 2 ist markiert)',
        functions: ['3*x'],
        points: [{ x: 2, y: 6, label: '(2, ?)' }],
        answer: 6,
        inputType: 'number',
        hint: 'y = 3 × 2 = 6'
      },
      {
        type: 'number-input',
        question: 'Eine Gerade hat die Steigung 0,5 und schneidet die y-Achse bei (0, −2).\nWie groß ist y bei x = 6?\ny = 0,5x − 2',
        answer: 1,
        hint: 'y = 0,5 × 6 − 2 = 3 − 2 = 1'
      },
      {
        type: 'coord-task',
        question: 'Zwei Geraden sind eingezeichnet: y = x (blau) und y = −x + 4 (rot).\nBei welchem x-Wert schneiden sie sich?',
        functions: [
          { expr: 'x',     color: '#0066ff' },
          { expr: '-x+4',  color: '#cc0000' }
        ],
        points: [{ x: 2, y: 2, label: '∩' }],
        answer: 2,
        inputType: 'number',
        hint: 'Setze x = −x + 4 → 2x = 4 → x = 2'
      }
    ]
  },
  {
    id: 4,
    icon: '⚖️',
    title: 'Lineare Gleichungen lösen',
    desc: 'Gleichungen algebraisch nach x auflösen',
    xpReward: 50,
    exercises: [
      {
        type: 'number-input',
        question: 'Löse nach x auf:\n2x + 4 = 10',
        answer: 3,
        hint: '2x = 10 − 4 = 6 → x = 3'
      },
      {
        type: 'number-input',
        question: 'Löse nach x auf:\n3x − 9 = 0',
        answer: 3,
        hint: '3x = 9 → x = 3'
      },
      {
        type: 'number-input',
        question: 'Löse nach x auf:\n−x + 5 = 2',
        answer: 3,
        hint: '−x = 2 − 5 = −3 → x = 3'
      },
      {
        type: 'step-order',
        question: 'Bringe diese Schritte in die richtige Reihenfolge, um 4x + 8 = 20 zu lösen:',
        steps: [
          '4x + 8 = 20',
          'Subtrahiere 8 von beiden Seiten: 4x = 12',
          'Dividiere beide Seiten durch 4: x = 3',
          'Probe: 4(3) + 8 = 20 ✓'
        ],
        answer: [0, 1, 2, 3],
        hint: 'Zuerst subtrahieren, dann dividieren, dann Probe'
      },
      {
        type: 'number-input',
        question: 'Löse nach x auf:\n2(x + 3) = 14',
        answer: 4,
        hint: 'Klammern auflösen: 2x + 6 = 14 → 2x = 8 → x = 4'
      },
      {
        type: 'multiple-choice',
        question: 'Welcher x-Wert erfüllt 5x = 25?',
        options: ['3', '4', '5', '6'],
        answer: '5'
      }
    ]
  },
  {
    id: 5,
    icon: '🌍',
    title: 'Anwendungen im Alltag',
    desc: 'Lineare Gleichungen in realen Situationen anwenden',
    xpReward: 50,
    exercises: [
      {
        type: 'number-input',
        question: '🚕 Ein Taxi kostet 2 € Grundgebühr + 1,50 € pro km.\nWas kostet eine Fahrt von 8 km?\nKosten = 1,50 × 8 + 2',
        answer: 14,
        hint: 'Kosten = 1,50 × 8 + 2 = 12 + 2 = 14'
      },
      {
        type: 'coord-task',
        question: '🌱 Eine Pflanze wächst 3 cm pro Woche und ist am Anfang 5 cm groß.\nDer Graph zeigt ihr Wachstum: h = 3w + 5\nWie groß ist sie nach 4 Wochen (in cm)?',
        functions: ['3*x+5'],
        points: [{ x: 4, y: 17, label: 'w=4' }],
        answer: 17,
        inputType: 'number',
        hint: 'h = 3 × 4 + 5 = 12 + 5 = 17'
      },
      {
        type: 'multiple-choice',
        question: '💶 Du hast 100 € und gibst täglich 15 € aus.\nWelche Gleichung beschreibt dein Guthaben?',
        options: [
          'y = 15x + 100',
          'y = −15x + 100',
          'y = 100x − 15',
          'y = −100x + 15'
        ],
        answer: 'y = −15x + 100'
      },
      {
        type: 'number-input',
        question: '🌡️ Die Temperatur sinkt stündlich um 2 °C, beginnend bei 20 °C.\nT = −2h + 20\nNach wie vielen Stunden beträgt die Temperatur 10 °C?',
        answer: 5,
        hint: '10 = −2h + 20 → 2h = 10 → h = 5'
      },
      {
        type: 'multiple-choice',
        question: '🍰 Ein Rezept braucht 3 Eier pro Kuchen.\nWelche Aussage beschreibt den Graphen von Eiern gegen Kuchen?',
        options: [
          'Eine Gerade durch den Ursprung mit Steigung 3',
          'Eine waagerechte Gerade bei y = 3',
          'Eine langsam wachsende Kurve',
          'Eine Gerade mit y-Achsenabschnitt 3 und Steigung 0'
        ],
        answer: 'Eine Gerade durch den Ursprung mit Steigung 3'
      }
    ]
  }
];

/* ══════════════════════════════════════════════
   CHAPTER PROGRESS HELPERS
   ══════════════════════════════════════════════ */
function getChapterProgress(chIdx) {
  const cp = state.chapterProgress[chIdx];
  if (!cp) return { completed: [] };
  return cp;
}

function markExerciseDone(chIdx, exIdx) {
  if (!state.chapterProgress[chIdx]) state.chapterProgress[chIdx] = { completed: [] };
  const cp = state.chapterProgress[chIdx];
  if (!cp.completed.includes(exIdx)) cp.completed.push(exIdx);
  saveState();
}

function getChapterCompletionRate(chIdx) {
  const total = CHAPTERS[chIdx].exercises.length;
  const cp = getChapterProgress(chIdx);
  return cp.completed.length / total;
}

function isChapterUnlocked(chIdx) {
  if (chIdx === 0) return true;
  // Check if teacher manually unlocked
  const forced = localStorage.getItem(`lp_ch_unlock_${chIdx}`);
  if (forced === '1') return true;
  // Unlock if previous chapter ≥ 80% complete
  return getChapterCompletionRate(chIdx - 1) >= 0.8;
}

function isChapterCompleted(chIdx) {
  return getChapterCompletionRate(chIdx) >= 0.8;
}

/* ══════════════════════════════════════════════
   RENDER HEADER
   ══════════════════════════════════════════════ */
function renderHeader() {
  const lvl = getLevel();
  const nextXP = getXPForNextLevel();
  const prevXP = XP_LEVELS[lvl - 1] || 0;
  const pct = nextXP
    ? Math.min(100, Math.round(((state.xp - prevXP) / (nextXP - prevXP)) * 100))
    : 100;

  document.getElementById('hdrLevel').textContent = `STUFE ${lvl}`;
  document.getElementById('hdrXPBar').style.width = pct + '%';
  document.getElementById('hdrXPLabel').textContent = nextXP
    ? `${state.xp} / ${nextXP} XP`
    : `${state.xp} XP MAX`;

  const heartsHtml = '❤️'.repeat(state.hearts) + '🖤'.repeat(Math.max(0, 5 - state.hearts));
  document.getElementById('hdrHearts').textContent = heartsHtml;
  document.getElementById('hdrStreak').textContent = state.streak > 0 ? `🔥 ${state.streak}` : '';

  const role = localStorage.getItem('lp_license_role');
  const teachBtn = document.getElementById('teacherBtn');
  if (teachBtn) teachBtn.style.display = role === 'teacher' ? 'inline-block' : 'none';
}

/* ══════════════════════════════════════════════
   HOME SCREEN
   ══════════════════════════════════════════════ */
function renderHome() {
  showScreen('homeScreen');
  const path = document.getElementById('chapterPath');
  path.innerHTML = '';

  CHAPTERS.forEach((ch, i) => {
    const unlocked = isChapterUnlocked(i);
    const completed = isChapterCompleted(i);
    const rate = getChapterCompletionRate(i);
    const pct = Math.round(rate * 100);

    const card = document.createElement('div');
    card.className = 'chapter-card' +
      (completed ? ' completed' : '') +
      (!unlocked ? ' locked' : '') +
      (!completed && unlocked ? ' active-chapter' : '');

    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Kapitel ${i + 1}: ${ch.title}${!unlocked ? ' (gesperrt)' : ''}`);
    card.tabIndex = unlocked ? 0 : -1;

    card.innerHTML = `
      <span class="chapter-num">${completed ? '✓' : i + 1}</span>
      <div class="chapter-icon">${unlocked ? ch.icon : '🔒'}</div>
      <div class="chapter-info">
        <h3>${ch.title}</h3>
        <p>${ch.desc}</p>
        <div class="chapter-progress">
          <div class="chapter-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="chapter-meta">
          <span>${pct}% abgeschlossen</span>
          <span class="chapter-xp">+${ch.xpReward} XP</span>
          ${completed ? '<span class="text-green">✓ Fertig</span>' : ''}
        </div>
      </div>
    `;

    if (unlocked) {
      card.addEventListener('click', () => startChapter(i));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') startChapter(i); });
    }

    path.appendChild(card);
  });
}

/* ══════════════════════════════════════════════
   EXERCISE ENGINE
   ══════════════════════════════════════════════ */
let currentChapter = -1;
let currentExIndex = 0;
let sessionXP = 0;
let answered = false;
let coordEmbed = null;   // active CoordEmbed instance

function startChapter(chIdx) {
  currentChapter = chIdx;
  currentExIndex = 0;
  sessionXP = 0;
  answered = false;
  showScreen('exerciseScreen');
  renderExercise();
}

function renderExercise() {
  const ch = CHAPTERS[currentChapter];
  const ex = ch.exercises[currentExIndex];
  const total = ch.exercises.length;

  // Progress bar
  document.getElementById('exProgressFill').style.width =
    Math.round((currentExIndex / total) * 100) + '%';
  document.getElementById('exSessionXP').textContent = `+${sessionXP} XP`;
  document.getElementById('exChapterTitle').textContent = `${ch.icon} ${ch.title}`;

  // Reset feedback
  hideFeedback();
  answered = false;

  // Destroy old coord embed
  if (coordEmbed) { coordEmbed = null; }

  // Build exercise card
  const card = document.getElementById('exCard');
  card.className = 'ex-card';

  const typeLabels = {
    'multiple-choice': '🔵 Multiple Choice',
    'fill-blank':      '✏️ Lückentext',
    'number-input':    '🔢 Zahleneingabe',
    'true-false':      '✅ Wahr oder Falsch',
    'coord-task':      '📐 Koordinatenaufgabe',
    'step-order':      '🔀 Schritte ordnen'
  };

  card.innerHTML = `
    <span class="ex-type-badge">${typeLabels[ex.type] || ex.type}</span>
    <div class="ex-question">${formatQuestion(ex.question)}</div>
    <div id="exCanvasArea"></div>
    <div id="exInputArea"></div>
  `;

  // Build canvas if coord-task
  if (ex.type === 'coord-task') {
    buildCoordCanvas(ex);
  }

  // Build input area
  buildInputArea(ex);

  // Check / Continue buttons
  document.getElementById('checkBtn').style.display = 'inline-block';
  document.getElementById('continueBtn').style.display = 'none';
}

function formatQuestion(q) {
  // Format newlines and code
  return q
    .replace(/\n/g, '<br>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function buildCoordCanvas(ex) {
  const area = document.getElementById('exCanvasArea');
  area.innerHTML = `
    <div class="ex-canvas-wrap" id="coordWrap">
      <canvas id="coordCanvas" aria-label="Coordinate graph"></canvas>
      <div class="ex-canvas-hint">${ex.inputType === 'click' ? '🖱 Klicke, um deinen Punkt zu setzen' : '👆 Scrollen/Pinchen zum Zoomen'}</div>
    </div>
  `;

  const canvas = document.getElementById('coordCanvas');
  const fns = Array.isArray(ex.functions) ? ex.functions : [];
  const pts = ex.points || [];

  coordEmbed = new CoordEmbed(canvas, {
    functions: fns,
    points: pts,
    interactive: ex.inputType === 'click',
    readOnly: ex.inputType !== 'click',
    xMin: -1, xMax: 10, yMin: -3, yMax: 20,
    onPointPlaced: (x, y) => {
      document.getElementById('coordAnswerX').value = x;
      document.getElementById('coordAnswerY').value = y;
    }
  });
}

function buildInputArea(ex) {
  const area = document.getElementById('exInputArea');

  if (ex.type === 'multiple-choice') {
    area.innerHTML = `<div class="mc-options" role="group" aria-label="Answer choices">
      ${ex.options.map((opt, i) =>
        `<button class="mc-option" data-idx="${i}" aria-label="${opt}">${opt}</button>`
      ).join('')}
    </div>`;
    area.querySelectorAll('.mc-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        area.querySelectorAll('.mc-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  }

  else if (ex.type === 'fill-blank') {
    // Replace each ___ with an input
    let idx = 0;
    const parts = ex.question.split('___');
    let html = '<div class="fib-wrap">';
    parts.forEach((part, i) => {
      html += `<span>${part.replace(/\n/g, '<br>')}</span>`;
      if (i < parts.length - 1) {
        html += `<input type="text" class="fib-input" id="fibInput${idx}" 
          placeholder="?" aria-label="Lücke ${idx + 1}" autocomplete="off">`;
        idx++;
      }
    });
    html += '</div>';
    area.innerHTML = html;
    // Focus first input
    const first = area.querySelector('.fib-input');
    if (first) first.focus();
    // Enter key → check
    area.querySelectorAll('.fib-input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') checkAnswer();
      });
    });
  }

  else if (ex.type === 'number-input') {
    area.innerHTML = `
      <div class="num-input-wrap">
        <input type="number" class="num-input" id="numInput"
          placeholder="Antwort eingeben" step="any" aria-label="Zahleneingabe">
      </div>`;
    const inp = area.querySelector('#numInput');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswer(); });
    }
  }

  else if (ex.type === 'true-false') {
    area.innerHTML = `
      <div class="tf-wrap">
        <button class="tf-btn" id="tfTrue" aria-label="Wahr">✅ Wahr</button>
        <button class="tf-btn" id="tfFalse" aria-label="Falsch">❌ Falsch</button>
      </div>`;
    ['tfTrue', 'tfFalse'].forEach(id => {
      const btn = document.getElementById(id);
      btn.addEventListener('click', () => {
        if (answered) return;
        document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  }

  else if (ex.type === 'coord-task') {
    // Number input below canvas
    area.innerHTML = `
      <div class="num-input-wrap" style="margin-top:10px">
        <input type="number" class="num-input" id="numInput"
          placeholder="Antwort eingeben" step="any" aria-label="Koordinatenaufgabe Antwort">
        ${ex.inputType === 'click'
          ? `<input type="hidden" id="coordAnswerX"><input type="hidden" id="coordAnswerY">`
          : ''}
      </div>`;
    const inp = area.querySelector('#numInput');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswer(); });
    }
  }

  else if (ex.type === 'step-order') {
    // Build draggable list (Fisher-Yates shuffle for unbiased randomization)
    const shuffled = [...ex.steps].map((s, i) => ({ text: s, origIdx: i }));
    for (let k = shuffled.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]];
    }
    area.innerHTML = `
      <div class="step-order-wrap" id="stepOrderList">
        ${shuffled.map((s, i) =>
          `<div class="step-item" draggable="true" data-orig="${s.origIdx}" data-pos="${i}">
            <span class="step-handle">⠿</span>
            <span>${s.text}</span>
          </div>`
        ).join('')}
      </div>
      <p class="text-dim mt-8" style="font-size:12px">Ziehe die Schritte in die richtige Reihenfolge</p>`;
    initDragDrop(document.getElementById('stepOrderList'));
  }
}

// Drag-and-drop for step ordering
function initDragDrop(list) {
  let dragSrc = null;
  list.querySelectorAll('.step-item').forEach(item => {
    item.addEventListener('dragstart', () => { dragSrc = item; item.style.opacity = '0.5'; });
    item.addEventListener('dragend',   () => { dragSrc = null; item.style.opacity = '1'; });
    item.addEventListener('dragover',  e => {
      e.preventDefault();
      list.querySelectorAll('.step-item').forEach(i => i.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (dragSrc && dragSrc !== item) {
        const allItems = Array.from(list.querySelectorAll('.step-item'));
        const srcIdx  = allItems.indexOf(dragSrc);
        const tgtIdx  = allItems.indexOf(item);
        if (srcIdx < tgtIdx) list.insertBefore(dragSrc, item.nextSibling);
        else list.insertBefore(dragSrc, item);
      }
    });
  });
}

/* ══════════════════════════════════════════════
   CHECK ANSWER
   ══════════════════════════════════════════════ */
function checkAnswer() {
  if (answered) { continueExercise(); return; }
  const ch = CHAPTERS[currentChapter];
  const ex = ch.exercises[currentExIndex];
  let isCorrect = false;

  if (ex.type === 'multiple-choice') {
    const sel = document.querySelector('.mc-option.selected');
    if (!sel) { showToast('Bitte wähle eine Antwort!'); return; }
    isCorrect = sel.textContent.trim() === ex.answer;
    document.querySelectorAll('.mc-option').forEach(btn => {
      btn.disabled = true;
      if (btn.textContent.trim() === ex.answer) btn.classList.add('correct');
      else if (btn.classList.contains('selected') && !isCorrect) btn.classList.add('wrong');
    });
  }

  else if (ex.type === 'fill-blank') {
    const inputs = document.querySelectorAll('.fib-input');
    let allCorrect = true;
    inputs.forEach((inp, i) => {
      const val = inp.value.trim();
      const expected = ex.blanks[i];
      const correct = val.toLowerCase() === expected.toLowerCase();
      inp.classList.add(correct ? 'correct' : 'wrong');
      inp.disabled = true;
      if (!correct) allCorrect = false;
    });
    isCorrect = allCorrect;
  }

  else if (ex.type === 'number-input' || ex.type === 'coord-task') {
    const inp = document.getElementById('numInput');
    if (!inp || inp.value === '') { showToast('Bitte gib eine Zahl ein!'); return; }
    const val = parseFloat(inp.value);
    isCorrect = Math.abs(val - ex.answer) < 0.01;
    inp.classList.add(isCorrect ? 'correct' : 'wrong');
    inp.disabled = true;
  }

  else if (ex.type === 'true-false') {
    const trueBtn  = document.getElementById('tfTrue');
    const falseBtn = document.getElementById('tfFalse');
    const selTrue  = trueBtn.classList.contains('selected');
    const selFalse = falseBtn.classList.contains('selected');
    if (!selTrue && !selFalse) { showToast('Bitte wähle Wahr oder Falsch!'); return; }
    isCorrect = selTrue === ex.answer;
    [trueBtn, falseBtn].forEach(b => b.disabled = true);
    if (isCorrect) {
      (ex.answer ? trueBtn : falseBtn).classList.add('correct');
    } else {
      (selTrue ? trueBtn : falseBtn).classList.add('wrong');
      (ex.answer ? trueBtn : falseBtn).classList.add('correct');
    }
  }

  else if (ex.type === 'step-order') {
    const items = document.querySelectorAll('#stepOrderList .step-item');
    const order = Array.from(items).map(item => parseInt(item.dataset.orig, 10));
    isCorrect = JSON.stringify(order) === JSON.stringify(ex.answer);
    // Highlight correct answer
    items.forEach((item, pos) => {
      const expectedOrig = ex.answer[pos];
      if (parseInt(item.dataset.orig, 10) === expectedOrig) {
        item.style.borderColor = 'var(--green2)';
        item.style.background  = '#0a2a0a';
      } else {
        item.style.borderColor = 'var(--acc)';
        item.style.background  = '#2a0a0a';
      }
    });
  }

  answered = true;

  if (isCorrect) {
    addXP(10);
    sessionXP += 10;
    recordActivity();
    markExerciseDone(currentChapter, currentExIndex);
    document.getElementById('exSessionXP').textContent = `+${sessionXP} XP`;
    showFeedback(true, null);
    document.getElementById('exCard').classList.add('anim-correct');
    setTimeout(() => document.getElementById('exCard').classList.remove('anim-correct'), 600);
  } else {
    loseHeart();
    const hint = ex.hint || `Correct answer: ${getCorrectAnswerString(ex)}`;
    showFeedback(false, hint);
    document.getElementById('exCard').classList.add('anim-wrong');
    setTimeout(() => document.getElementById('exCard').classList.remove('anim-wrong'), 500);
  }

  document.getElementById('checkBtn').style.display = 'none';
  document.getElementById('continueBtn').style.display = 'inline-block';
  document.getElementById('continueBtn').focus();
}

function getCorrectAnswerString(ex) {
  if (ex.type === 'multiple-choice') return ex.answer;
  if (ex.type === 'fill-blank') return ex.blanks.join(', ');
  if (ex.type === 'number-input' || ex.type === 'coord-task') return String(ex.answer);
  if (ex.type === 'true-false') return ex.answer ? 'Wahr' : 'Falsch';
  if (ex.type === 'step-order') return 'Sieh die richtige Reihenfolge oben';
  return '';
}

/* ══════════════════════════════════════════════
   CONTINUE / NEXT EXERCISE
   ══════════════════════════════════════════════ */
function continueExercise() {
  const ch = CHAPTERS[currentChapter];
  currentExIndex++;

  if (currentExIndex >= ch.exercises.length) {
    // Chapter done
    const wasCompleted = isChapterCompleted(currentChapter);
    if (!wasCompleted) {
      addXP(ch.xpReward);
      sessionXP += ch.xpReward;
    }
    restoreHearts();
    showCelebration(ch);
    return;
  }

  answered = false;
  renderExercise();
}

/* ══════════════════════════════════════════════
   FEEDBACK STRIP
   ══════════════════════════════════════════════ */
function showFeedback(correct, message) {
  const el = document.getElementById('exFeedback');
  el.className = 'ex-feedback ' + (correct ? 'correct-fb' : 'wrong-fb');
  if (correct) {
    el.innerHTML = `<span class="fb-icon">✓</span><span class="fb-text">Richtig! +10 XP</span>`;
  } else {
    el.innerHTML = `<span class="fb-icon">✗</span>
      <span class="fb-text">${message ? message : 'Falsch'}</span>`;
  }
}

function hideFeedback() {
  const el = document.getElementById('exFeedback');
  el.className = 'ex-feedback';
  el.innerHTML = '';
}

/* ══════════════════════════════════════════════
   CELEBRATION OVERLAY
   ══════════════════════════════════════════════ */
function showCelebration(ch) {
  document.getElementById('celebTitle').textContent  = `${ch.icon} Kapitel abgeschlossen!`;
  document.getElementById('celebSub').textContent    = ch.title;
  document.getElementById('celebXP').textContent     = `+${sessionXP} XP verdient`;
  document.getElementById('celebStars').textContent  = '⭐⭐⭐';
  document.getElementById('celebrationOverlay').classList.add('active');
  spawnConfetti();
}

function closeCelebration() {
  document.getElementById('celebrationOverlay').classList.remove('active');
  document.getElementById('confettiWrap').innerHTML = '';
  renderHome();
}

function spawnConfetti() {
  const wrap = document.getElementById('confettiWrap');
  wrap.innerHTML = '';
  const colors = ['#cc0000','#ffcc00','#00cc88','#0066ff','#cc44cc','#ff8800'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-p';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${-10 - Math.random() * 20}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.8}s;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
    `;
    wrap.appendChild(p);
  }
}

/* ══════════════════════════════════════════════
   HEARTS MODAL
   ══════════════════════════════════════════════ */
function showHeartsModal() {
  document.getElementById('heartsModal').classList.add('active');
}

function closeHeartsModal(continueAnyway) {
  document.getElementById('heartsModal').classList.remove('active');
  if (continueAnyway) {
    state.hearts = 3; // Give 3 hearts to continue
    saveState(); renderHeader();
  }
}

/* ══════════════════════════════════════════════
   TEACHER PANEL
   ══════════════════════════════════════════════ */
function openTeacherPanel() {
  const box = document.getElementById('teacherContent');
  box.innerHTML = '';

  // Chapter controls
  const sec1 = document.createElement('div');
  sec1.innerHTML = '<h3 style="font-size:14px;margin-bottom:12px;color:var(--dim)">KAPITELSTEUERUNG</h3>';

  CHAPTERS.forEach((ch, i) => {
    const unlocked = isChapterUnlocked(i);
    const row = document.createElement('div');
    row.className = 'teacher-chapter-row';
    row.innerHTML = `
      <span class="tc-name">${ch.icon} ${ch.title}</span>
      <span class="tc-badge ${unlocked ? 'unlocked' : 'locked'}">${unlocked ? 'Freigeschaltet' : 'Gesperrt'}</span>
      <button class="btn btn-sm btn-ghost" onclick="teacherToggleChapter(${i})">
        ${unlocked ? '🔒 Sperren' : '🔓 Freischalten'}
      </button>
    `;
    sec1.appendChild(row);
  });
  box.appendChild(sec1);

  // Answers section
  const hr = document.createElement('hr');
  hr.style.cssText = 'border:none;border-top:1px solid var(--bdr);margin:20px 0';
  box.appendChild(hr);

  const sec2 = document.createElement('div');
  sec2.innerHTML = '<h3 style="font-size:14px;margin-bottom:12px;color:var(--dim)">ALLE RICHTIGEN ANTWORTEN</h3>';

  CHAPTERS.forEach(ch => {
    const al = document.createElement('div');
    al.className = 'answer-list';
    al.innerHTML = `<h4>${ch.icon} ${ch.title}</h4>` +
      ch.exercises.map((ex, i) => {
        const ans = getCorrectAnswerString(ex);
        return `<div class="answer-row"><span class="aq">Q${i+1}: ${ex.question.slice(0, 50)}…</span><span class="aa">${ans}</span></div>`;
      }).join('');
    sec2.appendChild(al);
  });
  box.appendChild(sec2);

  // Reset progress button
  const hr2 = document.createElement('hr');
  hr2.style.cssText = 'border:none;border-top:1px solid var(--bdr);margin:20px 0';
  box.appendChild(hr2);
  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn btn-ghost btn-full';
  resetBtn.textContent = '🗑️ Alle Schülerfortschritte zurücksetzen';
  resetBtn.onclick = () => {
    if (confirm('Alle Fortschritte zurücksetzen? Dies kann nicht rückgängig gemacht werden.')) {
      state.xp = 0; state.hearts = 5; state.streak = 0;
      state.chapterProgress = {};
      saveState(); renderHome(); renderHeader();
      closeTeacherPanel();
    }
  };
  box.appendChild(resetBtn);

  document.getElementById('teacherPanel').classList.add('active');
}

function teacherToggleChapter(chIdx) {
  if (chIdx === 0) return; // Chapter 1 always unlocked
  const key = `lp_ch_unlock_${chIdx}`;
  const current = localStorage.getItem(key) === '1';
  localStorage.setItem(key, current ? '0' : '1');
  openTeacherPanel(); // re-render
}

function closeTeacherPanel() {
  document.getElementById('teacherPanel').classList.remove('active');
}

/* ══════════════════════════════════════════════
   LICENSE INFO MODAL
   ══════════════════════════════════════════════ */
function openLicenseModal() {
  const key  = localStorage.getItem('lp_license_key') || '—';
  const role = localStorage.getItem('lp_license_role') || 'unknown';
  document.getElementById('licenseKey').textContent = key;
  const roleLabels = { student: 'Schüler/in', teacher: 'Lehrer/in' };
  document.getElementById('licenseRoleBadge').textContent = roleLabels[role] || role;
  document.getElementById('licenseRoleBadge').className = 'lbadge ' + role;
  document.getElementById('licenseModal').classList.add('active');
}

function closeLicenseModal() {
  document.getElementById('licenseModal').classList.remove('active');
}

/* ══════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ══════════════════════════════════════════════
   SCREEN MANAGEMENT
   ══════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

/* ══════════════════════════════════════════════
   LAUNCH
   ══════════════════════════════════════════════ */
function launchPlatform(role) {
  document.getElementById('licenseGate').style.display = 'none';
  const app = document.getElementById('mainApp');
  app.classList.add('visible');

  loadState();
  renderHeader();
  renderHome();
}

/* ══════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (checkStoredLicense()) {
    const role = localStorage.getItem('lp_license_role');
    launchPlatform(role);
  }
  // else: license gate stays visible
});
