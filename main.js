// ============================================================
// PSYCHE AI — main.js
// Full Supabase-backed auth, assessment, dashboard, and chat
// ============================================================

import { supabase } from './supabase.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

// ── HEEADSSS Psychosocial Questions ──────────────────────────
const HEEADSSS_QUESTIONS = [
  {
    domain: 'home',
    title: 'Home Environment',
    badge: 'H',
    badgeClass: 'h-color',
    q: 'How supported, safe, and comfortable do you feel in your home environment with family or guardians?',
    context: 'Evaluates family dynamics, housing stability, and communication at home.',
    options: ['Very Safe & Supported', 'Mostly Comfortable', 'Occasional Tension', 'Frequent Conflict', 'Unsafe / Severe Conflict'],
    scores: [0, 1, 2, 3, 4]
  },
  {
    domain: 'education',
    title: 'Education & School',
    badge: 'E',
    badgeClass: 'e-color',
    q: 'How are you coping with your school requirements, grades, and academic expectations?',
    context: 'Measures academic strain, career goals, and school environment.',
    options: ['Managing Very Well', 'Doing Fine', 'Moderate Academic Stress', 'Heavy Pressure', 'Overwhelmed / Failing'],
    scores: [0, 1, 2, 3, 4]
  },
  {
    domain: 'eating',
    title: 'Eating & Body Image',
    badge: 'E',
    badgeClass: 'e2-color',
    q: 'How confident and healthy do you feel regarding your eating habits, nutrition, and body image?',
    context: 'Assesses dietary regularity, body positivity, and meal habits.',
    options: ['Very Healthy & Confident', 'Generally Good', 'Minor Body Image Concerns', 'Irregular Eating / Distressed', 'Severe Eating Issues'],
    scores: [0, 1, 2, 3, 4]
  },
  {
    domain: 'activities',
    title: 'Activities & Peers',
    badge: 'A',
    badgeClass: 'a-color',
    q: 'How balanced is your social life, friendships, sports, hobbies, and screen time?',
    context: 'Explores peer support, screen balance, and social connectedness.',
    options: ['Great Balance & Strong Friends', 'Good Friends & Active', 'Sometimes Isolated', 'High Screen / Low Connection', 'Lonely / Excluded'],
    scores: [0, 1, 2, 3, 4]
  },
  {
    domain: 'drugs',
    title: 'Drugs & Alcohol Exposure',
    badge: 'D',
    badgeClass: 'd-color',
    q: 'How often do you or your close peer group encounter vaping, alcohol, or substance pressure?',
    context: 'Screens exposure to substance use and peer influences.',
    options: ['Never / No Exposure', 'Rare Exposure', 'Occasional Peer Vaping/Alcohol', 'Frequent Peer Pressure', 'Regular Personal/Peer Use'],
    scores: [0, 1, 2, 3, 4]
  },
  {
    domain: 'sexuality',
    title: 'Sexuality & Identity',
    badge: 'S',
    badgeClass: 's1-color',
    q: 'How comfortable and supported do you feel regarding your identity, relationships, and self-expression?',
    context: 'Addresses relationship safety, personal boundaries, and identity support.',
    options: ['Completely Secure & Supported', 'Mostly Comfortable', 'Some Identity Questions', 'Relationship Strain', 'Distressed / Unsupported'],
    scores: [0, 1, 2, 3, 4]
  },
  {
    domain: 'suicide',
    title: 'Suicide & Mood',
    badge: 'S',
    badgeClass: 's2-color',
    q: 'How often in the past month have you felt persistent sadness, anxiety, hopelessness, or self-doubt?',
    context: 'Identifies emotional distress, mood regulation, and mental health crisis risks.',
    options: ['Never / High Morale', 'Rarely / Mild Blues', 'Sometimes Sad or Anxious', 'Frequently Hopeless', 'Severe Distress / Self-Harm Thoughts'],
    scores: [0, 1, 2, 3, 4]
  },
  {
    domain: 'safety',
    title: 'Safety & Cyberbullying',
    badge: 'S',
    badgeClass: 's3-color',
    q: 'How safe do you feel from bullying, cyberbullying, physical threats, or online harassment?',
    context: 'Assesses physical, digital, and community safety.',
    options: ['Completely Safe Everywhere', 'Generally Safe', 'Minor Online Harassment', 'Frequent Bullying / Cyberbullying', 'Unsafe Environment'],
    scores: [0, 1, 2, 3, 4]
  }
];

// ── App State ────────────────────────────────────────────────
let currentUser    = null;   // Supabase auth user
let currentProfile = null;   // profiles table row
let activeAssessmentType = 'pss'; // 'pss' or 'heeadsss'
let assessmentAnswers  = [];
let workloadAnswers    = {};
let heeadsssAnswers    = [];
let assessmentStep     = 0;
let selectedMood       = null;
let breathInterval     = null;
let chatHistory        = [];
let chatSessions       = [];
let currentSessionId   = null;
let pendingRegistrationData = null; // Stores pending registration payload prior to parent consent
let _chatbotInited     = false;  // guard: only attach chat listeners once
let _dashNavInited     = false;  // guard: only attach nav tab listeners once
let _dashBtnsInited    = false;  // guard: only attach dashboard button listeners once
let _lastInputWasVoice = false;  // track if last input was via mic (for auto-TTS)

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
  if (!data && currentUser?.id === uid && currentUser?.user_metadata) {
    const meta = currentUser.user_metadata;
    if (meta.grade) {
      return {
        id: uid,
        name: meta.real_name || currentUser.email.split('@')[0],
        real_name: meta.real_name,
        email: currentUser.email,
        grade: meta.grade
      };
    }
  }
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
  initZenAudio();


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
      // Avoid re-triggering if already processing
      if (currentUser?.id === session.user.id && currentProfile) return;
      
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
    el.innerHTML = `<div style="width:48px;height:48px;border:3px solid rgba(100,255,218,0.2);border-top-color:#64FFDA;border-radius:50%;animation:spin 0.8s linear infinite;"></div><p style="color:var(--text-secondary);font-family:var(--font-main);">Loading PSYCHE AI...</p>`;
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

// ── PAGE TRANSITIONS ─────────────────────────────────────────
function showLanding() {
  showEl('landing-page'); hideEl('dashboard-page'); hideEl('counselor-dashboard-page');
  showEl('landing-nav');  hideEl('dashboard-nav');
  showEl('nav-guest');    hideEl('nav-user');
}

