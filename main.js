// ============================================================
// ASTRIX AI — main.js
// Full Supabase-backed auth, assessment, dashboard, and chat
// ============================================================

import { supabase } from './supabase.js';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`;

// ── PSS-10 Questions ─────────────────────────────────────────
const ASSESSMENT_QUESTIONS = [
  { q: "In the last month, how often have you been upset because of something that happened unexpectedly?", context: "Think about unexpected events related to school, family, or personal life.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [0,1,2,3,4] },
  { q: "In the last month, how often have you felt that you were unable to control the important things in your life?", context: "This includes schoolwork, deadlines, relationships, and personal goals.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [0,1,2,3,4] },
  { q: "In the last month, how often have you felt nervous and stressed?", context: "Consider all sources of stress: exams, requirements, social pressures.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [0,1,2,3,4] },
  { q: "In the last month, how often have you felt confident about your ability to handle your personal problems?", context: "Reversed question — feeling confident means lower stress.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [4,3,2,1,0] },
  { q: "In the last month, how often have you felt that things were going your way?", context: "Reversed question — things going well means lower stress.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [4,3,2,1,0] },
  { q: "In the last month, how often have you been unable to cope with all the things you had to do?", context: "Think about your school requirements, extracurricular activities, and responsibilities at home.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [0,1,2,3,4] },
  { q: "In the last month, how often have you been able to control irritations in your life?", context: "Reversed question — being able to control irritations means lower stress.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [4,3,2,1,0] },
  { q: "In the last month, how often have you felt that you were on top of things?", context: "Reversed question — feeling on top of things means lower stress.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [4,3,2,1,0] },
  { q: "In the last month, how often have you been angered because of things that were outside your control?", context: "Include school policies, peer behavior, or family situations.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [0,1,2,3,4] },
  { q: "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?", context: "This is about feeling overwhelmed by the overall amount of stress in your life.", options: ["Never","Almost Never","Sometimes","Fairly Often","Very Often"], scores: [0,1,2,3,4] },
];

const WORKLOAD_QUESTIONS = [
  { key: "homeworkLoad",   label: "Daily Homework Load",   q: "How heavy is your daily homework and assignment load?" },
  { key: "examFrequency",  label: "Exam/Quiz Frequency",   q: "How often do you have exams or quizzes?" },
  { key: "sleepQuality",   label: "Sleep Quality",          q: "How would you rate your sleep quality lately?",          reversed: true },
  { key: "socialSupport",  label: "Social Support",         q: "How much social support do you feel from friends and family?", reversed: true },
];

const TOTAL_STEPS = ASSESSMENT_QUESTIONS.length + WORKLOAD_QUESTIONS.length;
const WORKLOAD_LABELS = ["Very Low","Low","Moderate","High","Very High"];

// ── App State ────────────────────────────────────────────────
let currentUser    = null;   // Supabase auth user
let currentProfile = null;   // profiles table row
let assessmentAnswers  = [];
let workloadAnswers    = {};
let assessmentStep     = 0;
let selectedMood       = null;
let breathInterval     = null;
let chatHistory        = [];
let _chatbotInited     = false;  // guard: only attach chat listeners once
let _dashNavInited     = false;  // guard: only attach nav tab listeners once
let _dashBtnsInited    = false;  // guard: only attach dashboard button listeners once

// ── Helpers ──────────────────────────────────────────────────
const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

function classifyStress(score) {
  if (score <= 13) return { level: "Low",      color: "#10B981", arcColor: "#10B981" };
  if (score <= 20) return { level: "Moderate",  color: "#F59E0B", arcColor: "#F59E0B" };
  if (score <= 26) return { level: "High",      color: "#F97316", arcColor: "#F97316" };
  return              { level: "Severe",    color: "#EF4444", arcColor: "#EF4444" };
}

const stressPercent = (score) => Math.round((score / 40) * 100);

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showEl(id)     { document.getElementById(id).classList.remove('hidden'); }
function hideEl(id)     { document.getElementById(id).classList.add('hidden'); }
function showFormError(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.classList.remove('hidden'); }

// ── Supabase DB helpers ──────────────────────────────────────
async function fetchProfile(uid) {
  const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  return data;
}

async function fetchAssessments(uid) {
  const { data } = await supabase.from('assessments').select('*').eq('user_id', uid).order('created_at', { ascending: false });
  return data || [];
}

async function insertAssessment(uid, entry) {
  const { data, error } = await supabase.from('assessments').insert({
    user_id: uid,
    pss_score: entry.pssScore,
    level: entry.level,
    workload: entry.workload,
    recommendations: entry.recommendations,
  }).select().single();
  return data;
}

async function fetchCheckins(uid) {
  const { data } = await supabase.from('checkins').select('*').eq('user_id', uid).order('created_at', { ascending: false });
  return data || [];
}

async function insertCheckin(uid, entry) {
  await supabase.from('checkins').insert({
    user_id: uid,
    mood: entry.mood,
    score: entry.score,
    note: entry.note || '',
  });
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initNeuralCanvas();
  initScrollReveal();
  initNavbar();
  initAuthButtons();
  initAuthForms();
  initAssessmentModal();
  initBreathingModal();
  initCheckinModal();

  // Show a loading state
  showLoadingOverlay(true);

  // Check existing Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser    = session.user;
    currentProfile = await fetchProfile(currentUser.id);
    showLoadingOverlay(false);
    await showDashboard();
  } else {
    showLoadingOverlay(false);
    showLanding();
  }

  // Listen for auth state changes (tab focus, token refresh, etc.)
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser    = session.user;
      currentProfile = await fetchProfile(currentUser.id);
      await showDashboard();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null; currentProfile = null; chatHistory = [];
      showLanding();
    }
  });
});

// ── Loading overlay ──────────────────────────────────────────
function showLoadingOverlay(show) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = `position:fixed;inset:0;background:rgba(10,25,47,0.92);z-index:999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;`;
    el.innerHTML = `<div style="width:48px;height:48px;border:3px solid rgba(100,255,218,0.2);border-top-color:#64FFDA;border-radius:50%;animation:spin 0.8s linear infinite;"></div><p style="color:var(--text-secondary);font-family:var(--font-main);">Loading ASTRIX AI...</p>`;
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

// ── PAGE TRANSITIONS ─────────────────────────────────────────
function showLanding() {
  showEl('landing-page'); hideEl('dashboard-page');
  showEl('landing-nav');  hideEl('dashboard-nav');
  showEl('nav-guest');    hideEl('nav-user');
}

async function showDashboard() {
  hideEl('landing-page'); showEl('dashboard-page');
  hideEl('landing-nav');  showEl('dashboard-nav');
  hideEl('nav-guest');    showEl('nav-user');

  const name  = currentProfile?.name  || currentUser.email.split('@')[0];
  const grade = currentProfile?.grade || '';

  document.getElementById('nav-avatar').textContent    = name.charAt(0).toUpperCase();
  document.getElementById('dropdown-name').textContent  = name;
  document.getElementById('dropdown-grade').textContent = grade;
  document.getElementById('welcome-greeting').textContent = `${getGreeting()}, ${name.split(' ')[0]}! 👋`;

  switchView('dashboard');
  initChatbot();
  initDashboardNav();
  initDashboardButtons();

  showLoadingOverlay(true);
  await renderDashboard();
  showLoadingOverlay(false);

  // Daily check-in prompt — check if already done today
  const checkins = await fetchCheckins(currentUser.id);
  const today    = new Date().toDateString();
  const doneTodayCheckin = checkins.some(c => new Date(c.created_at).toDateString() === today);
  if (!doneTodayCheckin) {
    setTimeout(() => openModal('checkin-overlay'), 1200);
  }
}

function switchView(viewName) {
  ['dashboard','chat','assessment-history'].forEach(v => hideEl(`view-${v}`));
  showEl(`view-${viewName}`);
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === viewName));
}

// ── NAVBAR ───────────────────────────────────────────────────
function initNavbar() {
  window.addEventListener('scroll', () => document.querySelector('.navbar').classList.toggle('scrolled', window.scrollY > 50));
  document.getElementById('nav-logo').addEventListener('click', () => { if (currentUser) switchView('dashboard'); else window.scrollTo({ top: 0, behavior: 'smooth' }); });

  document.getElementById('user-avatar-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('user-dropdown').classList.toggle('hidden'); });
  document.addEventListener('click', () => document.getElementById('user-dropdown').classList.add('hidden'));

  document.getElementById('signout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
  });

  document.getElementById('retake-assessment').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('user-dropdown').classList.add('hidden');
    startAssessment();
  });
}

function initDashboardNav() {
  if (_dashNavInited) return;
  _dashNavInited = true;
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => { e.preventDefault(); switchView(tab.dataset.view); });
  });
}

// ── AUTH ─────────────────────────────────────────────────────
function initAuthButtons() {
  const openLogin    = () => { showAuthTab('login');    openModal('auth-overlay'); };
  const openRegister = () => { showAuthTab('register'); openModal('auth-overlay'); };

  document.getElementById('signin-btn').addEventListener('click', openLogin);
  ['get-started-nav','hero-get-started','hero-assessment','hiw-start-btn','chat-signin-btn'].forEach(id => document.getElementById(id).addEventListener('click', openRegister));
  document.getElementById('close-auth').addEventListener('click', () => closeModal('auth-overlay'));
  document.getElementById('auth-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal('auth-overlay'); });
  document.getElementById('go-register').addEventListener('click', (e) => { e.preventDefault(); showAuthTab('register'); });
  document.getElementById('go-login').addEventListener('click',    (e) => { e.preventDefault(); showAuthTab('login'); });
}

function showAuthTab(tab) {
  document.getElementById('login-tab').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-tab').classList.toggle('hidden', tab !== 'register');
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
}

function initAuthForms() {
  // ── LOGIN ──
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pass  = document.getElementById('login-password').value;
    const btn   = e.target.querySelector('button[type=submit]');
    btn.textContent = 'Signing in...'; btn.disabled = true;

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    btn.textContent = 'Sign In'; btn.disabled = false;

    if (error) { showFormError('login-error', error.message); return; }
    closeModal('auth-overlay');
    // onAuthStateChange will trigger showDashboard
  });

  // ── REGISTER ──
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('reg-name').value.trim();
    const grade = document.getElementById('reg-grade').value;
    const age   = parseInt(document.getElementById('reg-age').value) || null;
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pass  = document.getElementById('reg-password').value;
    const btn   = e.target.querySelector('button[type=submit]');

    if (!name || !grade || !email || !pass) { showFormError('reg-error', 'Please fill in all required fields.'); return; }
    if (pass.length < 6) { showFormError('reg-error', 'Password must be at least 6 characters.'); return; }

    btn.textContent = 'Creating account...'; btn.disabled = true;

    // 1. Create auth user
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password: pass });
    if (signUpError) { showFormError('reg-error', signUpError.message); btn.textContent = 'Create Account & Start Assessment'; btn.disabled = false; return; }

    // 2. Set currentUser immediately so finishAssessment() has access before onAuthStateChange fires
    currentUser = data.user;

    // 3. Insert profile row
    const { data: profileData } = await supabase.from('profiles').insert({ id: data.user.id, name, grade, age }).select().single();
    currentProfile = profileData;

    btn.textContent = 'Create Account & Start Assessment'; btn.disabled = false;
    closeModal('auth-overlay');

    // Show dashboard then start assessment (no race condition since currentUser is already set)
    await showDashboard();
    setTimeout(() => startAssessment(), 400);
  });
}

// ── ASSESSMENT ───────────────────────────────────────────────
function startAssessment() {
  assessmentAnswers = new Array(ASSESSMENT_QUESTIONS.length).fill(null);
  workloadAnswers   = {};
  assessmentStep    = 0;
  openModal('assessment-overlay');
  renderAssessmentQuestion();
}

function renderAssessmentQuestion() {
  const container = document.getElementById('assessment-questions-container');
  const pct = (assessmentStep / TOTAL_STEPS) * 100;
  document.getElementById('assess-progress').style.width = `${pct}%`;
  document.getElementById('assess-progress-text').textContent = `${assessmentStep + 1} / ${TOTAL_STEPS}`;
  document.getElementById('assess-prev').disabled = assessmentStep === 0;

  if (assessmentStep < ASSESSMENT_QUESTIONS.length) {
    const q        = ASSESSMENT_QUESTIONS[assessmentStep];
    const selected = assessmentAnswers[assessmentStep];
    container.innerHTML = `
      <div class="question-block">
        <h3>Question ${assessmentStep + 1} of ${ASSESSMENT_QUESTIONS.length}</h3>
        <p class="q-context">${q.context}</p>
        <p style="font-size:1.15rem;font-weight:600;color:#E6F1FF;margin-bottom:28px;">${q.q}</p>
        <div class="options-grid">
          ${q.options.map((opt, i) => `<button class="option-btn ${selected === i ? 'selected' : ''}" data-index="${i}">${opt}</button>`).join('')}
        </div>
      </div>`;
    container.querySelectorAll('.option-btn').forEach(btn => btn.addEventListener('click', () => {
      assessmentAnswers[assessmentStep] = parseInt(btn.dataset.index);
      container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    }));
    document.getElementById('assess-next').textContent = assessmentStep === ASSESSMENT_QUESTIONS.length - 1 ? 'Continue →' : 'Next →';
  } else {
    const wIdx     = assessmentStep - ASSESSMENT_QUESTIONS.length;
    const wq       = WORKLOAD_QUESTIONS[wIdx];
    const selected = workloadAnswers[wq.key];
    container.innerHTML = `
      <div class="question-block">
        <h3>Academic Profile ${wIdx + 1} of ${WORKLOAD_QUESTIONS.length}</h3>
        <p class="q-context">Help us understand your academic environment for better recommendations.</p>
        <p style="font-size:1.15rem;font-weight:600;color:#E6F1FF;margin-bottom:28px;">${wq.q}</p>
        <div class="options-grid">
          ${WORKLOAD_LABELS.map((opt, i) => `<button class="option-btn ${selected === i ? 'selected' : ''}" data-index="${i}">${opt}</button>`).join('')}
        </div>
      </div>`;
    container.querySelectorAll('.option-btn').forEach(btn => btn.addEventListener('click', () => {
      workloadAnswers[wq.key] = parseInt(btn.dataset.index);
      container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    }));
    document.getElementById('assess-next').textContent = wIdx === WORKLOAD_QUESTIONS.length - 1 ? '✨ Get My Results' : 'Next →';
  }
}

function initAssessmentModal() {
  document.getElementById('assess-next').addEventListener('click', async () => {
    if (assessmentStep < ASSESSMENT_QUESTIONS.length) {
      if (assessmentAnswers[assessmentStep] === null) { alert('Please select an answer to continue.'); return; }
    } else {
      const wq = WORKLOAD_QUESTIONS[assessmentStep - ASSESSMENT_QUESTIONS.length];
      if (workloadAnswers[wq.key] === undefined) { alert('Please select an answer to continue.'); return; }
    }
    if (assessmentStep < TOTAL_STEPS - 1) { assessmentStep++; renderAssessmentQuestion(); }
    else { await finishAssessment(); }
  });
  document.getElementById('assess-prev').addEventListener('click', () => { if (assessmentStep > 0) { assessmentStep--; renderAssessmentQuestion(); } });
}

async function finishAssessment() {
  const btn = document.getElementById('assess-next');
  btn.textContent = '⏳ Analyzing with AI...'; btn.disabled = true;

  // Safety: re-fetch session if currentUser was somehow lost
  if (!currentUser) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      currentProfile = currentProfile || await fetchProfile(currentUser.id);
    } else {
      btn.textContent = '✨ Get My Results'; btn.disabled = false;
      alert('Session expired. Please sign in again.');
      closeModal('assessment-overlay');
      return;
    }
  }

  const pssScore = assessmentAnswers.reduce((sum, ansIdx, qIdx) => sum + ASSESSMENT_QUESTIONS[qIdx].scores[ansIdx], 0);
  const cl       = classifyStress(pssScore);
  const recs     = await getAIRecommendations(pssScore, cl.level);

  await insertAssessment(currentUser.id, { pssScore, level: cl.level, workload: workloadAnswers, recommendations: recs });

  btn.textContent = '✨ Get My Results'; btn.disabled = false;
  closeModal('assessment-overlay');
  showLoadingOverlay(true);
  await renderDashboard();
  showLoadingOverlay(false);
  // Small gap so the recommendations call above doesn't rate-limit the chat-welcome call
  await new Promise(r => setTimeout(r, 2000));
  updateChatWelcome(currentProfile?.name?.split(' ')[0] || 'there', cl.level, pssScore);
}

// ── RENDER DASHBOARD ─────────────────────────────────────────
async function renderDashboard() {
  const [assessments, checkins] = await Promise.all([
    fetchAssessments(currentUser.id),
    fetchCheckins(currentUser.id)
  ]);

  if (!assessments.length) {
    document.getElementById('stress-score-num').textContent   = '?';
    document.getElementById('stress-level-label').textContent = 'No Assessment Yet';
    renderEmptyRecommendations();
    return;
  }

  const latest = assessments[0];
  const score  = latest.pss_score;
  const cl     = classifyStress(score);
  const pct    = stressPercent(score);

  // Score gauge
  const arc = document.getElementById('score-arc');
  arc.style.stroke = cl.arcColor;
  setTimeout(() => { arc.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1), stroke 0.5s'; arc.style.strokeDashoffset = 283 - (283 * (score / 40)); }, 200);
  document.getElementById('stress-score-num').textContent   = score;
  document.getElementById('stress-level-label').textContent = cl.level;
  document.getElementById('stress-level-label').style.color = cl.color;

  // Classification bars
  setTimeout(() => {
    document.getElementById('bar-low').style.width      = cl.level === 'Low'      ? `${100 - pct}%` : '12%';
    document.getElementById('bar-moderate').style.width = cl.level === 'Moderate'  ? `${pct}%`       : (cl.level === 'High' || cl.level === 'Severe' ? '55%' : '22%');
    document.getElementById('bar-high').style.width     = cl.level === 'High'      ? `${pct}%`       : (cl.level === 'Severe' ? '75%' : '8%');
    document.getElementById('bar-severe').style.width   = cl.level === 'Severe'    ? `${pct}%`       : '4%';
  }, 400);

  // Workload
  renderWorkload(latest.workload);

  // Recommendations
  renderRecommendations(latest.recommendations || []);

  // Trend chart
  renderTrendChart(assessments, checkins);

  // History
  renderHistory(assessments, checkins);

  // Today's mood
  const today         = new Date().toDateString();
  const todayCheckin  = checkins.find(c => new Date(c.created_at).toDateString() === today);
  if (todayCheckin) renderMoodWidget(todayCheckin.mood, todayCheckin.score);

  // Trend badge
  if (assessments.length >= 2) {
    const diff = assessments[0].pss_score - assessments[1].pss_score;
    const badge = document.getElementById('trend-badge');
    if (diff < 0)       { badge.textContent = '↓ Improving'; badge.style.cssText += 'background:rgba(16,185,129,0.2);color:#6EE7B7;border-color:rgba(16,185,129,0.4);'; }
    else if (diff > 0)  { badge.textContent = '↑ Increasing'; badge.style.cssText += 'background:rgba(245,158,11,0.2);color:#FCD34D;border-color:rgba(245,158,11,0.4);'; }
    else                { badge.textContent = '→ Stable'; badge.style.cssText += 'background:rgba(100,255,218,0.1);color:var(--accent-cyan);border-color:rgba(100,255,218,0.3);'; }
  }
}

function renderWorkload(workload) {
  const container = document.getElementById('workload-display');
  if (!workload || !Object.keys(workload).length) { container.innerHTML = '<p style="color:var(--text-secondary);">No workload data yet.</p>'; return; }
  container.innerHTML = WORKLOAD_QUESTIONS.map(wq => {
    const val = workload[wq.key] ?? 0;
    const pct = wq.reversed ? 100 - ((val / 4) * 100) : ((val / 4) * 100);
    return `<div class="workload-item"><div class="workload-label"><span>${wq.label}</span><span>${WORKLOAD_LABELS[val]}</span></div><div class="workload-bar"><div class="workload-fill" style="width:0%" data-width="${pct}%"></div></div></div>`;
  }).join('');
  setTimeout(() => container.querySelectorAll('.workload-fill').forEach(el => el.style.width = el.dataset.width), 400);
}

function renderRecommendations(recs) {
  const list   = document.getElementById('recommendations-list');
  if (!recs.length) { renderEmptyRecommendations(); return; }
  const colors = { breathing:'#64FFDA', exercise:'#10B981', study:'#00D4FF', sleep:'#7C3AED', social:'#F59E0B' };
  list.innerHTML = recs.map(r => {
    const col = colors[r.type] || '#64FFDA';
    const btn = r.type === 'breathing'
      ? `<button class="btn btn-outline btn-small rec-action" data-action="breathing">Start</button>`
      : `<button class="btn btn-outline btn-small rec-action" data-action="chat" data-prompt="Tell me more about: ${r.title}">Chat</button>`;
    return `<li><div class="icon-dot" style="background:${col};box-shadow:0 0 12px ${col}88;"></div><div class="rec-content"><h4>${r.title}</h4><p>${r.description}</p></div>${btn}</li>`;
  }).join('');
  list.querySelectorAll('.rec-action').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.action === 'breathing') openModal('breathing-overlay');
    else { switchView('chat'); document.getElementById('chat-input').value = btn.dataset.prompt; document.getElementById('chat-send-btn').click(); }
  }));
}

function renderEmptyRecommendations() {
  document.getElementById('recommendations-list').innerHTML = `<li style="justify-content:center;flex-direction:column;text-align:center;gap:12px;"><p style="color:var(--text-secondary);">Take your stress assessment to get personalized AI recommendations.</p><button class="btn btn-primary btn-small" id="rec-assess-btn" style="align-self:center;">Take Assessment Now</button></li>`;
  document.getElementById('rec-assess-btn')?.addEventListener('click', startAssessment);
}

function renderTrendChart(assessments, checkins) {
  const canvas      = document.getElementById('trend-chart');
  const placeholder = document.getElementById('trend-placeholder');
  const days        = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toDateString(); });
  const points      = days.map(day => {
    const a = assessments.find(x => new Date(x.created_at).toDateString() === day);
    const c = checkins.find(x => new Date(x.created_at).toDateString() === day);
    if (a) return { value: stressPercent(a.pss_score), type: 'assessment' };
    if (c) return { value: 100 - ((c.score / 10) * 100), type: 'checkin' };
    return null;
  });
  if (!points.some(Boolean)) { placeholder.style.display = 'flex'; canvas.style.display = 'none'; return; }
  placeholder.style.display = 'none'; canvas.style.display = 'block';
  const W = canvas.parentElement.clientWidth || 400;
  canvas.width = W; canvas.height = 140;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, 140);
  const pts = points.map((p, i) => ({ ...p, x: (i / 6) * W, y: p ? (p.value / 100) * 120 + 10 : null }));
  const grad = ctx.createLinearGradient(0, 0, 0, 140);
  grad.addColorStop(0, 'rgba(100,255,218,0.2)'); grad.addColorStop(1, 'rgba(100,255,218,0)');
  let started = false;
  ctx.beginPath();
  pts.forEach(p => { if (p.value !== null) { if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); } });
  const fst = pts.find(p => p.value !== null), lst = [...pts].reverse().find(p => p.value !== null);
  if (fst && lst) { ctx.lineTo(lst.x, 140); ctx.lineTo(fst.x, 140); ctx.closePath(); ctx.fillStyle = grad; ctx.fill(); }
  const lg = ctx.createLinearGradient(0, 0, W, 0);
  lg.addColorStop(0, '#64FFDA'); lg.addColorStop(1, '#7C3AED');
  started = false;
  ctx.beginPath();
  pts.forEach(p => { if (p.value !== null) { if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); } });
  ctx.strokeStyle = lg; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
  pts.forEach(p => { if (p.value !== null) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = p.type === 'assessment' ? '#64FFDA' : '#00D4FF'; ctx.fill(); } });
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  ctx.font = '11px Inter'; ctx.fillStyle = 'rgba(136,146,176,0.8)'; ctx.textAlign = 'center';
  days.forEach((day, i) => ctx.fillText(dayNames[new Date(day).getDay()], (i / 6) * W, 138));
}

function renderMoodWidget(mood, score) {
  const emojis = { Great:'😄', Good:'🙂', Okay:'😐', Stressed:'😟', Overwhelmed:'😰', Exhausted:'😴' };
  document.getElementById('mood-emoji').textContent = emojis[mood] || '😐';
  document.getElementById('mood-label').textContent = mood;
  const btn = document.getElementById('widget-checkin-btn');
  btn.textContent = '✓ Checked In'; btn.disabled = true; btn.style.opacity = '0.6';
}

function renderHistory(assessments, checkins) {
  const makeEntry = (a) => {
    const cl  = classifyStress(a.pss_score);
    const d   = new Date(a.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return `<div class="history-item"><div class="history-score-badge" style="background:${cl.color}22;color:${cl.color};border:2px solid ${cl.color}44;">${a.pss_score}</div><div class="history-info"><h4>${cl.level} Stress</h4><p>PSS Score: ${a.pss_score}/40 · ${d}</p></div><span class="badge" style="background:${cl.color}22;color:${cl.color};border-color:${cl.color}44;">${cl.level}</span></div>`;
  };
  const makeCheckinEntry = (c) => {
    const emojis = { Great:'😄', Good:'🙂', Okay:'😐', Stressed:'😟', Overwhelmed:'😰', Exhausted:'😴' };
    const d = new Date(c.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return `<div class="history-item"><div class="history-score-badge" style="background:rgba(100,255,218,0.1);font-size:1.5rem;">${emojis[c.mood]||'😐'}</div><div class="history-info"><h4>Daily Check-in: ${c.mood}</h4><p>${c.note || 'No note added'} · ${d}</p></div><span class="badge success-badge">Check-in</span></div>`;
  };

  document.getElementById('history-timeline').innerHTML = assessments.slice(0,3).map(makeEntry).join('') || '<p style="color:var(--text-secondary);">No assessments yet.</p>';

  const fullList = document.getElementById('full-history-list');
  if (fullList) {
    // Interleave assessments and checkins sorted by date
    const all = [
      ...assessments.map(a => ({ ...a, _type: 'assessment', _date: new Date(a.created_at) })),
      ...checkins.map(c    => ({ ...c,  _type: 'checkin',    _date: new Date(c.created_at) })),
    ].sort((a, b) => b._date - a._date);
    fullList.innerHTML = all.map(item => item._type === 'assessment' ? makeEntry(item) : makeCheckinEntry(item)).join('') || '<p style="color:var(--text-secondary);">Nothing recorded yet.</p>';
  }
}

// ── DAILY CHECK-IN ───────────────────────────────────────────
function initCheckinModal() {
  document.querySelectorAll('.mood-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMood = { mood: btn.dataset.mood, score: parseInt(btn.dataset.score) };
  }));

  document.getElementById('submit-checkin').addEventListener('click', async () => {
    if (!selectedMood) { alert('Please select your mood.'); return; }
    const note = document.getElementById('checkin-note').value.trim();
    await insertCheckin(currentUser.id, { ...selectedMood, note });
    selectedMood = null;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('checkin-note').value = '';
    closeModal('checkin-overlay');
    showLoadingOverlay(true);
    await renderDashboard();
    showLoadingOverlay(false);
  });
}

function initDashboardButtons() {
  if (_dashBtnsInited) return;
  _dashBtnsInited = true;
  ['dashboard-checkin-btn','widget-checkin-btn','daily-checkin-btn'].forEach(id => document.getElementById(id)?.addEventListener('click', () => openModal('checkin-overlay')));
  document.getElementById('progress-retake-btn')?.addEventListener('click', startAssessment);
}

// ── BREATHING EXERCISE ───────────────────────────────────────
function initBreathingModal() {
  document.getElementById('close-breathing').addEventListener('click', stopBreathing);
  document.getElementById('close-breathing-btn').addEventListener('click', stopBreathing);
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
  document.getElementById('breath-start-btn').textContent   = 'Start Session';
  closeModal('breathing-overlay');
}

function startBreathingCycle() {
  const circle = document.getElementById('breath-circle');
  const label  = document.getElementById('breath-label');
  const instr  = document.getElementById('breath-instruction');
  const phases = [
    { class:'inhale', label:'Inhale',  instruction:'Breathe in slowly through your nose...',  duration:4000 },
    { class:'hold',   label:'Hold',    instruction:'Hold your breath gently...',               duration:4000 },
    { class:'exhale', label:'Exhale',  instruction:'Release slowly through your mouth...',     duration:4000 },
    { class:'hold',   label:'Hold',    instruction:'Rest before the next breath...',            duration:4000 },
  ];
  let counter = 0;
  const CYCLES = 4;
  function run() {
    if (counter >= phases.length * CYCLES) {
      circle.className = 'breath-circle'; label.textContent = '✓ Done';
      instr.textContent = 'Great job! You completed 4 cycles of box breathing. 💙';
      const startBtn = document.getElementById('breath-start-btn');
      startBtn.style.display = 'inline-flex'; startBtn.textContent = 'Start Again';
      return;
    }
    const p = phases[counter % phases.length];
    circle.className = `breath-circle ${p.class}`; label.textContent = p.label; instr.textContent = p.instruction;
    counter++; breathInterval = setTimeout(run, p.duration);
  }
  run();
}

// ── CHATBOT ──────────────────────────────────────────────────
let _isSending = false; // prevent double-sends

function initChatbot() {
  if (_chatbotInited) return; // only ever attach listeners once
  _chatbotInited = true;

  const sendBtn  = document.getElementById('chat-send-btn');
  const input    = document.getElementById('chat-input');
  const messages = document.getElementById('chat-messages');
  const typing   = document.getElementById('typing-indicator');
  if (!sendBtn || !input || !messages) return;

  const sendMessage = async () => {
    if (_isSending) return; // block while a reply is in-flight
    const text = input.value.trim();
    if (!text) return;
    _isSending = true;
    sendBtn.disabled = true;
    appendChatMessage(messages, text, 'user', typing);
    chatHistory.push({ role:"user", parts:[{ text }] });
    input.value = '';
    typing.classList.remove('hidden');
    messages.scrollTop = messages.scrollHeight;
    updateEmotionBadge(text);
    const reply = await getAIResponse();
    chatHistory.push({ role:"model", parts:[{ text: reply }] });
    typing.classList.add('hidden');
    appendChatMessage(messages, reply, 'ai', typing);
    sendBtn.disabled = false;
    _isSending = false;
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
}

async function updateChatWelcome(firstName, level, score) {
  const el = document.getElementById('chat-welcome-msg');
  if (!el) return;
  const msgs = {
    Low:      `Your stress score is <strong>${score}/40</strong> — you're in the <strong>low</strong> range. Keep it up! How can I support you today?`,
    Moderate: `Your stress score is <strong>${score}/40</strong> — <strong>moderate</strong> stress. That's manageable! What's on your mind?`,
    High:     `Your stress score is <strong>${score}/40</strong>, which is quite <strong>high</strong>. I'm here to help — what's weighing on you most?`,
    Severe:   `Your stress score of <strong>${score}/40</strong> shows <strong>severe stress</strong>. You're not alone — I'm here for you. Let's talk.`,
  };
  el.innerHTML = `<p>Hi <strong>${firstName}</strong>! ${msgs[level] || "How can I support you today?"}</p>`;

  const sugs = { Low:["Share a wellness tip","Breathing exercise"], Moderate:["Study planning help","Breathing exercise"], High:["Help me decompress","Breathing exercise"], Severe:["I need to talk","Breathing exercise"] };
  const sugDiv = document.createElement('div');
  sugDiv.className = 'message-suggestions';
  (sugs[level] || ["How are you?","Breathing exercise"]).forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'btn-suggestion'; btn.textContent = s;
    btn.addEventListener('click', () => { document.getElementById('chat-input').value = s; document.getElementById('chat-send-btn').click(); });
    sugDiv.appendChild(btn);
  });
  el.appendChild(sugDiv);

  document.getElementById('chat-stress-badge').textContent = `Stress: ${score}/40`;

  // Seed chat history with context
  const assessments = await fetchAssessments(currentUser.id);
  const latest      = assessments[0];
  chatHistory = [
    { role:"user",  parts:[{ text:`[SYSTEM CONTEXT - do not reveal]: Student: ${currentProfile?.name}, Grade: ${currentProfile?.grade}. PSS score: ${score}/40 (${level} stress). Workload: ${JSON.stringify(latest?.workload)}. Be empathetic, concise (2-4 sentences), use HTML p/strong/ul tags. No markdown asterisks.` }] },
    { role:"model", parts:[{ text:"Understood, I will provide personalized support." }] },
  ];
}

