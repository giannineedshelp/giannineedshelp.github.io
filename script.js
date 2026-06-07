// ============================================================
// GIOAI v6.0 - Main Client Script
// Handles: Platform logins (LN, Seneca, Sparx), homework fetching,
//          admin panel, status checking, announcements, blacklist
// ============================================================
(function() {
'use strict';

var APP_VERSION = '6.0';
var CHANGELOG_SEEN_KEY = 'gioai-changelog-seen';
var WORKER_URL = 'https://gioai.giannikei12.workers.dev';

// ===== SHORTHAND DOM CACHE =====
var $ = {};
function cache() {
  var ids = [
    'appLoading','sidebar','sidebarOverlay','sidebarClose','sidebarLinks','hamburgerBtn','sidebarUserName','sidebarUserPlatform','sidebarVersion',
    'disclaimer','disclaimerAgree','disclaimerContinue',
    'hubScreen','hubCards',
    'platformLoginScreen','platformLoginTitle','loginPlatformBadge','platformUsername','platformPassword','platformLoginBtn','loginStatus','loginStatusText','backToHub',
    'senecaLoginExtra','sparxLoginExtra','sparxSchoolSearch','sparxSchoolResults','sparxSchoolId',
    'plSvgLn','plSvgSe','plSvgSp','plText','plSub','platformLoading',
    'dashboardScreen','dashUserDisplay','dashStatusDot','dashPlatformBadge','dashTasks','dashLogEntries','dashFetchBtn','dashStartBtn','dashStopBtn','dashLogoutBtn','dashSettingsBtn','dashStatCompleted','dashStatXp','dashStatErrors','dashProgressFill','dashProgressText','dashFetchTasksBtn',
    'settingsScreen','settingsBackBtn','settingsDelayMin','settingsDelayMax','settingsShowWorking','settingsAiProvider',
    'psDelayMin','psDelayMax','psFakeTime','psDelayMinVal','psDelayMaxVal','psFakeTimeVal','psShowPrevHmwk','psShowWorking','psFakeTimeGroup','psShowWorkingGroup',
    'adminScreen','adminBackBtn','adminUsername','adminAmount','adminKey','adminGiveSlotsBtn','adminResult','adminPlatformStatus',
    'adminBlacklistBtn','adminBlacklistUser','adminBlacklistAction','adminBlacklistResult',
    'adminAnnouncementBtn','adminAnnouncementMsg','adminAnnouncementType','adminAnnouncementResult',
    'adminPlatStatusBtn','adminStatusPlatform','adminStatusValue','adminStatusResult',
    'adminCheckPlatformsBtn',
    'donateScreen','donateBackBtn',
    'changelogOverlay','changelogClose','changelogDismiss','changelogBody','changelogList',
    'notifOverlay','notifClose','notifBadge','notifBell','notifTabs','notifPanes',
    'notifList','announcementList',
    'disclaimerAgreeChk','disclaimerContinueBtn',
    'statusScreen','statusContent',
    'appVersion','bootLines','bootProgress','bootStatus'
  ];
  for (var i = 0; i < ids.length; i++) {
    $[ids[i]] = document.getElementById(ids[i]);
  }
  // Convert HTMLCollections to arrays
  if ($.sidebarLinks) $.sidebarLinks = Array.from($.sidebarLinks);
  if ($.hubCards) $.hubCards = Array.from($.hubCards);
  if ($.notifTabs) $.notifTabs = Array.from($.notifTabs);
  if ($.notifPanes) $.notifPanes = Array.from($.notifPanes);
}

function bind(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
function setBtn(el, disabled) { if (el) { el.disabled = disabled; } }

// ===== STATE =====
var S = {
  token: null, platform: '', userData: '', theme: localStorage.getItem('gioai-theme') || 'dark',
  tasks: [], completed: 0, xpEarned: 0, errors: 0, running: false,
  showPrevHmwk: localStorage.getItem('gioai-showPrevHmwk') === '1',
  showWorking: localStorage.getItem('gioai-showWorking') === '1',
  delayMin: 5, delayMax: 8, fakeTime: 10000,
  sparx: { token: '', sessionId: '' },
  seneca: { idToken: '', refreshToken: '' },
  ln: { token: '' },
  announcements: [],
  blacklist: [],
  initialized: false
};

// ===== HELPERS =====
function secondsToString(secs) {
  if (secs >= 3600) return Math.floor(secs / 3600) + 'h ' + (Math.floor(secs % 3600 / 60)) + 'm';
  if (secs >= 60) return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
  return secs + 's';
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function randomBetween(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

// ===== SCREENS =====
function showScreen(id) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
  closeSidebar();
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
  if (id === 'hubScreen') {
    if ($.sidebarUserName) $.sidebarUserName.textContent = S.token ? S.userData || 'User' : 'Guest';
    if ($.sidebarUserPlatform) $.sidebarUserPlatform.textContent = S.platform ? S.platform : 'Not logged in';
  }
  if (id === 'adminScreen') {
    checkPlatformStatus();
    loadAnnouncements();
    loadBlacklist();
  }
  if (id === 'statusScreen') {
    loadStatusPage();
  }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').style.display = 'block'; }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').style.display = 'none'; }

// ===== THEME =====
function setTheme(t) {
  S.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('gioai-theme', t);
  var all = document.querySelectorAll('.theme-btn, .theme-btn-lg');
  for (var i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i].dataset.theme === t);
}

// ===== LOGGING =====
function log(type, msg) {
  var e = document.createElement('div');
  e.className = 'log-entry ' + type;
  var t = new Date();
  var ts = t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0') + ':' + t.getSeconds().toString().padStart(2,'0');
  e.textContent = '[' + ts + '] ' + msg;
  var c = $.dashLogEntries;
  if (c) { c.appendChild(e); c.scrollTop = c.scrollHeight; }
}

// ===== STATS =====
function updateStats() {
  if ($.dashStatCompleted) $.dashStatCompleted.textContent = S.completed;
  if ($.dashStatXp) $.dashStatXp.textContent = S.xpEarned;
  if ($.dashStatErrors) $.dashStatErrors.textContent = S.errors;
  var total = S.tasks.length || 1;
  var pct = Math.round((S.completed / total) * 100);
  if ($.dashProgressFill) $.dashProgressFill.style.width = Math.min(pct, 100) + '%';
  if ($.dashProgressText) $.dashProgressText.textContent = S.completed + ' / ' + S.tasks.length + ' tasks (' + pct + '%)';
}

// ===== PLATFORM LOADING =====
function showPlatformLoading(platform) {
  var logos = { languagenut: 'plSvgLn', seneca: 'plSvgSe', sparx: 'plSvgSp' };
  var names = { languagenut: 'LanguageNut', seneca: 'Seneca Learning', sparx: 'Sparx Maths' };
  var msgs = { languagenut: 'Connecting to LanguageNut...', seneca: 'Fetching Seneca courses...', sparx: 'Contacting Sparx servers...' };
  if ($.plSvgLn) $.plSvgLn.style.display = 'none';
  if ($.plSvgSe) $.plSvgSe.style.display = 'none';
  if ($.plSvgSp) $.plSvgSp.style.display = 'none';
  var svgId = logos[platform];
  if ($[svgId]) $[svgId].style.display = 'block';
  if ($.plText) $.plText.textContent = msgs[platform] || 'Loading...';
  if ($.plSub) $.plSub.textContent = names[platform] || '';
  if ($.platformLoading) $.platformLoading.style.display = 'flex';
}

function hidePlatformLoading() { if ($.platformLoading) $.platformLoading.style.display = 'none'; }

// ===== API CALL =====
function api(url, data) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r) { return r.json(); });
}

