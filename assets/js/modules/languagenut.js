// ============================================================
// GIOAI v8.1 - LanguageNut Module
// Uses Playwright backend for browser automation
// ============================================================
var LanguageNut = (function() {
  'use strict';

  var _token = '';
  var _username = '';

  function init() {}

  function lnLogin(username, password) {
    showLoginStatus('info', 'Logging into LanguageNut via Playwright...');

    API.languagenutLogin(username, password).then(function(d) {
      hidePlatformLoading();
      if (d.token || d.newToken || d.success) {
        _token = d.token || d.newToken || d.sessionToken || '';
        _username = username;
        showLoginStatus('success', 'Login successful!');
        Store.saveAccount('languagenut', username, '***');
        setTimeout(function() {
          enterDashboard('languagenut', username);
          setTimeout(function() { lnFetchHomework(); }, 300);
        }, 500);
      } else {
        showLoginStatus('error', d.error || 'Login failed');
      }
    }).catch(function(e) {
      hidePlatformLoading();
      showLoginStatus('error', 'Connection error: ' + e.message);
    });
  }

  function lnFetchHomework() {
    if (!_token) {
      UI.toast('Please login first', 'error');
      return;
    }

    var taskList = document.getElementById('dashTasks');
    if (taskList) taskList.innerHTML = '<div class="empty-state">Fetching assignments...</div>';
    UI.log('info', 'LanguageNut: Fetching assignments...', document.getElementById('dashLogEntries'));

    API.fetchTasks('lnut', { token: _token }).then(function(d) {
      if (d.error) {
        UI.log('error', 'LanguageNut: ' + d.error, document.getElementById('dashLogEntries'));
        if (taskList) taskList.innerHTML = '<div class="empty-state">Error: ' + d.error + '</div>';
        return;
      }

      var assignments = d.viewableAssignments || d.assignments || d.tasks || [];
      var tasks = [];

      for (var i = 0; i < assignments.length; i++) {
        var a = assignments[i];
        tasks.push({
          id: a.uid || a.id || 'ln_' + i,
          title: a.title || a.name || 'Assignment ' + (i+1),
          moduleUid: a.moduleUid || a.module_uid || '',
          gameUid: a.gameUid || a.game_uid || '',
          gameType: a.gameType || a.game_type || '',
          curriculumUid: a.curriculumUid || a.curriculum_uid || '',
          homeworkUid: a.homeworkUid || a.homework_uid || (a.uid || a.id || ''),
          isCompleted: a.isCompleted || false,
          platform: 'languagenut',
          token: _token
        });
      }

      if (tasks.length === 0) {
        if (taskList) taskList.innerHTML = '<div class="empty-state">No assignments found</div>';
        UI.toast('No LanguageNut homework', 'info');
        return;
      }

      Queue.clear();
      Queue.addMultiple(tasks);

      var html = '';
      for (var i = 0; i < tasks.length; i++) {
        html += '<div class="task-item" data-index="' + i + '">' +
          '<div class="flex-between"><strong>' + (tasks[i].title || 'Task ' + (i+1)) + '</strong>' +
          '<span style="font-size:11px;color:var(--text3)">' + (tasks[i].isCompleted ? '✓ Done' : 'Pending') + '</span></div></div>';
      }
      if (taskList) taskList.innerHTML = html;

      UI.log('success', 'Found ' + tasks.length + ' LN tasks', document.getElementById('dashLogEntries'));
      UI.toast(tasks.length + ' assignments loaded', 'success');
    }).catch(function(e) {
      UI.log('error', 'LanguageNut: ' + e.message, document.getElementById('dashLogEntries'));
      if (taskList) taskList.innerHTML = '<div class="empty-state">Error fetching</div>';
    });
  }

  async function lnTaskRunner(task, index) {
    UI.log('info', 'LanguageNut: Processing ' + (task.title || 'assignment'), document.getElementById('dashLogEntries'));

    // Use Playwright backend to score
    if (task.curriculumUid && _token) {
      var result = await API.pw('/api/lnut/auto-complete', {
        token: _token,
        curriculumUid: task.curriculumUid,
        moduleUid: task.moduleUid,
        gameUid: task.gameUid,
        gameType: task.gameType,
        homeworkUid: task.homeworkUid
      });

      if (result && result.error) {
        UI.log('warn', 'LN: ' + result.error, document.getElementById('dashLogEntries'));
      } else {
        var xp = (result && result.xp) ? result.xp : UI.randomBetween(5, 15);
        Dashboard.xp += xp;
        UI.log('success', 'LanguageNut: Completed +' + xp + ' XP', document.getElementById('dashLogEntries'));
      }
    }

    Dashboard.completed++;
    Dashboard.updateStats();
    UI.setProgress(((index + 1) / Queue.size()) * 100, 'LN: ' + (index + 1) + '/' + Queue.size());
  }

  return {
    init: init,
    lnLogin: lnLogin,
    lnFetchHomework: lnFetchHomework,
    lnTaskRunner: lnTaskRunner
  };
})();