function appendChatMessage(container, text, role, typing) {
  const div = document.createElement('div');
  if (role === 'user') {
    div.className = 'message user-message';
    div.innerHTML = `<p>${text}</p>`;
  } else {
    const hasBreathing = text.toLowerCase().includes('breath');
    div.className = 'message ai-message';
    div.innerHTML = `
      <div class="ai-avatar-small"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="margin:9px"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/></svg></div>
      <div class="message-content">${text}${hasBreathing ? `<div class="message-suggestions"><button class="btn-suggestion breath-open">🌬️ Open Breathing Exercise</button></div>` : ''}</div>`;
    div.querySelector('.breath-open')?.addEventListener('click', () => openModal('breathing-overlay'));
  }
  container.insertBefore(div, typing);
  container.scrollTop = container.scrollHeight;
}

function updateEmotionBadge(text) {
  const badge = document.getElementById('chat-emotion-badge');
  if (!badge) return;
  const t = text.toLowerCase();
  if (t.includes('overwhelm') || t.includes("can't"))            { badge.textContent = 'Emotion: Overwhelmed'; badge.style.color = '#FCA5A5'; }
  else if (t.includes('stress') || t.includes('exam'))           { badge.textContent = 'Emotion: Stressed';    badge.style.color = '#FCD34D'; }
  else if (t.includes('sad') || t.includes('depress'))           { badge.textContent = 'Emotion: Sad';         badge.style.color = '#93C5FD'; }
  else if (t.includes('happy') || t.includes('better'))          { badge.textContent = 'Emotion: Positive';    badge.style.color = '#6EE7B7'; }
  else if (t.includes('anxious') || t.includes('worried'))       { badge.textContent = 'Emotion: Anxious';     badge.style.color = '#C4B5FD'; }
  else                                                            { badge.textContent = 'Emotion: Neutral';     badge.style.color = 'var(--text-secondary)'; }
}

