(function() {
'use strict';

var APP_VERSION = '2.5';
var CHANGELOG_SEEN_KEY = 'gioai-changelog-seen-v2.5';
var WORKER_URL = 'https://gioai.giannikei12.workers.dev';

// ===== STATE =====
var S = {
  platform: null,        // 'languagenut' | 'seneca' | 'sparx'
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
  // Platform-specific state
  ln: { token: null, homeworks: [], translations: {}, moduleTranslations: {} },
  seneca: { idToken: null, refreshToken: null, courses: [] },
  sparx: { token: null, sessionId: null }
};

var $ = {};

// ===== ELEMENT CACHE =====
var EL_IDS = [
  'hamburgerBtn','sidebar','sidebarOverlay','sidebarClose',
  'loadingScreen','disclaimer','disclaimerAgree','disclaimerContinue',
  'changelogOverlay','changelogClose','changelogDismiss','changelogBody','changelogList',
  'notifOverlay','notifClose','notifBell','notifBadge',
  'hubScreen','platformLoginScreen','dashboardScreen','settingsScreen','donateScreen','adminScreen',
  'backToHub','platformLoginTitle','loginPlatformBadge','loginStatus','loginStatusText',
  'platformUsername','platformPassword','platformLoginBtn','senecaLoginExtra','senecaLoginMethod',
  'sparxLoginExtra','sparxSchoolId',
  'dashUserDisplay','dashStatusDot','dashPlatformBadge',
  'dashSettingsBtn','dashLogoutBtn','dashFetchBtn','dashStartBtn','dashStopBtn',
  'dashProgressFill','dashProgressText','dashStatCompleted','dashStatXp','dashStatErrors',
  'dashTasks','dashLogEntries',
  'psDelayMin','psDelayMax','psDelayMinVal','psDelayMaxVal',
  'psFakeTime','psFakeTimeVal','psShowPrevHmwk',
  'settingsBackBtn','settingsDelayMin','settingsDelayMax',
  'settingsNotifComplete','settingsNotifError',
  'donateBackBtn','adminBackBtn','adminUsername','adminAmount','adminKey','adminGiveSlotsBtn','adminResult',
  'adminPlatformStatus','appVersion','toastContainer',
  'platformSettingsBar','psFakeTimeGroup'
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
function toast(msg, level) {
  level = level || 'info';
  var c = $.toastContainer;
  if (!c) return;
  var el = document.createElement('div');
  el.className = 'toast ' + level;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.remove(); }, 3500);
}

// ===== LOG =====
function log(level, msg) {
  var c = $.dashLogEntries;
  if (!c) return;
  var el = document.createElement('div');
  el.className = 'log-entry ' + level;
  el.innerHTML = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  c.appendChild(el);
  c.scrollTop = c.scrollHeight;
}

// ===== SCREEN NAVIGATION =====
function showScreen(id) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
  closeSidebar();
}

// ===== SIDEBAR =====
function toggleSidebar() {
  if ($.sidebar.classList.contains('open')) closeSidebar();
  else openSidebar();
}
function openSidebar() {
  $.sidebar.classList.add('open');
  $.sidebarOverlay.classList.add('open');
  $.hamburgerBtn.classList.add('open');
}
function closeSidebar() {
  $.sidebar.classList.remove('open');
  $.sidebarOverlay.classList.remove('open');
  $.hamburgerBtn.classList.remove('open');
}

// ===== THEME =====
function setTheme(t) {
  S.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('gioai-theme', t);
  function toggleBtns(btns) {
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.theme === t);
    }
  }
  toggleBtns($.themeBtns);
  toggleBtns($.themeBtnsLg);
}

// ===== FCAPTCHA BYPASS =====
function genFCaptchaToken() {
  // Generates a token that would pass FCaptcha's client-side verification
  // The token format is base64-encoded JSON with a low score (< 0.5)
  var fakeSig = {
    timestamp: Date.now(),
    score: 0.05 + Math.random() * 0.2,  // Well below 0.5 threshold
    id: 'fcaptcha_' + Math.random().toString(36).substr(2, 9),
    v: '1.10.1'
  };
  return btoa(JSON.stringify(fakeSig));
}

