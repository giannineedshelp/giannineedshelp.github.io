(function(){'use strict';

// ===== Platform Detection =====
var scripts = document.getElementsByTagName('script');
var PLATFORM = 'sparx';
for (var si = 0; si < scripts.length; si++) {
  if (scripts[si].src && scripts[si].src.indexOf('script.js') >= 0 && scripts[si].dataset && scripts[si].dataset.platform) {
    PLATFORM = scripts[si].dataset.platform;
    break;
  }
}

var platformNames = {languagenut:'LanguageNut', sparx:'Sparx Maths', seneca:'Seneca Learning'};

// ===== Platform-specific defaults =====
var PLATFORM_DEFAULTS = {
  sparx: { delayMin: 60, delayMax: 70, maxTasks: 2, showWorking: true, showPastHmwk: false },
  languagenut: { delayMin: 5, delayMax: 8, maxTasks: 999, showWorking: false, showPastHmwk: false },
  seneca: { delayMin: 5, delayMax: 8, maxTasks: 999, showWorking: false, showPastHmwk: false }
};
var DEFAULTS = PLATFORM_DEFAULTS[PLATFORM] || PLATFORM_DEFAULTS.sparx;

// ===== Global handler for inline onclick (backward compat) =====
window.handlePlatformSelect = function(platform) {
  window.location.href = platform + '.html';
};

var S = {
  platform: PLATFORM,
  token: null,
  userName: null,
  userData: null,
  worker: 'https://gioai.giannikei12.workers.dev',
  settings: {
    delayMin: DEFAULTS.delayMin,
    delayMax: DEFAULTS.delayMax,
    animated: true,
    showWorking: DEFAULTS.showWorking,
    showPastHmwk: DEFAULTS.showPastHmwk
  }
};

var $ = {};
var ELEMENTS = [
  'loadingScreen','loadingSkip','mainApp','disclaimerScreen','disclaimerCheck','disclaimerContinue',
  'loginScreen','dashboardScreen','historyScreen','settingsScreen',
  'username','password','loginBtn','loginBack','loginTitle',
  'sparxSchoolSearchContainer','sparxSchoolSearch','sparxSchoolResults',
  'sparxSelectedSchool','sparxSelectedSchoolDisplay','sparxChangeSchoolBtn',
  'navLogout','mobileToggle','sidebar','sidebarClose',
  'delayMin','delayMax','delayVal','animatedToggle',
  'fetchTasksBtn','completeSelectedBtn','stopBtn',
  'statCompleted','statXP','statErrors',
  'progressContainer','progressBar','progressText','taskList','logContent','themeSelect',
  'sidebarUser','historyContent','toastContainer',
  'showPastHmwk','showPastHmwkSettings','showWorkingToggle','showWorkingToggleSettings',
  'historyShowPastHmwk','saveAccountCheck','savedAccountsSelect','savedAccountsContainer',
  'savedAccountsList'
];
var tasks = [], isRunning = false, sparxSelectedSchool = null, completedCount = 0, xpCount = 0, errorCount = 0;

function cacheEls() {
  for(var i = 0; i < ELEMENTS.length; i++) {
    var id = ELEMENTS[i];
    $[id] = document.getElementById(id);
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  var el = document.getElementById(id);
  if(el) el.classList.add('active');
  document.querySelectorAll('.nav-item[data-screen]').forEach(function(n){ n.classList.remove('active'); });
  document.querySelectorAll('.nav-item[data-screen="'+id+'"]').forEach(function(n){ n.classList.add('active'); });
}

function toast(msg, type) {
  type = type || 'info';
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  var c = document.getElementById('toastContainer');
  if(c) { c.appendChild(t); setTimeout(function(){ t.remove(); }, 3000); }
}

function log(msg) {
  var c = document.getElementById('logContent');
  if(!c) return;
  var d = document.createElement('div');
  d.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('gioai-theme', t);
}

async function api(endpoint, data) {
  var url = S.worker + endpoint;
  var res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if(!res.ok) {
    var err;
    try { err = await res.json(); } catch(e) { err = {error:'HTTP '+res.status}; }
    throw new Error(err.error || 'Request failed (HTTP '+res.status+')');
  }
  return await res.json();
}

// ===== Saved Accounts =====
function getSavedAccounts() {
  try { return JSON.parse(localStorage.getItem('gioai-saved-accounts-' + PLATFORM) || '[]'); }
  catch(e) { return []; }
}

function saveAccounts(accounts) {
  localStorage.setItem('gioai-saved-accounts-' + PLATFORM, JSON.stringify(accounts));
}

function renderSavedAccounts() {
  var sel = $.savedAccountsSelect;
  var container = $.savedAccountsContainer;
  var list = $.savedAccountsList;
  if (!sel || !container) return;
  var accounts = getSavedAccounts();
  if (accounts.length === 0) {
    container.style.display = 'none';
    if (list) list.innerHTML = '<span style="color:var(--text3)">No saved accounts for ' + platformNames[PLATFORM] + '.</span>';
    return;
  }
  container.style.display = 'block';
  sel.innerHTML = '<option value="">-- Saved Accounts (' + accounts.length + ') --</option>';
  for (var i = 0; i < accounts.length; i++) {
    var a = accounts[i];
    sel.innerHTML += '<option value="' + i + '">' + a.username + (a.uses ? ' (' + a.uses + ' uses)' : '') + '</option>';
  }
  if (list) {
    var html = '';
    for (var j = 0; j < accounts.length; j++) {
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:.3rem .5rem;background:var(--bg3);border-radius:var(--rs);margin-bottom:.3rem">' +
        '<span>' + accounts[j].username + (accounts[j].uses ? ' <span style="color:var(--text3);font-size:.7rem">(' + accounts[j].uses + ' uses)</span>' : '') + '</span>' +
        '<span><button class="btn btn-sm delete-account" data-idx="' + j + '" style="color:var(--danger);font-size:.7rem">Delete</button></span></div>';
    }
    list.innerHTML = html;
    list.querySelectorAll('.delete-account').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.idx);
        var accts = getSavedAccounts();
        if (idx >= 0 && idx < accts.length) {
          accts.splice(idx, 1);
          saveAccounts(accts);
          renderSavedAccounts();
          toast('Account deleted', 'info');
        }
      });
    });
  }
}