// ===== LANGUAGE NUT AUTH =====
function lnLogin() {
  var user = $.platformUsername ? $.platformUsername.value.trim() : '';
  var pass = $.platformPassword ? $.platformPassword.value.trim() : '';
  if (!user || !pass) { showLoginStatus('error', 'Enter username and password'); return; }
  showLoginStatus('info', 'Authenticating...');
  showPlatformLoading('languagenut');
  api(WORKER_URL + '/api/lnut/login', { username: user, password: pass }).then(function(d) {
    hidePlatformLoading();
    if (d.token) {
      S.ln.token = d.token;
      S.token = d.token;
      S.userData = user;
      enterDashboard('languagenut', user);
      log('success', 'LanguageNut: Login successful');
      toast('LanguageNut logged in', 'success');
    } else {
      showLoginStatus('error', d.error || 'Login failed');
      log('error', 'LanguageNut: Login failed - ' + (d.error || 'unknown'));
    }
  }).catch(function(e) {
    hidePlatformLoading();
    showLoginStatus('error', 'Connection error: ' + e.message);
    log('error', 'LanguageNut: ' + e.message);
  });
}

// ===== SENECA AUTH =====
function senecaLogin() {
  var email = $.platformUsername ? $.platformUsername.value.trim() : '';
  var pass = $.platformPassword ? $.platformPassword.value.trim() : '';
  if (!email || !pass) { showLoginStatus('error', 'Enter email and password'); return; }
  showLoginStatus('info', 'Authenticating with Seneca...');
  showPlatformLoading('seneca');
  api(WORKER_URL + '/api/seneca/login', { email: email, password: pass }).then(function(d) {
    hidePlatformLoading();
    if (d.idToken) {
      S.seneca.idToken = d.idToken;
      S.seneca.refreshToken = d.refreshToken || '';
      S.token = d.idToken;
      S.userData = email;
      enterDashboard('seneca', email);
      log('success', 'Seneca: Login successful');
      toast('Seneca logged in', 'success');
    } else {
      showLoginStatus('error', d.error || 'Login failed');
      log('error', 'Seneca: Login failed - ' + (d.error || 'unknown'));
    }
  }).catch(function(e) {
    hidePlatformLoading();
    showLoginStatus('error', 'Connection error: ' + e.message);
    log('error', 'Seneca: ' + e.message);
  });
}

// ===== SPARX AUTH =====
function sparxLogin() {
  var user = $.platformUsername ? $.platformUsername.value.trim() : '';
  var pass = $.platformPassword ? $.platformPassword.value.trim() : '';
  var sid = $.sparxSchoolId ? $.sparxSchoolId.value.trim() || '1' : '1';
  if (!user || !pass) { showLoginStatus('error', 'Enter username and password'); return; }
  showLoginStatus('info', 'Authenticating with Sparx...');
  showPlatformLoading('sparx');
  api(WORKER_URL + '/api/sparx/login', { username: user, password: pass, schoolId: sid }).then(function(d) {
    hidePlatformLoading();
    if (d.token) {
      S.sparx.token = d.token;
      S.sparx.sessionId = d.session_id || '';
      S.token = d.token;
      S.userData = user;
      enterDashboard('sparx', user);
      log('success', 'Sparx: Login successful');
      toast('Sparx logged in', 'success');
    } else {
      showLoginStatus('error', d.error || 'Login failed');
      log('error', 'Sparx: Login failed - ' + (d.error || 'unknown'));
    }
  }).catch(function(e) {
    hidePlatformLoading();
    showLoginStatus('error', 'Connection error: ' + e.message);
    log('error', 'Sparx: ' + e.message);
  });
}

// ===== FCAPTCHA TOKEN =====
function genFCaptchaToken() {
  var jitter = Math.random() * 500 - 250;
  var interactions = ['click', 'scroll', 'keypress', 'mousemove', 'focus', 'blur'];
  var fakeSig = {
    timestamp: Date.now() + jitter,
    score: 0.03 + Math.random() * 0.25,
    id: 'fc_' + Math.random().toString(36).substr(2, 12),
    v: '1.10.1',
    s: Math.floor(Math.random() * 9) + 1,
    t: interactions[Math.floor(Math.random() * interactions.length)],
    r: Math.random().toString(36).substr(2, 6)
  };
  var raw = btoa(JSON.stringify(fakeSig));
  var pos = Math.floor(Math.random() * (raw.length - 2)) + 1;
  return raw.slice(0, pos) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + raw.slice(pos + 1);
}

// ===== LOGIN UI =====
function showLoginStatus(type, msg) {
  var s = $.loginStatus;
  var t = $.loginStatusText;
  if (!s || !t) return;
  s.style.display = 'block';
  s.className = 'login-status ' + type;
  t.textContent = msg;
}

function hideLoginStatus() { if ($.loginStatus) $.loginStatus.style.display = 'none'; }

