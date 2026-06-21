// ============================================================
// ASTRIX AI — main.js
// Full application logic: Auth, Assessment, Dashboard, Chat
// ============================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// PSS-10 Questions (Perceived Stress Scale)
const ASSESSMENT_QUESTIONS = [
  {
    q: "In the last month, how often have you been upset because of something that happened unexpectedly?",
    context: "Think about unexpected events related to school, family, or personal life.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [0, 1, 2, 3, 4]
  },
  {
    q: "In the last month, how often have you felt that you were unable to control the important things in your life?",
    context: "This includes schoolwork, deadlines, relationships, and personal goals.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [0, 1, 2, 3, 4]
  },
  {
    q: "In the last month, how often have you felt nervous and stressed?",
    context: "Consider all sources of stress: exams, requirements, social pressures.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [0, 1, 2, 3, 4]
  },
  {
    q: "In the last month, how often have you felt confident about your ability to handle your personal problems?",
    context: "Reversed question — feeling confident means lower stress.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [4, 3, 2, 1, 0]
  },
  {
    q: "In the last month, how often have you felt that things were going your way?",
    context: "Reversed question — things going well means lower stress.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [4, 3, 2, 1, 0]
  },
  {
    q: "In the last month, how often have you been unable to cope with all the things you had to do?",
    context: "Think about your school requirements, extracurricular activities, and responsibilities at home.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [0, 1, 2, 3, 4]
  },
  {
    q: "In the last month, how often have you been able to control irritations in your life?",
    context: "Reversed question — being able to control irritations means lower stress.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [4, 3, 2, 1, 0]
  },
  {
    q: "In the last month, how often have you felt that you were on top of things?",
    context: "Reversed question — feeling on top of things means lower stress.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [4, 3, 2, 1, 0]
  },
  {
    q: "In the last month, how often have you been angered because of things that were outside your control?",
    context: "Include school policies, peer behavior, or family situations.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [0, 1, 2, 3, 4]
  },
  {
    q: "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?",
    context: "This is about feeling overwhelmed by the overall amount of stress in your life.",
    options: ["Never", "Almost Never", "Sometimes", "Fairly Often", "Very Often"],
    scores: [0, 1, 2, 3, 4]
  }
];

const WORKLOAD_QUESTIONS = [
  { key: "homeworkLoad", label: "Daily Homework Load", q: "How heavy is your daily homework and assignment load?" },
  { key: "examFrequency", label: "Exam/Quiz Frequency", q: "How often do you have exams or quizzes?" },
  { key: "sleepQuality", label: "Sleep Quality", q: "How would you rate your sleep quality lately?", reversed: true },
  { key: "socialSupport", label: "Social Support", q: "How much social support do you feel from friends and family?", reversed: true },
];

// DB: localStorage helpers
const DB = {
  getUser: () => JSON.parse(localStorage.getItem('astrix_user') || 'null'),
  setUser: (u) => localStorage.setItem('astrix_user', JSON.stringify(u)),
  getUsers: () => JSON.parse(localStorage.getItem('astrix_users') || '{}'),
  setUsers: (u) => localStorage.setItem('astrix_users', JSON.stringify(u)),
  getAssessments: (uid) => JSON.parse(localStorage.getItem(`astrix_assessments_${uid}`) || '[]'),
  addAssessment: (uid, entry) => {
    const list = DB.getAssessments(uid);
    list.unshift(entry);
    localStorage.setItem(`astrix_assessments_${uid}`, JSON.stringify(list));
  },
  getCheckins: (uid) => JSON.parse(localStorage.getItem(`astrix_checkins_${uid}`) || '[]'),
  addCheckin: (uid, entry) => {
    const list = DB.getCheckins(uid);
    list.unshift(entry);
    localStorage.setItem(`astrix_checkins_${uid}`, JSON.stringify(list));
  },
  getLastCheckinDate: (uid) => localStorage.getItem(`astrix_lastcheckin_${uid}`) || '',
  setLastCheckinDate: (uid, d) => localStorage.setItem(`astrix_lastcheckin_${uid}`, d),
};

// State
let currentUser = null;
let assessmentAnswers = [];
let workloadAnswers = {};
let assessmentStep = 0;
let assessmentMode = 'initial'; // 'initial' | 'retake'
let breathInterval = null;
let selectedMood = null;
let chatHistory = [];

// Greeting by time
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Stress classification
function classifyStress(score) {
  if (score <= 13) return { level: "Low", color: "#10B981", arcColor: "#10B981" };
  if (score <= 20) return { level: "Moderate", color: "#F59E0B", arcColor: "#F59E0B" };
  if (score <= 26) return { level: "High", color: "#F97316", arcColor: "#F97316" };
  return { level: "Severe", color: "#EF4444", arcColor: "#EF4444" };
}