async function showDashboard() {
  hideEl('landing-page');
  hideEl('landing-nav');
  hideEl('nav-guest');    showEl('nav-user');

  const name  = currentProfile?.name  || currentUser?.user_metadata?.real_name || currentUser?.email?.split('@')[0];
  const grade = currentProfile?.grade || currentUser?.user_metadata?.grade || '';

  document.getElementById('nav-avatar').textContent    = name.charAt(0).toUpperCase();
  document.getElementById('dropdown-name').textContent  = name;
  document.getElementById('dropdown-grade').textContent = grade;

  if (grade === 'Guidance Counselor' || grade === 'Researcher') {
    hideEl('dashboard-page'); showEl('counselor-dashboard-page');
    hideEl('dashboard-nav');
    const titleRole = grade === 'Researcher' ? 'Researcher' : 'Guidance Counselor';
    document.getElementById('counselor-greeting').textContent = `${titleRole} Dashboard - Welcome, ${name.split(' ')[0]}!`;
    showLoadingOverlay(true);
    await renderCounselorDashboard();
    showLoadingOverlay(false);
  } else {
    showEl('dashboard-page'); hideEl('counselor-dashboard-page');
    showEl('dashboard-nav');
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
}

async function fetchAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) console.error('Error fetching profiles:', error);
  return (data || []).filter(p => p.grade !== 'Guidance Counselor' && p.grade !== 'Researcher');
}

async function fetchAllStaffProfiles() {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) console.error('Error fetching staff profiles:', error);
  return (data || []).filter(p => p.grade === 'Guidance Counselor' || p.grade === 'Researcher');
}

async function fetchAllAssessments() {
  const { data, error } = await supabase.from('assessments').select('*').order('created_at', { ascending: false });
  if (error) console.error('Error fetching assessments:', error);
  return data || [];
}