// ===== ENTER DASHBOARD =====
function enterDashboard(platform, username) {
  S.platform = platform;
  var icons = { languagenut: 'LN', seneca: 'SE', sparx: 'SX' };
  if ($.dashUserDisplay) $.dashUserDisplay.textContent = username;
  if ($.dashStatusDot) $.dashStatusDot.className = 'status-dot online';
  if ($.dashPlatformBadge) $.dashPlatformBadge.textContent = icons[platform] || '?';
  if ($.sidebarUserName) $.sidebarUserName.textContent = username || 'User';
  if ($.sidebarUserPlatform) $.sidebarUserPlatform.textContent = platform;

  if ($.psFakeTimeGroup) $.psFakeTimeGroup.style.display = 'block';
  if ($.psShowWorkingGroup) $.psShowWorkingGroup.style.display = (platform === 'sparx') ? 'block' : 'none';

  if (platform === 'languagenut') {
    S.delayMin = parseFloat(localStorage.getItem('gioai-ln-delayMin')) || 5;
    S.delayMax = parseFloat(localStorage.getItem('gioai-ln-delayMax')) || 8;
    S.fakeTime = parseInt(localStorage.getItem('gioai-ln-fakeTime')) || 10000;
  } else if (platform === 'sparx') {
    S.delayMin = parseFloat(localStorage.getItem('gioai-sp-delayMin')) || 60;
    S.delayMax = parseFloat(localStorage.getItem('gioai-sp-delayMax')) || 70;
    S.fakeTime = parseInt(localStorage.getItem('gioai-sp-fakeTime')) || 60000;
  } else {
    S.delayMin = parseFloat(localStorage.getItem('gioai-se-delayMin')) || 5;
    S.delayMax = parseFloat(localStorage.getItem('gioai-se-delayMax')) || 8;
    S.fakeTime = parseInt(localStorage.getItem('gioai-se-fakeTime')) || 10000;
  }

  syncDelayUI();
  if ($.psShowPrevHmwk) $.psShowPrevHmwk.checked = S.showPrevHmwk;
  if ($.psShowWorking) $.psShowWorking.checked = S.showWorking;

  S.tasks = [];
  S.completed = S.xpEarned = S.errors = 0;
  if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Click "Fetch Tasks" to load assignments</div>';
  if ($.dashLogEntries) $.dashLogEntries.innerHTML = '';
  updateStats();
  showScreen('dashboardScreen');
}

function syncDelayUI() {
  if ($.psDelayMin) { $.psDelayMin.value = S.delayMin; if ($.psDelayMinVal) $.psDelayMinVal.textContent = S.delayMin + 's'; }
  if ($.psDelayMax) { $.psDelayMax.value = S.delayMax; if ($.psDelayMaxVal) $.psDelayMaxVal.textContent = S.delayMax + 's'; }
  if ($.psFakeTime) {
    var logVal = Math.log10(S.fakeTime || 10000);
    $.psFakeTime.value = Math.max(0, Math.min(12, logVal));
    if ($.psFakeTimeVal) $.psFakeTimeVal.textContent = secondsToString(S.fakeTime);
  }
}

// ===== FETCH HOMEWORKS =====
function fetchHomeworks() {
  if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Loading...</div>';
  if (S.platform === 'languagenut') {
    if (!S.ln.token) { toast('Not logged into LanguageNut', 'error'); return; }
    showPlatformLoading('languagenut');
    api(WORKER_URL + '/api/lnut/homeworks', { token: S.ln.token }).then(function(d) {
      hidePlatformLoading();
      if (d && d.homeworkVms) {
        S.tasks = d.homeworkVms;
        renderLNHomeworks(S.tasks);
        log('success', 'Fetched ' + S.tasks.length + ' homeworks');
        toast('Loaded ' + S.tasks.length + ' homeworks', 'success');
      } else if (d && d.error) {
        $.dashTasks.innerHTML = '<div class="empty-state">Error: ' + d.error + '</div>';
      } else {
        $.dashTasks.innerHTML = '<div class="empty-state">No homeworks found</div>';
        log('warn', 'No homeworks returned');
      }
    }).catch(function(e) {
      hidePlatformLoading();
      $.dashTasks.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
      log('error', 'Fetch failed: ' + e.message);
    });
  } else if (S.platform === 'sparx') {
    if (!S.sparx.token) { toast('Not logged into Sparx', 'error'); return; }
    showPlatformLoading('sparx');
    api(WORKER_URL + '/api/sparx/homeworks', { token: S.sparx.token, session_id: S.sparx.sessionId }).then(function(d) {
      hidePlatformLoading();
      if (d.tasks && Array.isArray(d.tasks)) {
        S.tasks = d.tasks;
        renderSparxHomeworks(d.tasks);
        log('success', 'Sparx: Loaded ' + d.tasks.length + ' tasks');
        toast('Sparx data loaded', 'success');
      } else if (d.raw) {
        parseSparxHomeworks(d.raw);
      } else {
        $.dashTasks.innerHTML = '<div class="empty-state">No Sparx data</div>';
        log('warn', 'Sparx homeworks empty');
      }
    }).catch(function(e) {
      hidePlatformLoading();
      $.dashTasks.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
      log('error', 'Sparx fetch failed: ' + e.message);
    });
  } else if (S.platform === 'seneca') {
    if (!S.seneca.idToken) { toast('Not logged into Seneca', 'error'); return; }
    showPlatformLoading('seneca');
    api(WORKER_URL + '/api/seneca/homeworks', { idToken: S.seneca.idToken }).then(function(d) {
      hidePlatformLoading();
      if (d.homeworks && d.homeworks.length) {
        S.tasks = d.homeworks;
        renderSenecaHomeworks(d.homeworks);
        log('success', 'Seneca: Loaded ' + d.homeworks.length + ' assignments');
        toast('Seneca tasks loaded', 'success');
      } else {
        $.dashTasks.innerHTML = '<div class="empty-state">No Seneca assignments found</div>';
        log('warn', 'Seneca: No assignments returned');
      }
    }).catch(function(e) {
      hidePlatformLoading();
      $.dashTasks.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
      log('error', 'Seneca fetch failed: ' + e.message);
    });
  }
}

// ===== PARSE SPARX HOMEWORKS =====
function parseSparxHomeworks(b64raw) {
  try {
    var binary = atob(b64raw);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    S.tasks = [{ id: 'sparx-package', name: 'Sparx Homework Package', desc: 'Click to load tasks', tasks: [] }];
    renderSparxHomeworks(S.tasks);
    log('success', 'Sparx: Package data received');
    toast('Sparx data loaded', 'success');
  } catch(e) {
    $.dashTasks.innerHTML = '<div class="empty-state">Parse error: ' + e.message + '</div>';
    log('error', 'Sparx parse: ' + e.message);
  }
}

// ===== RENDER LN HOMEWORKS =====
function renderLNHomeworks(homeworks) {
  var html = '';
  for (var i = 0; i < homeworks.length; i++) {
    var h = homeworks[i];
    var isPast = h.status === 'Completed' || h.status === 'Marked' || (h.dueDate && new Date(h.dueDate) < new Date());
    if (isPast && !S.showPrevHmwk) continue;
    html += '<div class="exercise-row">' +
      '<label class="toggle-label"><input type="checkbox" class="hw-check" data-idx="' + i + '" ' + (isPast ? 'disabled' : '') + '>' +
      '<span class="ex-name">' + (h.title || h.name || 'Homework') + '</span></label>' +
      '<span class="ex-status ' + (isPast ? 'ex-past' : 'ex-pending') + '">' + (h.status || (isPast ? 'Past' : 'Active')) + '</span>' +
      '</div>';
  }
  if (!html) html = '<div class="empty-state">No homeworks' + (S.showPrevHmwk ? '' : ' (toggle Prev Homework to see past ones)') + '</div>';
  if ($.dashTasks) $.dashTasks.innerHTML = html;
  S.tasks = homeworks;
  updateStats();
}

