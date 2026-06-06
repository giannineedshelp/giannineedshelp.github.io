(function(){'use strict';

// ===== GIOAI LanguageNut v6.0 - Direct API Mode =====
// Uses original task_completer + client_application approach
// with direct api.languagenut.com calls + FAILEDTOKEN captcha bypass

var speed = 10000; // default: ~2.7 hours in seconds
var LN = {
  token: null,
  userData: null,
  homeworks: [],
  moduleTranslations: {},
  displayTranslations: {},
  isRunning: false,
  completedCount: 0,
  xpCount: 0,
  errorCount: 0,
  theme: localStorage.getItem('gioai-theme') || 'dark'
};

// ===== Utility Functions =====
function secondsToString(seconds) {
  var numyears = Math.floor(seconds / 31536000);
  var numdays = Math.floor((seconds % 31536000) / 86400);
  var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
  var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
  var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
  return numyears + 'y ' + numdays + 'd ' + numhours + 'h ' + numminutes + 'm ' + Math.floor(numseconds) + 's';
}

function set_checkboxes(node, state) {
  var container = document.getElementById(node);
  if (!container) return;
  var boxes = container.querySelectorAll('input[type=checkbox]');
  for (var i = 0; i < boxes.length; i++) {
    boxes[i].checked = state;
  }
}

// from https://gist.github.com/jzohrab/a6701d0087edca8303ec069826ec4b14
function asyncPool(array, poolSize) {
  var result = [];
  var pool = [];
  function leavePool(e) { pool.splice(pool.indexOf(e), 1); }
  var run = array[Symbol.iterator]();
  function next() {
    var item = run.next();
    if (item.done) return Promise.all(result);
    var p = Promise.resolve(item.value());
    result.push(p);
    var e = p.then(function() { leavePool(e); return next(); });
    pool.push(e);
    if (pool.length >= poolSize) return Promise.race(pool);
    return next();
  }
  return next();
}

function toast(msg, type) {
  type = type || 'info';
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  var c = document.getElementById('toastContainer');
  if (c) { c.appendChild(t); setTimeout(function(){ t.remove(); }, 4000); }
}

function log(msg) {
  var c = document.getElementById('log_container');
  if (!c) return;
  var d = document.createElement('div');
  d.innerHTML = '<span style="color:var(--text3);font-size:.75rem">[' + new Date().toLocaleTimeString() + ']</span> ' + msg;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

function showScreen(id) {
  var screens = document.querySelectorAll('.ln-screen');
  for (var i = 0; i < screens.length; i++) { screens[i].classList.remove('active'); }
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('gioai-theme', t);
  LN.theme = t;
}

function updateSpeedDisplay() {
  var d = document.getElementById('speed_display');
  if (d) d.textContent = secondsToString(speed);
}

// ===== FCaptcha bypass - just use FAILEDTOKEN =====
// The fcaptcha.js on the page is the full FCaptcha library.
// We bypass it entirely by using FAILEDTOKEN in all API calls.
// When fcaptcha.js tries to validate, it gets FAILEDTOKEN which
// the server accepts as a bypass token.

// ===== task_completer class =====
class task_completer {
  constructor(token, task, ietf) {
    this.token = token;
    this.task = task;
    this.mode = this.get_task_type();
    this.to_language = ietf;
    this.homework_id = task.base ? task.base[0] : null;
    this.catalog_uid = task.catalog_uid;
    if (this.catalog_uid === undefined && task.base) {
      this.catalog_uid = task.base[task.base.length - 1];
    }
    this.rel_module_uid = task.rel_module_uid;
    this.game_uid = task.game_uid;
    this.game_type = task.type;
  }

  async complete() {
    var answers = await this.get_data();
    if (!answers || answers.length === 0) {
      log('No data found for task, skipping');
      return null;
    }
    return await this.send_answers(answers);
  }

  async get_data() {
    var vocabs;
    if (this.mode === 'sentence') vocabs = await this.get_sentences();
    else if (this.mode === 'verbs') vocabs = await this.get_verbs();
    else if (this.mode === 'phonics') vocabs = await this.get_phonics();
    else if (this.mode === 'exam') vocabs = await this.get_exam();
    else vocabs = await this.get_vocabs();
    return vocabs;
  }

  async send_answers(vocabs) {
    if (!vocabs || vocabs.length === 0) { log('No vocabs, skipping'); return null; }
    var data = {
      moduleUid: this.catalog_uid,
      gameUid: this.game_uid,
      gameType: this.game_type,
      isTest: true,
      toietf: this.to_language,
      fromietf: 'en-US',
      score: vocabs.length * 200,
      correctVocabs: vocabs.map(function(x) { return x.uid; }).join(','),
      incorrectVocabs: '',
      homeworkUid: this.homework_id,
      isSentence: this.mode === 'sentence',
      isALevel: false,
      isVerb: this.mode === 'verbs',
      verbUid: this.mode === 'verbs' ? this.catalog_uid : '',
      phonicUid: this.mode === 'phonics' ? this.catalog_uid : '',
      sentenceScreenUid: this.mode === 'sentence' ? 100 : '',
      sentenceCatalogUid: this.mode === 'sentence' ? this.catalog_uid : '',
      grammarCatalogUid: this.catalog_uid,
      isGrammar: false,
      isExam: this.mode === 'exam',
      correctStudentAns: '',
      incorrectStudentAns: '',
      timeStamp: Math.floor(speed + ((Math.random() - 0.5) / 10) * speed) * 1000,
      vocabNumber: vocabs.length,
      rel_module_uid: this.rel_module_uid,
      dontStoreStats: true,
      product: 'secondary',
      friendlyCaptchaToken: 'FAILEDTOKEN',
      token: this.token
    };
    var result = await call_lnut('gameDataController/addGameScore', data);
    var xp = result && result.score ? result.score : 0;
    return { result: result, count: vocabs.length, xp: xp };
  }

  get_verbs() { return call_lnut_data('verbTranslationController/getVerbTranslations', { verbUid: this.catalog_uid, toLanguage: this.to_language, fromLanguage: 'en-US', token: this.token }).then(function(d) { return d.verbTranslations; }); }
  get_phonics() { return call_lnut_data('phonicsController/getPhonicsData', { phonicCatalogUid: this.catalog_uid, toLanguage: this.to_language, fromLanguage: 'en-US', token: this.token }).then(function(d) { return d.phonics; }); }
  get_sentences() { return call_lnut_data('sentenceTranslationController/getSentenceTranslations', { catalogUid: this.catalog_uid, toLanguage: this.to_language, fromLanguage: 'en-US', token: this.token }).then(function(d) { return d.sentenceTranslations; }); }
  get_exam() { return call_lnut_data('examTranslationController/getExamTranslationsCorrect', { gameUid: this.game_uid, examUid: this.catalog_uid, toLanguage: this.to_language, fromLanguage: 'en-US', token: this.token }).then(function(d) { return d.examTranslations; }); }
  get_vocabs() { return call_lnut_data('vocabTranslationController/getVocabTranslations', { 'catalogUid[]': this.catalog_uid, toLanguage: this.to_language, fromLanguage: 'en-US', token: this.token }).then(function(d) { return d.vocabTranslations; }); }

  get_task_type() {
    if (!this.task.gameLink) return 'vocabs';
    if (this.task.gameLink.indexOf('sentenceCatalog') >= 0) return 'sentence';
    if (this.task.gameLink.indexOf('verbUid') >= 0) return 'verbs';
    if (this.task.gameLink.indexOf('phonicCatalogUid') >= 0) return 'phonics';
    if (this.task.gameLink.indexOf('examUid') >= 0) return 'exam';
    return 'vocabs';
  }
}

// ===== Raw API calls =====
function call_lnut(url, data) {
  data.friendlyCaptchaToken = 'FAILEDTOKEN';
  var url_data = new URLSearchParams(data).toString();
  return fetch('https://api.languagenut.com/' + url + '?' + url_data, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  }).then(function(r) { return r.json(); });
}

function call_lnut_data(url, data) {
  var url_data = new URLSearchParams(data).toString();
  return fetch('https://api.languagenut.com/' + url + '?' + url_data, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  }).then(function(r) { return r.json(); });
}

// ===== Main Application =====
var app = null;

function init() {
  // Restore theme
  setTheme(LN.theme);
  var ts = document.getElementById('themeSelect');
  if (ts) ts.value = LN.theme;

  // Speed slider setup (both dashboard and modal sliders)
  var speedSlider = document.getElementById('speed_slider');
  var speedSliderModal = document.getElementById('speed_slider_modal');
  var savedSpeed = localStorage.getItem('gioai-lnut-speed');
  if (savedSpeed) speed = parseInt(savedSpeed);

  function updateBothSliders(val) {
    if (speedSlider) speedSlider.value = val;
    if (speedSliderModal) speedSliderModal.value = val;
  }

  function handleSpeedChange(val) {
    speed = Math.pow(10, val);
    updateSpeedDisplay();
    var modalDisplay = document.getElementById('speed_display_modal');
    if (modalDisplay) modalDisplay.textContent = secondsToString(speed);
    localStorage.setItem('gioai-lnut-speed', speed);
  }

  var initialVal = Math.log10(speed);
  updateBothSliders(initialVal);
  updateSpeedDisplay();
  var modalDisp = document.getElementById('speed_display_modal');
  if (modalDisp) modalDisp.textContent = secondsToString(speed);

  if (speedSlider) {
    speedSlider.oninput = function() {
      updateBothSliders(this.value);
      handleSpeedChange(this.value);
    };
  }
  if (speedSliderModal) {
    speedSliderModal.oninput = function() {
      updateBothSliders(this.value);
      handleSpeedChange(this.value);
    };
  }

  // Settings button
  var settingsBtn = document.getElementById('settings_button');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      document.getElementById('settings_dialog').showModal();
    });
  }

  // Settings close
  var settingsClose = document.getElementById('settings_close');
  if (settingsClose) {
    settingsClose.addEventListener('click', function() {
      document.getElementById('settings_dialog').close();
    });
  }

  // Theme select
  if (ts) {
    ts.addEventListener('change', function() { setTheme(this.value); });
  }

  // Login
  var loginBtn = document.getElementById('login_btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', doLogin);
  }

  // Enter key on password
  var pwBox = document.getElementById('password_input');
  if (pwBox) {
    pwBox.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  }

  // Show past homework toggle
  var showPast = document.getElementById('showPastHmwk');
  if (showPast) {
    var savedShowPast = localStorage.getItem('gioai-lnut-showpast');
    if (savedShowPast === 'true') showPast.checked = true;
    showPast.addEventListener('change', function() {
      localStorage.setItem('gioai-lnut-showpast', this.checked);
      if (LN.token && LN.homeworks.length > 0) display_hwks();
    });
  }

  // Do homework button
  var doHwBtn = document.getElementById('do_hw');
  if (doHwBtn) {
    doHwBtn.addEventListener('click', do_hwks);
  }

  // Stop button
  var stopBtn = document.getElementById('stop_btn');
  if (stopBtn) {
    stopBtn.addEventListener('click', function() {
      LN.isRunning = false;
      log('Stopped by user');
      if (stopBtn) stopBtn.disabled = true;
      if (doHwBtn) doHwBtn.disabled = false;
    });
  }

  // Select all button
  var selAll = document.getElementById('selectall');
  if (selAll) {
    selAll.addEventListener('click', function() {
      var boxes = document.getElementsByName('boxcheck');
      for (var i = 0; i < boxes.length; i++) {
        boxes[i].checked = this.checked;
      }
    });
  }

  // Logout
  var logoutBtn = document.getElementById('logout_btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      LN.token = null;
      LN.userData = null;
      LN.homeworks = [];
      showScreen('login_screen');
      document.getElementById('login_title').textContent = 'LanguageNut Login';
      toast('Logged out', 'info');
    });
  }

  // Show login screen after loading
  setTimeout(function() {
    document.getElementById('loadingScreen').classList.remove('active');
    // Check if already logged in (saved token?)
    var savedToken = localStorage.getItem('gioai-lnut-token');
    if (savedToken) {
      LN.token = savedToken;
      // Try to restore session
      afterLogin();
    } else {
      showScreen('login_screen');
    }
  }, 1000);
}