async function renderCounselorDashboard() {
  const profiles = await fetchAllProfiles();
  const assessments = await fetchAllAssessments();
  
  const latestAssessments = {};
  assessments.forEach(a => {
    if (!latestAssessments[a.user_id]) latestAssessments[a.user_id] = a;
  });

  const studentsWithAssessments = profiles.map(p => ({
    profile: p,
    latest: latestAssessments[p.id] || null
  }));

  const urgentList = document.getElementById('counselor-urgent-list');
  const allTbody = document.getElementById('counselor-all-tbody');

  const urgent = studentsWithAssessments.filter(s => s.latest && s.latest.level === 'Severe');
  
  if (urgent.length === 0) {
    urgentList.innerHTML = '<p style="color:var(--text-secondary);">No students currently flagged with Severe stress.</p>';
  } else {
    urgentList.innerHTML = urgent.map(s => {
      const d = new Date(s.latest.created_at).toLocaleDateString();
      return `<div class="history-item" style="border-color:rgba(239,68,68,0.5);">
        <div class="history-score-badge" style="background:rgba(239,68,68,0.1);color:#EF4444;">${s.latest.pss_score}</div>
        <div class="history-info">
          <h4 style="color:#FCA5A5;">${s.profile.real_name || s.profile.name} <span style="font-size:0.8rem;color:var(--text-secondary);">(${s.profile.grade})</span></h4>
          <p>Assessed as Severe on ${d}</p>
          <p style="font-size:0.8rem;color:var(--text-secondary);">${s.profile.email || 'No email'}</p>
        </div>
        <button class="btn btn-outline btn-small" onclick="alert('Contacting student ${s.profile.real_name || s.profile.name}...')">Contact</button>
      </div>`;
    }).join('');
  }

  if (studentsWithAssessments.length === 0) {
    allTbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-secondary);text-align:center;">No students found.</td></tr>';
  } else {
    allTbody.innerHTML = studentsWithAssessments.map(s => {
      const p = s.profile;
      const a = s.latest;
      let scoreStr = '--', levelStr = 'None', dateStr = '--', color = 'var(--text-secondary)';
      if (a) {
        scoreStr = `${a.pss_score}/40`;
        levelStr = a.level;
        dateStr = new Date(a.created_at).toLocaleDateString();
        const cl = classifyStress(a.pss_score);
        color = cl.color;
      }
      const hasConsent = p.parent_consent || p.parent_name;
      const consentHtml = hasConsent 
        ? `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10B981;border:1px solid rgba(16,185,129,0.3);">✓ Confirmed</span><div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">${p.parent_name || 'Parent/Guardian'}</div>`
        : `<span class="badge" style="background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);">Pending</span>`;

      return `<tr>
        <td>
          <div style="font-weight:600;color:var(--text-primary);">${p.real_name || p.name}</div>
          <div style="font-size:0.85rem;color:var(--text-secondary);">${p.email || 'No email'}</div>
        </td>
        <td>${p.grade}</td>
        <td>${consentHtml}</td>
        <td style="font-weight:600;">${scoreStr}</td>
        <td><span class="badge" style="background:${color}22;color:${color};border-color:${color}44;">${levelStr}</span></td>
        <td>${dateStr}</td>
        <td><button class="btn btn-glass btn-small" onclick="alert('Viewing full report for ${p.real_name || p.name}')">View Report</button></td>
      </tr>`;
    }).join('');
  }

  // Render Counselors & Researchers Directory Table
  const staffProfiles = await fetchAllStaffProfiles();
  const staffTbody = document.getElementById('counselor-staff-tbody');
  if (staffTbody) {
    if (staffProfiles.length === 0) {
      staffTbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-secondary);text-align:center;">No counselors or researchers registered yet.</td></tr>';
    } else {
      staffTbody.innerHTML = staffProfiles.map(sp => {
        const isCounselor = sp.grade === 'Guidance Counselor';
        const roleBadge = isCounselor 
          ? `<span class="badge" style="background:rgba(100,255,218,0.15);color:#64FFDA;border:1px solid rgba(100,255,218,0.3);">Guidance Counselor</span>`
          : `<span class="badge" style="background:rgba(192,132,252,0.15);color:#C084FC;border:1px solid rgba(192,132,252,0.3);">Researcher</span>`;
        return `<tr>
          <td>
            <div style="font-weight:600;color:var(--text-primary);">${sp.real_name || sp.name}</div>
          </td>
          <td>${sp.email || 'Staff Email'}</td>
          <td>${roleBadge}</td>
          <td><span style="color:#10B981;font-size:0.85rem;">Active Authorized Staff</span></td>
        </tr>`;
      }).join('');
    }
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
function initAuthButtons() {
  const openLogin    = () => { showAuthTab('login');    openModal('auth-overlay'); };
  const openRegister = () => { showAuthTab('register'); openModal('auth-overlay'); };

  document.getElementById('signin-btn').addEventListener('click', openLogin);
  ['get-started-nav','hero-get-started','hero-assessment','hiw-start-btn','chat-signin-btn'].forEach(id => document.getElementById(id)?.addEventListener('click', openRegister));
  document.getElementById('heeadsss-start-btn')?.addEventListener('click', () => {
    if (currentUser) {
      startAssessment('heeadsss');
    } else {
      openRegister();
    }
  });
  document.getElementById('close-auth').addEventListener('click', () => closeModal('auth-overlay'));
  document.getElementById('auth-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal('auth-overlay'); });
  document.getElementById('go-register').addEventListener('click', (e) => { e.preventDefault(); showAuthTab('register'); });
  document.getElementById('go-login').addEventListener('click',    (e) => { e.preventDefault(); showAuthTab('login'); });

  // Grade selection change listener for staff authorization passcode toggle
  document.getElementById('reg-grade')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const passcodeGroup = document.getElementById('reg-passcode-group');
    const submitBtn = document.getElementById('reg-submit-btn');
    if (val === 'Guidance Counselor' || val === 'Researcher') {
      passcodeGroup?.classList.remove('hidden');
      if (submitBtn) submitBtn.textContent = 'Create Staff Account ✨';
    } else {
      passcodeGroup?.classList.add('hidden');
      if (submitBtn) submitBtn.textContent = 'Proceed to Parent Consent & Sign Up →';
    }
  });

  // Parent Consent Modal button listeners
  document.getElementById('close-parent-consent')?.addEventListener('click', () => closeModal('parent-consent-overlay'));
  document.getElementById('btn-back-to-register')?.addEventListener('click', () => {
    closeModal('parent-consent-overlay');
    openModal('auth-overlay');
  });

  // Create Staff Account Modal button listeners
  document.getElementById('close-create-staff')?.addEventListener('click', () => closeModal('create-staff-overlay'));
  document.getElementById('btn-cancel-create-staff')?.addEventListener('click', () => closeModal('create-staff-overlay'));
  document.getElementById('open-create-staff-btn')?.addEventListener('click', () => {
    document.getElementById('staff-error')?.classList.add('hidden');
    openModal('create-staff-overlay');
  });
  document.getElementById('open-create-staff-btn-2')?.addEventListener('click', () => {
    document.getElementById('staff-error')?.classList.add('hidden');
    openModal('create-staff-overlay');
  });
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
  });

  // ── REGISTER ──
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('reg-name').value.trim();
    const nickname = document.getElementById('reg-nickname').value.trim() || name.split(' ')[0];
    const grade = document.getElementById('reg-grade').value;
    const age   = parseInt(document.getElementById('reg-age').value) || null;
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pass  = document.getElementById('reg-password').value;
    const passcode = document.getElementById('reg-passcode')?.value?.trim();
    const btn   = e.target.querySelector('button[type=submit]');

    if (!name || !nickname || !grade || !email || !pass) { showFormError('reg-error', 'Please fill in all required fields.'); return; }
    if (pass.length < 6) { showFormError('reg-error', 'Password must be at least 6 characters.'); return; }

    // Check staff account creation restriction (Guidance Counselor & Researcher)
    if (grade === 'Guidance Counselor' || grade === 'Researcher') {
      const VALID_PASSCODES = ['COUNSELOR2026', 'RESEARCHER2026', 'PSYCHE-ADMIN', 'COUNSELOR', 'RESEARCHER'];
      if (!passcode || !VALID_PASSCODES.includes(passcode.toUpperCase())) {
        showFormError('reg-error', 'Authorization Passcode is invalid. Guidance Counselor & Researcher accounts can only be created by authorized staff or with a valid access key.');
        return;
      }

      btn.textContent = 'Creating Staff Account...'; btn.disabled = true;

      const { data, error: signUpError } = await supabase.auth.signUp({ 
        email, 
        password: pass,
        options: { data: { real_name: name, grade: grade } }
      });
      btn.textContent = 'Create Staff Account ✨'; btn.disabled = false;

      if (signUpError) { showFormError('reg-error', signUpError.message); return; }

      currentUser = data.user;
      
      const staffPayload = { 
        id: data.user.id, 
        name: nickname, 
        real_name: name,
        email: email,
        grade, 
        age,
        parent_consent: true 
      };

      let profileData = null;
      const { data: insData, error: profileErr } = await supabase.from('profiles').insert(staffPayload).select().single();
      if (profileErr) {
        console.warn('DB staff profile insert notice:', profileErr.message);
        const fbPayload = { id: data.user.id, name: nickname, real_name: name, email, grade, age };
        const { data: fbData } = await supabase.from('profiles').insert(fbPayload).select().single();
        profileData = fbData || { ...staffPayload };
      } else {
        profileData = insData || { ...staffPayload };
      }
      currentProfile = profileData;

      closeModal('auth-overlay');
      await showDashboard();
      return;
    }

    // Student account registration flow: Store draft and require Parent Consent & Confirmation before account creation
    pendingRegistrationData = { name, nickname, grade, age, email, pass };

    closeModal('auth-overlay');
    document.getElementById('consent-student-summary').textContent = `${name} (${grade})`;
    document.getElementById('parent-name').value = '';
    document.getElementById('parent-contact').value = '';
    document.getElementById('parent-check-confirm').checked = false;
    document.getElementById('parent-consent-error').classList.add('hidden');

    openModal('parent-consent-overlay');
  });

  // ── PARENT CONSENT & CONFIRMATION SUBMISSION ──
  document.getElementById('parent-consent-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const parentName = document.getElementById('parent-name').value.trim();
    const parentRelation = document.getElementById('parent-relation').value;
    const parentContact = document.getElementById('parent-contact').value.trim();
    const parentConfirm = document.getElementById('parent-check-confirm').checked;
    const btn = document.getElementById('btn-submit-parent-consent');

    if (!parentName || !parentContact) {
      showFormError('parent-consent-error', 'Please fill in all parent/guardian contact details.');
      return;
    }
    if (!parentConfirm) {
      showFormError('parent-consent-error', 'Parent/guardian must check the confirmation checkbox to grant consent.');
      return;
    }

    if (!pendingRegistrationData) {
      showFormError('parent-consent-error', 'Registration information missing. Please try signing up again.');
      return;
    }

    btn.textContent = 'Creating Account...'; btn.disabled = true;

    const { name, nickname, grade, age, email, pass } = pendingRegistrationData;

    // 1. Create auth user with parent consent metadata
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          real_name: name,
          parent_name: parentName,
          parent_relation: parentRelation,
          parent_contact: parentContact,
          parent_consent: true,
          parent_consent_date: new Date().toISOString()
        }
      }
    });

    if (signUpError) {
      showFormError('parent-consent-error', signUpError.message);
      btn.textContent = 'Confirm Consent & Create Account ✨'; btn.disabled = false;
      return;
    }

    currentUser = data.user;

    // 2. Insert profile row
    const profilePayload = {
      id: data.user.id,
      name: nickname,
      real_name: name,
      email: email,
      grade: grade,
      age: age,
      parent_name: parentName,
      parent_relation: parentRelation,
      parent_contact: parentContact,
      parent_consent: true,
      parent_consent_date: new Date().toISOString()
    };

    let profileData = null;
    const { data: insData, error: profileErr } = await supabase.from('profiles').insert(profilePayload).select().single();
    if (profileErr) {
      console.warn('DB profile insert with parent fields notice:', profileErr.message);
      const fallbackPayload = { id: data.user.id, name: nickname, real_name: name, email, grade, age };
      const { data: fbData } = await supabase.from('profiles').insert(fallbackPayload).select().single();
      profileData = fbData || { ...profilePayload };
    } else {
      profileData = insData;
    }

    currentProfile = profileData;
    btn.textContent = 'Confirm Consent & Create Account ✨'; btn.disabled = false;
    pendingRegistrationData = null;

    closeModal('parent-consent-overlay');

    // Proceed to dashboard and assessment
    await showDashboard();
    if (grade !== 'Guidance Counselor' && grade !== 'Researcher') {
      setTimeout(() => startAssessment(), 400);
    }
  });

  // ── IN-DASHBOARD STAFF (COUNSELOR & RESEARCHER) ACCOUNT CREATION ──
  document.getElementById('create-staff-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.getElementById('staff-role').value;
    const name = document.getElementById('staff-name').value.trim();
    const nickname = document.getElementById('staff-nickname').value.trim() || name.split(' ')[0];
    const email = document.getElementById('staff-email').value.trim().toLowerCase();
    const pass = document.getElementById('staff-password').value;
    const btn = document.getElementById('btn-submit-create-staff');

    if (!name || !email || !pass) {
      showFormError('staff-error', 'Please fill in all required staff fields.');
      return;
    }
    if (pass.length < 6) {
      showFormError('staff-error', 'Password must be at least 6 characters.');
      return;
    }

    btn.textContent = 'Creating Staff Account...'; btn.disabled = true;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { real_name: name, grade: role } }
    });

    btn.textContent = '➕ Create Staff Account'; btn.disabled = false;

    if (signUpError) {
      showFormError('staff-error', signUpError.message);
      return;
    }

    if (data?.user) {
      const staffPayload = {
        id: data.user.id,
        name: nickname,
        real_name: name,
        email: email,
        grade: role,
        parent_consent: true
      };
      const { error: profileErr } = await supabase.from('profiles').insert(staffPayload);
      if (profileErr) {
        console.warn('DB staff profile insert notice:', profileErr.message);
        await supabase.from('profiles').insert({
          id: data.user.id,
          name: nickname,
          real_name: name,
          email: email,
          grade: role
        });
      }
    }

    closeModal('create-staff-overlay');
    alert(`Success: ${role} account for ${name} (${email}) has been created successfully.`);
    await renderCounselorDashboard();
  });
}