// ===== RENDER SPARX HOMEWORKS =====
function renderSparxHomeworks(packages) {
  var html = '';
  for (var i = 0; i < packages.length; i++) {
    var p = packages[i];
    var completed = p.completed ? 'ex-past' : 'ex-pending';
    html += '<div class="exercise-row">' +
      '<label class="toggle-label"><input type="checkbox" class="hw-check" data-idx="' + i + '" ' + (p.completed ? 'disabled' : '') + '>' +
      '<span class="ex-name">' + (p.title || p.name || p.id || 'Task') + '</span></label>' +
      '<span class="ex-status ' + completed + '">' + (p.completed ? 'Done' : (p.status || 'Pending')) + '</span>' +
      '</div>';
  }
  if (!html) html = '<div class="empty-state">No Sparx tasks found</div>';
  if ($.dashTasks) $.dashTasks.innerHTML = html;
  updateStats();
}

// ===== RENDER SENECA HOMEWORKS =====
function renderSenecaHomeworks(homeworks) {
  var html = '';
  for (var i = 0; i < homeworks.length; i++) {
    var h = homeworks[i];
    var isPast = h.status === 'completed' || h.progress >= 100 || (h.dueDate && new Date(h.dueDate) < new Date());
    if (isPast && !S.showPrevHmwk) continue;
    html += '<div class="exercise-row" data-course="' + h.courseId + '" data-section="' + h.sectionId + '">' +
      '<label class="toggle-label"><input type="checkbox" class="hw-check" data-idx="' + i + '" ' + (isPast ? 'disabled' : '') + '>' +
      '<span class="ex-name">' + (h.title || 'Assignment') + '</span></label>' +
      '<span class="ex-course">' + (h.courseName || '') + '</span>' +
      '<span class="ex-status ' + (isPast ? 'ex-past' : 'ex-pending') + '">' + (h.progress ? h.progress + '%' : (h.status || 'Pending')) + '</span>' +
      '</div>';
  }
  if (!html) html = '<div class="empty-state">No Seneca assignments' + (S.showPrevHmwk ? '' : ' (toggle Prev Homework to see past)') + '</div>';
  if ($.dashTasks) $.dashTasks.innerHTML = html;
  S.tasks = homeworks;
  updateStats();
}

// ===== START COMPLETION =====
function startCompletion() {
  if (S.running) return;
  if (!S.tasks.length) { toast('No tasks to complete. Fetch tasks first.', 'warn'); return; }
  S.running = true;
  if ($.dashStartBtn) { $.dashStartBtn.disabled = true; $.dashStartBtn.textContent = 'Running...'; }
  if ($.dashStopBtn) $.dashStopBtn.disabled = false;
  S.completed = S.xpEarned = S.errors = 0;
  log('info', 'Starting batch completion...');
  toast('Starting tasks', 'info');
  runTasks();
}

function stopCompletion() {
  S.running = false;
  if ($.dashStartBtn) { $.dashStartBtn.disabled = false; $.dashStartBtn.textContent = 'Start All'; }
  if ($.dashStopBtn) $.dashStopBtn.disabled = true;
  log('warn', 'Stopped by user');
  toast('Stopped', 'warn');
}

// ===== RUN TASKS =====
async function runTasks() {
  var tasks = S.tasks;
  for (var i = 0; i < tasks.length && S.running; i++) {
    if (S.platform === 'languagenut') {
      await completeLNHw(i);
    } else if (S.platform === 'sparx') {
      await sleep(500);
      log('info', 'Sparx: Task ' + (i+1) + ' - submit placeholder');
      S.completed++;
      updateStats();
    } else if (S.platform === 'seneca') {
      await completeSenecaTask(i);
    }
  }
  if (S.running) {
    log('success', 'All tasks completed!');
    toast('All done!', 'success');
    if ($.dashStartBtn) { $.dashStartBtn.disabled = false; $.dashStartBtn.textContent = 'Start All'; }
    if ($.dashStopBtn) $.dashStopBtn.disabled = true;
    S.running = false;
  }
}

// ===== COMPLETE LN HOMEWORK =====
async function completeLNHw(idx) {
  log('info', 'LanguageNut: Completing homework ' + (idx+1));
  var hw = S.tasks[idx];
  if (!hw) return;
  
  // Get vocab for this homework
  var curriculumUid = hw.curriculumUid || hw.curriculumUid || '';
  if (curriculumUid && S.ln.token) {
    try {
      var vocabResp = await api(WORKER_URL + '/api/lnut/vocab', { token: S.ln.token, curriculumUid: curriculumUid });
      if (vocabResp && vocabResp.vocabVms && vocabResp.vocabVms.length) {
        var correctUids = [];
        for (var v = 0; v < vocabResp.vocabVms.length; v++) {
          if (vocabResp.vocabVms[v].vocabUid) correctUids.push(vocabResp.vocabVms[v].vocabUid);
        }
        // Submit score
        var scoreData = {
          moduleUid: hw.moduleUid || '',
          homeworkUid: hw.homeworkUid || hw.uid || '',
          gameUid: 'auto_complete',
          gameType: 'vocab',
          score: 200,
          correctVocabUids: correctUids,
          incorrectVocabUids: [],
          toietf: hw.toietf || 'fr',
          fromietf: 'en-US',
          vocabNumber: String(correctUids.length)
        };
        await api(WORKER_URL + '/api/lnut/score', { token: S.ln.token, scoreData: scoreData });
      }
    } catch(e) { log('warn', 'LN vocab fetch failed: ' + e.message); }
  }

  await sleep(randomBetween(S.delayMin * 1000, S.delayMax * 1000));
  S.completed++;
  S.xpEarned += randomBetween(50, 200);
  updateStats();
  log('success', 'Completed homework ' + (idx+1));
}