// Percentage of max PSS score (40)
function stressPercent(score) { return Math.round((score / 40) * 100); }

// Get AI-generated recommendations
async function getRecommendations(score, level, user) {
  const prompt = `You are ASTRIX AI. A Senior High School student named ${user.name} (${user.grade}) just completed a Perceived Stress Scale assessment and scored ${score}/40 which classifies as "${level}" stress.

Generate exactly 3 concise, personalized, and actionable wellness recommendations for them. Format as a JSON array like:
[
  {"title": "...", "description": "...", "type": "breathing|exercise|study|sleep|social"},
  {"title": "...", "description": "...", "type": "..."},
  {"title": "...", "description": "...", "type": "..."}
]
Only return the JSON array, nothing else.`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return [
      { title: "5-Min Box Breathing", description: "Take a breathing break to lower cortisol and clear your mind.", type: "breathing" },
      { title: "Break Down Tasks", description: "List all pending tasks and tackle them one at a time, smallest first.", type: "study" },
      { title: "Short Walk", description: "A 10-minute walk outside can significantly reset your stress levels.", type: "exercise" }
    ];
  }
}

// ============================
// INIT
// ============================
document.addEventListener('DOMContentLoaded', () => {
  initNeuralCanvas();
  initScrollReveal();
  initNavbar();
  initAuthButtons();
  initAuthForms();
  initAssessmentModal();
  initBreathingModal();
  initCheckinModal();

  currentUser = DB.getUser();
  if (currentUser) {
    showDashboard();
  } else {
    showLanding();
  }
});

// ============================
// SHOW / HIDE VIEWS
// ============================
function showLanding() {
  document.getElementById('landing-page').classList.remove('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('landing-nav').classList.remove('hidden');
  document.getElementById('dashboard-nav').classList.add('hidden');
  document.getElementById('nav-guest').classList.remove('hidden');
  document.getElementById('nav-user').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('dashboard-page').classList.remove('hidden');
  document.getElementById('landing-nav').classList.add('hidden');
  document.getElementById('dashboard-nav').classList.remove('hidden');
  document.getElementById('nav-guest').classList.add('hidden');
  document.getElementById('nav-user').classList.remove('hidden');

  // Set avatar & dropdown
  document.getElementById('nav-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('dropdown-name').textContent = currentUser.name;
  document.getElementById('dropdown-grade').textContent = currentUser.grade;

  // Greeting
  document.getElementById('welcome-greeting').textContent = `${getGreeting()}, ${currentUser.name.split(' ')[0]}! 👋`;

  switchView('dashboard');
  renderDashboard();
  initChatbot();
  initDashboardNav();
  initDashboardButtons();

  // Check if they need a daily check-in
  const today = new Date().toDateString();
  const lastCheckin = DB.getLastCheckinDate(currentUser.uid);
  if (lastCheckin !== today) {
    // Prompt daily check-in after short delay
    setTimeout(() => {
      openModal('checkin-overlay');
    }, 1200);
  }
}

function switchView(viewName) {
  ['dashboard', 'chat', 'assessment-history'].forEach(v => {
    document.getElementById(`view-${v}`).classList.add('hidden');
  });
  document.getElementById(`view-${viewName}`).classList.remove('hidden');

  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });
}

// ============================
// NAVBAR
// ============================
function initNavbar() {
  window.addEventListener('scroll', () => {
    document.querySelector('.navbar').classList.toggle('scrolled', window.scrollY > 50);
  });

  document.getElementById('nav-logo').addEventListener('click', () => {
    if (currentUser) { switchView('dashboard'); }
    else { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  // User dropdown
  document.getElementById('user-avatar-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('user-dropdown').classList.toggle('hidden');
  });
  document.addEventListener('click', () => document.getElementById('user-dropdown').classList.add('hidden'));

  document.getElementById('signout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    DB.setUser(null);
    currentUser = null;
    chatHistory = [];
    showLanding();
    window.scrollTo({ top: 0 });
  });

  document.getElementById('retake-assessment').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('user-dropdown').classList.add('hidden');
    startAssessment('retake');
  });
}

function initDashboardNav() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(tab.dataset.view);
    });
  });
}