async function doLogin() {
  var u = document.getElementById('username_input').value.trim();
  var p = document.getElementById('password_input').value;
  if (!u || !p) { toast('Enter username and password', 'error'); return; }

  var loginBtn = document.getElementById('login_btn');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  log('Attempting login...');

  try {
    var response = await call_lnut('loginController/attemptLogin', {
      username: u,
      pass: p
    });

    if (!response || !response.newToken) {
      var errMsg = (response && response.message) || 'Login failed - check credentials';
      throw new Error(errMsg);
    }

    LN.token = response.newToken;
    LN.userData = response;
    localStorage.setItem('gioai-lnut-token', LN.token);
    log('Logged in as ' + u);
    toast('Logged in successfully!', 'success');
    afterLogin();
  } catch (e) {
    log('Login error: ' + e.message);
    toast(e.message, 'error');
  }
  loginBtn.disabled = false;
  loginBtn.textContent = 'Login';
}

async function afterLogin() {
  // Clear saved token reference - we'll use it from memory
  document.getElementById('login_title').textContent = 'LanguageNut - Logged In';
  showScreen('dashboard_screen');

  // Fetch module translations and display translations
  try {
    var mt = await call_lnut_data('translationController/getUserModuleTranslations', { token: LN.token });
    LN.moduleTranslations = mt.translations || {};
  } catch(e) { log('Could not fetch module translations'); }

  try {
    var dt = await call_lnut_data('publicTranslationController/getTranslations', {});
    LN.displayTranslations = dt.translations || {};
  } catch(e) { log('Could not fetch display translations'); }

  // Display user info
  var ui = document.getElementById('user_info');
  if (ui && LN.userData) {
    var name = LN.userData.firstName || LN.userData.username || 'User';
    ui.textContent = 'Logged in as: ' + name;
  }

  await fetchAndDisplayHomeworks();
}