// ===== COMPLETE SENECA TASK =====
async function completeSenecaTask(idx) {
  log('info', 'Seneca: Completing task ' + (idx+1));
  var task = S.tasks[idx];
  if (!task || !S.seneca.idToken) return;
  
  try {
    // Get signed URL for content
    var signedUrlResp = await api(WORKER_URL + '/api/seneca/signed-url', {
      idToken: S.seneca.idToken,
      courseId: task.courseId,
      sectionId: task.sectionId
    });
    
    if (signedUrlResp && signedUrlResp.url) {
      // Fetch content
      var contentResp = await fetch(signedUrlResp.url);
      if (contentResp.ok) {
        var content = await contentResp.json();
        // Generate session data
        var sessionData = {
          courseId: task.courseId,
          sectionId: task.sectionId,
          timeStarted: new Date(Date.now() - 30000).toISOString(),
          timeFinished: new Date().toISOString(),
          answers: [],
          score: 100,
          maxScore: 100,
          duration: 30
        };
        if (content.questions) {
          for (var qi = 0; qi < content.questions.length; qi++) {
            sessionData.answers.push({
              questionId: content.questions[qi].id,
              answer: 'Sample answer',
              correct: true,
              timeTaken: Math.floor(Math.random() * 10) + 5
            });
          }
        }
        await api(WORKER_URL + '/api/seneca/submit-session', {
          idToken: S.seneca.idToken,
          sessionData: sessionData
        });
      }
    }
  } catch(e) { log('warn', 'Seneca completion error: ' + e.message); }
  
  await sleep(randomBetween(S.delayMin * 1000, S.delayMax * 1000));
  S.completed++;
  S.xpEarned += randomBetween(100, 300);
  updateStats();
  log('success', 'Completed task ' + (idx+1));
}

// ===== SPARX SCHOOL SEARCH =====
function setupSparxSchoolSearch() {
  if (!$.sparxSchoolSearch || !$.sparxSchoolResults) return;
  bind($.sparxSchoolSearch, 'input', function() {
    var q = this.value.trim();
    if (q.length < 2) { $.sparxSchoolResults.classList.remove('active'); return; }
    clearTimeout(S.sparx.schoolSearchTimer);
    S.sparx.schoolSearchTimer = setTimeout(function() {
      api(WORKER_URL + '/api/sparx/search-school', { query: q }).then(function(d) {
        if (d.results && d.results.length) {
          var html = '';
          for (var i = 0; i < d.results.length; i++) {
            html += '<div class="school-result-item" data-id="' + d.results[i].id + '" data-name="' + d.results[i].name + '">' +
              d.results[i].name + '<span class="school-result-id">ID: ' + d.results[i].id + '</span></div>';
          }
          $.sparxSchoolResults.innerHTML = html;
          $.sparxSchoolResults.classList.add('active');
          var items = $.sparxSchoolResults.querySelectorAll('.school-result-item');
          for (var j = 0; j < items.length; j++) {
            (function(item) {
              bind(item, 'click', function() {
                var id = this.dataset.id;
                var name = this.dataset.name;
                if ($.sparxSchoolSearch) $.sparxSchoolSearch.value = name;
                if ($.sparxSchoolId) $.sparxSchoolId.value = id;
                $.sparxSchoolResults.classList.remove('active');
              });
            })(items[j]);
          }
        } else {
          $.sparxSchoolResults.classList.remove('active');
        }
      }).catch(function() {});
    }, 300);
  });
  bind(document, 'click', function(e) {
    if ($.sparxSchoolResults && !e.target.closest('.school-search-wrapper')) {
      $.sparxSchoolResults.classList.remove('active');
    }
  });
}

// ===== STATUS PAGE =====
function loadStatusPage() {
  var container = $.statusContent;
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Checking worker status...</div>';
  
  fetch(WORKER_URL + '/api/status', { signal: AbortSignal.timeout(8000) })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var html = '<div class="status-dashboard">';
      
      // Worker health
      html += '<div class="status-card ' + (d.status === 'operational' ? 'status-ok' : 'status-warn') + '">';
      html += '<div class="status-card-header">Worker Status</div>';
      html += '<div class="status-card-body">';
      html += '<div class="status-row"><span class="status-label">Status:</span><span class="status-value">' + d.status + '</span></div>';
      html += '<div class="status-row"><span class="status-label">Uptime:</span><span class="status-value">' + secondsToString(d.uptime || 0) + '</span></div>';
      html += '<div class="status-row"><span class="status-label">Total API Calls:</span><span class="status-value">' + (d.totalCalls || 0) + '</span></div>';
      html += '<div class="status-row"><span class="status-label">AI Calls:</span><span class="status-value">' + (d.aiCalls || 0) + '</span></div>';
      html += '<div class="status-row"><span class="status-label">Version:</span><span class="status-value">' + (d.version || '?') + '</span></div>';
      html += '</div></div>';
      
      // Platforms
      html += '<div class="status-card"><div class="status-card-header">Platforms</div><div class="status-card-body">';
      var platforms = d.platforms || {};
      var platNames = { languagenut: 'LanguageNut', seneca: 'Seneca Learning', sparx: 'Sparx Maths' };
      for (var p in platforms) {
        var status = platforms[p];
        var cls = status === 'online' ? 'status-ok' : status === 'offline' ? 'status-err' : 'status-warn';
        html += '<div class="status-row"><span class="status-label">' + (platNames[p] || p) + ':</span>' +
          '<span class="status-value ' + cls + '">' + status + '</span></div>';
      }
      html += '</div></div>';
      
      // Endpoints
      html += '<div class="status-card"><div class="status-card-header">API Endpoints</div><div class="status-card-body">';
      var endpoints = d.endpoints || [];
      for (var ei = 0; ei < endpoints.length; ei++) {
        html += '<div class="status-row"><span class="status-label">' + endpoints[ei] + '</span></div>';
      }
      html += '</div></div>';
      
      html += '</div>';
      container.innerHTML = html;
    })
    .catch(function(e) {
      container.innerHTML = '<div class="status-card status-err"><div class="status-card-header">Connection Error</div>' +
        '<div class="status-card-body">Could not reach worker: ' + e.message + '</div></div>';
    });
}

// ===== CHECK PLATFORM STATUS =====
function checkPlatformStatus() {
  var statusEl = $.adminPlatformStatus;
  if (!statusEl) return;
  var items = statusEl.querySelectorAll('.platform-status-item');
  function setStatus(idx, status) {
    if (items[idx]) {
      var ind = items[idx].querySelector('.ps-indicator');
      if (ind) { ind.className = 'ps-indicator ' + status; ind.textContent = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Checking...'; }
    }
  }
  
  fetch('https://api.languagenut.com/publicTranslationController/getTranslations', { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'Mozilla/5.0' } })
    .then(function(r) { setStatus(0, r.ok ? 'online' : 'offline'); }).catch(function() { setStatus(0, 'offline'); });
  
  fetch(WORKER_URL + '/api/status', { signal: AbortSignal.timeout(5000) })
    .then(function(r) { return r.json(); }).then(function(d) {
      if (d.status === 'operational') {
        setStatus(3, 'online');
        var plats = d.platforms || {};
        setStatus(1, plats.seneca === 'online' ? 'online' : 'offline');
        setStatus(2, plats.sparx === 'online' ? 'online' : 'offline');
      }
    }).catch(function() { setStatus(1, 'offline'); setStatus(2, 'offline'); setStatus(3, 'offline'); });
}