// ── ASSESSMENT ───────────────────────────────────────────────
function startAssessment(type = 'pss') {
  activeAssessmentType = type;
  assessmentAnswers = new Array(ASSESSMENT_QUESTIONS.length).fill(null);
  workloadAnswers   = {};
  heeadsssAnswers   = new Array(HEEADSSS_QUESTIONS.length).fill(null);
  assessmentStep    = 0;

  const pssBtn = document.getElementById('assess-btn-pss');
  const heeadsssBtn = document.getElementById('assess-btn-heeadsss');
  if (pssBtn && heeadsssBtn) {
    if (type === 'pss') {
      pssBtn.classList.add('active');
      heeadsssBtn.classList.remove('active');
    } else {
      heeadsssBtn.classList.add('active');
      pssBtn.classList.remove('active');
    }
  }

  openModal('assessment-overlay');
  renderAssessmentQuestion();
}

function renderAssessmentQuestion() {
  const container = document.getElementById('assessment-questions-container');

  if (activeAssessmentType === 'heeadsss') {
    const totalHeeadsss = HEEADSSS_QUESTIONS.length;
    const pct = ((assessmentStep + 1) / totalHeeadsss) * 100;
    document.getElementById('assess-progress').style.width = `${pct}%`;
    document.getElementById('assess-progress-text').textContent = `${assessmentStep + 1} / ${totalHeeadsss}`;
    document.getElementById('assess-prev').disabled = assessmentStep === 0;

    const q = HEEADSSS_QUESTIONS[assessmentStep];
    const selected = heeadsssAnswers[assessmentStep];

    container.innerHTML = `
      <div class="question-block">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div class="domain-mini-badge ${q.badgeClass}" style="width:34px;height:34px;font-size:1.1rem;">${q.badge}</div>
          <h3 style="margin:0;font-size:1.25rem;">HEEADSSS: ${q.title} (${assessmentStep + 1} of ${totalHeeadsss})</h3>
        </div>
        <p class="q-context">${q.context}</p>
        <p style="font-size:1.15rem;font-weight:600;color:#E6F1FF;margin-bottom:28px;">${q.q}</p>
        <div class="options-grid">
          ${q.options.map((opt, i) => `<button class="option-btn ${selected === i ? 'selected' : ''}" data-index="${i}">${opt}</button>`).join('')}
        </div>
      </div>`;

    container.querySelectorAll('.option-btn').forEach(btn => btn.addEventListener('click', () => {
      heeadsssAnswers[assessmentStep] = parseInt(btn.dataset.index);
      container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    }));

    document.getElementById('assess-next').textContent = assessmentStep === totalHeeadsss - 1 ? '✨ Complete HEEADSSS Profile' : 'Next →';
    return;
  }

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
  const pssBtn = document.getElementById('assess-btn-pss');
  const heeadsssBtn = document.getElementById('assess-btn-heeadsss');
  pssBtn?.addEventListener('click', () => { if (activeAssessmentType !== 'pss') startAssessment('pss'); });
  heeadsssBtn?.addEventListener('click', () => { if (activeAssessmentType !== 'heeadsss') startAssessment('heeadsss'); });

  document.getElementById('assess-next').addEventListener('click', async () => {
    if (activeAssessmentType === 'heeadsss') {
      if (heeadsssAnswers[assessmentStep] === null) { alert('Please select an answer to continue.'); return; }
      if (assessmentStep < HEEADSSS_QUESTIONS.length - 1) {
        assessmentStep++; renderAssessmentQuestion();
      } else {
        await finishHeeadsssAssessment();
      }
      return;
    }

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

  if (cl.level === 'Severe') {
    setTimeout(() => {
      alert("Notification: Your stress level is assessed as Severe. The Guidance Counselor has been automatically notified to provide you with additional support.");
    }, 1000);
  }

  btn.textContent = '✨ Get My Results'; btn.disabled = false;
  closeModal('assessment-overlay');
  showLoadingOverlay(true);
  await renderDashboard();
  showLoadingOverlay(false);
  // Small gap so the recommendations call above doesn't rate-limit the chat-welcome call
  await new Promise(r => setTimeout(r, 2000));
  updateChatWelcome(currentProfile?.name?.split(' ')[0] || 'there', cl.level, pssScore);
}

async function finishHeeadsssAssessment() {
  const btn = document.getElementById('assess-next');
  btn.textContent = '⏳ Saving HEEADSSS Profile...'; btn.disabled = true;

  if (!currentUser) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) currentUser = session.user;
  }

  const results = HEEADSSS_QUESTIONS.map((q, idx) => {
    const ansIdx = heeadsssAnswers[idx] ?? 0;
    const score = q.scores[ansIdx];
    const pct = Math.max(12, Math.round(100 - (score * 22.5)));
    let statusText = 'Optimal';
    let statusColor = '#10B981';
    if (score === 1) { statusText = 'Good'; statusColor = '#34D399'; }
    else if (score === 2) { statusText = 'Moderate Stress'; statusColor = '#F59E0B'; }
    else if (score === 3) { statusText = 'High Risk'; statusColor = '#F97316'; }
    else if (score >= 4) { statusText = 'Needs Support'; statusColor = '#EF4444'; }

    return {
      domain: q.domain,
      title: q.title,
      badge: q.badge,
      badgeClass: q.badgeClass,
      score: score,
      pct: pct,
      statusText: statusText,
      statusColor: statusColor,
      selectedOption: q.options[ansIdx]
    };
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    results: results
  };

  if (currentUser) {
    localStorage.setItem(`psyche_heeadsss_${currentUser.id}`, JSON.stringify(payload));
  }

  btn.textContent = '✨ Complete HEEADSSS Profile'; btn.disabled = false;
  closeModal('assessment-overlay');

  renderHeeadsssWidget(payload.results);

  const highRisk = results.filter(r => r.score >= 3);
  if (highRisk.length > 0) {
    const names = highRisk.map(r => r.title).join(', ');
    setTimeout(() => {
      alert(`HEEADSSS Screening Complete: Domain attention flagged for (${names}). PSYCHE AI companion is ready to support you with tailored guidance.`);
    }, 400);
  }
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

  // HEEADSSS Widget
  renderHeeadsssWidget();
}

function renderHeeadsssWidget(customResults = null) {
  const container = document.getElementById('heeadsss-dashboard-grid');
  if (!container) return;

  let results = customResults;
  if (!results && currentUser) {
    const stored = localStorage.getItem(`psyche_heeadsss_${currentUser.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        results = parsed.results;
      } catch (e) {
        console.error('Error parsing HEEADSSS data:', e);
      }
    }
  }

  if (!results || !results.length) {
    const defaults = HEEADSSS_QUESTIONS.map(q => ({
      domain: q.domain,
      title: q.title,
      badge: q.badge,
      badgeClass: q.badgeClass,
      pct: 0,
      statusText: 'Not Screened Yet',
      statusColor: 'var(--text-secondary)'
    }));
    container.innerHTML = defaults.map(d => `
      <div class="domain-item-card">
        <div class="domain-item-header">
          <div class="domain-item-title">
            <div class="domain-mini-badge ${d.badgeClass}">${d.badge}</div>
            <span>${d.title}</span>
          </div>
          <span style="font-size:0.78rem;color:${d.statusColor};font-weight:600;">${d.statusText}</span>
        </div>
        <div class="domain-progress-bar">
          <div class="domain-progress-fill" style="width:0%;background:var(--accent-cyan);"></div>
        </div>
      </div>
    `).join('');
    return;
  }

  container.innerHTML = results.map(d => `
    <div class="domain-item-card">
      <div class="domain-item-header">
        <div class="domain-item-title">
          <div class="domain-mini-badge ${d.badgeClass}">${d.badge}</div>
          <span>${d.title}</span>
        </div>
        <span style="font-size:0.78rem;color:${d.statusColor};font-weight:600;">${d.statusText}</span>
      </div>
      <div class="domain-progress-bar">
        <div class="domain-progress-fill" style="width:${d.pct}%;background:${d.statusColor};"></div>
      </div>
    </div>
  `).join('');
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
  document.getElementById('progress-retake-btn')?.addEventListener('click', () => startAssessment('pss'));
  ['widget-heeadsss-btn', 'retake-heeadsss-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => startAssessment('heeadsss'));
  });
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

// ── CHATBOT & HISTORY ──────────────────────────────────────────
let _isSending = false; // prevent double-sends

function getChatStorageKey() {
  return `psyche_chats_${currentUser?.id || 'guest'}`;
}

function loadChatSessions() {
  try {
    const raw = localStorage.getItem(getChatStorageKey());
    chatSessions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load chat sessions', e);
    chatSessions = [];
  }
}

function saveChatSessions() {
  try {
    localStorage.setItem(getChatStorageKey(), JSON.stringify(chatSessions));
  } catch (e) {
    console.error('Failed to save chat sessions', e);
  }
}

function formatChatTimeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderChatHistoryList(filterQuery = '') {
  const container = document.getElementById('chat-history-list');
  if (!container) return;

  const query = filterQuery.toLowerCase().trim();
  const filtered = chatSessions.filter(s => {
    if (!query) return true;
    const inTitle = (s.title || '').toLowerCase().includes(query);
    const inMsg = (s.messages || []).some(m => (m.content || '').toLowerCase().includes(query));
    return inTitle || inMsg;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px 12px;color:var(--text-secondary);font-size:0.83rem;">${query ? 'No matching chats found' : 'No past conversations yet.'}</div>`;
    return;
  }

  container.innerHTML = filtered.map(sess => {
    const isActive = sess.id === currentSessionId;
    return `
      <div class="history-item ${isActive ? 'active' : ''}" data-id="${sess.id}">
        <div class="history-item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="history-item-info">
          <div class="history-item-title" title="${escapeHtml(sess.title)}">${escapeHtml(sess.title)}</div>
          <div class="history-item-time">${formatChatTimeAgo(sess.updatedAt)}</div>
        </div>
        <button class="history-item-del" data-id="${sess.id}" title="Delete session">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.history-item-del')) return;
      const id = el.dataset.id;
      switchChatSession(id);
    });
  });

  container.querySelectorAll('.history-item-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deleteChatSession(id);
    });
  });
}

function createNewChatSession() {
  const newSess = {
    id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };
  chatSessions.unshift(newSess);
  currentSessionId = newSess.id;
  saveChatSessions();
  switchChatSession(newSess.id);
  renderChatHistoryList();
}

function switchChatSession(sessionId) {
  const sess = chatSessions.find(s => s.id === sessionId);
  if (!sess) return;
  currentSessionId = sessionId;

  const messagesEl = document.getElementById('chat-messages');
  const titleEl    = document.getElementById('current-chat-title');

  if (titleEl) {
    titleEl.textContent = sess.title || 'PSYCHE Assistant';
  }

  if (messagesEl) {
    messagesEl.innerHTML = '';
    // Add welcome message
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'message ai-message';
    welcomeDiv.innerHTML = `
      <div class="ai-avatar-small"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="margin:10px"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/></svg></div>
      <div class="message-content" id="chat-welcome-msg"><p>Hi! I'm here to support you. How are you feeling today?</p></div>
    `;
    messagesEl.appendChild(welcomeDiv);

    // Typing indicator
    const newTyping = document.createElement('div');
    newTyping.className = 'typing-indicator hidden';
    newTyping.id = 'typing-indicator';
    newTyping.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(newTyping);
  }

  // Re-build chatHistory for AI API context
  rebuildChatHistory(sess);

  // Render past messages into UI
  const currentTyping = document.getElementById('typing-indicator');
  if (sess.messages && sess.messages.length > 0) {
    sess.messages.forEach(m => {
      appendChatMessage(messagesEl, m.content, m.role === 'user' ? 'user' : 'ai', currentTyping);
    });
  }

  renderChatHistoryList();
}

function rebuildChatHistory(sess) {
  const sysMsg = chatHistory.find(m => m.role === 'system');
  const systemPrompt = sysMsg ? sysMsg.content : `PERSONA: You are PSYCHE, a helpful, polite AI assistant.`;
  
  chatHistory = [
    { role: "system", content: systemPrompt },
    { role: "assistant", content: "Understood. I am PSYCHE, a helpful AI assistant. I am ready to assist you." }
  ];

  if (sess && sess.messages) {
    sess.messages.forEach(m => {
      chatHistory.push({ role: m.role, content: m.content });
    });
  }
}

function saveMessageToCurrentSession(role, content) {
  if (!currentSessionId || !chatSessions.some(s => s.id === currentSessionId)) {
    const newSess = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    chatSessions.unshift(newSess);
    currentSessionId = newSess.id;
  }
  
  const sess = chatSessions.find(s => s.id === currentSessionId);
  if (!sess) return;

  if ((sess.title === 'New Conversation' || !sess.title) && role === 'user') {
    let rawTitle = content.trim().replace(/<[^>]*>?/gm, '');
    sess.title = rawTitle.length > 26 ? rawTitle.substring(0, 26) + '…' : rawTitle;
    const titleEl = document.getElementById('current-chat-title');
    if (titleEl) titleEl.textContent = sess.title;
  }

  sess.messages.push({
    role: role,
    content: content,
    timestamp: new Date().toISOString()
  });

  sess.updatedAt = new Date().toISOString();

  // Move updated session to top
  chatSessions = [sess, ...chatSessions.filter(s => s.id !== sess.id)];

  saveChatSessions();
  renderChatHistoryList();
}

function deleteChatSession(sessionId) {
  chatSessions = chatSessions.filter(s => s.id !== sessionId);
  saveChatSessions();

  if (currentSessionId === sessionId) {
    if (chatSessions.length > 0) {
      switchChatSession(chatSessions[0].id);
    } else {
      createNewChatSession();
    }
  } else {
    renderChatHistoryList();
  }
}

function clearAllChatHistory() {
  if (!confirm('Are you sure you want to clear all chat history?')) return;
  chatSessions = [];
  saveChatSessions();
  createNewChatSession();
}

function initChatbot() {
  if (_chatbotInited) return; // only ever attach listeners once
  _chatbotInited = true;

  const sendBtn  = document.getElementById('chat-send-btn');
  const input    = document.getElementById('chat-input');
  const messages = document.getElementById('chat-messages');
  const typing   = document.getElementById('typing-indicator');
  if (!sendBtn || !input || !messages) return;

  // Setup Chat History UI Event Listeners
  const newChatBtn = document.getElementById('new-chat-btn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => createNewChatSession());
  }

  const clearHistoryBtn = document.getElementById('clear-history-btn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => clearAllChatHistory());
  }

  const searchInput = document.getElementById('chat-history-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => renderChatHistoryList(e.target.value));
  }

  const toggleSidebarBtn = document.getElementById('toggle-chat-sidebar');
  const sidebar = document.getElementById('chat-sidebar');
  if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('hidden-mobile');
    });
  }

  // Bind HEEADSSS Quick Topic Chips
  document.querySelectorAll('#heeadsss-chips .chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt && input) {
        input.value = prompt;
        sendMessage();
      }
    });
  });

  // Load chat sessions from storage
  loadChatSessions();
  if (chatSessions.length === 0) {
    createNewChatSession();
  } else {
    switchChatSession(chatSessions[0].id);
  }

  const sendMessage = async () => {
    if (_isSending) return; // block while a reply is in-flight
    const text = input.value.trim();
    if (!text) return;
    _isSending = true;
    sendBtn.disabled = true;
    
    // Append to UI & Save to Session
    appendChatMessage(messages, text, 'user', typing);
    chatHistory.push({ role:"user", content: text });
    saveMessageToCurrentSession('user', text);

    input.value = '';
    typing.classList.remove('hidden');
    messages.scrollTop = messages.scrollHeight;
    updateEmotionBadge(text);
    const reply = await getAIResponse();
    if (reply === null) {
      chatHistory.pop(); // remove unanswered user message to preserve alternating roles
      typing.classList.add('hidden');
      return; // startRateLimitCountdown handles re-enabling inputs
    }
    
    chatHistory.push({ role:"assistant", content: reply });
    saveMessageToCurrentSession('assistant', reply);

    typing.classList.add('hidden');
    appendChatMessage(messages, reply, 'ai', typing);
    // Auto-speak the AI reply if user used voice input
    if (_lastInputWasVoice) {
      const plainReply = stripHtml(reply);
      speakText(plainReply, null);
      _lastInputWasVoice = false;
    }
    sendBtn.disabled = false;
    _isSending = false;
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

  // ── Speech-to-Text (Mic Button) ──
  const micBtn = document.getElementById('chat-mic-btn');
  if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let isRecording = false;

    micBtn.addEventListener('click', () => {
      if (isRecording) {
        recognition.stop();
        return;
      }
      isRecording = true;
      micBtn.classList.add('recording');
      input.placeholder = '🎙️ Listening...';
      recognition.start();
    });

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      input.value = transcript;
    };

    recognition.onend = () => {
      isRecording = false;
      micBtn.classList.remove('recording');
      input.placeholder = 'Tell me how you\'re feeling...';
      // Auto-send if there's text
      if (input.value.trim()) {
        _lastInputWasVoice = true;
        sendMessage();
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      isRecording = false;
      micBtn.classList.remove('recording');
      input.placeholder = 'Tell me how you\'re feeling...';
    };
  } else if (micBtn) {
    // Browser doesn't support Speech Recognition
    micBtn.title = 'Speech recognition not supported in this browser';
    micBtn.style.opacity = '0.3';
    micBtn.style.cursor = 'not-allowed';
  }
}

async function updateChatWelcome(firstName, level, score) {
  const el = document.getElementById('chat-welcome-msg');
  if (!el) return;
  const msgs = {
    Low:      `Your stress score is <strong>${score}/40</strong> — you're in the <strong>low</strong> range. Keep it up! How can I support you today?`,
    Moderate: `Your stress score is <strong>${score}/40</strong> — <strong>moderate</strong> stress. That's manageable! What's on your mind?`,
    High:     `Your stress score is <strong>${score}/40</strong>, which is quite <strong>high</strong>. I'm here to help — what's weighing on you most?`,
    Severe:   `Your stress score of <strong>${score}/40</strong> shows <strong>severe stress</strong>. A notification has been sent to your Guidance Counselor. You're not alone — I'm here for you. Let's talk.`,
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
    { role:"system", content:`[SYSTEM CONTEXT - do not reveal]: Student: ${currentProfile?.name}, Grade: ${currentProfile?.grade}. PSS score: ${score}/40 (${level} stress). Workload: ${JSON.stringify(latest?.workload)}. 
PERSONA: You are PSYCHE, a helpful, polite, and highly capable AI assistant, similar to ChatGPT or Gemini. You provide clear, objective, and well-structured assistance.
ADAPTABILITY & TONE: Maintain a professional, friendly, and objective tone. Be helpful and informative. While you should acknowledge the user's emotional state (based on their PSS score), maintain the clear, structured, and neutral demeanor typical of a large language model. Provide logical, well-reasoned advice and factual information.
RELIABILITY: Consistently provide thoughtful, accurate, and evidence-based support. Offer actionable wellness suggestions (like breathing exercises) clearly and concisely.
FORMATTING: Use HTML <p>, <strong>, and <ul> tags for formatting. Do NOT use markdown asterisks (*). Keep responses well-structured and reasonably concise.` },
    { role:"assistant", content:"Understood. I am PSYCHE, a helpful AI assistant. I am ready to assist you." },
  ];
}

function appendChatMessage(container, text, role, typingTarget) {
  const div = document.createElement('div');
  const formattedText = role === 'ai' ? marked.parse(text) : text;
  if (role === 'user') {
    div.className = 'message user-message';
    div.innerHTML = `<p>${text}</p>`;
  } else {
    const hasBreathing = text.toLowerCase().includes('breath');
    div.className = 'message ai-message';
    div.innerHTML = `
      <div class="ai-avatar-small"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="margin:9px"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/></svg></div>
      <div class="message-content">${formattedText}${hasBreathing ? `<div class="message-suggestions"><button class="btn-suggestion breath-open">🌬️ Open Breathing Exercise</button></div>` : ''}<button class="btn-tts" title="Listen to this message"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg></button></div>`;
    div.querySelector('.breath-open')?.addEventListener('click', () => openModal('breathing-overlay'));
    // TTS: speak this message when speaker button clicked
    div.querySelector('.btn-tts')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const plainText = stripHtml(text);
      speakText(plainText, btn);
    });
  }
  
  const typing = (typingTarget && typingTarget.parentNode === container) ? typingTarget : container.querySelector('#typing-indicator');
  if (typing && typing.parentNode === container) {
    container.insertBefore(div, typing);
  } else {
    container.appendChild(div);
  }
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

// ── Groq API fetch ──
async function groqRequest(messages) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      temperature: 0.6
    }),
  });
  if (res.status === 429) return { _rateLimited: true };
  if (!res.ok) return null;
  return await res.json();
}