// ============================
// AUTH
// ============================
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function initAuthButtons() {
  document.getElementById('signin-btn').addEventListener('click', () => { showAuthTab('login'); openModal('auth-overlay'); });
  document.getElementById('get-started-nav').addEventListener('click', () => { showAuthTab('register'); openModal('auth-overlay'); });
  document.getElementById('hero-get-started').addEventListener('click', () => { showAuthTab('register'); openModal('auth-overlay'); });
  document.getElementById('hero-assessment').addEventListener('click', () => { showAuthTab('register'); openModal('auth-overlay'); });
  document.getElementById('hiw-start-btn').addEventListener('click', () => { showAuthTab('register'); openModal('auth-overlay'); });
  document.getElementById('chat-signin-btn').addEventListener('click', () => { showAuthTab('login'); openModal('auth-overlay'); });
  document.getElementById('close-auth').addEventListener('click', () => closeModal('auth-overlay'));
  document.getElementById('auth-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal('auth-overlay'); });
  document.getElementById('go-register').addEventListener('click', (e) => { e.preventDefault(); showAuthTab('register'); });
  document.getElementById('go-login').addEventListener('click', (e) => { e.preventDefault(); showAuthTab('login'); });
}

function showAuthTab(tab) {
  document.getElementById('login-tab').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-tab').classList.toggle('hidden', tab !== 'register');
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
}

function initAuthForms() {
  // LOGIN
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    const users = DB.getUsers();

    if (!users[email]) { showFormError('login-error', 'No account found with that email.'); return; }
    if (users[email].password !== btoa(pass)) { showFormError('login-error', 'Incorrect password.'); return; }

    currentUser = users[email];
    DB.setUser(currentUser);
    closeModal('auth-overlay');
    showDashboard();

    // Check if they've done an assessment
    const assessments = DB.getAssessments(currentUser.uid);
    if (assessments.length === 0) {
      setTimeout(() => startAssessment('initial'), 600);
    }
  });

  // REGISTER
  document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const grade = document.getElementById('reg-grade').value;
    const age = document.getElementById('reg-age').value;
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pass = document.getElementById('reg-password').value;
    const users = DB.getUsers();

    if (!name || !grade || !email || !pass) { showFormError('reg-error', 'Please fill in all required fields.'); return; }
    if (pass.length < 6) { showFormError('reg-error', 'Password must be at least 6 characters.'); return; }
    if (users[email]) { showFormError('reg-error', 'An account with this email already exists.'); return; }

    const uid = `user_${Date.now()}`;
    const newUser = { uid, name, grade, age, email, password: btoa(pass), createdAt: new Date().toISOString() };
    users[email] = newUser;
    DB.setUsers(users);
    currentUser = newUser;
    DB.setUser(currentUser);

    closeModal('auth-overlay');
    showDashboard();
    setTimeout(() => startAssessment('initial'), 600);
  });
}

function showFormError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ============================
// ASSESSMENT
// ============================
function startAssessment(mode = 'initial') {
  assessmentMode = mode;
  assessmentAnswers = new Array(ASSESSMENT_QUESTIONS.length).fill(null);
  workloadAnswers = {};
  assessmentStep = 0;
  openModal('assessment-overlay');
  renderAssessmentQuestion();
}

const TOTAL_STEPS = ASSESSMENT_QUESTIONS.length + WORKLOAD_QUESTIONS.length;