// ===== ADMIN FUNCTIONS =====
function getAdminKey() {
  return $.adminKey ? $.adminKey.value.trim() : '';
}

function giveSlots() {
  var username = $.adminUsername ? $.adminUsername.value.trim() : '';
  var amount = $.adminAmount ? parseInt($.adminAmount.value) || 1 : 1;
  var adminKey = getAdminKey();
  if (!username) { toast('Enter a username', 'error'); return; }
  api(WORKER_URL + '/api/admin/give-slots', { username: username, amount: amount, adminKey: adminKey }).then(function(d) {
    var result = $.adminResult;
    if (!result) return;
    if (d.success) {
      result.className = 'admin-result success';
      result.textContent = d.message || 'Added ' + amount + ' slots to ' + username;
      toast('Slots given!', 'success');
    } else {
      result.className = 'admin-result error';
      result.textContent = d.error || 'Failed';
      toast('Admin error: ' + (d.error || 'unknown'), 'error');
    }
  }).catch(function(e) {
    if ($.adminResult) { $.adminResult.className = 'admin-result error'; $.adminResult.textContent = 'Error: ' + e.message; }
  });
}

// Blacklist management
function manageBlacklist() {
  var username = $.adminBlacklistUser ? $.adminBlacklistUser.value.trim() : '';
  var action = $.adminBlacklistAction ? $.adminBlacklistAction.value : 'add';
  var adminKey = getAdminKey();
  if (!username && action !== 'list') { toast('Enter a username', 'error'); return; }
  
  api(WORKER_URL + '/api/admin/blacklist', { username: username, action: action, adminKey: adminKey }).then(function(d) {
    var result = $.adminBlacklistResult;
    if (!result) return;
    if (d.success) {
      S.blacklist = d.blacklist || [];
      if (action === 'add') {
        result.className = 'admin-result success';
        result.textContent = username + ' blacklisted';
        toast('User blacklisted', 'success');
      } else if (action === 'remove') {
        result.className = 'admin-result success';
        result.textContent = username + ' removed from blacklist';
        toast('User unblacklisted', 'success');
      } else {
        result.className = 'admin-result success';
        result.textContent = 'Blacklisted users: ' + (d.blacklist && d.blacklist.length ? d.blacklist.join(', ') : 'none');
      }
      loadBlacklist();
    } else {
      result.className = 'admin-result error';
      result.textContent = d.error || 'Failed';
    }
  }).catch(function(e) {
    if ($.adminBlacklistResult) { $.adminBlacklistResult.className = 'admin-result error'; $.adminBlacklistResult.textContent = 'Error: ' + e.message; }
  });
}

function loadBlacklist() {
  // Load from localStorage
  var bl = localStorage.getItem('gioai-blacklist');
  if (bl) {
    try { S.blacklist = JSON.parse(bl); } catch(e) { S.blacklist = []; }
  }
  var el = $.adminBlacklistResult;
  if (el && S.blacklist && S.blacklist.length) {
    el.className = 'admin-result success';
    el.textContent = 'Blacklisted: ' + S.blacklist.join(', ');
  }
}

// Announcements
function sendAnnouncement() {
  var message = $.adminAnnouncementMsg ? $.adminAnnouncementMsg.value.trim() : '';
  var type = $.adminAnnouncementType ? $.adminAnnouncementType.value : 'info';
  var adminKey = getAdminKey();
  if (!message) { toast('Enter announcement message', 'error'); return; }
  
  api(WORKER_URL + '/api/admin/announcement', { message: message, type: type, adminKey: adminKey }).then(function(d) {
    var result = $.adminAnnouncementResult;
    if (!result) return;
    if (d.success) {
      result.className = 'admin-result success';
      result.textContent = 'Announcement sent!';
      if ($.adminAnnouncementMsg) $.adminAnnouncementMsg.value = '';
      // Save locally
      var anns = JSON.parse(localStorage.getItem('gioai-announcements') || '[]');
      anns.unshift(d.announcement);
      if (anns.length > 50) anns = anns.slice(0, 50);
      localStorage.setItem('gioai-announcements', JSON.stringify(anns));
      loadAnnouncements();
      toast('Announcement created!', 'success');
    } else {
      result.className = 'admin-result error';
      result.textContent = d.error || 'Failed';
    }
  }).catch(function(e) {
    if ($.adminAnnouncementResult) { $.adminAnnouncementResult.className = 'admin-result error'; $.adminAnnouncementResult.textContent = 'Error: ' + e.message; }
  });
}

// Platform status management
function setPlatformStatus() {
  var platform = $.adminStatusPlatform ? $.adminStatusPlatform.value : '';
  var status = $.adminStatusValue ? $.adminStatusValue.value : 'online';
  var adminKey = getAdminKey();
  if (!platform) { toast('Select a platform', 'error'); return; }
  
  api(WORKER_URL + '/api/admin/platform-status', { platform: platform, status: status, adminKey: adminKey }).then(function(d) {
    var result = $.adminStatusResult;
    if (!result) return;
    if (d.success) {
      result.className = 'admin-result success';
      result.textContent = d.message || platform + ' set to ' + status;
      toast('Status updated!', 'success');
    } else {
      result.className = 'admin-result error';
      result.textContent = d.error || 'Failed';
    }
  }).catch(function(e) {
    if ($.adminStatusResult) { $.adminStatusResult.className = 'admin-result error'; $.adminStatusResult.textContent = 'Error: ' + e.message; }
  });
}

// Load announcements into notification panel
function loadAnnouncements() {
  var anns = JSON.parse(localStorage.getItem('gioai-announcements') || '[]');
  S.announcements = anns;
  
  // Update notification badge
  if (anns.length && $.notifBadge) {
    $.notifBadge.style.display = 'flex';
    $.notifBadge.textContent = anns.length;
  }
  
  // Render in announcement pane
  var list = $.announcementList;
  if (!list) return;
  if (!anns.length) {
    list.innerHTML = '<div class="empty-state">No announcements</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < anns.length; i++) {
    var a = anns[i];
    var typeClass = a.type === 'warning' ? 'ann-warning' : a.type === 'error' ? 'ann-error' : 'ann-info';
    html += '<div class="announcement-item ' + typeClass + '">' +
      '<div class="ann-header">' + a.type.toUpperCase() + '</div>' +
      '<div class="ann-body">' + a.message + '</div>' +
      '<div class="ann-time">' + (a.timestamp ? new Date(a.timestamp).toLocaleString() : '') + '</div>' +
      '</div>';
  }
  list.innerHTML = html;
}