async function getAIResponse() {
  const data = await groqRequest(chatHistory);
  if (!data) return "<p>Something went wrong connecting to the AI. Please try again. 💙</p>";
  if (data._rateLimited) {
    // Start a 60-second visible countdown in the chat
    startRateLimitCountdown();
    return null; // signal to caller: don't append a message, countdown handles it
  }
  return data.choices?.[0]?.message?.content || "<p>I'm here for you. Could you tell me more?</p>";
}

function startRateLimitCountdown() {
  const messages  = document.getElementById('chat-messages');
  const typing    = document.getElementById('typing-indicator');
  const div       = document.createElement('div');
  div.className   = 'message ai-message';
  let secs        = 60;
  const render    = () => `<div class="ai-avatar-small"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="margin:9px"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/></svg></div><div class="message-content"><p>⚡ AI is temporarily rate-limited. Ready again in <strong>${secs}s</strong>…</p></div>`;
  div.innerHTML   = render();
  if (typing && typing.parentNode === messages) {
    messages.insertBefore(div, typing);
  } else {
    messages.appendChild(div);
  }
  messages.scrollTop = messages.scrollHeight;
  const timer = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(timer);
      div.querySelector('.message-content').innerHTML = '<p>✅ AI is ready! Send your message.</p>';
      _isSending = false;
      document.getElementById('chat-send-btn').disabled = false;
    } else {
      div.querySelector('.message-content').innerHTML = `<p>⚡ AI is temporarily rate-limited. Ready again in <strong>${secs}s</strong>…</p>`;
    }
    messages.scrollTop = messages.scrollHeight;
  }, 1000);
}

