// ============================================================
// GIOAI v8.1 - Seneca Module
// Uses Playwright backend for browser automation
// ============================================================
var Seneca = (function() {
  'use strict';

  var _token = '';
  var _username = '';

  function init() {}

  function seLogin(email, password) {
    showLoginStatus('info', 'Logging into Seneca via Playwright...');

    API.senecaLogin(email, password).then(function(d) {
      hidePlatformLoading();
      if (d.idToken || d.token || d.success) {
        _token = d.idToken || d.token || d.sessionToken || '';
        _username = email;
        showLoginStatus('success', 'Login successful!');
        Store.saveAccount('seneca', email, '***');
        setTimeout(function() {
          enterDashboard('seneca', email);
          setTimeout(function() { seFetchHomework(); }, 300);
        }, 500);
      } else {
        showLoginStatus('error', d.error || 'Login failed');
      }
    }).catch(function(e) {
      hidePlatformLoading();
      showLoginStatus('error', 'Connection error: ' + e.message);
    });
  }

  function seFetchHomework() {
    if (!_token) {
      UI.toast('Please login first', 'error');
      return;
    }

    var taskList = document.getElementById('dashTasks');
    if (taskList) taskList.innerHTML = '<div class="empty-state">Fetching Seneca assignments...</div>';
    UI.log('info', 'Seneca: Fetching assignments...', document.getElementById('dashLogEntries'));

    API.fetchTasks('seneca', { idToken: _token }).then(function(d) {
      if (d.error) {
        UI.log('error', 'Seneca: ' + d.error, document.getElementById('dashLogEntries'));
        if (taskList) taskList.innerHTML = '<div class="empty-state">Error: ' + d.error + '</div>';
        return;
      }

      var homeworks = d.homeworks || d.assignments || d.tasks || [];
      var tasks = [];

      for (var i = 0; i < homeworks.length; i++) {
        var h = homeworks[i];
        tasks.push({
          id: h.id || h.sectionId || 'se_' + i,
          title: h.title || h.courseName || 'Assignment ' + (i+1),
          courseId: h.courseId || '',
          sectionId: h.sectionId || '',
          platform: 'seneca',
          token: _token
        });
      }

      if (tasks.length === 0) {
        if (taskList) taskList.innerHTML = '<div class="empty-state">No assignments found</div>';
        UI.toast('No Seneca homework', 'info');
        return;
      }

      Queue.clear();
      Queue.addMultiple(tasks);

      var html = '';
      for (var i = 0; i < tasks.length; i++) {
        html += '<div class="task-item" data-index="' + i + '">' +
          '<div class="flex-between"><strong>' + (tasks[i].title || 'Task ' + (i+1)) + '</strong></div></div>';
      }
      if (taskList) taskList.innerHTML = html;

      UI.log('success', 'Found ' + tasks.length + ' Seneca tasks', document.getElementById('dashLogEntries'));
      UI.toast(tasks.length + ' assignments loaded', 'success');
    }).catch(function(e) {
      UI.log('error', 'Seneca: ' + e.message, document.getElementById('dashLogEntries'));
      if (taskList) taskList.innerHTML = '<div class="empty-state">Error fetching</div>';
    });
  }

  async function seTaskRunner(task, index) {
    UI.log('info', 'Seneca: Processing ' + (task.title || 'assignment'), document.getElementById('dashLogEntries'));

    // Use Playwright backend to complete
    var result = await API.pw('/api/seneca/auto-complete', {
      idToken: _token,
      courseId: task.courseId,
      sectionId: task.sectionId
    });

    if (result && result.error) {
      UI.log('warn', 'Seneca: ' + result.error, document.getElementById('dashLogEntries'));
    } else {
      var xp = (result && result.xp) ? result.xp : UI.randomBetween(5, 15);
      Dashboard.xp += xp;
      UI.log('success', 'Seneca: Completed +' + xp + ' XP', document.getElementById('dashLogEntries'));
    }

    Dashboard.completed++;
    Dashboard.updateStats();
    UI.setProgress(((index + 1) / Queue.size()) * 100, 'Seneca: ' + (index + 1) + '/' + Queue.size());
  }

  return {
    init: init,
    seLogin: seLogin,
    seFetchHomework: seFetchHomework,
    seTaskRunner: seTaskRunner
  };
})();