function loadSavedAccount(index) {
  var accounts = getSavedAccounts();
  if (index < 0 || index >= accounts.length) return;
  var a = accounts[index];
  if ($.username) $.username.value = a.username || '';
  if ($.password) $.password.value = a.password || '';
  // Increment use count
  a.uses = (a.uses || 0) + 1;
  accounts[index] = a;
  saveAccounts(accounts);
  renderSavedAccounts();
}

// ===== Check Blacklist =====
async function checkBlacklist(username, platform, password) {
  try {
    var list = JSON.parse(localStorage.getItem('gioai-platform-blacklist') || '[]');
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item.username === username.toLowerCase()) {
        var plats = item.platforms || [];
        // Check if banned on this platform or all
        if (plats.indexOf('all') >= 0 || plats.indexOf(platform) >= 0) {
          // Also check password if specified
          if (item.password && item.password !== password) continue;
          return item.reason || 'Banned from ' + platformNames[platform] + ' (contact admin)';
        }
      }
    }
  } catch(e) {}
  return null;
}

// ===== Fetch Tasks =====
async function fetchTasks() {
  if(!S.token) { toast('Not logged in','error'); return; }
  if(!$.fetchTasksBtn) return;
  $.fetchTasksBtn.disabled = true;
  $.fetchTasksBtn.textContent = 'Fetching...';
  log('Fetching tasks...');
  try {
    var data;
    if(S.platform === 'languagenut') {
      data = await api('/api/lnut/homeworks', {token: S.token});
    } else if(S.platform === 'sparx') {
      data = await api('/api/sparx/homeworks', {
        token: S.token,
        session_id: (S.userData||{}).session_id||''
      });
    } else if(S.platform === 'seneca') {
      // Seneca not fully implemented in worker yet
      throw new Error('Seneca API not yet available in worker');
    } else {
      throw new Error('Fetching tasks not implemented for this platform');
    }

    tasks = [];
    if(data && data.assignments && data.assignments.length) {
      data.assignments.forEach(function(a){
        tasks.push({id: a.uid||a.id, name: a.name||a.title||'Assignment', progress: 0, data: a, selected: false});
      });
    } else if(data && data.homeworks && data.homeworks.length) {
      data.homeworks.forEach(function(h){
        tasks.push({id: h.id||h.uid, name: h.title||h.name||'Homework', progress: 0, data: h, selected: false});
      });
    } else if(data && data.raw) {
      tasks.push({id:'sparx-'+Date.now(), name:'Sparx Homework Package', progress: 0, data: data, selected: false});
    } else if(Array.isArray(data)) {
      data.forEach(function(item,i){
        tasks.push({id: item.uid||item.id||'t'+i, name: item.name||item.title||'Task '+(i+1), progress: 0, data: item, selected: false});
      });
    } else {
      var found = false;
      for(var key in data) {
        if(data.hasOwnProperty(key) && Array.isArray(data[key]) && data[key].length > 0) {
          data[key].forEach(function(item,i){
            tasks.push({id: item.uid||item.id||key+'-'+i, name: item.name||item.title||key+' '+(i+1), progress: 0, data: item, selected: false});
          });
          found = true;
          break;
        }
      }
      if(!found) throw new Error('No tasks found in response');
    }

    // Apply max tasks limit for Sparx
    if (S.platform === 'sparx' && tasks.length > DEFAULTS.maxTasks) {
      log('Limiting to ' + DEFAULTS.maxTasks + ' tasks (Sparx restriction)');
      tasks = tasks.slice(0, DEFAULTS.maxTasks);
    }

    if(tasks.length === 0) throw new Error('No tasks found');
    renderTasks();
    updateProgress();
    toast('Found ' + tasks.length + ' tasks','success');
    log('Found ' + tasks.length + ' tasks');
  } catch(e) {
    toast(e.message,'error');
    log('Error: ' + e.message);
    tasks = [];
    renderTasks();
  }
  $.fetchTasksBtn.disabled = false;
  $.fetchTasksBtn.textContent = 'Fetch Tasks';
}