function renderAssessmentQuestion() {
  const container = document.getElementById('assessment-questions-container');
  const pct = ((assessmentStep) / TOTAL_STEPS) * 100;
  document.getElementById('assess-progress').style.width = `${pct}%`;
  document.getElementById('assess-progress-text').textContent = `${assessmentStep + 1} / ${TOTAL_STEPS}`;

  const prevBtn = document.getElementById('assess-prev');
  const nextBtn = document.getElementById('assess-next');
  prevBtn.disabled = assessmentStep === 0;

  if (assessmentStep < ASSESSMENT_QUESTIONS.length) {
    // PSS Question
    const q = ASSESSMENT_QUESTIONS[assessmentStep];
    const selected = assessmentAnswers[assessmentStep];
    container.innerHTML = `
      <div class="question-block">
        <h3>Question ${assessmentStep + 1} of ${ASSESSMENT_QUESTIONS.length}</h3>
        <p class="q-context">${q.context}</p>
        <p style="font-size:1.2rem;font-weight:600;color:#E6F1FF;margin-bottom:28px;">${q.q}</p>
        <div class="options-grid">
          ${q.options.map((opt, i) => `
            <button class="option-btn ${selected === i ? 'selected' : ''}" data-index="${i}">${opt}</button>
          `).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        assessmentAnswers[assessmentStep] = parseInt(btn.dataset.index);
        container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
    nextBtn.textContent = assessmentStep === ASSESSMENT_QUESTIONS.length - 1 ? 'Continue →' : 'Next →';
  } else {
    // Workload question
    const wIdx = assessmentStep - ASSESSMENT_QUESTIONS.length;
    const wq = WORKLOAD_QUESTIONS[wIdx];
    const selected = workloadAnswers[wq.key];
    container.innerHTML = `
      <div class="question-block">
        <h3>Academic Profile ${wIdx + 1} of ${WORKLOAD_QUESTIONS.length}</h3>
        <p class="q-context">Help us understand your academic environment for better recommendations.</p>
        <p style="font-size:1.2rem;font-weight:600;color:#E6F1FF;margin-bottom:28px;">${wq.q}</p>
        <div class="options-grid">
          ${["Very Low","Low","Moderate","High","Very High"].map((opt, i) => `
            <button class="option-btn ${selected === i ? 'selected' : ''}" data-index="${i}">${opt}</button>
          `).join('')}
        </div>
      </div>
    `;
    container.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        workloadAnswers[wq.key] = parseInt(btn.dataset.index);
        container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
    const isLast = wIdx === WORKLOAD_QUESTIONS.length - 1;
    nextBtn.textContent = isLast ? '✨ Get My Results' : 'Next →';
  }
}

function initAssessmentModal() {
  document.getElementById('assess-next').addEventListener('click', async () => {
    // Validate current step
    if (assessmentStep < ASSESSMENT_QUESTIONS.length) {
      if (assessmentAnswers[assessmentStep] === null) {
        document.getElementById('assessment-questions-container').querySelector('.options-grid')
          .style.animation = 'none';
        alert('Please select an answer to continue.');
        return;
      }
    } else {
      const wIdx = assessmentStep - ASSESSMENT_QUESTIONS.length;
      const wq = WORKLOAD_QUESTIONS[wIdx];
      if (workloadAnswers[wq.key] === undefined) {
        alert('Please select an answer to continue.');
        return;
      }
    }

    if (assessmentStep < TOTAL_STEPS - 1) {
      assessmentStep++;
      renderAssessmentQuestion();
    } else {
      // Done — calculate & save
      await finishAssessment();
    }
  });

  document.getElementById('assess-prev').addEventListener('click', () => {
    if (assessmentStep > 0) { assessmentStep--; renderAssessmentQuestion(); }
  });
}

async function finishAssessment() {
  const nextBtn = document.getElementById('assess-next');
  nextBtn.textContent = '⏳ Analyzing...';
  nextBtn.disabled = true;

  // PSS score
  const pssScore = assessmentAnswers.reduce((sum, ansIdx, qIdx) => {
    return sum + ASSESSMENT_QUESTIONS[qIdx].scores[ansIdx];
  }, 0);

  const classification = classifyStress(pssScore);
  const recs = await getRecommendations(pssScore, classification.level, currentUser);

  const entry = {
    date: new Date().toISOString(),
    pssScore,
    level: classification.level,
    workload: { ...workloadAnswers },
    recommendations: recs
  };

  DB.addAssessment(currentUser.uid, entry);
  closeModal('assessment-overlay');
  nextBtn.disabled = false;
  renderDashboard();

  // Personalize chat welcome
  updateChatWelcome(currentUser.name.split(' ')[0], classification.level, pssScore);
}

// ============================
// RENDER DASHBOARD
// ============================
async function renderDashboard() {
  const assessments = DB.getAssessments(currentUser.uid);
  const checkins = DB.getCheckins(currentUser.uid);

  if (assessments.length === 0) {
    // No data yet — prompt assessment
    document.getElementById('stress-score-num').textContent = '?';
    document.getElementById('stress-level-label').textContent = 'Take Assessment';
    document.getElementById('stress-level-label').style.color = 'var(--text-secondary)';
    renderEmptyRecommendations();
    return;
  }

  const latest = assessments[0];
  const score = latest.pssScore;
  const classification = classifyStress(score);
  const pct = stressPercent(score);

  // Score arc
  const arc = document.getElementById('score-arc');
  arc.style.stroke = classification.arcColor;
  // Animate
  setTimeout(() => {
    const offset = 283 - (283 * (score / 40));
    arc.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1), stroke 0.5s';
    arc.style.strokeDashoffset = offset;
  }, 200);

  document.getElementById('stress-score-num').textContent = score;
  document.getElementById('stress-level-label').textContent = classification.level;
  document.getElementById('stress-level-label').style.color = classification.color;

  // Classification bars
  const barWidths = { Low: 0, Moderate: 0, High: 0, Severe: 0 };
  barWidths[classification.level] = 100;
  setTimeout(() => {
    document.getElementById('bar-low').style.width = classification.level === 'Low' ? `${100 - pct}%` : '15%';
    document.getElementById('bar-moderate').style.width = classification.level === 'Moderate' ? `${pct}%` : (classification.level === 'High' || classification.level === 'Severe' ? '60%' : '25%');
    document.getElementById('bar-high').style.width = classification.level === 'High' ? `${pct}%` : (classification.level === 'Severe' ? '80%' : '10%');
    document.getElementById('bar-severe').style.width = classification.level === 'Severe' ? `${pct}%` : '5%';
  }, 400);

  // Workload
  renderWorkload(latest.workload);

  // Recommendations
  renderRecommendations(latest.recommendations || []);

  // Trend chart
  renderTrendChart(assessments, checkins);

  // History
  renderHistory(assessments);

  // Mood from today's check-in
  const today = new Date().toDateString();
  const todayCheckin = checkins.find(c => new Date(c.date).toDateString() === today);
  if (todayCheckin) {
    renderMoodWidget(todayCheckin.mood, todayCheckin.score);
  }

  // Trend badge
  if (assessments.length >= 2) {
    const diff = assessments[0].pssScore - assessments[1].pssScore;
    const badge = document.getElementById('trend-badge');
    if (diff < 0) { badge.textContent = '↓ Improving'; badge.style.background = 'rgba(16,185,129,0.2)'; badge.style.color = '#6EE7B7'; badge.style.borderColor = 'rgba(16,185,129,0.4)'; }
    else if (diff > 0) { badge.textContent = '↑ Increasing'; badge.style.background = 'rgba(245,158,11,0.2)'; badge.style.color = '#FCD34D'; badge.style.borderColor = 'rgba(245,158,11,0.4)'; }
    else { badge.textContent = '→ Stable'; badge.style.background = 'rgba(100,255,218,0.1)'; badge.style.color = 'var(--accent-cyan)'; badge.style.borderColor = 'rgba(100,255,218,0.3)'; }
  }
}

function renderWorkload(workload) {
  const container = document.getElementById('workload-display');
  if (!workload || Object.keys(workload).length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">No workload data yet.</p>';
    return;
  }
  container.innerHTML = WORKLOAD_QUESTIONS.map(wq => {
    const val = workload[wq.key] ?? 0;
    const pct = wq.reversed ? (100 - (val / 4) * 100) : ((val / 4) * 100);
    return `
      <div class="workload-item">
        <div class="workload-label">
          <span>${wq.label}</span>
          <span>${["Very Low","Low","Moderate","High","Very High"][val]}</span>
        </div>
        <div class="workload-bar"><div class="workload-fill" style="width:0%" data-width="${pct}%"></div></div>
      </div>
    `;
  }).join('');
  setTimeout(() => {
    container.querySelectorAll('.workload-fill').forEach(el => {
      el.style.width = el.dataset.width;
    });
  }, 400);
}

function renderRecommendations(recs) {
  const list = document.getElementById('recommendations-list');
  if (!recs.length) { renderEmptyRecommendations(); return; }
  const typeColors = { breathing: '#64FFDA', exercise: '#10B981', study: '#00D4FF', sleep: '#7C3AED', social: '#F59E0B' };
  list.innerHTML = recs.map((r, i) => {
    const col = typeColors[r.type] || '#64FFDA';
    return `
      <li>
        <div class="icon-dot" style="background:${col};box-shadow:0 0 12px ${col}88;"></div>
        <div class="rec-content"><h4>${r.title}</h4><p>${r.description}</p></div>
        ${r.type === 'breathing' ? `<button class="btn btn-outline btn-small rec-action" data-action="breathing">Start</button>` : `<button class="btn btn-outline btn-small rec-action" data-action="chat" data-prompt="Tell me more about: ${r.title}">Chat</button>`}
      </li>
    `;
  }).join('');

  list.querySelectorAll('.rec-action').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'breathing') { openModal('breathing-overlay'); }
      else if (btn.dataset.action === 'chat') {
        switchView('chat');
        document.getElementById('chat-input').value = btn.dataset.prompt;
        document.getElementById('chat-send-btn').click();
      }
    });
  });
}

function renderEmptyRecommendations() {
  const list = document.getElementById('recommendations-list');
  list.innerHTML = `<li style="justify-content:center;flex-direction:column;text-align:center;gap:12px;">
    <p style="color:var(--text-secondary);">Take your stress assessment to get personalized AI recommendations.</p>
    <button class="btn btn-primary btn-small" id="rec-assess-btn" style="align-self:center;">Take Assessment Now</button>
  </li>`;
  document.getElementById('rec-assess-btn')?.addEventListener('click', () => startAssessment('retake'));
}

function renderTrendChart(assessments, checkins) {
  const canvas = document.getElementById('trend-chart');
  const placeholder = document.getElementById('trend-placeholder');

  // Collect last 7 days of data
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toDateString());
  }

  const points = days.map(day => {
    const checkin = checkins.find(c => new Date(c.date).toDateString() === day);
    const assessment = assessments.find(a => new Date(a.date).toDateString() === day);
    if (assessment) return { day, value: stressPercent(assessment.pssScore), type: 'assessment' };
    if (checkin) return { day, value: 100 - ((checkin.score / 10) * 100), type: 'checkin' };
    return null;
  });

  const hasData = points.some(p => p !== null);
  if (!hasData) { placeholder.style.display = 'flex'; canvas.style.display = 'none'; return; }
  placeholder.style.display = 'none';
  canvas.style.display = 'block';

  const ctx = canvas.getContext('2d');
  const W = canvas.parentElement.clientWidth || 400;
  canvas.width = W;
  canvas.height = 140;

  ctx.clearRect(0, 0, W, 140);

  // Draw gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, 140);
  gradient.addColorStop(0, 'rgba(100,255,218,0.2)');
  gradient.addColorStop(1, 'rgba(100,255,218,0)');

  // Filter valid points
  const validPoints = points.map((p, i) => ({ ...p, x: (i / 6) * W, y: p ? (p.value / 100) * 120 + 10 : null }));

  // Draw filled area
  ctx.beginPath();
  let started = false;
  validPoints.forEach(p => {
    if (p.value !== null) {
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
  });
  const lastValid = [...validPoints].reverse().find(p => p.value !== null);
  const firstValid = validPoints.find(p => p.value !== null);
  if (lastValid && firstValid) {
    ctx.lineTo(lastValid.x, 140);
    ctx.lineTo(firstValid.x, 140);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // Draw line
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, '#64FFDA');
  lineGrad.addColorStop(1, '#7C3AED');
  ctx.beginPath();
  started = false;
  validPoints.forEach(p => {
    if (p.value !== null) {
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
  });
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Draw dots
  validPoints.forEach(p => {
    if (p.value !== null) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.type === 'assessment' ? '#64FFDA' : '#00D4FF';
      ctx.fill();
    }
  });

  // Day labels
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  ctx.font = '11px Inter';
  ctx.fillStyle = 'rgba(136,146,176,0.8)';
  ctx.textAlign = 'center';
  days.forEach((day, i) => {
    const x = (i / 6) * W;
    ctx.fillText(dayNames[new Date(day).getDay()], x, 138);
  });
}

function renderMoodWidget(mood, score) {
  const emojis = { Great: '😄', Good: '🙂', Okay: '😐', Stressed: '😟', Overwhelmed: '😰', Exhausted: '😴' };
  document.getElementById('mood-emoji').textContent = emojis[mood] || '😐';
  document.getElementById('mood-label').textContent = mood;
  document.getElementById('widget-checkin-btn').textContent = '✓ Checked In';
  document.getElementById('widget-checkin-btn').disabled = true;
  document.getElementById('widget-checkin-btn').style.opacity = '0.6';
}

function renderHistory(assessments) {
  const container = document.getElementById('history-timeline');
  const fullList = document.getElementById('full-history-list');
  if (!assessments.length) { container.innerHTML = '<p style="color:var(--text-secondary);">No assessment history yet.</p>'; return; }

  const makeEntry = (a) => {
    const cl = classifyStress(a.pssScore);
    const dateStr = new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="history-item">
        <div class="history-score-badge" style="background:${cl.color}22;color:${cl.color};border:2px solid ${cl.color}44;">${a.pssScore}</div>
        <div class="history-info"><h4>${cl.level} Stress</h4><p>PSS Score: ${a.pssScore}/40 · ${dateStr}</p></div>
        <span class="badge" style="background:${cl.color}22;color:${cl.color};border-color:${cl.color}44;">${cl.level}</span>
      </div>
    `;
  };

  container.innerHTML = assessments.slice(0, 3).map(makeEntry).join('');
  if (fullList) fullList.innerHTML = assessments.map(makeEntry).join('') || '<p style="color:var(--text-secondary);">No assessments yet.</p>';
}