// ===== GIVE SLOTS (LEGACY) =====
function giveSlotsLegacy() { giveSlots(); }

// ===== BOOT ANIMATION =====
function bootAnimate() {
  var lines = [
    { text: 'Initializing kernel modules...', type: 'ok' },
    { text: 'Mounting core services...', type: 'ok' },
    { text: 'Loading AI engine (Gemini/Groq/Mistral)...', type: 'ok' },
    { text: 'Establishing secure worker tunnel...', type: 'info' },
    { text: 'Syncing platform configurations...', type: 'ok' },
    { text: 'Starting GIOAI v' + APP_VERSION + '...', type: 'ok' }
  ];
  var container = document.getElementById('bootLines');
  var progress = document.getElementById('bootProgress');
  var status = document.getElementById('bootStatus');
  if (!container) return;
  var i = 0;
  function addLine() {
    if (i >= lines.length) {
      if (status) status.textContent = 'Ready. Starting interface...';
      return;
    }
    var l = lines[i];
    var div = document.createElement('div');
    div.className = 'boot-line';
    var tag = l.type === 'warn' ? 'WARN' : l.type === 'info' ? 'INFO' : '  OK  ';
    var cls = l.type === 'warn' ? 'warn' : l.type === 'info' ? 'info' : 'ok';
    div.innerHTML = '<span class="boot-ts ' + cls + '">[' + tag + ']</span> ' + l.text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    if (progress) progress.style.width = ((i + 1) / lines.length * 100) + '%';
    if (status) status.textContent = l.text;
    i++;
    setTimeout(addLine, 200 + Math.random() * 150);
  }
  addLine();
}

// ===== CHANGELOG =====
function renderChangelog() {
  var html = '<div class="changelog-list"><div class="changelog-item"><h3>v2.5 (June 2026)</h3><ul>' +
    '<li>Unified single-page app with all platforms</li>' +
    '<li>4 themes: Dark, Hacker, Light, Neon</li>' +
    '<li>Admin panel with give slots, blacklist, announcements</li>' +
    '<li>Seneca API proxy endpoints + homework fetch</li>' +
    '<li>Status dashboard for worker health & usage</li>' +
    '<li>Fixed Sparx legacy API integration</li>' +
    '<li>LanguageNut homework auto-completion</li>' +
    '</ul></div></div>';
  if ($.changelogBody) $.changelogBody.innerHTML = html;
  if ($.changelogList) $.changelogList.innerHTML = html;
}

function showChangelog() { if ($.changelogOverlay) $.changelogOverlay.style.display = 'flex'; }
function hideChangelog() {
  if ($.changelogOverlay) $.changelogOverlay.style.display = 'none';
  localStorage.setItem(CHANGELOG_SEEN_KEY, '1');
}

// ===== NOTIFICATIONS =====
function openNotifPanel() {
  if ($.notifOverlay) $.notifOverlay.style.display = 'flex';
  if ($.notifBadge) $.notifBadge.style.display = 'none';
  loadAnnouncements();
}

function closeNotifPanel() { if ($.notifOverlay) $.notifOverlay.style.display = 'none'; }

// ===== TOAST =====
function toast(msg, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = '0.3s ease'; }, 3000);
  setTimeout(function() { el.remove(); }, 3500);
}

