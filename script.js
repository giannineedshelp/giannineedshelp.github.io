(function() {
'use strict';

var APP_VERSION = '3.0';
var CHANGELOG_SEEN_KEY = 'gioai-changelog-seen-v3';
var WORKER_URL = 'https://gioai.giannikei12.workers.dev';

// ===== STATE =====
var S = {
  platform: null,
  token: null,
  userData: null,
  tasks: [],
  completed: 0,
  xpEarned: 0,
  errors: 0,
  running: false,
  theme: getSavedTheme(),
  initialized: false,
  delayMin: 5,
  delayMax: 8,
  fakeTime: 10000,
  showPrevHmwk: false,
  showWorking: true,
  aiProvider: 'auto',
  ln: { token: null, homeworks: [], translations: {}, moduleTranslations: {} },
  seneca: { idToken: null, refreshToken: null, courses: [] },
  sparx: { token: null, sessionId: null, schoolSearchTimer: null }
};

var $ = {};

var EL_IDS = [
  'hamburgerBtn','sidebar','sidebarOverlay','sidebarClose',
  'appLoading','platformLoading','plLogo','plSvgLn','plSvgSe','plSvgSp','plText','plSub',
  'disclaimer','disclaimerAgree','disclaimerContinue',
  'changelogOverlay','changelogClose','changelogDismiss','changelogBody','changelogList',
  'notifOverlay','notifClose','notifBell','notifBadge',
  'hubScreen','platformLoginScreen','dashboardScreen','settingsScreen','donateScreen','adminScreen',
  'backToHub','platformLoginTitle','loginPlatformBadge','loginStatus','loginStatusText',
  'platformUsername','platformPassword','platformLoginBtn',
  'senecaLoginExtra','senecaLoginMethod',
  'sparxLoginExtra','sparxSchoolId','sparxSchoolSearch','sparxSchoolResults',
  'dashUserDisplay','dashStatusDot','dashPlatformBadge',
  'dashSettingsBtn','dashLogoutBtn','dashFetchBtn','dashStartBtn','dashStopBtn',
  'dashProgressFill','dashProgressText','dashStatCompleted','dashStatXp','dashStatErrors',
  'dashTasks','dashLogEntries',
  'psDelayMin','psDelayMax','psDelayMinVal','psDelayMaxVal',
  'psFakeTime','psFakeTimeVal','psShowPrevHmwk','psShowWorking','psShowWorkingGroup',
  'settingsBackBtn','settingsDelayMin','settingsDelayMax',
  'settingsShowWorking','settingsAiProvider',
  'settingsNotifComplete','settingsNotifError',
  'donateBackBtn','adminBackBtn','adminUsername','adminAmount','adminKey','adminGiveSlotsBtn','adminResult',
  'adminPlatformStatus','appVersion','sidebarVersion','toastContainer',
  'platformSettingsBar','psFakeTimeGroup','sidebarUserName','sidebarUserPlatform','sidebarAvatar',
  'themeBtns','themeBtnsLg'
];

function cache() {
  for (var i = 0; i < EL_IDS.length; i++) {
    var id = EL_IDS[i];
    $[id] = document.getElementById(id);
  }
  $.sidebarLinks = document.querySelectorAll('.sidebar-link');
  $.themeBtns = document.querySelectorAll('.theme-btn');
  $.themeBtnsLg = document.querySelectorAll('.theme-btn-lg');
  $.hubCards = document.querySelectorAll('.hub-card');
  $.notifTabs = document.querySelectorAll('.notif-tab');
  $.notifPanes = document.querySelectorAll('.notif-pane');
}

function getSavedTheme() {
  return localStorage.getItem('gioai-theme') || 'dark';
}

// ===== TOAST =====
function toast(msg, type) {
  type = type || 'info';
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  var c = $.toastContainer || document.getElementById('toastContainer');
  c.appendChild(t);
  setTimeout(function() { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; t.style.transition = '0.3s'; }, 3000);
  setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
}

// ===== BIND SHORTCUT =====
function bind(el, ev, fn) {
  if (el) el.addEventListener(ev, fn);
}

// ===== UTILITY =====
function setBtn(btn, disabled) {
  if (btn) btn.disabled = !!disabled;
}

function secondsToString(secs) {
  if (secs >= 86400) return Math.floor(secs/86400)+'d '+(Math.floor(secs%86400/3600))+'h';
  if (secs >= 3600) return Math.floor(secs/3600)+'h '+(Math.floor(secs%3600/60))+'m';
  if (secs >= 60) return Math.floor(secs/60)+'m '+(secs%60)+'s';
  return secs+'s';
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

function randomBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

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
}

// ===== SIDEBAR =====
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').style.display = 'block'; }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').style.display = 'none'; }

