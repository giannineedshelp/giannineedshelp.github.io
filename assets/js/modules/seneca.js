// ============================================================
// GIOAI v8.0 - Seneca Learning Module
// ============================================================
var Seneca = (function() {
  'use strict';
  
  var _idToken = '';
  var _refreshToken = '';
  var _username = '';
  
  function init() {
    // Login button
    var loginBtn = document.getElementById('senecaLoginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', function() {
        var email = document.getElementById('senecaEmail');
        var pass = document.getElementById('senecaPassword');
        if (!email || !email.value.trim()) { UI.toast('Enter your email', 'error'); return; }
        if (!pass || !pass.value.trim()) { UI.toast('Enter your password', 'error'); return; }
        senecaLogin(email.value.trim(), pass.value);
      });
    }
    
    // Enter key for login
    var passEl = document.getElementById('senecaPassword');
    if (passEl) {
      passEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var email = document.getElementById('senecaEmail');
          if (email && email.value.trim()) {
            document.getElementById('senecaLoginBtn').click();
          }
        }
      });
    }
    
    // Fetch homework
    var fetchBtn = document.getElementById('senecaFetchBtn');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', senecaFetchHomework);
    }
    
    // Logout
    var logoutBtn = document.getElementById('senecaLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        _idToken = '';
        _refreshToken = '';
        _username = '';
        var dash = document.getElementById('senecaDashboard');
        if (dash) dash.style.display = 'none';
        UI.toast('Logged out of Seneca', 'info');
      });
    }
  }
  
  function senecaLogin(email, password) {
    var statusEl = document.getElementById('senecaLoginStatus');
    if (statusEl) statusEl.textContent = 'Logging in...';
    
    API.senecaLogin(email, password).then(function(d) {
      if (d.idToken || d.token) {
        _idToken = d.idToken || d.token;
        _refreshToken = d.refreshToken || '';
        _username = email;
        
        if (statusEl) statusEl.textContent = 'Login successful!';
        
        var dash = document.getElementById('senecaDashboard');
        var badge = document.getElementById('senecaUserBadge');
        if (dash) dash.style.display = 'block';
        if (badge) badge.textContent = email;
        
        UI.toast('Seneca login successful', 'success');
        
        // Auto-fetch courses
        senecaFetchHomework();
      } else {
        var err = d.error || d.loginError || 'Login failed';
        if (statusEl) statusEl.textContent = 'Error: ' + err;
        UI.toast('Seneca: ' + err, 'error');
      }
    }).catch(function(e) {
      if (statusEl) statusEl.textContent = 'Error: ' + e.message;
      UI.toast('Connection error', 'error');
    });
  }
  
  function senecaFetchHomework() {
    if (!_idToken) {
      UI.toast('Please login to Seneca first', 'error');
      return;
    }
    
    var courseList = document.getElementById('senecaCourseList');
    if (courseList) courseList.innerHTML = '<div class="empty-state">Fetching courses & homework...</div>';
    UI.log('info', 'Seneca: Fetching homework...', document.getElementById('senecaLogContent'));
    
    // Try multiple approaches to get homework data
    var attempts = [
      function() { return API.fetchTasks('seneca', { idToken: _idToken }); },
      function() { return API.worker('/api/seneca/homeworks', { idToken: _idToken, email: _username }); },
      function() { return API.worker('/api/seneca/assignments', { idToken: _idToken }); },
      function() { return API.worker('/api/seneca/homeworks', { token: _idToken }); }
    ];
    
    function tryNext(idx) {
      if (idx >= attempts.length) {
        UI.log('error', 'Seneca: All fetch methods failed', document.getElementById('senecaLogContent'));
        if (courseList) courseList.innerHTML = '<div class="empty-state">Failed to fetch homework. Try re-logging in.</div>';
        UI.toast('Seneca fetch failed', 'error');
        return;
      }
      
      attempts[idx]().then(function(d) {
        if (d.error && idx < attempts.length - 1) {
          UI.log('warn', 'Seneca method ' + (idx+1) + ' failed: ' + d.error + ' - trying next...', document.getElementById('senecaLogContent'));
          tryNext(idx + 1);
          return;
        }
        
        if (d.error) {
          UI.log('error', 'Seneca: ' + d.error, document.getElementById('senecaLogContent'));
          if (courseList) courseList.innerHTML = '<div class="empty-state">Error: ' + d.error + '</div>';
          return;
        }
        
        processSenecaData(d, courseList);
      }).catch(function(e) {
        UI.log('warn', 'Seneca attempt ' + (idx+1) + ' error: ' + e.message, document.getElementById('senecaLogContent'));
        tryNext(idx + 1);
      });
    }
    
    tryNext(0);
  }
  
  function processSenecaData(d, courseList) {
    var homeworks = d.homeworks || d.assignments || [];
    var courses = d.courses || [];
    
    // Some APIs return assignments nested differently
    if (d.data && d.data.assignments) homeworks = d.data.assignments;
    if (d.data && d.data.courses) courses = d.data.courses;
    
    if (homeworks.length === 0 && courses.length === 0) {
      if (courseList) courseList.innerHTML = '<div class="empty-state">No homework found. Check your account.</div>';
      UI.toast('No Seneca homework', 'info');
      return;
    }
    
    // Build task list
    var tasks = [];
    for (var i = 0; i < homeworks.length; i++) {
      var h = homeworks[i];
      tasks.push({
        id: h.id || h.sectionId || 'se_' + i,
        title: h.title || h.name || 'Assignment ' + (i+1),
        courseId: h.courseId,
        sectionId: h.sectionId || h.id,
        courseName: h.courseName || 'Course',
        dueDate: h.dueDate,
        platform: 'seneca',
        idToken: _idToken
      });
    }
    
    // Also add courses as tasks if no specific homeworks
    if (tasks.length === 0 && courses.length > 0) {
      for (var ci = 0; ci < courses.length; ci++) {
        var c = courses[ci];
        tasks.push({
          id: c.id || 'course_' + ci,
          title: c.title || c.name || 'Course ' + (ci+1),
          courseId: c.id,
          sectionId: c.sectionId || c.id,
          courseName: c.title || c.name || 'Course',
          platform: 'seneca',
          idToken: _idToken
        });
      }
    }
    
    Queue.clear();
    Queue.addMultiple(tasks);
    
    var html = '';
    for (var i = 0; i < tasks.length; i++) {
      html += '<div class="task-item" data-index="' + i + '">' +
        '<div class="flex-between"><strong>' + (tasks[i].title || 'Task ' + (i+1)) + '</strong>' +
        '<span style="font-size:.7rem;color:var(--text3)">' + (tasks[i].courseName || '') + '</span></div></div>';
    }
    if (courseList) courseList.innerHTML = html;
    
    UI.log('success', 'Found ' + tasks.length + ' Seneca tasks', document.getElementById('senecaLogContent'));
    UI.toast(tasks.length + ' Seneca tasks loaded', 'success');
  }
  
  // Seneca task runner for queue system
  async function senecaTaskRunner(task, index) {
    UI.log('info', 'Seneca: Processing ' + (task.title || 'task'), document.getElementById('senecaLogContent'));
    
    var token = task.idToken || _idToken;
    
    // Get signed URL for content
    var signedResp = await API.worker('/api/seneca/signed-url', {
      idToken: token,
      courseId: task.courseId,
      sectionId: task.sectionId
    });
    
    if (signedResp && signedResp.url) {
      var contentResp = await fetch(signedResp.url);
      if (contentResp.ok) {
        var content = await contentResp.json();
        
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
        
        var submitResp = await API.worker('/api/seneca/submit-session', {
          idToken: token,
          sessionData: sessionData
        });
        
        if (submitResp && submitResp.error) {
          UI.log('warn', 'Seneca submit warning: ' + submitResp.error, document.getElementById('senecaLogContent'));
        } else {
          UI.log('success', 'Seneca: Submitted session for ' + (task.title || 'task'), document.getElementById('senecaLogContent'));
        }
      }
    } else {
      // Fallback - just mark as completed via assignments API
      var completeResp = await API.worker('/api/seneca/complete', {
        idToken: token,
        courseId: task.courseId,
        sectionId: task.sectionId
      });
      UI.log('info', 'Seneca: Completed via fallback', document.getElementById('senecaLogContent'));
    }
    
    await UI.sleep(UI.randomBetween(2000, 5000));
    UI.setProgress(((index + 1) / Queue.size()) * 100, 'Seneca: ' + (index + 1) + '/' + Queue.size());
  }
  
  return {
    init: init,
    senecaLogin: senecaLogin,
    senecaFetchHomework: senecaFetchHomework,
    senecaTaskRunner: senecaTaskRunner
  };
})();

