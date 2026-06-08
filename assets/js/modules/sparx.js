// ============================================================
// GIOAI v8.0 - Sparx Maths Module
// ============================================================
var Sparx = (function() {
  'use strict';
  
  var _token = '';
  var _sessionId = '';
  var _username = '';
  var _schoolSearchTimer = null;
  
  function init() {
    // School search
    var searchEl = document.getElementById('sparxSchoolSearch');
    var resultsEl = document.getElementById('sparxSchoolResults');
    if (searchEl && resultsEl) {
      searchEl.addEventListener('input', function() {
        var q = this.value.trim();
        if (q.length < 2) { resultsEl.classList.remove('active'); return; }
        clearTimeout(_schoolSearchTimer);
        _schoolSearchTimer = setTimeout(function() {
          API.worker('/api/sparx/search-school', { query: q }).then(function(d) {
            if (d.results && d.results.length) {
              var html = '';
              for (var i = 0; i < d.results.length; i++) {
                html += '<div class="school-result-item" data-id="' + d.results[i].id + '" data-name="' + (d.results[i].name || '').replace(/'/g, "\\'") + '">' +
                  (d.results[i].name || 'Unknown') + '<span class="school-result-id">' + (d.results[i].town ? ' - ' + d.results[i].town : '') + '</span></div>';
              }
              resultsEl.innerHTML = html;
              resultsEl.classList.add('active');
              Array.from(resultsEl.children).forEach(function(item) {
                item.addEventListener('click', function() {
                  if (document.getElementById('sparxSchoolSearch')) document.getElementById('sparxSchoolSearch').value = this.dataset.name || '';
                  if (document.getElementById('sparxSchoolId')) document.getElementById('sparxSchoolId').value = this.dataset.id || '';
                  resultsEl.classList.remove('active');
                });
              });
            } else {
              resultsEl.classList.remove('active');
            }
          }).catch(function() {});
        }, 300);
      });
      document.addEventListener('click', function(e) {
        if (resultsEl && !e.target.closest('.school-search-wrapper')) {
          resultsEl.classList.remove('active');
        }
      });
    }
    
    // Exchange cookies button
    var exchangeBtn = document.getElementById('sparxExchangeBtn');
    if (exchangeBtn) {
      exchangeBtn.addEventListener('click', function() {
        var cookies = document.getElementById('sparxCookies');
        var schoolId = document.getElementById('sparxSchoolId');
        if (!cookies || !cookies.value.trim()) {
          UI.toast('Please paste your Sparx cookies', 'error');
          return;
        }
        sparxExchange(cookies.value.trim(), schoolId ? schoolId.value : '');
      });
    }
    
    // Cookie input change
    var cookieInput = document.getElementById('sparxCookies');
    if (cookieInput) {
      cookieInput.addEventListener('input', function() {
        var btn = document.getElementById('sparxExchangeBtn');
        if (btn) btn.disabled = !this.value.trim();
      });
    }
    
    // Help button
    var helpBtn = document.getElementById('sparxHelpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', function() {
        UI.toast('F12 > Application > Cookies > api.sparx-learning.com - copy all cookies', 'info', 5000);
      });
    }
    
    // Logout
    var logoutBtn = document.getElementById('sparxLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        _token = '';
        _sessionId = '';
        _username = '';
        var dash = document.getElementById('sparxDashboard');
        if (dash) dash.style.display = 'none';
        UI.toast('Logged out of Sparx', 'info');
      });
    }
    
    // Fetch homework
    var fetchBtn = document.getElementById('sparxFetchHwBtn');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', sparxFetchHomework);
    }
    
    // Auto-complete
    var autoBtn = document.getElementById('sparxStartAutoBtn');
    if (autoBtn) {
      autoBtn.addEventListener('click', function() {
        sparxStartAuto();
      });
    }
    
    // Stop
    var stopBtn = document.getElementById('sparxStopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', function() {
        Queue.stop();
      });
    }
  }
  
  function sparxExchange(cookies, schoolId) {
    var statusEl = document.getElementById('sparxLoginStatus');
    if (statusEl) statusEl.textContent = 'Exchanging cookies for token...';
    UI.toast('Exchanging cookies...', 'info');
    
    API.sparxExchangeCookies(cookies, schoolId).then(function(d) {
      if (d.token || d.authToken) {
        _token = d.token || d.authToken;
        _sessionId = d.session_id || d.sessionId || '';
        _username = d.username || 'Sparx User';
        
        if (statusEl) statusEl.textContent = 'Token acquired! Loading dashboard...';
        sparxShowDashboard(_username);
        UI.toast('Sparx logged in successfully', 'success');
      } else {
        var err = d.error || 'Exchange failed';
        if (statusEl) statusEl.textContent = 'Error: ' + err;
        UI.toast('Sparx error: ' + err, 'error');
      }
    }).catch(function(e) {
      if (statusEl) statusEl.textContent = 'Error: ' + e.message;
      UI.toast('Connection error', 'error');
    });
  }
  
  function sparxShowDashboard(username) {
    var dash = document.getElementById('sparxDashboard');
    var badge = document.getElementById('sparxUserBadge');
    if (dash) dash.style.display = 'block';
    if (badge) badge.textContent = username;
  }
  
  function sparxFetchHomework() {
    if (!_token) {
      UI.toast('Please login to Sparx first', 'error');
      return;
    }
    
    var taskList = document.getElementById('sparxTaskList');
    if (taskList) taskList.innerHTML = '<div class="empty-state">Fetching homework...</div>';
    UI.log('info', 'Sparx: Fetching homework...', document.getElementById('sparxLogContent'));
    
    API.fetchTasks('sparx', { token: _token, session_id: _sessionId }).then(function(d) {
      if (d.error) {
        UI.log('error', 'Sparx: ' + d.error, document.getElementById('sparxLogContent'));
        if (taskList) taskList.innerHTML = '<div class="empty-state">Error: ' + d.error + '</div>';
        return;
      }
      
      var tasks = [];
      if (d.raw) {
        tasks = parseSparxHomeworks(d.raw);
      } else if (d.tasks) {
        tasks = d.tasks.map(function(t, i) { return { id: t.id || 'sp_' + i, title: t.title || 'Task', raw: t, platform: 'sparx' }; });
      }
      
      if (tasks.length === 0) {
        if (taskList) taskList.innerHTML = '<div class="empty-state">No homework found</div>';
        UI.toast('No Sparx homework', 'info');
        return;
      }
      
      Queue.clear();
      Queue.addMultiple(tasks);
      
      var html = '';
      for (var i = 0; i < tasks.length; i++) {
        html += '<div class="task-item" data-index="' + i + '">' +
          '<div class="flex-between"><strong>' + (tasks[i].title || 'Task ' + (i+1)) + '</strong></div>' +
          '<div style="font-size:.75rem;color:var(--text3)">Package: ' + (tasks[i].package_id || 'N/A') + '</div></div>';
      }
      if (taskList) taskList.innerHTML = html;
      
      var autoBtn = document.getElementById('sparxStartAutoBtn');
      if (autoBtn) autoBtn.disabled = false;
      
      UI.log('success', 'Found ' + tasks.length + ' Sparx tasks', document.getElementById('sparxLogContent'));
      UI.toast(tasks.length + ' tasks loaded', 'success');
    }).catch(function(e) {
      UI.log('error', 'Sparx fetch error: ' + e.message, document.getElementById('sparxLogContent'));
      if (taskList) taskList.innerHTML = '<div class="empty-state">Error fetching tasks</div>';
    });
  }
  
  function parseSparxHomeworks(rawB64) {
    var tasks = [];
    if (!rawB64) return tasks;
    try {
      var raw = atob(rawB64);
      var len = raw.length;
      if (len < 5) return tasks;
      
      var pos = 0;
      var pkgCount = 0;
      while (pos < len - 4) {
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
              title: 'Package ' + pkgId.substr(0, 8) + '...',
              task_index: pkgCount,
              platform: 'sparx',
              token: _token,
              session_id: _sessionId
            });
            pkgCount++;
          }
          pos += strLen;
        } else { pos++; }
      }
      
      if (tasks.length === 0) {
        tasks.push({
          id: 'sp_default', package_id: rawB64.substr(0, 16),
          title: 'Sparx Homework', task_index: 0,
          platform: 'sparx', rawData: rawB64,
          token: _token, session_id: _sessionId
        });
      }
    } catch(e) {
      UI.log('error', 'Sparx parse: ' + e.message, document.getElementById('sparxLogContent'));
      tasks.push({
        id: 'sp_error', package_id: rawB64 ? rawB64.substr(0, 16) : '',
        title: 'Sparx Tasks (raw)', task_index: 0,
        platform: 'sparx', rawData: rawB64,
        token: _token, session_id: _sessionId
      });
    }
    return tasks;
  }
  
  // Sparx task runner for queue system
  async function sparxTaskRunner(task, index) {
    UI.log('info', 'Sparx: Starting activity ' + task.package_id, document.getElementById('sparxLogContent'));
    
    var startResp = await API.worker('/api/sparx/start-activity', {
      token: task.token || _token,
      package_id: task.package_id,
      task_index: task.task_index || 0,
      session_id: task.session_id || _sessionId
    });
    
    if (startResp && startResp.error) {
      throw new Error(startResp.error);
    }
    
    // Simulate working through problems
    var numProblems = UI.randomBetween(5, 15);
    for (var pi = 0; pi < numProblems; pi++) {
      if (!Queue.isRunning()) break;
      await UI.sleep(UI.randomBetween(3000, 7000));
      if (pi % 3 === 0) UI.log('info', 'Sparx: Problem ' + (pi+1) + '/' + numProblems, document.getElementById('sparxLogContent'));
      
      // Update progress
      var percent = ((index * numProblems + pi + 1) / (Queue.size() * numProblems)) * 100;
      UI.setProgress(percent, 'Sparx: ' + (pi+1) + '/' + numProblems + ' problems');
    }
    
    UI.log('success', 'Sparx: Completed package ' + task.package_id, document.getElementById('sparxLogContent'));
  }
  
  function sparxStartAuto() {
    var usage = Queue.checkUsage(_username || 'sparx-user');
    if (!usage.allowed) {
      UI.toast(usage.reason, 'error');
      return;
    }
    Queue.start(_username || 'sparx-user', sparxTaskRunner);
  }
  
  return {
    init: init,
    sparxExchange: sparxExchange,
    sparxFetchHomework: sparxFetchHomework,
    sparxStartAuto: sparxStartAuto,
    parseSparxHomeworks: parseSparxHomeworks,
    sparxTaskRunner: sparxTaskRunner
  };
})();