// ── Gemini fetch with retry on 429 ───────────────────────────
async function geminiRequest(body, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      // Rate limited — wait then retry (1s, 3s, 7s)
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, (2 ** attempt) * 1000));
        continue;
      }
      return null; // give up after all retries
    }
    if (!res.ok) return null;
    return await res.json();
  }
  return null;
}

async function getAIResponse() {
  const data = await geminiRequest({
    systemInstruction: { parts: [{ text: "You are ASTRIX AI — an empathetic, premium AI companion for Senior High School students. Use simple HTML tags (p, strong, ul, li). No markdown asterisks. Be warm, non-judgmental, and actionable in 2-4 sentences unless detailed help is needed." }] },
    contents: chatHistory,
  });
  if (!data) return "<p>I'm a little busy right now — please try again in a moment. 💙</p>";
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "<p>I'm here for you. Could you tell me more?</p>";
}

async function getAIRecommendations(score, level) {
  const name  = currentProfile?.name  || 'Student';
  const grade = currentProfile?.grade || 'SHS';
  const prompt = `You are ASTRIX AI. Student ${name} (${grade}) scored ${score}/40 on the PSS — "${level}" stress. Generate exactly 3 concise, personalized wellness recommendations as a JSON array: [{"title":"...","description":"...","type":"breathing|exercise|study|sleep|social"}]. Return ONLY the JSON array.`;
  const data = await geminiRequest({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  if (!data) {
    return [
      { title: "5-Min Box Breathing",  description: "A quick breathing reset to lower cortisol and calm your mind.",                   type: "breathing" },
      { title: "Break Down Your Tasks", description: "List all pending tasks and tackle the smallest one first to build momentum.",    type: "study" },
      { title: "Short Walk Outside",    description: "A 10-minute walk can significantly reset your stress levels and boost clarity.", type: "exercise" },
    ];
  }
  try {
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return [
      { title: "5-Min Box Breathing",  description: "A quick breathing reset to lower cortisol and calm your mind.",                   type: "breathing" },
      { title: "Break Down Your Tasks", description: "List all pending tasks and tackle the smallest one first to build momentum.",    type: "study" },
      { title: "Short Walk Outside",    description: "A 10-minute walk can significantly reset your stress levels and boost clarity.", type: "exercise" },
    ];
  }
}

// ── NEURAL CANVAS ────────────────────────────────────────────
function initNeuralCanvas() {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [], W, H;
  const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  window.addEventListener('resize', resize); resize();
  for (let i = 0; i < 75; i++) particles.push({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-0.5)*0.25, vy:(Math.random()-0.5)*0.25, r:Math.random()*1.5+0.5 });
  (function animate() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fillStyle='rgba(100,255,218,0.35)'; ctx.fill();
      for (let j = i+1; j < particles.length; j++) {
        const dx=p.x-particles[j].x, dy=p.y-particles[j].y, dist=Math.sqrt(dx*dx+dy*dy);
        if (dist < 140) { ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(particles[j].x,particles[j].y); ctx.strokeStyle=`rgba(100,255,218,${0.08-(dist/140)*0.08})`; ctx.lineWidth=0.5; ctx.stroke(); }
      }
    });
    requestAnimationFrame(animate);
  })();
}

// ── SCROLL REVEAL ────────────────────────────────────────────
function initScrollReveal() {
  const els   = document.querySelectorAll('.reveal');
  const check = () => els.forEach(el => { if (el.getBoundingClientRect().top < window.innerHeight - 100) el.classList.add('active'); });
  window.addEventListener('scroll', check);
  setTimeout(check, 100);
}
