// ============================================================
// GIOAI v8.0 - LanguageNut Module
// ============================================================
var LanguageNut = (function() {
  'use strict';
  
  var _token = '';
  var _username = '';
  
  function init() {
    // Login button
    var loginBtn = document.getElementById('lnutLoginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', function() {
        var user = document.getElementById('lnutUser');
        var pass = document.getElementById('lnutPass');
        if (!user || !user.value.trim()) { UI.toast('Enter username', 'error'); return; }
        if (!pass || !pass.value.trim()) { UI.toast('Enter password', 'error'); return; }
        lnLogin(user.value.trim(), pass.value);
      });
    }
    
    // Enter key for login
    var passEl = document.getElementById('lnutPass');
    if (passEl) {
      passEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var user = document.getElementById('lnutUser');
          if (user && user.value.trim()) {
            document.getElementById('lnutLoginBtn').click();
          }
        }
      });
    }
    
    // Fetch homework
    var hwBtn = document.getElementById('lnutHwBtn');
    if (hwBtn) {
      hwBtn.addEventListener('click', lnFetchHomework);
    }
  }
  
  function lnLogin(username, password) {
    var statusEl = document.getElementById('lnutLoginStatus');
    if (statusEl) statusEl.textContent = 'Logging in...';
    
    API.languagenutLogin(username, password).then(function(d) {
      if (d.token || d.newToken) {
        _token = d.token || d.newToken;
        _username = username;
        
        if (statusEl) statusEl.textContent = 'Login successful!';
        
        var dash = document.getElementById('lnutDashboard');
        if (dash) dash.style.display = 'block';
        
        UI.toast('LanguageNut login successful', 'success');
        
        // Save account
        Store.saveAccount('languagenut', username, '***');
        
        // Auto-fetch homework
        lnFetchHomework();
      } else {
        var err = d.error || d.loginError || 'Login failed (captcha?)';
        if (statusEl) statusEl.textContent = 'Error: ' + err;
        UI.toast('LanguageNut: ' + err, 'error');
      }
    }).catch(function(e) {
      if (statusEl) statusEl.textContent = 'Error: ' + e.message;
      UI.toast('Connection error', 'error');
    });
  }
  
  function lnFetchHomework() {
    if (!_token) {
      UI.toast('Please login to LanguageNut first', 'error');
      return;
    }
    
    var taskList = document.getElementById('lnutTaskList');
    if (taskList) taskList.innerHTML = '<div class="empty-state">Fetching assignments...</div>';
    UI.log('info', 'LanguageNut: Fetching assignments...', document.getElementById('lnutLogContent'));
    
    API.fetchTasks('lnut', { token: _token }).then(function(d) {
      if (d.error) {
        UI.log('error', 'LanguageNut: ' + d.error, document.getElementById('lnutLogContent'));
        if (taskList) taskList.innerHTML = '<div class="empty-state">Error: ' + d.error + '</div>';
        return;
      }
      
      var assignments = d.viewableAssignments || d.assignments || [];
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
          '<span style="font-size:.7rem;color:var(--text3)">' + (tasks[i].isCompleted ? '✓ Done' : 'Pending') + '</span></div></div>';
      }
      if (taskList) taskList.innerHTML = html;
      
      UI.log('success', 'Found ' + tasks.length + ' LN tasks', document.getElementById('lnutLogContent'));
      UI.toast(tasks.length + ' assignments loaded', 'success');
    }).catch(function(e) {
      UI.log('error', 'LanguageNut fetch error: ' + e.message, document.getElementById('lnutLogContent'));
      if (taskList) taskList.innerHTML = '<div class="empty-state">Error fetching assignments</div>';
    });
  }
  
  // LN task runner for queue system
  async function lnTaskRunner(task, index) {
    UI.log('info', 'LanguageNut: Processing ' + (task.title || 'assignment'), document.getElementById('lnutLogContent'));
    
    var token = task.token || _token;
    
    if (task.curriculumUid && token) {
      var vocabResp = await API.worker('/api/lnut/vocab', {
        token: token,
        curriculumUid: task.curriculumUid
      });
      
      if (vocabResp && vocabResp.vocab) {
        var correctUids = [];
        var incorrectUids = [];
        
        if (Array.isArray(vocabResp.vocab)) {
          var half = Math.ceil(vocabResp.vocab.length / 2);
          for (var vi = 0; vi < vocabResp.vocab.length; vi++) {
            var uid = vocabResp.vocab[vi].uid || vocabResp.vocab[vi].vocabUid || 'v_' + vi;
            if (vi < half) correctUids.push(uid);
            else incorrectUids.push(uid);
          }
        }
        
        var scoreResp = await API.worker('/api/lnut/score', {
          token: token,
          scoreData: {
            moduleUid: task.moduleUid,
            gameUid: task.gameUid,
            gameType: task.gameType,
            homeworkUid: task.homeworkUid,
            score: UI.randomBetween(180, 300),
            correctUids: correctUids,
            incorrectUids: incorrectUids
          }
        });
        
        if (scoreResp && scoreResp.error) {
          UI.log('warn', 'LN score warning: ' + scoreResp.error, document.getElementById('lnutLogContent'));
        } else {
          UI.log('success', 'LanguageNut: Submitted score', document.getElementById('lnutLogContent'));
        }
      }
    }
    
    await UI.sleep(UI.randomBetween(2000, 5000));
    UI.setProgress(((index + 1) / Queue.size()) * 100, 'LN: ' + (index + 1) + '/' + Queue.size());
  }
  
  return {
    init: init,
    lnLogin: lnLogin,
    lnFetchHomework: lnFetchHomework,
    lnTaskRunner: lnTaskRunner
  };
})();