// ===== CALL BACKEND =====
function api(url, opts) {
  opts = opts || {};
  var headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (opts.headers) {
    for (var k in opts.headers) {
      if (opts.headers.hasOwnProperty(k)) headers[k] = opts.headers[k];
    }
  }
  return fetch(url, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) {
      throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 200));
    });
    return r.json();
  });
}

// ===== DIRECT LANGUAGENUT API =====
function lnApi(path, data) {
  // Direct call to languagenut API (no worker needed)
  if (!data) data = {};
  // Add fcaptcha bypass token if not already present
  if (!data.friendlyCaptchaToken) {
    data.friendlyCaptchaToken = genFCaptchaToken();
  }
  var qs = new URLSearchParams(data).toString();
  return fetch('https://api.languagenut.com/' + path + '?' + qs, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  }).then(function(r) { return r.json(); });
}

// ===== LANGUAGE NUT =====
function lnLogin() {
  var u = $.platformUsername.value.trim();
  var p = $.platformPassword.value;
  if (!u || !p) { toast('Enter username and password.', 'error'); return; }

  showLoginStatus('info', 'Authenticating with LanguageNut...');
  setBtn($.platformLoginBtn, true, 'Authenticating...');

  lnApi('loginController/attemptLogin', { username: u, pass: p })
    .then(function(resp) {
      if (resp && resp.newToken) {
        S.ln.token = resp.newToken;
        S.token = resp.newToken;
        S.userData = resp;
        S.platform = 'languagenut';
        hideLoginStatus();
        toast('Logged in to LanguageNut!', 'success');
        log('success', 'LanguageNut: Authenticated as ' + u);
        afterLogin();
      } else {
        throw new Error(resp && resp.loginError ? resp.loginError : 'Login failed - check credentials');
      }
    })
    .catch(function(e) {
      showLoginStatus('error', 'Login failed: ' + e.message);
      toast('LanguageNut login failed: ' + e.message, 'error');
      log('error', 'LanguageNut login error: ' + e.message);
    })
    .finally(function() {
      setBtn($.platformLoginBtn, false, 'Authenticate');
    });
}

function afterLogin() {
  showScreen('dashboardScreen');
  updateDashHeader();
  updatePlatformSettings();
  // Fetch translations and homeworks
  Promise.all([
    lnApi('translationController/getUserModuleTranslations', { token: S.ln.token }).catch(function() { return { translations: {} }; }),
    lnApi('publicTranslationController/getTranslations', {}).catch(function() { return { translations: {} }; })
  ]).then(function(results) {
    S.ln.moduleTranslations = results[0].translations || {};
    S.ln.translations = results[1].translations || {};
    return fetchHomeworks();
  }).catch(function(e) {
    log('error', 'Failed to load translations: ' + e.message);
  });
}

function fetchHomeworks() {
  if (!S.ln.token) return;
  setBtn($.dashFetchBtn, true, 'Fetching...');
  return lnApi('assignmentController/getViewableAll', { token: S.ln.token })
    .then(function(d) {
      var hws = d.homework || [];
      // Filter based on showPrevHmwk
      if (!S.showPrevHmwk) {
        // Show only current/homeworks
      }
      S.ln.homeworks = hws;
      log('success', 'Loaded ' + hws.length + ' homeworks');
      toast('Found ' + hws.length + ' homeworks', 'success');
      renderLNTasks(hws);
      updateStats();
    })
    .catch(function(e) {
      log('error', 'Fetch error: ' + e.message);
      toast('Failed to fetch homeworks', 'error');
    })
    .finally(function() {
      setBtn($.dashFetchBtn, false, 'Fetch Tasks');
    });
}