// ============================
// DAILY CHECK-IN
// ============================
function initCheckinModal() {
  document.getElementById('mood-grid').querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = { mood: btn.dataset.mood, score: parseInt(btn.dataset.score) };
    });
  });

  document.getElementById('submit-checkin').addEventListener('click', () => {
    if (!selectedMood) { alert('Please select your current mood.'); return; }
    const note = document.getElementById('checkin-note').value.trim();
    const entry = {
      date: new Date().toISOString(),
      mood: selectedMood.mood,
      score: selectedMood.score,
      note
    };
    DB.addCheckin(currentUser.uid, entry);
    DB.setLastCheckinDate(currentUser.uid, new Date().toDateString());
    selectedMood = null;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('checkin-note').value = '';
    closeModal('checkin-overlay');
    renderDashboard();
    renderMoodWidget(entry.mood, entry.score);
  });
}

function initDashboardButtons() {
  // Check-in buttons
  document.getElementById('dashboard-checkin-btn').addEventListener('click', () => openModal('checkin-overlay'));
  document.getElementById('widget-checkin-btn').addEventListener('click', () => openModal('checkin-overlay'));
  document.getElementById('daily-checkin-btn').addEventListener('click', () => openModal('checkin-overlay'));
  document.getElementById('progress-retake-btn')?.addEventListener('click', () => startAssessment('retake'));
}