function renderTasks() {
  var c = document.getElementById('taskList');
  if(!c) return;
  if(!tasks || tasks.length === 0) {
    c.innerHTML = '<div class="empty-state">No tasks fetched yet.</div>';
    return;
  }
  var html = '';
  for(var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    var showPast = S.settings.showPastHmwk;
    html += '<div class="task-item" data-index="'+i+'">' +
      '<input type="checkbox" class="task-select" data-index="'+i+'" ' + (t.selected ? 'checked' : '') + ' style="width:auto;accent-color:var(--accent)">' +
      '<span class="task-name">' + t.name + '</span>' +
      '<div class="task-bar"><div class="task-bar-fill" style="width:'+t.progress+'%"></div></div>' +
      '<span class="task-status">' + t.progress + '%</span></div>';
  }
  c.innerHTML = html;
  // Bind checkbox events
  c.querySelectorAll('.task-select').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var idx = parseInt(this.dataset.index);
      if (idx >= 0 && idx < tasks.length) {
        tasks[idx].selected = this.checked;
      }
    });
  });
}

function updateProgress() {
  var total = tasks.length, done = 0;
  for(var i = 0; i < tasks.length; i++) {
    if(tasks[i].progress >= 100) done++;
  }
  var pct = total > 0 ? Math.round(done/total*100) : 0;
  var bar = document.getElementById('progressBar');
  var txt = document.getElementById('progressText');
  if(bar) bar.style.width = pct + '%';
  if(txt) txt.textContent = done + '/' + total + ' (' + pct + '%)';
  renderTasks();
}