const FALLBACK_RECS = [
  { title: "5-Min Box Breathing",   description: "A quick breathing reset to lower cortisol and calm your mind.",                   type: "breathing" },
  { title: "Break Down Your Tasks", description: "List all pending tasks and tackle the smallest one first to build momentum.",    type: "study"    },
  { title: "Short Walk Outside",    description: "A 10-minute walk can significantly reset your stress levels and boost clarity.", type: "exercise" },
];

async function getAIRecommendations(score, level) {
  const name  = currentProfile?.name  || 'Student';
  const grade = currentProfile?.grade || 'SHS';
  const prompt = `You are PSYCHE AI. Student ${name} (${grade}) scored ${score}/40 on the PSS — "${level}" stress. Generate exactly 3 concise, personalized wellness recommendations as a JSON array: [{"title":"...","description":"...","type":"breathing|exercise|study|sleep|social"}]. Return ONLY the JSON array.`;
  const data = await groqRequest([{ role: "user", content: prompt }]);
  if (!data || data._rateLimited) return FALLBACK_RECS;
  try {
    const raw = data.choices?.[0]?.message?.content || '[]';
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return FALLBACK_RECS;
  }
}

// ── ZEN SERENE CANVAS ──────────────────────────────────────────
function initNeuralCanvas() {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [], W, H;
  
  const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  window.addEventListener('resize', resize); 
  resize();

  // Create serene floating leaves/petals and ambient light orbs
  const colors = [
    { r: 132, g: 169, b: 140 }, // Sage leaf
    { r: 118, g: 199, b: 183 }, // Soft cyan mist
    { r: 181, g: 168, b: 213 }, // Soft iris
    { r: 226, g: 180, b: 154 }  // Warm sand
  ];

  for (let i = 0; i < 55; i++) {
    const col = colors[Math.floor(Math.random() * colors.length)];
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.15 - Math.random() * 0.25, // Gentle upward drift
      size: Math.random() * 4 + 2,
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 0.015,
      sineOffset: Math.random() * Math.PI * 2,
      sineSpeed: 0.005 + Math.random() * 0.008,
      color: col,
      alpha: Math.random() * 0.35 + 0.15,
      isLeaf: Math.random() > 0.4
    });
  }

  (function animate() {
    ctx.clearRect(0, 0, W, H);

    // Soft background radial aura
    const bgGlow = ctx.createRadialGradient(W / 2, H / 3, 0, W / 2, H / 3, W * 0.7);
    bgGlow.addColorStop(0, 'rgba(132, 169, 140, 0.04)');
    bgGlow.addColorStop(0.5, 'rgba(82, 121, 111, 0.02)');
    bgGlow.addColorStop(1, 'rgba(10, 17, 15, 0)');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p, i) => {
      p.sineOffset += p.sineSpeed;
      p.x += p.vx + Math.sin(p.sineOffset) * 0.35;
      p.y += p.vy;
      p.angle += p.vAngle;

      // Wrap around bounds softly
      if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.isLeaf) {
        // Draw organic serene leaf/petal
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 1.8);
        ctx.bezierCurveTo(p.size * 1.5, -p.size * 0.5, p.size * 1.2, p.size * 1.2, 0, p.size * 1.8);
        ctx.bezierCurveTo(-p.size * 1.2, p.size * 1.2, -p.size * 1.5, -p.size * 0.5, 0, -p.size * 1.8);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha})`;
        ctx.fill();
      } else {
        // Draw soft ambient glowing orb
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha * 0.8})`;
        ctx.shadowColor = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0.5)`;
        ctx.shadowBlur = 12;
        ctx.fill();
      }
      ctx.restore();

      // Soft connections between close floating particles
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x, dy = p.y - p2.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          const lineAlpha = (1 - dist / 130) * 0.08;
          ctx.strokeStyle = `rgba(132, 169, 140, ${lineAlpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    });

    requestAnimationFrame(animate);
  })();
}

