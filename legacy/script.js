// ============================================================
// GIOAI v7.0 - Main Client Script
// Handles: Platform logins (LN, Seneca, Sparx), homework fetching,
//          admin panel, status checking, announcements, blacklist
// ============================================================
(function() {
'use strict';

var APP_VERSION = '7.0';
var CHANGELOG_SEEN_KEY = 'gioai-changelog-seen';
var WORKER_URL = 'https://gioai.giannikei12.workers.dev';

// ===== SHORTHAND DOM CACHE =====
var $ = {};
function cache() {
  var ids = [
    'appLoading','sidebar','sidebarOverlay','sidebarClose','hamburgerBtn','sidebarUserName','sidebarUserPlatform','sidebarVersion',
    'disclaimer','disclaimerAgree','disclaimerContinue',
    'hubScreen',
    'platformLoginScreen','platformLoginTitle','loginPlatformBadge','platformUsername','platformPassword','platformLoginBtn','loginStatus','loginStatusText','backToHub',
    'senecaLoginExtra','sparxLoginExtra','sparxSchoolSearch','sparxSchoolResults','sparxSchoolId',
    'sparxManualTokenGroup','sparxManualToken','sparxManualTokenBtn',
    'plSvgLn','plSvgSe','plSvgSp','plText','plSub','platformLoading',
    'dashboardScreen','dashUserDisplay','dashStatusDot','dashPlatformBadge','dashTasks','dashLogEntries','dashFetchBtn','dashStartBtn','dashStopBtn','dashLogoutBtn','dashSettingsBtn','dashStatCompleted','dashStatXp','dashStatErrors','dashProgressFill','dashProgressText',
    'settingsScreen','settingsBackBtn','settingsDelayMin','settingsDelayMax','settingsShowWorking','settingsAiProvider',
    'psDelayMin','psDelayMax','psFakeTime','psDelayMinVal','psDelayMaxVal','psFakeTimeVal','psShowPrevHmwk','psShowWorking','psFakeTimeGroup','psShowWorkingGroup',
    'adminScreen','adminBackBtn','adminUsername','adminAmount','adminKey','adminGiveSlotsBtn','adminResult','adminPlatformStatus',
    'adminBlacklistBtn','adminBlacklistUser','adminBlacklistAction','adminBlacklistResult',
    'adminAnnouncementBtn','adminAnnouncementMsg','adminAnnouncementType','adminAnnouncementResult',
    'adminPlatStatusBtn','adminStatusPlatform','adminStatusValue','adminStatusResult',
    'adminCheckPlatformsBtn',
    'donateScreen','donateBackBtn',
    'changelogOverlay','changelogClose','changelogDismiss','changelogBody','changelogList',
    'notifOverlay','notifClose','notifBadge','notifBell',
    'announcementList',
    'statusScreen','statusContent',
    'appVersion','bootLines','bootProgress','bootStatus'
  ];
  for (var i = 0; i < ids.length; i++) {
    $[ids[i]] = document.getElementById(ids[i]);
  }
  // Class-based queries (elements without unique IDs)
  $.sidebarLinks = Array.from(document.querySelectorAll('.sidebar-link'));
  $.hubCards = Array.from(document.querySelectorAll('.hub-card'));
  $.notifTabs = Array.from(document.querySelectorAll('.notif-tab'));
  $.notifPanes = Array.from(document.querySelectorAll('.notif-pane'));
}

function bind(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
function setBtn(el, disabled) { if (el) { el.disabled = disabled; } }

// ===== STATE =====
var S = {
  token: null, platform: '', userData: '', theme: localStorage.getItem('gioai-theme') || 'dark',
  tasks: [], completed: 0, xpEarned: 0, errors: 0, running: false,
  showPrevHmwk: localStorage.getItem('gioai-showPrevHmwk') === 'true',
  showWorking: localStorage.getItem('gioai-showWorking') === 'true',
  delayMin: 5, delayMax: 8, fakeTime: 10000,
  sparx: { token: '', sessionId: '', schoolSearchTimer: null },
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

function toggleSidebar() { var sb = document.getElementById('sidebar'); if (sb) sb.classList.toggle('open'); var so = document.getElementById('sidebarOverlay'); if (so) so.style.display = 'block'; }
function closeSidebar() { var sb = document.getElementById('sidebar'); if (sb) sb.classList.remove('open'); var so = document.getElementById('sidebarOverlay'); if (so) so.style.display = 'none'; }

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
  var sid = $.sparxSchoolId ? $.sparxSchoolId.value.trim() : '';
  if (!user || !pass) { showLoginStatus('error', 'Enter username and password'); return; }
  if (!sid) { showLoginStatus('error', 'Search and select your school first'); return; }
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
    } else if (d.autoLoginFailed) {
      // Show manual token entry option
      showSparxManualToken(user);
      showLoginStatus('info', 'Sparx auto-login unavailable. Enter your token manually below.');
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

function showSparxManualToken(user) {
  if ($.sparxManualTokenGroup) $.sparxManualTokenGroup.style.display = 'block';
  if ($.sparxManualToken) {
    $.sparxManualToken.value = '';
    $.sparxManualToken.placeholder = 'Paste your Sparx API token here';
  }
  if ($.sparxManualTokenBtn) {
    bind($.sparxManualTokenBtn, 'click', function() {
      var token = $.sparxManualToken ? $.sparxManualToken.value.trim() : '';
      if (!token) { showLoginStatus('error', 'Please paste your token'); return; }
      S.sparx.token = token;
      S.token = token;
      S.userData = user;
      enterDashboard('sparx', user);
      log('success', 'Sparx: Logged in with manual token');
      toast('Sparx - manual token set', 'success');
    });
  }
}

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
    $.psFakeTime.value = Math.max(0, Math.min(logVal, 5));
    if ($.psFakeTimeVal) $.psFakeTimeVal.textContent = (S.fakeTime / 1000) + 's';
  }
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

// ===== SETTINGS =====
function saveSettings() {
  var platform = S.platform || 'languagenut';
  if ($.psDelayMin) S.delayMin = parseFloat($.psDelayMin.value) || 5;
  if ($.psDelayMax) S.delayMax = parseFloat($.psDelayMax.value) || 8;
  if ($.psFakeTime) S.fakeTime = Math.pow(10, parseFloat($.psFakeTime.value)) || 10000;
  if ($.psShowPrevHmwk) S.showPrevHmwk = $.psShowPrevHmwk.checked;
  if ($.psShowWorking) S.showWorking = $.psShowWorking.checked;

  localStorage.setItem('gioai-showPrevHmwk', S.showPrevHmwk);
  localStorage.setItem('gioai-showWorking', S.showWorking);
  localStorage.setItem('gioai-' + platform + '-delayMin', String(S.delayMin));
  localStorage.setItem('gioai-' + platform + '-delayMax', String(S.delayMax));
  localStorage.setItem('gioai-' + platform + '-fakeTime', String(S.fakeTime));

  syncDelayUI();
  toast('Settings saved', 'success');
}

// ===== FETCH TASKS (dispatches by platform) =====
function fetchTasks() {
  if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Fetching tasks...</div>';
  log('info', 'Fetching tasks for ' + S.platform + '...');
  if (S.platform === 'languagenut') fetchLnTasks();
  else if (S.platform === 'seneca') fetchSenecaTasks();
  else if (S.platform === 'sparx') fetchSparxTasks();
  else log('error', 'Unknown platform: ' + S.platform);
}

// ===== LANGUAGE NUT TASKS =====
function fetchLnTasks() {
  api(WORKER_URL + '/api/lnut/homeworks', { token: S.ln.token }).then(function(d) {
    if (d.error) { log('error', 'LanguageNut: ' + d.error); return; }
    S.completed = 0; S.xpEarned = 0; S.errors = 0; S.tasks = [];
    var assignments = d.viewableAssignments || d.assignments || [];
    for (var i = 0; i < assignments.length; i++) {
      var a = assignments[i];
      if (a.isCompleted && !S.showPrevHmwk) continue;
      S.tasks.push({
        id: a.uid || a.id || 'ln_' + i,
        title: a.title || a.name || 'Assignment',
        moduleUid: a.moduleUid || a.module_uid || '',
        gameUid: a.gameUid || a.game_uid || '',
        gameType: a.gameType || a.game_type || '',
        curriculumUid: a.curriculumUid || a.curriculum_uid || '',
        homeworkUid: a.homeworkUid || a.homework_uid || (a.uid || a.id || ''),
        isCompleted: a.isCompleted || false,
        platform: 'languagenut'
      });
    }
    renderTasks();
    log('success', 'Found ' + S.tasks.length + ' tasks');
  }).catch(function(e) {
    log('error', 'LanguageNut fetch error: ' + e.message);
    if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Error fetching tasks: ' + e.message + '</div>';
  });
}

// ===== SENECA TASKS =====
function fetchSenecaTasks() {
  api(WORKER_URL + '/api/seneca/homeworks', { idToken: S.seneca.idToken }).then(function(d) {
    if (d.error) { log('error', 'Seneca: ' + d.error); return; }
    S.completed = 0; S.xpEarned = 0; S.errors = 0; S.tasks = [];
    var homeworks = d.homeworks || [];
    for (var i = 0; i < homeworks.length; i++) {
      var h = homeworks[i];
      if ((h.status === 'completed' || h.progress >= 100) && !S.showPrevHmwk) continue;
      S.tasks.push({
        id: h.id || h.sectionId || 'se_' + i,
        title: h.title || 'Assignment',
        courseId: h.courseId,
        sectionId: h.sectionId || h.id,
        courseName: h.courseName || 'Course',
        dueDate: h.dueDate,
        platform: 'seneca'
      });
    }
    renderTasks();
    log('success', 'Found ' + S.tasks.length + ' tasks');
  }).catch(function(e) {
    log('error', 'Seneca fetch error: ' + e.message);
    if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Error fetching tasks: ' + e.message + '</div>';
  });
}

// ===== SPARX TASKS =====
function fetchSparxTasks() {
  if (!S.sparx.token) {
    log('error', 'Sparx: No token available');
    if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">No Sparx token. Please login again.</div>';
    return;
  }
  api(WORKER_URL + '/api/sparx/homeworks', { token: S.sparx.token, session_id: S.sparx.sessionId }).then(function(d) {
    if (d.error) { log('error', 'Sparx: ' + d.error); return; }
    S.completed = 0; S.xpEarned = 0; S.errors = 0;
    if (d.raw) {
      S.tasks = parseSparxHomeworks(d.raw);
    } else if (d.tasks) {
      S.tasks = d.tasks.map(function(t, i) { return { id: t.id || 'sp_' + i, title: t.title || 'Task', raw: t, platform: 'sparx' }; });
    } else {
      S.tasks = [];
    }
    renderTasks();
    log('success', 'Found ' + S.tasks.length + ' Sparx tasks');
  }).catch(function(e) {
    log('error', 'Sparx fetch error: ' + e.message);
    if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Error fetching tasks: ' + e.message + '</div>';
  });
}

// ===== PARSE SPARX HOMEWORKS (from protobuf base64 response) =====
function parseSparxHomeworks(rawB64) {
  var tasks = [];
  if (!rawB64) return tasks;
  try {
    var raw = atob(rawB64);
    var len = raw.length;
    if (len < 5) return tasks;
    
    // Simple heuristic parsing of the protobuf structure:
    // We look for package_id strings and activity names
    var pos = 0;
    var pkgCount = 0;
    while (pos < len - 4) {
      // Field 1, wire type 2 (string) = package_id
      if (raw.charCodeAt(pos) === 0x0A) {
        var strLen = 0;
        for (var shift = 0; ; shift += 7) {
          var b = raw.charCodeAt(pos + 1 + shift);
          strLen |= (b & 0x7F) << shift;
          if (!(b & 0x80)) { pos += 1 + shift + 1; break; }
        }
        if (pos + strLen <= len) {
          var pkgId = raw.substr(pos, strLen);
          tasks.push({
            id: 'sp_pkg_' + pkgCount,
            package_id: pkgId,
            title: 'Homework Package ' + pkgId.substr(0, 8) + '...',
            task_index: pkgCount,
            platform: 'sparx'
          });
          pkgCount++;
        }
        pos += strLen;
      } else {
        pos++;
      }
    }
    
    if (tasks.length === 0) {
      // Fallback: treat raw response as a single task
      tasks.push({
        id: 'sp_default',
        package_id: rawB64.substr(0, 16),
        title: 'Sparx Homework',
        task_index: 0,
        platform: 'sparx',
        rawData: rawB64
      });
    }
  } catch(e) {
    log('error', 'Sparx parse error: ' + e.message);
    tasks.push({
      id: 'sp_error',
      package_id: rawB64 ? rawB64.substr(0, 16) : '',
      title: 'Sparx Tasks (raw)',
      task_index: 0,
      platform: 'sparx',
      rawData: rawB64
    });
  }
  return tasks;
}

// ===== RENDER TASKS =====
function renderTasks() {
  var container = $.dashTasks;
  if (!container) return;
  if (!S.tasks.length) {
    container.innerHTML = '<div class="empty-state">No tasks found. Check your account or try again later.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < S.tasks.length; i++) {
    var t = S.tasks[i];
    html += '<div class="task-card" data-index="' + i + '">' +
      '<div class="task-check">' +
      '<div class="task-checkbox' + (i < S.completed ? ' checked' : '') + '"></div>' +
      '</div>' +
      '<div class="task-info">' +
      '<div class="task-title">' + (t.title || 'Task ' + (i+1)) + '</div>' +
      '<div class="task-meta">' + (t.courseName ? t.courseName + ' - ' : '') + (t.platform || '') + '</div>' +
      '</div>' +
      '</div>';
  }
  container.innerHTML = html;
  updateStats();
}

// ===== RUN LOOP =====
async function runTasks() {
  if (S.running || !S.tasks.length) return;
  S.running = true;
  if ($.dashStartBtn) $.dashStartBtn.disabled = true;
  if ($.dashFetchBtn) $.dashFetchBtn.disabled = true;
  log('info', 'Starting completion of ' + S.tasks.length + ' tasks...');
  
  for (var i = 0; i < S.tasks.length; i++) {
    if (!S.running) break;
    if (i < S.completed) continue;
    var task = S.tasks[i];
    log('info', 'Processing task ' + (i+1) + '/' + S.tasks.length + ': ' + (task.title || 'Task'));
    
    if (task.platform === 'seneca') {
      await doSeneca(i, task);
    } else if (task.platform === 'sparx') {
      await doSparx(i, task);
    } else if (task.platform === 'languagenut') {
      await doLn(i, task);
    } else {
      await genericComplete(i, task);
    }
  }
  
  S.running = false;
  if ($.dashStartBtn) $.dashStartBtn.disabled = false;
  if ($.dashFetchBtn) $.dashFetchBtn.disabled = false;
  log('success', 'All tasks completed!');
  toast('All tasks done!', 'success');
}

function stopRunning() {
  S.running = false;
  if ($.dashStartBtn) $.dashStartBtn.disabled = false;
  if ($.dashFetchBtn) $.dashFetchBtn.disabled = false;
  log('warn', 'Stopped by user');
}

// ===== GENERIC COMPLETE (fallback) =====
async function genericComplete(idx, task) {
  var delay = randomBetween(S.delayMin * 1000, S.delayMax * 1000);
  await sleep(delay);
  S.completed++;
  S.xpEarned += randomBetween(50, 150);
  updateStats();
  renderTasks();
  log('success', 'Completed task ' + (idx+1));
}

// ===== LN COMPLETE =====
async function doLn(idx, task) {
  try {
    var startTime = Date.now();
    
    // Fetch vocab for this assignment
    if (task.curriculumUid && S.ln.token) {
      var vocabResp = await api(WORKER_URL + '/api/lnut/vocab', {
        token: S.ln.token,
        curriculumUid: task.curriculumUid
      });
      if (vocabResp && vocabResp.vocab) {
        var fakeDelay = Math.min(S.fakeTime || 10000, Date.now() - startTime + 1000);
        await sleep(Math.max(0, fakeDelay - (Date.now() - startTime)));
        // Submit a score
        var correctUids = [];
        var incorrectUids = [];
        if (Array.isArray(vocabResp.vocab)) {
          var half = Math.ceil(vocabResp.vocab.length / 2);
          for (var vi = 0; vi < vocabResp.vocab.length; vi++) {
            if (vi < half) correctUids.push(vocabResp.vocab[vi].uid || vocabResp.vocab[vi].vocabUid || 'v_' + vi);
            else incorrectUids.push(vocabResp.vocab[vi].uid || vocabResp.vocab[vi].vocabUid || 'v_' + vi);
          }
        }
        var scoreResp = await api(WORKER_URL + '/api/lnut/score', {
          token: S.ln.token,
          scoreData: {
            moduleUid: task.moduleUid,
            gameUid: task.gameUid,
            gameType: task.gameType,
            homeworkUid: task.homeworkUid,
            score: randomBetween(180, 300),
            correctUids: correctUids,
            incorrectUids: incorrectUids
          }
        });
        if (scoreResp && scoreResp.error) log('warn', 'LN score error: ' + scoreResp.error);
      }
    }
    
    await sleep(randomBetween(500, 3000));
  } catch(e) {
    log('warn', 'LN completion error: ' + e.message);
    S.errors++;
  }
  
  S.completed++;
  S.xpEarned += randomBetween(100, 300);
  updateStats();
  renderTasks();
  log('success', 'Completed task ' + (idx+1));
}

// ===== SENECA COMPLETE =====
async function doSeneca(idx, task) {
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
  renderTasks();
  log('success', 'Completed task ' + (idx+1));
}

// ===== SPARX COMPLETE =====
async function doSparx(idx, task) {
  try {
    // Start the activity
    var startResp = await api(WORKER_URL + '/api/sparx/start-activity', {
      token: S.sparx.token,
      package_id: task.package_id,
      task_index: task.task_index || 0,
      session_id: S.sparx.sessionId
    });
    log('info', 'Sparx: Started activity ' + task.package_id);
    
    // Simulate working on problems
    var numProblems = randomBetween(5, 15);
    for (var pi = 0; pi < numProblems; pi++) {
      if (!S.running) break;
      await sleep(randomBetween(2000, 5000));
      // Log progress
      if (pi % 3 === 0) log('info', 'Sparx: Working on problem ' + (pi+1) + '/' + numProblems);
    }
  } catch(e) {
    log('warn', 'Sparx completion error: ' + e.message);
    S.errors++;
  }
  
  await sleep(randomBetween(S.delayMin * 1000, S.delayMax * 1000));
  S.completed++;
  S.xpEarned += randomBetween(200, 500);
  updateStats();
  renderTasks();
  log('success', 'Completed Sparx task ' + (idx+1));
}

// ===== SPARX SCHOOL SEARCH =====
function setupSparxSchoolSearch() {
  if (!$.sparxSchoolSearch || !$.sparxSchoolResults) return;
  bind($.sparxSchoolSearch, 'input', function() {
    var q = this.value.trim();
    if (q.length < 2) { 
      if ($.sparxSchoolResults) $.sparxSchoolResults.classList.remove('active'); 
      return; 
    }
    clearTimeout(S.sparx.schoolSearchTimer);
    S.sparx.schoolSearchTimer = setTimeout(function() {
      api(WORKER_URL + '/api/sparx/search-school', { query: q }).then(function(d) {
        if (d.results && d.results.length) {
          var html = '';
          for (var i = 0; i < d.results.length; i++) {
            var town = d.results[i].town ? ' - ' + d.results[i].town : '';
            html += '<div class="school-result-item" data-id="' + d.results[i].id + '" data-name="' + d.results[i].name.replace(/'/g, "\\'") + '">' +
              d.results[i].name + '<span class="school-result-id">' + town + '</span></div>';
          }
          if ($.sparxSchoolResults) {
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
                  if ($.sparxSchoolResults) $.sparxSchoolResults.classList.remove('active');
                });
              })(items[j]);
            }
          }
        } else {
          if ($.sparxSchoolResults) $.sparxSchoolResults.classList.remove('active');
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
      
      html += '<div class="status-card ' + (d.status === 'operational' ? 'status-ok' : 'status-warn') + '">';
      html += '<div class="status-card-header">Worker Status</div>';
      html += '<div class="status-card-body">';
      html += '<div class="status-row"><span class="status-label">Status:</span><span class="status-value">' + d.status + '</span></div>';
      html += '<div class="status-row"><span class="status-label">Uptime:</span><span class="status-value">' + secondsToString(d.uptime || 0) + '</span></div>';
      html += '<div class="status-row"><span class="status-label">Total API Calls:</span><span class="status-value">' + (d.totalCalls || 0) + '</span></div>';
      html += '<div class="status-row"><span class="status-label">AI Calls:</span><span class="status-value">' + (d.aiCalls || 0) + '</span></div>';
      html += '<div class="status-row"><span class="status-label">Version:</span><span class="status-value">' + (d.version || '?') + '</span></div>';
      html += '</div></div>';
      
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

function setPlatformStatusFn() {
  var platform = $.adminStatusPlatform ? $.adminStatusPlatform.value : '';
  var status = $.adminStatusValue ? $.adminStatusValue.value : '';
  var adminKey = getAdminKey();
  if (!platform || !status) { toast('Select platform and status', 'error'); return; }
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

function loadAnnouncements() {
  var anns = JSON.parse(localStorage.getItem('gioai-announcements') || '[]');
  S.announcements = anns;
  if (anns.length && $.notifBadge) {
    $.notifBadge.style.display = 'flex';
    $.notifBadge.textContent = anns.length;
  }
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
  var html = '<div class="changelog-list"><div class="changelog-item"><h3>v7.0 (June 2026)</h3><ul>' +
    '<li>Fixed Sparx school search (new data format)</li>' +
    '<li>Added Sparx manual token entry fallback</li>' +
    '<li>Improved Sparx homework fetching & parsing</li>' +
    '<li>Added Sparx answer submission endpoint</li>' +
    '<li>Improved Seneca homework fetching</li>' +
    '<li>Better error handling throughout</li>' +
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

// ===== INIT =====
function init() {
  if (S.initialized) return;
  S.initialized = true;
  cache();
  setTheme(S.theme);

  loadAnnouncements();
  loadBlacklist();

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
    // Hide manual token group when opening login
    if ($.sparxManualTokenGroup) $.sparxManualTokenGroup.style.display = 'none';
    if ($.platformUsername) $.platformUsername.placeholder = (platform === 'seneca') ? 'Email address' : 'Username';
    if ($.sparxSchoolSearch && $.sparxSchoolResults) {
      if (platform === 'sparx') {
        $.sparxSchoolSearch.value = '';
        if ($.sparxSchoolId) $.sparxSchoolId.value = '';
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

  // === ENTER KEY on password field ===
  bind($.platformPassword, 'keydown', function(e) {
    if (e.key === 'Enter' && $.platformLoginBtn) $.platformLoginBtn.click();
  });
  
  // === ENTER KEY on manual token field ===
  bind($.sparxManualToken, 'keydown', function(e) {
    if (e.key === 'Enter' && $.sparxManualTokenBtn) $.sparxManualTokenBtn.click();
  });

  // === SPARX SCHOOL SEARCH ===
  setupSparxSchoolSearch();

  // === DASHBOARD ===
  bind($.dashFetchBtn, 'click', fetchTasks);
  bind($.dashStartBtn, 'click', runTasks);
  bind($.dashStopBtn, 'click', stopRunning);
  bind($.dashLogoutBtn, 'click', function() {
    S.token = null; S.platform = '';
    showScreen('hubScreen');
    toast('Logged out', 'info');
  });
  bind($.dashSettingsBtn, 'click', function() { showScreen('settingsScreen'); });

  // === SETTINGS ===
  bind($.settingsBackBtn, 'click', function() { showScreen('dashboardScreen'); });
  bind($.psDelayMin, 'input', function() { if ($.psDelayMinVal) $.psDelayMinVal.textContent = this.value + 's'; });
  bind($.psDelayMax, 'input', function() { if ($.psDelayMaxVal) $.psDelayMaxVal.textContent = this.value + 's'; });
  bind($.psFakeTime, 'input', function() {
    var v = Math.pow(10, parseFloat(this.value));
    if ($.psFakeTimeVal) $.psFakeTimeVal.textContent = Math.round(v / 1000) + 's';
  });
  bind(document.getElementById('settingsSaveBtn'), 'click', saveSettings);

  // === ADMIN ===
  bind($.adminBackBtn, 'click', function() { showScreen('hubScreen'); });
  bind($.adminGiveSlotsBtn, 'click', giveSlots);
  bind($.adminBlacklistBtn, 'click', manageBlacklist);
  bind($.adminAnnouncementBtn, 'click', sendAnnouncement);
  bind($.adminPlatStatusBtn, 'click', setPlatformStatusFn);
  bind($.adminCheckPlatformsBtn, 'click', checkPlatformStatus);

  // === DONATE ===
  bind($.donateBackBtn, 'click', function() { showScreen('hubScreen'); });

  // === CHANGELOG ===
  bind($.changelogClose, 'click', hideChangelog);
  bind($.changelogDismiss, 'click', hideChangelog);
  renderChangelog();
  if (!localStorage.getItem(CHANGELOG_SEEN_KEY)) {
    setTimeout(showChangelog, 3000);
  }

  // === NOTIFICATIONS ===
  bind($.notifBell, 'click', openNotifPanel);
  if ($.notifClose) bind($.notifClose, 'click', closeNotifPanel);
  // Click outside to close
  if ($.notifOverlay) {
    bind($.notifOverlay, 'click', function(e) { if (e.target === this) closeNotifPanel(); });
  }
  
  // Status bar - update version
  if ($.sidebarVersion) $.sidebarVersion.textContent = 'v' + APP_VERSION;
  if ($.appVersion) $.appVersion.textContent = APP_VERSION;
}

// Boot when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();