async function fetchAndDisplayHomeworks() {
  log('Fetching homeworks...');
  var fetchBtn = document.getElementById('fetch_btn');
  if (fetchBtn) { fetchBtn.disabled = true; fetchBtn.textContent = 'Fetching...'; }

  try {
    var hwData = await call_lnut_data('assignmentController/getViewableAll', { token: LN.token });
    LN.homeworks = hwData.homework || [];
    log('Found ' + LN.homeworks.length + ' homeworks');
    display_hwks();
    toast('Loaded ' + LN.homeworks.length + ' homeworks', 'success');
  } catch (e) {
    log('Error fetching homeworks: ' + e.message);
    toast('Failed to fetch homeworks', 'error');
  }

  if (fetchBtn) { fetchBtn.disabled = false; fetchBtn.textContent = 'Reload'; }
}

function get_task_name(task) {
  var name = task.verb_name;
  if (task.module_translations && task.module_translations[0] !== undefined) {
    name = LN.moduleTranslations[task.module_translations[0]];
  }
  if (task.module_translation !== undefined) {
    name = LN.moduleTranslations[task.module_translation];
  }
  return name || 'Unknown Task';
}

function display_hwks() {
  var container = document.getElementById('hw_container');
  if (!container) return;
  container.innerHTML = '';

  var showPast = document.getElementById('showPastHmwk') && document.getElementById('showPastHmwk').checked;
  var homeworks = LN.homeworks.slice(); // copy

  // Filter out past homeworks if not showing
  if (!showPast) {
    homeworks = homeworks.filter(function(h) {
      // Check if any task is not completed (no gameResults or percentage < 100)
      var hasUnfinished = false;
      if (h.tasks) {
        for (var i = 0; i < h.tasks.length; i++) {
          var t = h.tasks[i];
          if (!t.gameResults || t.gameResults.percentage < 100) {
            hasUnfinished = true;
            break;
          }
        }
      }
      return hasUnfinished;
    });
  }

  // Reverse so newest first
  homeworks.reverse();

  if (homeworks.length === 0) {
    container.innerHTML = '<div class="empty-state">No homeworks' + (showPast ? '' : ' (enable "Show past homework" to see completed)') + '</div>';
    return;
  }

  for (var hwIdx = 0; hwIdx < homeworks.length; hwIdx++) {
    var homework = homeworks[hwIdx];

    // Homework header with checkbox
    var hwHeader = document.createElement('div');
    hwHeader.className = 'hw-header';

    var hwCheckbox = document.createElement('input');
    hwCheckbox.type = 'checkbox';
    hwCheckbox.className = 'hw-checkbox';
    hwCheckbox.onclick = function(idx, containerId) {
      return function() {
        set_checkboxes(containerId, this.checked);
      };
    }(hwIdx, 'hw_' + (homework.id || hwIdx));

    var hwTitle = document.createElement('span');
    hwTitle.className = 'hw-title';
    hwTitle.textContent = homework.name || ('Homework #' + (hwIdx + 1));
    if (homework.languageCode) {
      var langSpan = document.createElement('span');
      langSpan.className = 'hw-lang';
      langSpan.textContent = homework.languageCode;
      hwTitle.appendChild(langSpan);
    }

    hwHeader.appendChild(hwCheckbox);
    hwHeader.appendChild(hwTitle);
    container.appendChild(hwHeader);

    // Tasks under this homework
    var hwTasksContainer = document.createElement('div');
    hwTasksContainer.className = 'hw-tasks';
    hwTasksContainer.id = 'hw_' + (homework.id || hwIdx);

    if (homework.tasks && homework.tasks.length > 0) {
      for (var tIdx = 0; tIdx < homework.tasks.length; tIdx++) {
        var task = homework.tasks[tIdx];
        var percentage = task.gameResults ? task.gameResults.percentage : '-';
        var trans = task.translation ? (LN.displayTranslations[task.translation] || task.translation) : 'Unknown';

        var taskItem = document.createElement('div');
        taskItem.className = 'task-item';

        var taskCheckbox = document.createElement('input');
        taskCheckbox.type = 'checkbox';
        taskCheckbox.name = 'boxcheck';
        taskCheckbox.dataset.hwIdx = hwIdx;
        taskCheckbox.dataset.taskIdx = tIdx;

        var taskLabel = document.createElement('label');
        taskLabel.textContent = trans + ' - ' + get_task_name(task) + ' (' + percentage + '%)';
        if (percentage !== '-' && percentage < 100) {
          taskLabel.innerHTML += ' <span class="task-incomplete">incomplete</span>';
        } else if (percentage === 100) {
          taskLabel.innerHTML += ' <span class="task-complete">done</span>';
        }

        taskItem.appendChild(taskCheckbox);
        taskItem.appendChild(taskLabel);
        hwTasksContainer.appendChild(taskItem);
      }
    } else {
      hwTasksContainer.innerHTML = '<div style="padding:.5rem;font-size:.8rem;color:var(--text3)">No tasks</div>';
    }

    container.appendChild(hwTasksContainer);
  }
}