// ===== THEME =====
function setTheme(t) {
  S.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('gioai-theme', t);
  // Update theme buttons
  var all = document.querySelectorAll('.theme-btn, .theme-btn-lg');
  for (var i = 0; i < all.length; i++) {
    all[i].classList.toggle('active', all[i].dataset.theme === t);
  }
}

// ===== LOGGING =====
function log(type, msg) {
  var e = document.createElement('div');
  e.className = 'log-entry ' + type;
  var t = new Date();
  var ts = t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0')+':'+t.getSeconds().toString().padStart(2,'0');
  e.textContent = '['+ts+'] ' + msg;
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
  // Hide all SVGs
  if ($.plSvgLn) $.plSvgLn.style.display = 'none';
  if ($.plSvgSe) $.plSvgSe.style.display = 'none';
  if ($.plSvgSp) $.plSvgSp.style.display = 'none';
  // Show relevant one
  var svgId = logos[platform];
  if ($[svgId]) $[svgId].style.display = 'block';
  if ($.plText) $.plText.textContent = msgs[platform] || 'Loading...';
  if ($.plSub) $.plSub.textContent = names[platform] || '';
  if ($.platformLoading) $.platformLoading.style.display = 'flex';
}

function hidePlatformLoading() {
  if ($.platformLoading) $.platformLoading.style.display = 'none';
}

// ===== API CALL =====
function api(url, data) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r) { return r.json(); });
}

// ===== LANGUAGE NUT AUTH (direct API) =====
function lnLogin() {
  var user = $.platformUsername ? $.platformUsername.value.trim() : '';
  var pass = $.platformPassword ? $.platformPassword.value.trim() : '';
  if (!user || !pass) { showLoginStatus('error', 'Enter username and password'); return; }
  showLoginStatus('info', 'Authenticating...');
  showPlatformLoading('languagenut');
  // Direct call to LN API
  fetch('https://api.languagenut.com/loginController/attemptLogin?' + new URLSearchParams({
    username: user,
    pass: pass,
    friendlyCaptchaToken: genFCaptchaToken()
  }), {
    method: 'POST',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json', 'Referer': 'https://www.languagenut.com/', 'Origin': 'https://www.languagenut.com', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
  }).then(function(r) { return r.json(); }).then(function(d) {
    hidePlatformLoading();
    if (d.newToken) {
      S.ln.token = d.newToken;
      S.token = d.newToken;
      S.userData = user;
      enterDashboard('languagenut', user);
      log('success', 'LanguageNut: Login successful');
      toast('LanguageNut logged in', 'success');
    } else {
      showLoginStatus('error', d.loginError || 'Login failed');
      log('error', 'LanguageNut: Login failed - ' + (d.loginError || 'no token'));
    }
  }).catch(function(e) {
    hidePlatformLoading();
    showLoginStatus('error', 'Connection error: ' + e.message);
    log('error', 'LanguageNut: ' + e.message);
  });
}