// ── ZEN AMBIENT SOUNDSCAPE SYNTHESIZER ────────────────────────
let _zenAudioCtx = null;
let _zenSoundMode = 0; // 0: Off, 1: Rain, 2: Stream, 3: Singing Bowl
let _zenNodes = [];
let _bowlTimer = null;

function initZenAudio() {
  const btn = document.getElementById('zen-audio-btn');
  if (!btn) return;

  const modes = [
    { label: "Zen Sound: Off", icon: "🧘" },
    { label: "Rain Sanctuary", icon: "🌧️" },
    { label: "Forest Stream", icon: "🍃" },
    { label: "Singing Bowl", icon: "🔔" }
  ];

  btn.addEventListener('click', () => {
    _zenSoundMode = (_zenSoundMode + 1) % modes.length;
    const mode = modes[_zenSoundMode];

    document.getElementById('zen-audio-icon').textContent = mode.icon;
    document.getElementById('zen-audio-label').textContent = mode.label;

    if (_zenSoundMode === 0) {
      btn.classList.remove('playing');
      stopZenAudio();
    } else {
      btn.classList.add('playing');
      startZenAudio(_zenSoundMode);
    }
  });
}

function stopZenAudio() {
  if (_bowlTimer) { clearInterval(_bowlTimer); _bowlTimer = null; }
  _zenNodes.forEach(n => {
    try {
      if (n.stop) n.stop();
      if (n.disconnect) n.disconnect();
    } catch (e) {}
  });
  _zenNodes = [];
}