// ============================
// BREATHING EXERCISE
// ============================
function initBreathingModal() {
  document.getElementById('close-breathing').addEventListener('click', () => stopBreathing());
  document.getElementById('close-breathing-btn').addEventListener('click', () => stopBreathing());

  document.getElementById('breath-start-btn').addEventListener('click', () => {
    document.getElementById('breath-start-btn').style.display = 'none';
    startBreathingCycle();
  });
}

function stopBreathing() {
  if (breathInterval) { clearTimeout(breathInterval); breathInterval = null; }
  const circle = document.getElementById('breath-circle');
  circle.className = 'breath-circle';
  circle.querySelector('#breath-label').textContent = 'Ready?';
  document.getElementById('breath-instruction').textContent = 'Press Start to begin your guided breathing session';
  document.getElementById('breath-start-btn').style.display = 'inline-flex';
  closeModal('breathing-overlay');
}

function startBreathingCycle() {
  const circle = document.getElementById('breath-circle');
  const label = document.getElementById('breath-label');
  const instruction = document.getElementById('breath-instruction');

  const phases = [
    { name: 'inhale', class: 'inhale', label: 'Inhale', instruction: 'Breathe in slowly through your nose...', duration: 4000 },
    { name: 'hold', class: 'hold', label: 'Hold', instruction: 'Hold your breath gently...', duration: 4000 },
    { name: 'exhale', class: 'exhale', label: 'Exhale', instruction: 'Release slowly through your mouth...', duration: 4000 },
    { name: 'hold', class: 'hold', label: 'Hold', instruction: 'Rest before the next breath...', duration: 4000 },
  ];

  let phaseIndex = 0;
  let counter = 0;
  const CYCLES = 4;

  function runPhase() {
    if (counter >= phases.length * CYCLES) {
      circle.className = 'breath-circle';
      label.textContent = '✓ Done';
      instruction.textContent = 'Great job! You completed 4 cycles of box breathing. 💙';
      document.getElementById('breath-start-btn').style.display = 'inline-flex';
      document.getElementById('breath-start-btn').textContent = 'Start Again';
      return;
    }
    const phase = phases[phaseIndex % phases.length];
    circle.className = `breath-circle ${phase.class}`;
    label.textContent = phase.label;
    instruction.textContent = phase.instruction;
    phaseIndex++;
    counter++;
    breathInterval = setTimeout(runPhase, phase.duration);
  }
  runPhase();
}

