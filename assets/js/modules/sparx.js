// ============================================================
// GIOAI v8.1 - Sparx Maths Module
// Uses Playwright backend for browser automation
// ============================================================
var Sparx = (function() {
  'use strict';

  var _token = '';
  var _username = '';
  var _tasks = [];

  function init() {
    // Bind dashboard buttons
    document.addEventListener('DOMContentLoaded', function() {
      // Sparx-specific log buttons are in sparxLoginFlow in main.js
    });
  }

  function sparxFetchHomework() {
    if (!_token) {
      UI.toast('Please login to Sparx first', 'error');
      return;
    }

    var taskList = document.getElementById('dashTasks');
    if (taskList) taskList.innerHTML = '<div class="empty-state">Fetching homework via Playwright...</div>';
    UI.log('info', 'Sparx: Fetching homework via Playwright', document.getElementById('dashLogEntries'));

    API.fetchTasks('sparx', { token: _token }).then(function(d) {
      if (d.error) {
        UI.log('error', 'Sparx: ' + d.error, document.getElementById('dashLogEntries'));
        if (taskList) taskList.innerHTML = '<div class="empty-state">Error: ' + d.error + '</div>';
        return;
      }

      var tasks = [];
      if (d.tasks && Array.isArray(d.tasks)) {
        tasks = d.tasks.map(function(t, i) {
          return { id: t.id || 'sp_' + i, title: t.title || 'Sparx Task', package_id: t.package_id || '', task_index: t.task_index || 0, platform: 'sparx', token: _token };
        });
      } else if (d.raw) {
        tasks = parseSparxHomeworks(d.raw);
      }

      if (tasks.length === 0) {
        if (taskList) taskList.innerHTML = '<div class="empty-state">No homework found</div>';
        UI.toast('No Sparx homework', 'info');
        return;
      }

      _tasks = tasks;
      Queue.clear();
      Queue.addMultiple(tasks);

      var html = '';
      for (var i = 0; i < tasks.length; i++) {
        html += '<div class="task-item" data-index="' + i + '">' +
          '<div class="flex-between"><strong>' + (tasks[i].title || 'Task ' + (i+1)) + '</strong>' +
          '<span style="font-size:11px;color:var(--text3)">' + (tasks[i].package_id ? tasks[i].package_id.substr(0, 8) + '...' : '') + '</span></div></div>';
      }
      if (taskList) taskList.innerHTML = html;

      UI.log('success', 'Found ' + tasks.length + ' Sparx tasks', document.getElementById('dashLogEntries'));
      UI.toast(tasks.length + ' tasks loaded', 'success');
    }).catch(function(e) {
      UI.log('error', 'Sparx: ' + e.message, document.getElementById('dashLogEntries'));
      if (taskList) taskList.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
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
              token: _token
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
          platform: 'sparx', rawData: rawB64, token: _token
        });
      }
    } catch(e) {
      tasks.push({
        id: 'sp_error', package_id: rawB64 ? rawB64.substr(0, 16) : '',
        title: 'Sparx Tasks (raw)', task_index: 0,
        platform: 'sparx', rawData: rawB64, token: _token
      });
    }
    return tasks;
  }

  // Sparx task runner - uses Playwright server to complete tasks
  async function sparxTaskRunner(task, index) {
    UI.log('info', 'Sparx: Starting ' + (task.title || 'task'), document.getElementById('dashLogEntries'));

    // Tell the Playwright server to start and complete this activity
    var resp = await API.pw('/api/sparx/complete-task', {
      token: _token,
      package_id: task.package_id,
      task_index: task.task_index || 0
    });

    if (resp && resp.error) {
      throw new Error(resp.error);
    }

    var xpGained = resp && resp.xp ? resp.xp : UI.randomBetween(10, 30);
    Dashboard.xp += xpGained;
    Dashboard.completed++;
    Dashboard.updateStats();

    UI.setProgress(((index + 1) / Queue.size()) * 100, 'Sparx: ' + (index + 1) + '/' + Queue.size());
    UI.log('success', 'Sparx: Completed ' + (task.title || 'task') + ' (+' + xpGained + ' XP)', document.getElementById('dashLogEntries'));
  }

  function sparxStartAuto() {
    var username = APP.username || 'sparx-user';
    var usage = Queue.checkUsage(username);
    if (!usage.allowed) {
      UI.toast(usage.reason, 'error');
      return;
    }
    Queue.start(username, sparxTaskRunner);
  }

  return {
    init: init,
    sparxFetchHomework: sparxFetchHomework,
    sparxStartAuto: sparxStartAuto,
    parseSparxHomeworks: parseSparxHomeworks,
    sparxTaskRunner: sparxTaskRunner
  };
})();