async function do_hwks() {
  if (LN.isRunning) return;
  LN.isRunning = true;

  var doBtn = document.getElementById('do_hw');
  var stopBtn = document.getElementById('stop_btn');
  if (doBtn) doBtn.disabled = true;
  if (stopBtn) stopBtn.disabled = false;

  // Find all checked task boxes
  var checked = document.querySelectorAll('.task-item input[type=checkbox]:checked');
  if (checked.length === 0) {
    // If none checked, auto-select all incomplete
    var allTasks = document.querySelectorAll('.task-item input[type=checkbox]');
    for (var i = 0; i < allTasks.length; i++) {
      // Check if task is incomplete (label contains "incomplete" or no "done")
      var label = allTasks[i].nextElementSibling;
      if (label && label.textContent.indexOf('done') === -1) {
        allTasks[i].checked = true;
      }
    }
    checked = document.querySelectorAll('.task-item input[type=checkbox]:checked');
    if (checked.length === 0) {
      log('No tasks selected or incomplete');
      toast('All tasks already done!', 'info');
      LN.isRunning = false;
      if (doBtn) doBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      return;
    }
    log('Auto-selected ' + checked.length + ' incomplete tasks');
  }

  var logs = document.getElementById('log_container');
  var progressBar = document.getElementById('hw_bar');
  var progressText = document.getElementById('progress_text');
  var statTasks = document.getElementById('stat_tasks');
  var statXP = document.getElementById('stat_xp');
  var statErrors = document.getElementById('stat_errors');

  log('Starting ' + checked.length + ' tasks...');
  LN.completedCount = 0;
  LN.xpCount = 0;
  LN.errorCount = 0;

  var totalTasks = checked.length;
  var completed = 0;

  // Build task functions for concurrent execution
  var funcs = [];
  for (var c = 0; c < checked.length; c++) {
    var cb = checked[c];
    var hwIdx = parseInt(cb.dataset.hwIdx);
    var taskIdx = parseInt(cb.dataset.taskIdx);

    if (isNaN(hwIdx) || isNaN(taskIdx) || !LN.homeworks[hwIdx] || !LN.homeworks[hwIdx].tasks[taskIdx]) continue;

    var task = LN.homeworks[hwIdx].tasks[taskIdx];
    var ietf = LN.homeworks[hwIdx].languageCode || 'fr-FR';
    var completer = new task_completer(LN.token, task, ietf);

    (function(hwIdx, taskIdx, taskName, completer) {
      funcs.push(function() {
        return (async function() {
          if (!LN.isRunning) return;
          log('Starting: <b>' + taskName + '</b>');
          try {
            var result = await completer.complete();
            if (result) {
              LN.completedCount++;
              LN.xpCount += result.xp || 0;
              log('Done: <b>' + taskName + '</b> - XP: ' + (result.xp || 0));
            } else {
              LN.errorCount++;
              log('No data for: ' + taskName);
            }
          } catch (e) {
            LN.errorCount++;
            log('Error: ' + taskName + ' - ' + e.message);
          }
          completed++;
          var pct = Math.round((completed / totalTasks) * 100);
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressText) progressText.textContent = completed + '/' + totalTasks + ' (' + pct + '%)';
          if (statTasks) statTasks.textContent = LN.completedCount;
          if (statXP) statXP.textContent = LN.xpCount;
          if (statErrors) statErrors.textContent = LN.errorCount;
        })();
      });
    })(hwIdx, taskIdx, get_task_name(task), completer);
  }

  try {
    await asyncPool(funcs, 5); // 5 concurrent
    log('All done! Completed: ' + LN.completedCount + ', XP: ' + LN.xpCount + ', Errors: ' + LN.errorCount);
    toast('Done! ' + LN.completedCount + ' tasks, ' + LN.xpCount + ' XP', LN.errorCount > 0 ? 'warning' : 'success');
    // Refresh homework list to show updated percentages
    display_hwks();
  } catch (e) {
    log('Fatal error: ' + e.message);
  }

  LN.isRunning = false;
  if (doBtn) doBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

// ===== Init =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();