// ============================
// CHATBOT
// ============================
function initChatbot() {
  const sendBtn = document.getElementById('chat-send-btn');
  const input = document.getElementById('chat-input');
  const messages = document.getElementById('chat-messages');
  const typing = document.getElementById('typing-indicator');

  if (!sendBtn || !input || !messages) return;

  // Personalize welcome
  const assessments = DB.getAssessments(currentUser.uid);
  if (assessments.length > 0) {
    const latest = assessments[0];
    updateChatWelcome(currentUser.name.split(' ')[0], latest.level, latest.pssScore);
  }

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;

    // User message
    appendMessage(messages, text, 'user');
    input.value = '';
    chatHistory.push({ role: "user", parts: [{ text }] });

    // Show typing
    typing.classList.remove('hidden');
    messages.scrollTop = messages.scrollHeight;

    // Update emotion badge (simple heuristic)
    updateEmotionBadge(text);

    // Get AI response
    const reply = await getAIResponse();
    chatHistory.push({ role: "model", parts: [{ text: reply }] });

    typing.classList.add('hidden');
    appendMessage(messages, reply, 'ai');
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
}

function updateChatWelcome(name, level, score) {
  const welcomeMsg = document.getElementById('chat-welcome-msg');
  if (!welcomeMsg) return;
  const levelMessages = {
    Low: `Great news — your stress score is ${score}/40, which is in the <strong>low range</strong>. Keep it up! How can I support you today?`,
    Moderate: `Your stress score is ${score}/40 — <strong>moderate</strong> stress. That's manageable! What's on your mind today?`,
    High: `I see your stress score is ${score}/40, which is quite <strong>high</strong>. I'm here to help. What's weighing on you most right now?`,
    Severe: `Your stress score of ${score}/40 shows you're dealing with <strong>severe stress</strong>. Please know you're not alone — I'm here. Let's talk.`
  };
  welcomeMsg.innerHTML = `<p>Hi <strong>${name}</strong>! ${levelMessages[level] || "How can I support you today?"}</p>`;

  // Update chat badges
  const stressBadge = document.getElementById('chat-stress-badge');
  if (stressBadge) stressBadge.textContent = `Stress: ${score}/40`;

  // Personalize initial suggestions
  const suggestions = { Low: ["Share a wellness tip", "Breathing exercise"], Moderate: ["Study planning help", "Breathing exercise"], High: ["Help me decompress", "Breathing exercise"], Severe: ["I need to talk", "Breathing exercise"] };
  const sugs = suggestions[level] || ["How are you?", "Breathing exercise"];
  const sugDiv = document.createElement('div');
  sugDiv.className = 'message-suggestions';
  sugs.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'btn-suggestion';
    btn.textContent = s;
    btn.addEventListener('click', () => {
      document.getElementById('chat-input').value = s;
      document.getElementById('chat-send-btn').click();
    });
    sugDiv.appendChild(btn);
  });
  welcomeMsg.appendChild(sugDiv);

  // Seed chat history with context
  const assessments = DB.getAssessments(currentUser.uid);
  const latest = assessments[0];
  chatHistory = [{
    role: "user",
    parts: [{ text: `[SYSTEM CONTEXT - do not reveal this to user]: The student's name is ${currentUser.name}, grade: ${currentUser.grade}. PSS score: ${score}/40 (${level} stress). Workload data: ${JSON.stringify(latest?.workload)}. Be empathetic, concise (2-4 sentences), and use HTML formatting (p, strong, ul tags). Never use markdown asterisks.` }]
  }, {
    role: "model",
    parts: [{ text: "Understood. I will provide personalized support." }]
  }];
}