function startZenAudio(mode) {
  stopZenAudio();
  if (!_zenAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    _zenAudioCtx = new AudioCtx();
  }
  if (_zenAudioCtx.state === 'suspended') {
    _zenAudioCtx.resume();
  }

  const ctx = _zenAudioCtx;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.18, ctx.currentTime);
  masterGain.connect(ctx.destination);
  _zenNodes.push(masterGain);

  if (mode === 1) {
    // 🌧️ Gentle Rain (Pink noise + lowpass filter)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(masterGain);
    whiteNoise.start();
    _zenNodes.push(whiteNoise, filter);

  } else if (mode === 2) {
    // 🍃 Forest Stream (Low binaural ambient hum + serene water frequency)
    [216, 218].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start();
      _zenNodes.push(osc, gain);
    });

  } else if (mode === 3) {
    // 🔔 Zen Singing Bowl (Resonant 432 Hz warm chime)
    const playBowlStrike = () => {
      if (!ctx || _zenSoundMode !== 3) return;
      const freqs = [432, 864, 1296];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, ctx.currentTime);

        const vol = 0.25 / (idx + 1);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 6.0);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();
        osc.stop(ctx.currentTime + 6.0);
      });
    };

    playBowlStrike();
    _bowlTimer = setInterval(playBowlStrike, 7000);
  }
}

// ── SCROLL REVEAL ────────────────────────────────────────────
function initScrollReveal() {
  const els   = document.querySelectorAll('.reveal');
  const check = () => els.forEach(el => { if (el.getBoundingClientRect().top < window.innerHeight - 100) el.classList.add('active'); });
  window.addEventListener('scroll', check);
  setTimeout(check, 100);
}

// ── TEXT-TO-SPEECH HELPERS (Groq Orpheus Neural TTS) ─────────
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

let _ttsAudio = null;       // current Audio element
let _ttsSpeakingBtn = null;  // which btn is currently "speaking"

async function speakText(text, btn) {
  // If already playing, stop it
  if (_ttsAudio && !_ttsAudio.paused) {
    _ttsAudio.pause();
    _ttsAudio.currentTime = 0;
    if (_ttsSpeakingBtn) _ttsSpeakingBtn.classList.remove('speaking');
    // If clicking the same button that was speaking, just stop (toggle off)
    if (_ttsSpeakingBtn === btn) {
      _ttsAudio = null;
      _ttsSpeakingBtn = null;
      return;
    }
  }

  // Clean up text for speech (remove emojis, excessive punctuation)
  const cleanText = text
    .replace(/[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();

  if (!cleanText) return;

  if (btn) btn.classList.add('speaking');
  _ttsSpeakingBtn = btn;

  try {
    // Prepend a vocal direction for warmth (Orpheus supports [gentle], [cheerful], [whisper], etc.)
    const spokenText = `[gentle] ${cleanText}`;

    const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'canopylabs/orpheus-v1-english',
        input: spokenText,
        voice: 'diana',
        response_format: 'wav'
      })
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text body');
      console.warn('Groq TTS failed, falling back to browser TTS:', res.status, errorText);
      fallbackBrowserTTS(cleanText, btn);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    _ttsAudio = audio;

    audio.onended = () => {
      if (btn) btn.classList.remove('speaking');
      _ttsSpeakingBtn = null;
      _ttsAudio = null;
      URL.revokeObjectURL(url);
    };

    audio.onerror = () => {
      if (btn) btn.classList.remove('speaking');
      _ttsSpeakingBtn = null;
      _ttsAudio = null;
      URL.revokeObjectURL(url);
    };

    await audio.play();
  } catch (err) {
    console.warn('TTS error, falling back to browser TTS:', err);
    fallbackBrowserTTS(cleanText, btn);
  }
}

// Fallback to browser SpeechSynthesis if Groq TTS fails
function fallbackBrowserTTS(text, btn) {
  if (typeof speechSynthesis === 'undefined') {
    if (btn) btn.classList.remove('speaking');
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Microsoft Zira') || v.name.includes('Google UK English Female') || v.name.includes('Samantha'))
    || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
    || voices.find(v => v.lang.startsWith('en'))
    || voices[0];
  if (preferred) utterance.voice = preferred;
  utterance.rate = 1.0;
  utterance.pitch = 1.05;
  if (btn) btn.classList.add('speaking');
  utterance.onend = () => { if (btn) btn.classList.remove('speaking'); };
  utterance.onerror = () => { if (btn) btn.classList.remove('speaking'); };
  speechSynthesis.speak(utterance);
}

// Ensure browser voices are loaded (for fallback)
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