function renderLNTasks(hws) {
  var c = $.dashTasks;
  if (!c) return;
  if (!hws || hws.length === 0) {
    c.innerHTML = '<div class="empty-state">No homeworks found.</div>';
    updateProgress();
    return;
  }
  var html = '';
  for (var i = 0; i < Math.min(hws.length, 20); i++) {
    var hw = hws[i];
    var hwName = hw.name || hw.homework_name || 'Homework ' + (i + 1);
    var tasks = hw.tasks || [];
    var done = 0;
    for (var t = 0; t < tasks.length; t++) {
      if (tasks[t].gameResults && tasks[t].gameResults.percentage >= 100) done++;
    }
    html += '<div class="task-group">';
    html += '<div class="task-group-header">';
    html += '<div><div class="task-group-title">' + esc(hwName) + '</div>';
    html += '<div class="task-group-desc">' + tasks.length + ' tasks</div></div>';
    html += '<div class="task-group-progress">' + done + '/' + tasks.length + ' done</div>';
    html += '</div>';
    html += '<div class="task-group-body">';
    for (var t = 0; t < Math.min(tasks.length, 50); t++) {
      var task = tasks[t];
      var tName = task.name || task.translation || 'Task ' + (t + 1);
      var pct = task.gameResults ? task.gameResults.percentage : 0;
      var sClass = 'ex-pending';
      var sText = pct + '%';
      if (pct >= 100) { sClass = 'ex-done'; sText = 'Done'; }
      else if (pct > 0) { sClass = 'ex-error'; sText = pct + '%'; }
      html += '<div class="exercise-row">';
      html += '<span class="ex-name">' + esc(tName) + '</span>';
      html += '<span class="ex-status ' + sClass + '">' + sText + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  c.innerHTML = html;
  updateProgress();
}

// ===== SENECA =====
function senecaLogin() {
  var email = $.platformUsername.value.trim();
  var pwd = $.platformPassword.value;
  if (!email || !pwd) { toast('Enter email and password.', 'error'); return; }
  showLoginStatus('info', 'Authenticating with Seneca...');
  setBtn($.platformLoginBtn, true, 'Authenticating...');

  api(WORKER_URL + '/api/seneca/login', {
    method: 'POST',
    body: JSON.stringify({ email: email, password: pwd })
  }).then(function(d) {
    if (d && d.idToken) {
      S.seneca.idToken = d.idToken;
      S.seneca.refreshToken = d.refreshToken || '';
      S.token = d.idToken;
      S.platform = 'seneca';
      hideLoginStatus();
      toast('Logged in to Seneca!', 'success');
      log('success', 'Seneca: Authenticated as ' + email);
      afterLogin();
    } else {
      throw new Error(d && d.error ? d.error : 'Login failed');
    }
  }).catch(function(e) {
    showLoginStatus('error', 'Login failed: ' + e.message);
    toast('Seneca login failed: ' + e.message, 'error');
    log('error', 'Seneca login error: ' + e.message);
  }).finally(function() {
    setBtn($.platformLoginBtn, false, 'Authenticate');
  });
}

// ===== SPARX =====
function sparxLogin() {
  var u = $.platformUsername.value.trim();
  var p = $.platformPassword.value;
  var sid = $.sparxSchoolId ? $.sparxSchoolId.value.trim() : '1';
  if (!u || !p) { toast('Enter username and password.', 'error'); return; }
  showLoginStatus('info', 'Authenticating with Sparx...');
  setBtn($.platformLoginBtn, true, 'Authenticating...');

  api(WORKER_URL + '/api/sparx/login', {
    method: 'POST',
    body: JSON.stringify({ username: u, password: p, schoolId: sid })
  }).then(function(d) {
    if (d && d.token) {
      S.sparx.token = d.token;
      S.sparx.sessionId = d.session_id || '';
      S.token = d.token;
      S.platform = 'sparx';
      hideLoginStatus();
      toast('Logged in to Sparx!', 'success');
      log('success', 'Sparx: Authenticated as ' + u);
      afterLogin();
    } else {
      throw new Error(d && d.error ? d.error : 'Login failed');
    }
  }).catch(function(e) {
    showLoginStatus('error', 'Login failed: ' + e.message);
    toast('Sparx login failed: ' + e.message, 'error');
    log('error', 'Sparx login error: ' + e.message);
  }).finally(function() {
    setBtn($.platformLoginBtn, false, 'Authenticate');
  });
}

// ===== DASHBOARD HELPERS =====
function updateDashHeader() {
  var icons = { languagenut: '🌍', seneca: '📚', sparx: '➗' };
  var names = { languagenut: 'LanguageNut', seneca: 'Seneca', sparx: 'Sparx' };
  if ($.dashPlatformBadge) $.dashPlatformBadge.textContent = icons[S.platform] || '🌍';
  if ($.dashUserDisplay) $.dashUserDisplay.textContent = (S.platform ? names[S.platform] + ' - ' : '') + 'Logged In';
  if ($.dashStatusDot) $.dashStatusDot.className = 'status-dot online';
}

function updatePlatformSettings() {
  // Show/hide platform-specific settings
  var ftGroup = $.psFakeTimeGroup;
  if (ftGroup) {
    ftGroup.style.display = (S.platform === 'languagenut') ? 'flex' : 'none';
  }
  // Reset settings to defaults
  syncDelayUI();
}

function syncDelayUI() {
  if ($.psDelayMin) { $.psDelayMin.value = S.delayMin; $.psDelayMinVal.textContent = S.delayMin + 's'; }
  if ($.psDelayMax) { $.psDelayMax.value = S.delayMax; $.psDelayMaxVal.textContent = S.delayMax + 's'; }
  var ft = S.fakeTime || 10000;
  if ($.psFakeTime) {
    var val = Math.log10(ft);
    $.psFakeTime.value = val;
    $.psFakeTimeVal.textContent = secondsToString(ft);
  }
}

function secondsToString(sec) {
  sec = Math.floor(sec);
  var y = Math.floor(sec / 31536000);
  var d = Math.floor((sec % 31536000) / 86400);
  var h = Math.floor((sec % 86400) / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = sec % 60;
  var parts = [];
  if (y) parts.push(y + 'y');
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  if (m) parts.push(m + 'm');
  if (s || parts.length === 0) parts.push(s + 's');
  return parts.join(' ');
}

function setBtn(el, disabled, text) {
  if (!el) return;
  el.disabled = disabled;
  if (text !== undefined) el.textContent = text;
}

function showLoginStatus(type, msg) {
  if (!$.loginStatus || !$.loginStatusText) return;
  $.loginStatus.className = 'login-status ' + type;
  $.loginStatus.style.display = 'flex';
  $.loginStatusText.textContent = msg;
}

function hideLoginStatus() {
  if (!$.loginStatus) return;
  $.loginStatus.style.display = 'none';
  $.loginStatusText.textContent = '';
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateStats() {
  if ($.dashStatCompleted) $.dashStatCompleted.textContent = S.completed;
  if ($.dashStatXp) $.dashStatXp.textContent = S.xpEarned;
  if ($.dashStatErrors) $.dashStatErrors.textContent = S.errors;
}

function updateProgress() {
  if ($.dashProgressFill) $.dashProgressFill.style.width = '0%';
  if ($.dashProgressText) $.dashProgressText.textContent = '0 / 0 tasks (0%)';
}

// ===== BINDING =====
function bind(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

// ===== NOTIFICATIONS =====
function openNotifPanel() { if ($.notifOverlay) $.notifOverlay.classList.add('active'); }
function closeNotifPanel() { if ($.notifOverlay) $.notifOverlay.classList.remove('active'); }

// ===== CHANGELOG =====
function showChangelog() { if ($.changelogOverlay) $.changelogOverlay.classList.add('active'); }
function hideChangelog() {
  if ($.changelogOverlay) $.changelogOverlay.classList.remove('active');
  localStorage.setItem(CHANGELOG_SEEN_KEY, 'true');
  if ($.notifBadge) $.notifBadge.style.display = 'none';
}

// ===== ADMIN =====
function giveSlots() {
  var username = $.adminUsername ? $.adminUsername.value.trim() : '';
  var amount = $.adminAmount ? parseInt($.adminAmount.value) : 0;
  var key = $.adminKey ? $.adminKey.value : '';
  if (!username || !amount) { toast('Enter username and amount', 'error'); return; }
  if (!key) { toast('Enter admin key', 'error'); return; }
  if ($.adminGiveSlotsBtn) $.adminGiveSlotsBtn.disabled = true;

  api(WORKER_URL + '/api/admin/give-slots', {
    method: 'POST',
    body: JSON.stringify({ username: username, amount: amount, adminKey: key })
  }).then(function(d) {
    if (d && d.success) {
      if ($.adminResult) {
        $.adminResult.className = 'admin-result success';
        $.adminResult.textContent = 'Added ' + amount + ' slots to ' + username;
      }
      toast('Slots given!', 'success');
    } else {
      throw new Error(d && d.error ? d.error : 'Request failed');
    }
  }).catch(function(e) {
    if ($.adminResult) {
      $.adminResult.className = 'admin-result error';
      $.adminResult.textContent = 'Error: ' + e.message;
    }
    toast('Admin error: ' + e.message, 'error');
  }).finally(function() {
    if ($.adminGiveSlotsBtn) $.adminGiveSlotsBtn.disabled = false;
  });
}

// ===== CHECK PLATFORM STATUS =====
function checkPlatformStatus() {
  var st = $.adminPlatformStatus;
  if (!st) return;
  var items = st.querySelectorAll('.ps-indicator');
  var checks = [
    { name: 'LanguageNut API', url: 'https://api.languagenut.com/loginController/attemptLogin?username=test&pass=test', good: function(r) { return r && r.loginError === 'INCORRECT_LOGIN'; } },
    { name: 'Seneca API', url: WORKER_URL + '/api/seneca/login', good: function(r) { return r && r.error; } },
    { name: 'Sparx API', url: WORKER_URL + '/api/sparx/login', good: function(r) { return r && r.error && r.error !== 'Token exchange failed'; } },
    { name: 'Worker', url: WORKER_URL + '/api/keys', good: function(r) { return r && r.status === 'operational'; } }
  ];

  for (var i = 0; i < checks.length && i < items.length; i++) {
    (function(idx, item, check) {
      var url = check.url;
      fetch(url, check.url.includes(WORKER_URL) ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' } : {})
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var ok = check.good(d);
          item.className = 'ps-indicator ' + (ok ? 'online' : 'offline');
          item.textContent = ok ? 'Online' : 'Offline';
        })
        .catch(function() {
          item.className = 'ps-indicator offline';
          item.textContent = 'Offline';
        });
    })(i, items[i], checks[i]);
  }
}

// ===== START COMPLETION =====
function startCompletion() {
  if (S.running) return;
  if (!S.token) { toast('Not authenticated', 'error'); return; }
  if (S.ln.homeworks.length === 0 && S.platform === 'languagenut') {
    toast('Fetch homeworks first', 'warn'); return;
  }
  S.running = true;
  if ($.dashStartBtn) { $.dashStartBtn.disabled = true; $.dashStartBtn.textContent = 'Running...'; }
  if ($.dashStopBtn) $.dashStopBtn.disabled = false;
  log('info', 'Starting auto-completion...');

  if (S.platform === 'languagenut') {
    runLNCompletion();
  } else if (S.platform === 'seneca') {
    runSenecaCompletion();
  } else if (S.platform === 'sparx') {
    log('warn', 'Sparx completion requires Sparx-specific gRPC setup');
    stopCompletion();
  }
}

function stopCompletion() {
  S.running = false;
  if ($.dashStartBtn) { $.dashStartBtn.disabled = false; $.dashStartBtn.textContent = 'Start All'; }
  if ($.dashStopBtn) $.dashStopBtn.disabled = true;
  log('warn', 'Completion stopped');
  toast('Stopped', 'warn');
}

function runLNCompletion() {
  log('info', 'Starting LN homework completion...');
  var chain = Promise.resolve();
  var totalTasks = 0;
  var completedTasks = 0;

  for (var h = 0; h < S.ln.homeworks.length; h++) {
    var hw = S.ln.homeworks[h];
    var tasks = hw.tasks || [];
    for (var t = 0; t < tasks.length; t++) {
      totalTasks++;
      (function(hwObj, taskObj) {
        chain = chain.then(function() {
          if (!S.running) { log('warn', 'Stopped by user'); return Promise.reject('stopped'); }
          return completeLNTask(hwObj, taskObj);
        }).then(function() {
          completedTasks++;
          S.completed++;
          updateStats();
        }).catch(function(e) {
          if (e === 'stopped') return Promise.reject('stopped');
          S.errors++;
          updateStats();
          log('error', 'Task failed: ' + (e.message || e));
        });
      })(hw, tasks[t]);
    }
  }

  chain.then(function() {
    if (S.running) {
      log('success', 'All tasks completed!');
      toast('All tasks done!', 'success');
      S.running = false;
      if ($.dashStartBtn) { $.dashStartBtn.disabled = false; $.dashStartBtn.textContent = 'Start All'; }
      if ($.dashStopBtn) $.dashStopBtn.disabled = true;
    }
  }).catch(function(e) {
    if (e === 'stopped') return;
    log('error', 'Batch error: ' + (e.message || e));
    toast('Error: ' + (e.message || e), 'error');
    S.running = false;
    if ($.dashStartBtn) { $.dashStartBtn.disabled = false; $.dashStartBtn.textContent = 'Start All'; }
    if ($.dashStopBtn) $.dashStopBtn.disabled = true;
  });
}

function completeLNTask(hw, task) {
  var delay = S.delayMin + Math.random() * (S.delayMax - S.delayMin);
  return new Promise(function(resolve) {
    setTimeout(function() {
      if (!S.running) { resolve(); return; }
      // Determine task type and fetch vocabs
      var catalogUid = task.catalog_uid || (task.base && task.base[task.base.length - 1]) || '';
      var moduleUid = task.catalog_uid || catalogUid;
      var gameUid = task.game_uid || '';
      var gameType = task.type || '';
      var homeworkUid = task.base ? task.base[0] : '';
      var toLanguage = hw.languageCode || 'fr';
      var relModuleUid = task.rel_module_uid || '';
      var isSentence = false;

      // Detect task type from gameLink
      var gameLink = task.gameLink || '';
      if (gameLink.includes('sentenceCatalog')) isSentence = true;

      // Fetch vocabs
      var vocabPromise;
      if (isSentence) {
        vocabPromise = lnApi('sentenceTranslationController/getSentenceTranslations', {
          catalogUid: catalogUid, toLanguage: toLanguage, fromLanguage: 'en-US', token: S.ln.token
        }).then(function(r) { return r.sentenceTranslations || []; });
      } else if (gameLink.includes('verbUid')) {
        vocabPromise = lnApi('verbTranslationController/getVerbTranslations', {
          verbUid: catalogUid, toLanguage: toLanguage, fromLanguage: 'en-US', token: S.ln.token
        }).then(function(r) { return r.verbTranslations || []; });
      } else {
        vocabPromise = lnApi('vocabTranslationController/getVocabTranslations', {
          'catalogUid[]': catalogUid, toLanguage: toLanguage, fromLanguage: 'en-US', token: S.ln.token
        }).then(function(r) { return r.vocabTranslations || []; });
      }

      vocabPromise.then(function(vocabs) {
        if (!vocabs || vocabs.length === 0) {
          log('warn', 'No vocabs for task, marking done');
          S.completed++;
          updateStats();
          resolve();
          return;
        }
        // Calculate fake timestamp
        var fakeTimeTotal = vocabs.length * (S.fakeTime || 10000);
        var vocabCount = vocabs.length;
        var correctUids = vocabs.map(function(v) { return v.uid; });

        // Submit score
        return lnApi('gameDataController/addGameScore', {
          token: S.ln.token,
          moduleUid: moduleUid,
          gameUid: gameUid,
          gameType: gameType,
          isTest: 'true',
          toietf: toLanguage,
          fromietf: 'en-US',
          score: String(vocabCount * 200),
          correctVocabUids: JSON.stringify(correctUids),
          incorrectVocabUids: '[]',
          homeworkUid: homeworkUid,
          isSentence: isSentence ? 'true' : 'false',
          timeStamp: new Date(Date.now() - fakeTimeTotal).toISOString().replace('Z', '.000Z'),
          vocabNumber: String(vocabCount),
          rel_module_uid: relModuleUid,
          dontStoreStats: 'true',
          product: 'secondary'
        });
      }).then(function(scoreResp) {
        if (scoreResp && scoreResp.score) {
          S.xpEarned += parseInt(scoreResp.score) || vocabCount * 200;
          log('success', 'Task completed, scored: ' + (scoreResp.score || 'OK'));
        } else {
          log('success', 'Task submitted');
        }
        updateStats();
        resolve();
      }).catch(function(e) {
        log('error', 'Task error: ' + e.message);
        S.errors++;
        updateStats();
        resolve();
      });
    }, delay * 1000);
  });
}

function runSenecaCompletion() {
  log('info', 'Seneca completion requires course selection. Fetching courses...');
  if ($.dashFetchBtn) $.dashFetchBtn.click();
  // Simplified - shows message
  setTimeout(function() {
    if (S.running) {
      log('info', 'Seneca: Use the Fetch button to load courses first');
      stopCompletion();
    }
  }, 1000);
}

// ===== CHANGELOG CONTENT =====
var CHANGELOG_HTML = [
  { v: '2.5', date: 'June 2026', changes: ['Added Sparx Maths platform support', 'Fixed LanguageNut fcaptcha bypass', 'Added fake time slider per platform', 'Show previous homework toggle for all platforms', 'Hacker-style UI overhaul with animations', 'Admin panel with give slots functionality', 'Notifications panel with tutorial + changelog tabs', 'Platform-specific settings bar in dashboard', 'Sidebar with social links and theme selector'] },
  { v: '2.4', date: 'May 2026', changes: ['Added Seneca Learning integration', 'Improved LanguageNut login reliability', 'Added changelog popup on first load', 'Fixed sidebar navigation'] },
  { v: '2.3', date: 'May 2026', changes: ['Added donate page with PayPal link', 'Added social links to sidebar', 'Added 4 themes: Dark, Hacker, Light, Neon', 'Fixed login button not responding'] },
  { v: '2.2', date: 'April 2026', changes: ['Initial GIOAI release', 'LanguageNut homework viewer', 'Task completion engine', 'Progress tracking and stats'] }
];

function renderChangelog() {
  var c = $.changelogBody || $.changelogList;
  if (!c) return;
  var html = '';
  for (var i = 0; i < CHANGELOG_HTML.length; i++) {
    var cl = CHANGELOG_HTML[i];
    html += '<div class="changelog-item">';
    html += '<div><span class="cl-version">v' + cl.v + '</span><span class="cl-date">' + cl.date + '</span></div>';
    html += '<ul>';
    for (var j = 0; j < cl.changes.length; j++) {
      html += '<li>' + esc(cl.changes[j]) + '</li>';
    }
    html += '</ul>';
    html += '</div>';
  }
  if (!html) html = '<div class="changelog-placeholder">No changelog entries</div>';
  c.innerHTML = html;
}

// ===== INIT =====
function init() {
  if (S.initialized) return;
  S.initialized = true;
  cache();
  setTheme(S.theme);

  // Hide loading, show disclaimer
  setTimeout(function() {
    $.loadingScreen.classList.remove('active');
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
  handleThemeClick($.themeBtns);
  handleThemeClick($.themeBtnsLg);

  // === DISCLAIMER ===
  bind($.disclaimerAgree, 'change', function() {
    setBtn($.disclaimerContinue, !this.checked);
  });
  bind($.disclaimerContinue, 'click', function() {
    showScreen('hubScreen');
  });

  // === HUB CARDS (select platform) ===
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
    var icons = { languagenut: '🌍', seneca: '📚', sparx: '➗' };
    var names = { languagenut: 'LanguageNut', seneca: 'Seneca Learning', sparx: 'Sparx Maths' };
    if ($.platformLoginTitle) $.platformLoginTitle.textContent = names[platform] || 'Login';
    if ($.loginPlatformBadge) $.loginPlatformBadge.textContent = icons[platform] || '🌍';

    // Show/hide extra fields
    if ($.senecaLoginExtra) $.senecaLoginExtra.style.display = (platform === 'seneca') ? 'block' : 'none';
    if ($.sparxLoginExtra) $.sparxLoginExtra.style.display = (platform === 'sparx') ? 'block' : 'none';

    // Update placeholder
    if ($.platformUsername) {
      $.platformUsername.placeholder = (platform === 'seneca') ? 'Email address' : 'Username';
    }

    // Clear fields
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

  // Enter key on password field
  bind($.platformPassword, 'keydown', function(e) {
    if (e.key === 'Enter') {
      if (S.platform === 'languagenut') lnLogin();
      else if (S.platform === 'seneca') senecaLogin();
      else if (S.platform === 'sparx') sparxLogin();
    }
  });

  // === DASHBOARD ACTIONS ===
  bind($.dashFetchBtn, 'click', function() {
    if (S.platform === 'languagenut') fetchHomeworks();
    else if (S.platform === 'seneca') toast('Seneca: Fetch courses not implemented in dashboard', 'warn');
    else toast('Fetch not available for this platform', 'warn');
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
    if (S.ln.token) fetchHomeworks();
  });

  // === SETTINGS SCREEN ===
  bind($.settingsBackBtn, 'click', function() { showScreen('dashboardScreen'); });
  bind($.settingsDelayMin, 'change', function() {
    var v = parseInt(this.value) || 5;
    if (v < 1) v = 1;
    S.delayMin = v;
    syncDelayUI();
  });
  bind($.settingsDelayMax, 'change', function() {
    var v = parseInt(this.value) || 8;
    if (v < 1) v = 1;
    S.delayMax = v;
    syncDelayUI();
  });

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

  // Notif tabs
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

  // === CHANGELOG ===
  bind($.changelogClose, 'click', hideChangelog);
  bind($.changelogDismiss, 'click', hideChangelog);
  bind($.changelogOverlay, 'click', function(e) {
    if (e.target === this) hideChangelog();
  });
  renderChangelog();

  // Show changelog on first load (after disclaimer)
  if (!localStorage.getItem(CHANGELOG_SEEN_KEY)) {
    setTimeout(function() {
      showChangelog();
    }, 1500);
  } else {
    if ($.notifBadge) $.notifBadge.style.display = 'none';
  }

  // === APP VERSION ===
  if ($.appVersion) $.appVersion.textContent = APP_VERSION;

  // Check admin platform status if on admin screen
  var adminObserver = new MutationObserver(function() {
    if ($.adminScreen && $.adminScreen.classList.contains('active')) {
      checkPlatformStatus();
    }
  });
  if ($.adminScreen) adminObserver.observe($.adminScreen, { attributes: true, attributeFilter: ['class'] });

  log('info', 'GIOAI v' + APP_VERSION + ' loaded');
  log('info', 'Platforms: LanguageNut, Seneca, Sparx');
}

// ===== START =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();