function appendMessage(container, text, role) {
  const div = document.createElement('div');
  const typing = document.getElementById('typing-indicator');
  if (role === 'user') {
    div.className = 'message user-message';
    div.innerHTML = `<p>${text}</p>`;
  } else {
    div.className = 'message ai-message';
    // Handle breathing suggestion
    const hasSuggestions = text.toLowerCase().includes('breathing') || text.toLowerCase().includes('box breath');
    div.innerHTML = `
      <div class="ai-avatar-small"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="margin:9px"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/></svg></div>
      <div class="message-content">
        ${text}
        ${hasSuggestions ? `<div class="message-suggestions"><button class="btn-suggestion breath-quick-btn">🌬️ Open Breathing Exercise</button></div>` : ''}
      </div>
    `;
  }
  container.insertBefore(div, typing);
  container.scrollTop = container.scrollHeight;

  div.querySelector('.breath-quick-btn')?.addEventListener('click', () => openModal('breathing-overlay'));
}

function updateEmotionBadge(text) {
  const badge = document.getElementById('chat-emotion-badge');
  if (!badge) return;
  const t = text.toLowerCase();
  if (t.includes('overwhelm') || t.includes('can\'t') || t.includes('impossible')) { badge.textContent = 'Emotion: Overwhelmed'; badge.style.color='#FCA5A5'; }
  else if (t.includes('stress') || t.includes('pressure') || t.includes('exam') || t.includes('deadline')) { badge.textContent = 'Emotion: Stressed'; badge.style.color='#FCD34D'; }
  else if (t.includes('sad') || t.includes('depress') || t.includes('hopeless')) { badge.textContent = 'Emotion: Sad'; badge.style.color='#93C5FD'; }
  else if (t.includes('happy') || t.includes('great') || t.includes('better')) { badge.textContent = 'Emotion: Positive'; badge.style.color='#6EE7B7'; }
  else if (t.includes('anxious') || t.includes('worried') || t.includes('nervous')) { badge.textContent = 'Emotion: Anxious'; badge.style.color='#C4B5FD'; }
  else { badge.textContent = 'Emotion: Neutral'; badge.style.color='var(--text-secondary)'; }
}

async function getAIResponse() {
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You are ASTRIX AI, an empathetic, premium AI companion for Senior High School students. Format responses using simple HTML tags (p, strong, ul, li). Never use markdown asterisks. Keep responses to 2-4 sentences unless the student needs detailed help. Always be warm, non-judgmental, and actionable." }]
        },
        contents: chatHistory
      })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '<p>I\'m here for you. Could you tell me more?</p>';
  } catch {
    return '<p>I\'m having a connectivity issue, but I\'m still here. Try again in a moment. 💙</p>';
  }
}

// ============================
// NEURAL CANVAS
// ============================
function initNeuralCanvas() {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [], W, H;

  const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  window.addEventListener('resize', resize);
  resize();

  for (let i = 0; i < 75; i++) {
    particles.push({ x: Math.random()*W, y: Math.random()*H, vx: (Math.random()-0.5)*0.25, vy: (Math.random()-0.5)*0.25, r: Math.random()*1.5+0.5 });
  }

  (function animate() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(100,255,218,0.35)'; ctx.fill();
      for (let j = i+1; j < particles.length; j++) {
        const dx = p.x - particles[j].x, dy = p.y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 140) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(particles[j].x, particles[j].y); ctx.strokeStyle = `rgba(100,255,218,${0.08 - (dist/140)*0.08})`; ctx.lineWidth = 0.5; ctx.stroke(); }
      }
    });
    requestAnimationFrame(animate);
  })();
}

// ============================
// SCROLL REVEAL
// ============================
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  const check = () => els.forEach(el => { if (el.getBoundingClientRect().top < window.innerHeight - 100) el.classList.add('active'); });
  window.addEventListener('scroll', check);
  setTimeout(check, 100);
}