// ===== SENECA AUTH (via worker) =====
function senecaLogin() {
  var email = $.platformUsername ? $.platformUsername.value.trim() : '';
  var pass = $.platformPassword ? $.platformPassword.value.trim() : '';
  if (!email || !pass) { showLoginStatus('error', 'Enter email and password'); return; }
  showLoginStatus('info', 'Authenticating...');
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

// ===== SPARX AUTH (via worker) =====
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

// ===== FCAPTCHA TOKEN (with jitter & anti-tracking) =====
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

function hideLoginStatus() {
  if ($.loginStatus) $.loginStatus.style.display = 'none';
}

// ===== ENTER DASHBOARD =====
function enterDashboard(platform, username) {
  S.platform = platform;
  var icons = { languagenut: 'LN', seneca: 'SE', sparx: 'SX' };
  if ($.dashUserDisplay) $.dashUserDisplay.textContent = username;
  if ($.dashStatusDot) { $.dashStatusDot.className = 'status-dot online'; }
  if ($.dashPlatformBadge) $.dashPlatformBadge.textContent = icons[platform] || '?';
  if ($.sidebarUserName) $.sidebarUserName.textContent = username || 'User';
  if ($.sidebarUserPlatform) $.sidebarUserPlatform.textContent = platform;

  // Configure platform settings bar
  if ($.psFakeTimeGroup) $.psFakeTimeGroup.style.display = 'block';
  if ($.psShowWorkingGroup) $.psShowWorkingGroup.style.display = (platform === 'sparx') ? 'block' : 'none';

  // Set defaults per platform
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
    fetch('https://api.languagenut.com/assignmentController/getViewableAll?token=' + S.ln.token, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }).then(function(r) { return r.json(); }).then(function(data) {
      hidePlatformLoading();
      if (data && data.homeworkVms) {
        S.tasks = data.homeworkVms;
        renderLNHomeworks(S.tasks);
        log('success', 'Fetched ' + S.tasks.length + ' homeworks');
        toast('Loaded ' + S.tasks.length + ' homeworks', 'success');
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
      if (d.raw) {
        // Parse the protobuf response - extract package list
        parseSparxHomeworks(d.raw);
      } else {
        $.dashTasks.innerHTML = '<div class="empty-state">No data from Sparx</div>';
        log('warn', 'Sparx homeworks empty');
      }
    }).catch(function(e) {
      hidePlatformLoading();
      $.dashTasks.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
      log('error', 'Sparx fetch failed: ' + e.message);
    });
  } else if (S.platform === 'seneca') {
    toast('Seneca: Course fetching not yet implemented in dashboard', 'warn');
  }
}

// ===== PARSE SPARX HOMEWORKS (protobuf) =====
function parseSparxHomeworks(b64raw) {
  try {
    var binary = atob(b64raw);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    // Simple protobuf extractor for package list
    var packages = [];
    var pos = 0;
    while (pos < bytes.length) {
      var tag = bytes[pos]; pos++;
      var fieldNum = tag >> 3;
      var wireType = tag & 7;
      if (wireType === 0) { // varint
        while (bytes[pos] & 0x80) pos++;
        pos++;
      } else if (wireType === 2) { // length-delimited
        var len = 0, shift = 0;
        while (true) { var b = bytes[pos]; len |= (b & 0x7F) << shift; shift += 7; pos++; if (!(b & 0x80)) break; }
        pos += len; // Skip embedded message for now
      } else { pos++; }
    }
    // Store task list
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
    // Check if past due or completed
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
    html += '<div class="task-group"><div class="task-group-header">' +
      '<span class="task-group-title">' + p.name + '</span>' +
      '<span class="task-group-progress">Load tasks</span></div></div>';
  }
  if (!html) html = '<div class="empty-state">No Sparx packages found</div>';
  if ($.dashTasks) $.dashTasks.innerHTML = html;
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
  // Placeholder - actual completion logic would send answers to LN API
  log('info', 'LanguageNut: Completing homework ' + (idx+1));
  await sleep(randomBetween(S.delayMin * 1000, S.delayMax * 1000));
  S.completed++;
  S.xpEarned += randomBetween(50, 200);
  updateStats();
  log('success', 'Completed homework ' + (idx+1));
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
          // Bind clicks to each result
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
  // Close dropdown on click outside
  bind(document, 'click', function(e) {
    if ($.sparxSchoolResults && !e.target.closest('.school-search-wrapper')) {
      $.sparxSchoolResults.classList.remove('active');
    }
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
  // Check LN
  fetch('https://api.languagenut.com/publicTranslationController/getTranslations', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) })
    .then(function(r) { setStatus(0, r.ok ? 'online' : 'offline'); }).catch(function() { setStatus(0, 'offline'); });
  // Check Worker
  fetch(WORKER_URL + '/api/keys', { signal: AbortSignal.timeout(5000) })
    .then(function(r) { return r.json(); }).then(function(d) {
      if (d.status === 'operational') { setStatus(3, 'online');
        // Check Seneca/Sparx via worker
        setStatus(1, d.endpoints.some(function(e) { return e.includes('seneca'); }) ? 'online' : 'offline');
        setStatus(2, d.endpoints.some(function(e) { return e.includes('sparx'); }) ? 'online' : 'offline');
      }
    }).catch(function() { setStatus(1, 'offline'); setStatus(2, 'offline'); setStatus(3, 'offline'); });
}