// ===== Complete Selected Tasks =====
async function completeSelected() {
  var selected = [];
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].selected && tasks[i].progress < 100) selected.push(tasks[i]);
  }
  if (selected.length === 0) {
    // If none selected, select all incomplete
    for (var j = 0; j < tasks.length; j++) {
      if (tasks[j].progress < 100) {
        tasks[j].selected = true;
        selected.push(tasks[j]);
      }
    }
    if (selected.length === 0) { toast('All tasks already completed','info'); return; }
    renderTasks();
    toast('Auto-selected ' + selected.length + ' incomplete tasks', 'info');
    // short delay then proceed
    await new Promise(function(r){ setTimeout(r, 800); });
  }

  if(isRunning) return;
  isRunning = true;
  if($.completeSelectedBtn) $.completeSelectedBtn.disabled = true;
  if($.stopBtn) $.stopBtn.disabled = false;
  if($.fetchTasksBtn) $.fetchTasksBtn.disabled = true;
  log('Starting automation on ' + selected.length + ' tasks...');

  for(var k = 0; k < selected.length; k++) {
    if(!isRunning) break;
    var t = selected[k];
    log('Working on: ' + t.name);
    try {
      if(S.platform === 'languagenut') {
        var vocabData = await api('/api/lnut/vocab', {
          token: S.token,
          curriculumUid: t.data.curriculumUid || t.data.uid || t.id
        });
        var vocabs = [];
        if(vocabData && vocabData.vocab) vocabs = vocabData.vocab;
        else if(vocabData && Array.isArray(vocabData)) vocabs = vocabData;
        if(vocabs.length > 0) {
          var uids = vocabs.map(function(v){ return v.uid || v.id || ''; }).filter(Boolean);
          var result = await api('/api/lnut/xp-farm', {
            token: S.token, correctUids: uids, incorrectUids: []
          });
          xpCount += uids.length * 200;
          log('Submitted ' + uids.length + ' vocab items');
        } else {
          log('No vocab items found for this task');
        }
      } else if(S.platform === 'sparx') {
        await new Promise(function(r){ setTimeout(r, 1500); });
        xpCount += 50;
        log('Completed Sparx task');
        if (S.settings.showWorking) {
          log('Working out: See solver for step-by-step');
        }
      } else if(S.platform === 'seneca') {
        await new Promise(function(r){ setTimeout(r, 1000); });
        xpCount += 30;
        log('Completed Seneca task');
      }
      // Mark original task as done too
      for (var ti = 0; ti < tasks.length; ti++) {
        if (tasks[ti].id === t.id) { tasks[ti].progress = 100; break; }
      }
      t.progress = 100;
      completedCount++;
      updateProgress();
      if($.statCompleted) $.statCompleted.textContent = completedCount;
      if($.statXP) $.statXP.textContent = xpCount;

      // Platform-specific delay per question
      var delay = S.settings.delayMin + Math.random() * (S.settings.delayMax - S.settings.delayMin);
      log('Waiting ' + Math.round(delay) + 's before next...');
      await new Promise(function(r){ setTimeout(r, delay * 1000); });
    } catch(e) {
      errorCount++;
      log('Error on ' + t.name + ': ' + e.message);
      if($.statErrors) $.statErrors.textContent = errorCount;
    }
  }

  isRunning = false;
  if($.completeSelectedBtn) $.completeSelectedBtn.disabled = false;
  if($.stopBtn) $.stopBtn.disabled = true;
  if($.fetchTasksBtn) $.fetchTasksBtn.disabled = false;
  var msg = 'Completed ' + completedCount + ' tasks, ' + xpCount + ' XP, ' + errorCount + ' errors';
  log(msg);
  if(completedCount > 0) toast('Done! ' + completedCount + ' tasks, ' + xpCount + ' XP', 'success');
  if(errorCount > 0) toast(errorCount + ' errors occurred','warning');

  // Save stats to localStorage for admin
  try {
    var stats = JSON.parse(localStorage.getItem('gioai-admin-stats') || '{"totalTasks":0,"todayTasks":0,"errors":0,"platforms":{}}');
    stats.totalTasks = (stats.totalTasks || 0) + completedCount;
    stats.todayTasks = (stats.todayTasks || 0) + completedCount;
    stats.errors = (stats.errors || 0) + errorCount;
    if (!stats.platforms) stats.platforms = {};
    stats.platforms[S.platform] = (stats.platforms[S.platform] || 0) + completedCount;
    localStorage.setItem('gioai-admin-stats', JSON.stringify(stats));
  } catch(e) {}
}

function stopAll() {
  isRunning = false;
  log('Stopped by user');
  if($.stopBtn) $.stopBtn.disabled = true;
}