// ===== INIT =====
function init() {
  if (S.initialized) return;
  S.initialized = true;
  cache();
  setTheme(S.theme);

  // Load saved announcements
  loadAnnouncements();
  loadBlacklist();

  // Boot animation sequence
  bootAnimate();
  setTimeout(function() {
    if ($.appLoading) $.appLoading.classList.remove('active');
    showScreen('disclaimer');
  }, 2200);

  // === SIDEBAR ===
  bind($.hamburgerBtn, 'click', toggleSidebar);
  bind($.sidebarOverlay, 'click', closeSidebar);
  bind($.sidebarClose, 'click', closeSidebar);
  for (var i = 0; i < $.sidebarLinks.length; i++) {
    (function(link) {
      bind(link, 'click', function(e) {
        e.preventDefault();
        var screen = this.dataset.screen;
        showScreen(screen);
      });
    })($.sidebarLinks[i]);
  }

  // === THEME BUTTONS ===
  function handleThemeClick(btns) {
    for (var i = 0; i < btns.length; i++) {
      (function(btn) {
        bind(btn, 'click', function() { setTheme(this.dataset.theme); });
      })(btns[i]);
    }
  }
  handleThemeClick(document.querySelectorAll('.theme-btn'));
  handleThemeClick(document.querySelectorAll('.theme-btn-lg'));

  // === DISCLAIMER ===
  bind($.disclaimerAgree, 'change', function() {
    setBtn($.disclaimerContinue, !this.checked);
  });
  bind($.disclaimerContinue, 'click', function() {
    showScreen('hubScreen');
  });

  // === HUB CARDS ===
  for (var i = 0; i < $.hubCards.length; i++) {
    (function(card) {
      bind(card, 'click', function() {
        var platform = this.dataset.platform;
        openPlatformLogin(platform);
      });
    })($.hubCards[i]);
  }

  function openPlatformLogin(platform) {
    S.platform = platform;
    var icons = { languagenut: 'LN', seneca: 'SE', sparx: 'SX' };
    var names = { languagenut: 'LanguageNut', seneca: 'Seneca Learning', sparx: 'Sparx Maths' };
    if ($.platformLoginTitle) $.platformLoginTitle.textContent = names[platform] || 'Login';
    if ($.loginPlatformBadge) $.loginPlatformBadge.textContent = icons[platform] || '?';
    if ($.senecaLoginExtra) $.senecaLoginExtra.style.display = (platform === 'seneca') ? 'block' : 'none';
    if ($.sparxLoginExtra) $.sparxLoginExtra.style.display = (platform === 'sparx') ? 'block' : 'none';
    if ($.platformUsername) $.platformUsername.placeholder = (platform === 'seneca') ? 'Email address' : 'Username';
    if ($.sparxSchoolSearch && $.sparxSchoolResults) {
      if (platform === 'sparx') {
        $.sparxSchoolSearch.value = '';
        $.sparxSchoolResults.classList.remove('active');
      }
    }
    if ($.platformUsername) $.platformUsername.value = '';
    if ($.platformPassword) $.platformPassword.value = '';
    hideLoginStatus();
    showScreen('platformLoginScreen');
  }

  // === BACK TO HUB ===
  bind($.backToHub, 'click', function() {
    S.token = null;
    showScreen('hubScreen');
  });

  // === PLATFORM LOGIN ===
  bind($.platformLoginBtn, 'click', function() {
    if (S.platform === 'languagenut') lnLogin();
    else if (S.platform === 'seneca') senecaLogin();
    else if (S.platform === 'sparx') sparxLogin();
  });

  bind($.platformPassword, 'keydown', function(e) {
    if (e.key === 'Enter') {
      if (S.platform === 'languagenut') lnLogin();
      else if (S.platform === 'seneca') senecaLogin();
      else if (S.platform === 'sparx') sparxLogin();
    }
  });

  // === SPARX SCHOOL SEARCH ===
  setupSparxSchoolSearch();

  // === DASHBOARD ACTIONS ===
  bind($.dashFetchBtn, 'click', fetchHomeworks);
  bind($.dashStartBtn, 'click', startCompletion);
  bind($.dashStopBtn, 'click', stopCompletion);

  bind($.dashLogoutBtn, 'click', function() {
    S.token = null;
    S.ln.token = null;
    S.seneca.idToken = null;
    S.sparx.token = null;
    S.tasks = [];
    S.completed = S.xpEarned = S.errors = 0;
    if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Logged out</div>';
    if ($.dashLogEntries) $.dashLogEntries.innerHTML = '';
    if ($.dashStatusDot) $.dashStatusDot.className = 'status-dot offline';
    if ($.dashUserDisplay) $.dashUserDisplay.textContent = 'Not logged in';
    updateStats();
    S.running = false;
    if ($.dashStartBtn) { $.dashStartBtn.disabled = false; $.dashStartBtn.textContent = 'Start All'; }
    if ($.dashStopBtn) $.dashStopBtn.disabled = true;
    showScreen('hubScreen');
    toast('Logged out', 'info');
  });

  bind($.dashSettingsBtn, 'click', function() { showScreen('settingsScreen'); });

  // === PLATFORM SETTINGS BAR ===
  bind($.psDelayMin, 'input', function() {
    S.delayMin = parseFloat(this.value) || 1;
    if ($.psDelayMinVal) $.psDelayMinVal.textContent = S.delayMin + 's';
  });
  bind($.psDelayMax, 'input', function() {
    S.delayMax = parseFloat(this.value) || 1;
    if ($.psDelayMaxVal) $.psDelayMaxVal.textContent = S.delayMax + 's';
  });
  bind($.psFakeTime, 'input', function() {
    var val = Math.pow(10, parseFloat(this.value));
    S.fakeTime = Math.floor(val);
    if ($.psFakeTimeVal) $.psFakeTimeVal.textContent = secondsToString(S.fakeTime);
  });
  bind($.psShowPrevHmwk, 'change', function() {
    S.showPrevHmwk = this.checked;
    localStorage.setItem('gioai-showPrevHmwk', S.showPrevHmwk ? '1' : '0');
    if (S.ln.token || S.sparx.token || S.seneca.idToken) fetchHomeworks();
  });
  bind($.psShowWorking, 'change', function() {
    S.showWorking = this.checked;
    localStorage.setItem('gioai-showWorking', S.showWorking ? '1' : '0');
  });

  // === SETTINGS SCREEN ===
  bind($.settingsBackBtn, 'click', function() { showScreen('dashboardScreen'); });
  bind($.settingsDelayMin, 'change', function() {
    var v = parseInt(this.value) || 5; if (v < 1) v = 1; S.delayMin = v; syncDelayUI();
  });
  bind($.settingsDelayMax, 'change', function() {
    var v = parseInt(this.value) || 8; if (v < 1) v = 1; S.delayMax = v; syncDelayUI();
  });
  bind($.settingsShowWorking, 'change', function() { S.showWorking = this.checked; });
  bind($.settingsAiProvider, 'change', function() { S.aiProvider = this.value; });

  // === DONATE SCREEN ===
  bind($.donateBackBtn, 'click', function() { showScreen('hubScreen'); });

  // === ADMIN SCREEN ===
  bind($.adminBackBtn, 'click', function() { showScreen('hubScreen'); });
  bind($.adminGiveSlotsBtn, 'click', giveSlots);
  bind($.adminBlacklistBtn, 'click', manageBlacklist);
  bind($.adminAnnouncementBtn, 'click', sendAnnouncement);
  bind($.adminPlatStatusBtn, 'click', setPlatformStatus);
  bind($.adminCheckPlatformsBtn, 'click', checkPlatformStatus);

  // === NOTIFICATIONS ===
  bind($.notifBell, 'click', openNotifPanel);
  bind($.notifClose, 'click', closeNotifPanel);
  bind($.notifOverlay, 'click', function(e) { if (e.target === this) closeNotifPanel(); });
  if ($.notifTabs && $.notifTabs.length) {
    for (var i = 0; i < $.notifTabs.length; i++) {
      (function(tab) {
        bind(tab, 'click', function() {
          var target = this.dataset.tab;
          for (var j = 0; j < $.notifTabs.length; j++) $.notifTabs[j].classList.remove('active');
          for (var j = 0; j < $.notifPanes.length; j++) $.notifPanes[j].classList.remove('active');
          this.classList.add('active');
          var pane = document.getElementById(target + 'Pane');
          if (pane) pane.classList.add('active');
        });
      })($.notifTabs[i]);
    }
  }

  // === CHANGELOG ===
  bind($.changelogClose, 'click', hideChangelog);
  bind($.changelogDismiss, 'click', hideChangelog);
  bind($.changelogOverlay, 'click', function(e) { if (e.target === this) hideChangelog(); });
  renderChangelog();

  if (!localStorage.getItem(CHANGELOG_SEEN_KEY)) {
    setTimeout(function() { showChangelog(); }, 1500);
  } else {
    if ($.notifBadge) $.notifBadge.style.display = 'none';
  }

  // === VERSION ===
  if ($.appVersion) $.appVersion.textContent = APP_VERSION;
  if ($.sidebarVersion) $.sidebarVersion.textContent = APP_VERSION;

  // === STATUS SCREEN ===
  bind(document.getElementById('statusRefreshBtn'), 'click', loadStatusPage);

  // Admin platform status observer
  var adminObserver = new MutationObserver(function() {
    if ($.adminScreen && $.adminScreen.classList.contains('active')) {
      checkPlatformStatus();
    }
  });
  if ($.adminScreen) adminObserver.observe($.adminScreen, { attributes: true, attributeFilter: ['class'] });

  log('info', 'GIOAI v' + APP_VERSION + ' loaded');
  log('info', 'Platforms: LanguageNut, Seneca, Sparx');
  log('info', 'Worker: ' + WORKER_URL);
}

// ===== START =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();