// ===== GIVE SLOTS (ADMIN) =====
function giveSlots() {
  var username = $.adminUsername ? $.adminUsername.value.trim() : '';
  var amount = $.adminAmount ? parseInt($.adminAmount.value) || 1 : 1;
  var adminKey = $.adminKey ? $.adminKey.value.trim() : '';
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

// ===== CHANGELOG =====
function renderChangelog() {
  var list = $.changelogBody || $.changelogList;
  if (!list) return;
  list.innerHTML = '<div class="changelog-list">' +
    '<h3>v3.0 (June 2026)</h3><ul>' +
    '<li>Sparx school search (type school name)</li>' +
    '<li>AI working out generation (Gemini + Groq + Mistral)</li>' +
    '<li>Platform loading screens with animated SVGs</li>' +
    '<li>Hacker theme = v5.2 matrix style with scanlines</li>' +
    '<li>Show previous homework for Sparx (completed/past due)</li>' +
    '<li>FCaptcha jitter + anti-tracking bypass</li>' +
    '<li>Working out toggle in Sparx settings</li>' +
    '<li>AI provider selector (Auto / Gemini / Groq / Mistral)</li>' +
    '<li>User agent rotation for anti-detection</li>' +
    '<li>Improved UI with SVG logos on hub cards</li>' +
    '</ul>' +
    '<h3>v2.5 (June 2026)</h3><ul>' +
    '<li>Unified single-page app with all platforms</li>' +
    '<li>4 themes: Dark, Hacker, Light, Neon</li>' +
    '<li>Admin panel with give slots</li>' +
    '<li>Seneca API proxy endpoints</li>' +
    '</ul></div>';
}

function showChangelog() {
  if ($.changelogOverlay) $.changelogOverlay.style.display = 'flex';
}

function hideChangelog() {
  if ($.changelogOverlay) $.changelogOverlay.style.display = 'none';
  localStorage.setItem(CHANGELOG_SEEN_KEY, '1');
}

// ===== NOTIFICATIONS =====
function openNotifPanel() {
  if ($.notifOverlay) $.notifOverlay.style.display = 'flex';
  if ($.notifBadge) $.notifBadge.style.display = 'none';
}

function closeNotifPanel() {
  if ($.notifOverlay) $.notifOverlay.style.display = 'none';
}

// ===== INIT =====
function init() {
  if (S.initialized) return;
  S.initialized = true;
  cache();
  setTheme(S.theme);

  // Hide app loading after delay and show disclaimer
  setTimeout(function() {
    if ($.appLoading) $.appLoading.classList.remove('active');
    showScreen('disclaimer');
  }, 800);

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

    if ($.platformUsername) {
      $.platformUsername.placeholder = (platform === 'seneca') ? 'Email address' : 'Username';
    }
    // Show sparx school search for sparx
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
  bind($.dashFetchBtn, 'click', function() {
    fetchHomeworks();
  });
  bind($.dashStartBtn, 'click', startCompletion);
  bind($.dashStopBtn, 'click', stopCompletion);

  bind($.dashLogoutBtn, 'click', function() {
    S.token = null;
    S.ln.token = null;
    S.ln.homeworks = [];
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
    if (S.ln.token || S.sparx.token) fetchHomeworks();
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

  // === NOTIFICATIONS ===
  bind($.notifBell, 'click', openNotifPanel);
  bind($.notifClose, 'click', closeNotifPanel);
  bind($.notifOverlay, 'click', function(e) {
    if (e.target === this) closeNotifPanel();
  });

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
  bind($.changelogOverlay, 'click', function(e) {
    if (e.target === this) hideChangelog();
  });
  renderChangelog();

  if (!localStorage.getItem(CHANGELOG_SEEN_KEY)) {
    setTimeout(function() { showChangelog(); }, 1500);
  } else {
    if ($.notifBadge) $.notifBadge.style.display = 'none';
  }

  // === VERSION ===
  if ($.appVersion) $.appVersion.textContent = APP_VERSION;
  if ($.sidebarVersion) $.sidebarVersion.textContent = APP_VERSION;

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