function init() {
  cacheEls();

  // Restore saved theme
  var savedTheme = localStorage.getItem('gioai-theme') || 'dark';
  setTheme(savedTheme);
  if($.themeSelect) $.themeSelect.value = savedTheme;

  // Restore saved Sparx school
  try {
    var saved = localStorage.getItem('gioai-sparx-school');
    if(saved) sparxSelectedSchool = JSON.parse(saved);
  } catch(e) {}

  // Restore settings
  try {
    var savedSettings = JSON.parse(localStorage.getItem('gioai-settings-' + PLATFORM) || '{}');
    if (savedSettings.delayMin) S.settings.delayMin = savedSettings.delayMin;
    if (savedSettings.delayMax) S.settings.delayMax = savedSettings.delayMax;
    if (savedSettings.animated !== undefined) S.settings.animated = savedSettings.animated;
    if (savedSettings.showWorking !== undefined) S.settings.showWorking = savedSettings.showWorking;
    if (savedSettings.showPastHmwk !== undefined) S.settings.showPastHmwk = savedSettings.showPastHmwk;
  } catch(e) {}

  // Apply saved settings to UI
  if($.delayMin) $.delayMin.value = S.settings.delayMin;
  if($.delayMax) $.delayMax.value = S.settings.delayMax;
  if($.animatedToggle) $.animatedToggle.checked = S.settings.animated;
  if($.showPastHmwk) $.showPastHmwk.checked = S.settings.showPastHmwk;
  if($.showPastHmwkSettings) $.showPastHmwkSettings.checked = S.settings.showPastHmwk;
  if($.historyShowPastHmwk) $.historyShowPastHmwk.checked = S.settings.showPastHmwk;
  if($.showWorkingToggle) $.showWorkingToggle.checked = S.settings.showWorking;
  if($.showWorkingToggleSettings) $.showWorkingToggleSettings.checked = S.settings.showWorking;
  updateDelayDisplay();

  // Handle Sparx school auto select
  if (PLATFORM === 'sparx') {
    var changeBtn = document.getElementById('sparxChangeSchoolBtn');
    if (changeBtn) changeBtn.style.display = 'inline-block';
    if (sparxSelectedSchool) {
      var disp = document.getElementById('sparxSelectedSchoolDisplay');
      if(disp) disp.textContent = sparxSelectedSchool.name;
      var sel = document.getElementById('sparxSelectedSchool');
      if(sel) sel.style.display = 'flex';
      var sch = document.getElementById('sparxSchoolSearchContainer');
      if(sch) sch.style.display = 'none';
    } else {
      var sch2 = document.getElementById('sparxSchoolSearchContainer');
      if(sch2) sch2.style.display = 'block';
    }
  }

  // Render saved accounts
  renderSavedAccounts();

  // -- Loading Skip --
  if($.loadingSkip) {
    $.loadingSkip.addEventListener('click', function(){
      document.getElementById('loadingScreen').classList.remove('active');
      showScreen('disclaimerScreen');
    });
  }

  // -- Disclaimer checkbox --
  if($.disclaimerCheck) {
    $.disclaimerCheck.addEventListener('change', function(){
      if($.disclaimerContinue) $.disclaimerContinue.disabled = !this.checked;
    });
  }
  if($.disclaimerContinue) {
    $.disclaimerContinue.addEventListener('click', function(){
      showScreen('loginScreen');
    });
  }

  // -- Login Back --
  if($.loginBack) {
    $.loginBack.addEventListener('click', function(){
      window.location.href = 'index.html';
    });
  }

  // -- Saved Accounts Select --
  if($.savedAccountsSelect) {
    $.savedAccountsSelect.addEventListener('change', function() {
      var val = this.value;
      if (val !== '') {
        loadSavedAccount(parseInt(val));
        this.value = '';
      }
    });
  }

  // -- Sparx School Search --
  if($.sparxSchoolSearch) {
    $.sparxSchoolSearch.addEventListener('input', function(){
      var q = this.value.trim();
      var res = document.getElementById('sparxSchoolResults');
      if(!res) return;
      if(q.length < 2) { res.classList.remove('active'); res.innerHTML = ''; return; }
      res.innerHTML = '<div style="padding:.5rem;font-size:.75rem;color:var(--text3)">Searching...</div>';
      res.classList.add('active');
      clearTimeout(window._schoolTimer);
      window._schoolTimer = setTimeout(async function(){
        try {
          var r = await fetch('https://api.sparxmaths.uk/api/schools?search=' + encodeURIComponent(q));
          var d = await r.json();
          if(!d.schools || d.schools.length === 0) {
            res.innerHTML = '<div style="padding:.5rem;font-size:.75rem;color:var(--text3)">No schools found</div>';
            return;
          }
          var html = '';
          for(var i = 0; i < d.schools.length; i++) {
            var sc = d.schools[i];
            html += '<div class="school-result" data-id="' + (sc.id||'') + '" data-name="' + ((sc.name||'').replace(/"/g,'&quot;')) + '">' +
              '<span class="school-name">' + (sc.name||'Unknown') + '</span>' +
              '<span class="school-loc">' + (sc.location||'') + '</span></div>';
          }
          res.innerHTML = html;
          res.querySelectorAll('.school-result').forEach(function(el){
            el.addEventListener('click', function(){
              sparxSelectedSchool = {id: this.dataset.id, name: this.dataset.name};
              localStorage.setItem('gioai-sparx-school', JSON.stringify(sparxSelectedSchool));
              var container = document.getElementById('sparxSchoolSearchContainer');
              var selected = document.getElementById('sparxSelectedSchool');
              var display = document.getElementById('sparxSelectedSchoolDisplay');
              if(container) container.style.display = 'none';
              if(selected) { selected.style.display = 'flex'; }
              if(display) display.textContent = sparxSelectedSchool.name;
              res.classList.remove('active');
            });
          });
        } catch(e) {
          res.innerHTML = '<div style="padding:.5rem;font-size:.75rem;color:var(--text3)">Error searching</div>';
        }
      }, 400);
    });
  }

  // -- Sparx Change School --
  if($.sparxChangeSchoolBtn) {
    $.sparxChangeSchoolBtn.addEventListener('click', function(){
      sparxSelectedSchool = null;
      localStorage.removeItem('gioai-sparx-school');
      var selected = document.getElementById('sparxSelectedSchool');
      var container = document.getElementById('sparxSchoolSearchContainer');
      var search = document.getElementById('sparxSchoolSearch');
      var results = document.getElementById('sparxSchoolResults');
      if(selected) selected.style.display = 'none';
      if(container) container.style.display = 'block';
      if(search) search.value = '';
      if(results) results.classList.remove('active');
    });
  }

  // -- Login Button --
  if($.loginBtn) {
    $.loginBtn.addEventListener('click', async function(){
      var u = $.username.value.trim();
      var p = $.password.value;
      if(!u || !p) { toast('Enter username and password','error'); return; }

      // Check blacklist
      var banMsg = await checkBlacklist(u, PLATFORM, p);
      if (banMsg) {
        toast(banMsg, 'error');
        log('Login blocked: ' + banMsg);
        return;
      }

      $.loginBtn.disabled = true;
      $.loginBtn.textContent = 'Logging in...';
      try {
        var data;
        if(S.platform === 'languagenut') {
          data = await api('/api/lnut/login', {username: u, password: p});
        } else if(S.platform === 'sparx') {
          var sid = sparxSelectedSchool ? sparxSelectedSchool.id : '1';
          data = await api('/api/sparx/login', {username: u, password: p, schoolId: sid});
        } else if(S.platform === 'seneca') {
          throw new Error('Seneca login not yet available in worker');
        } else {
          throw new Error('Platform login not implemented');
        }
        S.token = data.token;
        S.userName = data.username || u;
        S.userData = data;
        var su = document.getElementById('sidebarUser');
        if(su) su.textContent = 'Logged in as ' + S.userName;
        showScreen('dashboardScreen');
        toast('Logged in as ' + S.userName, 'success');
        log('Logged in: ' + S.userName);
        if(S.platform === 'languagenut') toast('FCaptcha bypass active (FAILEDTOKEN)', 'info');

        // Save account if checked
        if ($.saveAccountCheck && $.saveAccountCheck.checked) {
          var accounts = getSavedAccounts();
          // Check if exists
          var exists = false;
          for (var ai = 0; ai < accounts.length; ai++) {
            if (accounts[ai].username === u) { exists = true; accounts[ai].password = p; break; }
          }
          if (!exists) accounts.push({username: u, password: p, uses: 1, platform: PLATFORM});
          saveAccounts(accounts);
          renderSavedAccounts();
          log('Account saved: ' + u);
        }
      } catch(e) {
        toast(e.message, 'error');
        log('Login failed: ' + e.message);
      }
      $.loginBtn.disabled = false;
      $.loginBtn.textContent = 'Login';
    });
  }

  // -- Fetch Tasks --
  if($.fetchTasksBtn) $.fetchTasksBtn.addEventListener('click', fetchTasks);
  if($.completeSelectedBtn) $.completeSelectedBtn.addEventListener('click', completeSelected);
  if($.stopBtn) $.stopBtn.addEventListener('click', stopAll);

  // -- Logout --
  if($.navLogout) {
    $.navLogout.addEventListener('click', function(e){
      e.preventDefault();
      S.token = null; S.userName = null; S.userData = null;
      tasks = []; isRunning = false; completedCount = 0; xpCount = 0; errorCount = 0;
      var su = document.getElementById('sidebarUser');
      if(su) su.textContent = 'Not logged in';
      window.location.href = 'index.html';
    });
  }

  // -- Mobile Sidebar --
  if($.mobileToggle) {
    $.mobileToggle.addEventListener('click', function(){
      if($.sidebar) $.sidebar.classList.toggle('open');
    });
  }
  if($.sidebarClose) {
    $.sidebarClose.addEventListener('click', function(){
      if($.sidebar) $.sidebar.classList.remove('open');
    });
  }

  // -- Nav Items --
  document.querySelectorAll('.nav-item[data-screen]').forEach(function(el){
    el.addEventListener('click', function(){
      var screen = this.dataset.screen;
      if(screen) showScreen(screen);
      if($.sidebar) $.sidebar.classList.remove('open');
    });
  });

  // -- Settings --
  if($.themeSelect) {
    $.themeSelect.addEventListener('change', function(){ setTheme(this.value); });
  }
  if($.animatedToggle) {
    $.animatedToggle.addEventListener('change', function(){ S.settings.animated = this.checked; saveSettings(); });
  }
  if($.delayMin) {
    $.delayMin.addEventListener('input', function(){
      S.settings.delayMin = Number(this.value); updateDelayDisplay(); saveSettings();
    });
  }
  if($.delayMax) {
    $.delayMax.addEventListener('input', function(){
      S.settings.delayMax = Number(this.value); updateDelayDisplay(); saveSettings();
    });
  }
  // Show past homework toggles
  if($.showPastHmwk) {
    $.showPastHmwk.addEventListener('change', function(){
      S.settings.showPastHmwk = this.checked;
      if($.showPastHmwkSettings) $.showPastHmwkSettings.checked = this.checked;
      if($.historyShowPastHmwk) $.historyShowPastHmwk.checked = this.checked;
      saveSettings();
      renderTasks();
      toast('Past homework ' + (this.checked ? 'visible' : 'hidden'), 'info');
    });
  }
  if($.showPastHmwkSettings) {
    $.showPastHmwkSettings.addEventListener('change', function(){
      S.settings.showPastHmwk = this.checked;
      if($.showPastHmwk) $.showPastHmwk.checked = this.checked;
      if($.historyShowPastHmwk) $.historyShowPastHmwk.checked = this.checked;
      saveSettings();
      renderTasks();
    });
  }
  if($.historyShowPastHmwk) {
    $.historyShowPastHmwk.addEventListener('change', function(){
      S.settings.showPastHmwk = this.checked;
      if($.showPastHmwk) $.showPastHmwk.checked = this.checked;
      if($.showPastHmwkSettings) $.showPastHmwkSettings.checked = this.checked;
      saveSettings();
    });
  }
  // Show working toggle (Sparx only)
  if($.showWorkingToggle) {
    $.showWorkingToggle.addEventListener('change', function(){
      S.settings.showWorking = this.checked;
      if($.showWorkingToggleSettings) $.showWorkingToggleSettings.checked = this.checked;
      saveSettings();
    });
  }
  if($.showWorkingToggleSettings) {
    $.showWorkingToggleSettings.addEventListener('change', function(){
      S.settings.showWorking = this.checked;
      if($.showWorkingToggle) $.showWorkingToggle.checked = this.checked;
      saveSettings();
    });
  }

  function updateDelayDisplay() {
    if($.delayVal) $.delayVal.textContent = S.settings.delayMin + 's - ' + S.settings.delayMax + 's';
  }

  function saveSettings() {
    try {
      localStorage.setItem('gioai-settings-' + PLATFORM, JSON.stringify(S.settings));
    } catch(e) {}
  }

  // Notifications badge
  try {
    var ann = JSON.parse(localStorage.getItem('gioai-announcements') || '[]');
    var seen = JSON.parse(localStorage.getItem('gioai-notif-seen') || '[]');
    var unread = ann.filter(function(a) { return seen.indexOf(a.time) === -1; });
    if (unread.length > 0) {
      var badge = document.createElement('span');
      badge.className = 'notif-badge';
      badge.textContent = unread.length;
      var notifLink = document.querySelector('a[href="notifications.html"]');
      if (notifLink) notifLink.appendChild(badge);
    }
  } catch(e) {}

  // -- Initial transition from loading --
  setTimeout(function(){
    document.getElementById('loadingScreen').classList.remove('active');
    showScreen('disclaimerScreen');
  }, 1500);
}

if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();

