// ============================================================
// GIOAI v8.0 - Main Application Entry Point
// Complete rewrite with modules, queue system, usage limits
// ============================================================
(function() {
  'use strict';

  var APP = {
    currentPlatform: '',
    username: '',
    token: '',
    userData: null,
    initialized: false
  };

  // ===== DOM CACHE =====
  var $ = {};
  function cacheDOM() {
    var ids = [
      'appLoading', 'bootProgress', 'bootStatus', 'bootLines',
      'sidebar', 'sidebarOverlay', 'sidebarClose', 'hamburgerBtn',
      'sidebarUserName', 'sidebarUserPlatform', 'sidebarVersion',
      'disclaimer', 'disclaimerAgree', 'disclaimerContinue',
      'hubScreen', 'statusScreen', 'adminScreen', 'donateScreen',
      'platformLoginScreen', 'platformLoginTitle', 'loginPlatformBadge',
      'platformUsername', 'platformPassword', 'platformLoginBtn',
      'loginStatus', 'loginStatusText', 'backToHub',
      'senecaLoginExtra', 'sparxLoginExtra',
      'dashboardScreen', 'dashUserDisplay', 'dashStatusDot',
      'dashPlatformBadge', 'dashTasks', 'dashLogEntries',
      'dashFetchBtn', 'dashStartBtn', 'dashStopBtn', 'dashLogoutBtn',
      'dashSettingsBtn', 'dashStatCompleted', 'dashStatXp', 'dashStatErrors',
      'dashProgressFill', 'dashProgressText',
      'settingsScreen', 'settingsBackBtn',
      'changelogOverlay', 'changelogClose', 'changelogDismiss', 'changelogBody', 'changelogList',
      'notifOverlay', 'notifClose', 'notifBadge', 'notifBell',
      'announcementList', 'statusContent', 'appVersion',
      'globalLog', 'queueTotal', 'queueStatus',
      'themeSelector', 'adminPassword', 'adminLoginBtn', 'adminAuthError',
      'adminContent', 'adminUsername', 'adminAmount', 'adminKey',
      'adminGiveSlotsBtn', 'adminResult',
      'adminPlatformStatus', 'adminCheckPlatformsBtn',
      'adminAnnouncementMsg', 'adminAnnouncementType', 'adminAnnouncementBtn', 'adminAnnouncementResult',
      'adminBlacklistUser', 'adminBlacklistAction', 'adminBlacklistBtn', 'adminBlacklistResult',
      'adminStatusPlatform', 'adminStatusValue', 'adminPlatStatusBtn', 'adminStatusResult',
      'adminLogoutBtn'
    ];
    for (var i = 0; i < ids.length; i++) {
      $[ids[i]] = document.getElementById(ids[i]);
    }
    $.sidebarLinks = Array.from(document.querySelectorAll('.sidebar-link'));
    $.hubCards = Array.from(document.querySelectorAll('.hub-card'));
  }

  // ===== BOOT SEQUENCE =====
  function boot() {
    cacheDOM();
    
    // Apply saved theme
    var savedTheme = Store.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update version
    if ($.appVersion) $.appVersion.textContent = 'v' + CONFIG.VERSION;
    if ($.sidebarVersion) $.sidebarVersion.textContent = 'v' + CONFIG.VERSION;
    
    // Boot animation
    var bootLines = [
      '> GIOAI kernel v' + CONFIG.VERSION + ' loading...',
      '> Initializing modules...',
      '> Connecting to worker: ' + CONFIG.WORKER_URL,
      '> Loading platform handlers...',
      '> System ready.'
    ];
    
    var lineIdx = 0;
    var progress = 0;
    var bootInterval = setInterval(function() {
      progress += 8;
      if ($.bootProgress) $.bootProgress.style.width = Math.min(100, progress) + '%';
      
      if (lineIdx < bootLines.length && progress >= (lineIdx + 1) * 20) {
        if ($.bootLines) {
          var line = document.createElement('div');
          line.className = 'boot-line';
          line.textContent = bootLines[lineIdx];
          $.bootLines.appendChild(line);
        }
        if ($.bootStatus) $.bootStatus.textContent = bootLines[lineIdx].replace('> ', '');
        lineIdx++;
      }
      
      if (progress >= 100) {
        clearInterval(bootInterval);
        setTimeout(function() {
          if ($.appLoading) $.appLoading.classList.remove('active');
          APP.initialized = true;
          
          // Check changelog
          if (Store.get('changelog-seen') !== CONFIG.VERSION) {
            showChangelog();
          }
          
          // Start periodic status checks
          setInterval(checkWorkerStatus, 60000);
          checkWorkerStatus();
        }, 500);
      }
    }, 150);
    
    // Setup all event listeners after DOM is ready
    setTimeout(setupEventListeners, 100);
  }
  
  // ===== EVENT LISTENERS =====
  function setupEventListeners() {
    // Sidebar
    if ($.hamburgerBtn) $.hamburgerBtn.addEventListener('click', function() {
      if ($.sidebar) $.sidebar.classList.add('active');
      if ($.sidebarOverlay) $.sidebarOverlay.classList.add('active');
    });
    if ($.sidebarClose) $.sidebarClose.addEventListener('click', closeSidebar);
    if ($.sidebarOverlay) $.sidebarOverlay.addEventListener('click', closeSidebar);
    
    $.sidebarLinks.forEach(function(link) {
      link.addEventListener('click', function() {
        var screen = this.dataset.screen;
        if (screen) {
          closeSidebar();
          if (screen === 'status') { loadStatusPage(); }
          UI.showScreen(screen + 'Screen');
        }
      });
    });
    
    // Hub cards - platform selection
    $.hubCards.forEach(function(card) {
      card.addEventListener('click', function() {
        var platform = this.dataset.platform;
        if (platform) openPlatformLogin(platform);
      });
    });
    
    // Disclaimer
    if ($.disclaimerAgree) $.disclaimerAgree.addEventListener('click', function() {
      if ($.disclaimer) $.disclaimer.style.display = 'none';
      Store.set('disclaimer-accepted', 'true');
    });
    if ($.disclaimerContinue) $.disclaimerContinue.addEventListener('click', function() {
      if ($.disclaimer) $.disclaimer.style.display = 'none';
    });
    
    // Back to hub
    if ($.backToHub) $.backToHub.addEventListener('click', function() {
      UI.showScreen('hubScreen');
    });
    
    // Platform login button
    if ($.platformLoginBtn) $.platformLoginBtn.addEventListener('click', doPlatformLogin);
    
    // Dashboard controls
    if ($.dashFetchBtn) $.dashFetchBtn.addEventListener('click', function() { fetchCurrentTasks(); });
    if ($.dashStartBtn) $.dashStartBtn.addEventListener('click', function() { startTaskQueue(); });
    if ($.dashStopBtn) $.dashStopBtn.addEventListener('click', function() { Queue.stop(); });
    if ($.dashLogoutBtn) $.dashLogoutBtn.addEventListener('click', logout);
    if ($.dashSettingsBtn) $.dashSettingsBtn.addEventListener('click', function() { UI.showScreen('settingsScreen'); });
    
    // Settings
    if ($.settingsBackBtn) $.settingsBackBtn.addEventListener('click', function() { UI.showScreen('dashboardScreen'); });
    
    // Theme selector
    setupThemeSelector();
    
    // Admin
    if ($.adminLoginBtn) $.adminLoginBtn.addEventListener('click', adminLogin);
    if ($.adminPassword) $.adminPassword.addEventListener('keydown', function(e) { if (e.key === 'Enter') adminLogin(); });
    if ($.adminGiveSlotsBtn) $.adminGiveSlotsBtn.addEventListener('click', adminGiveSlots);
    if ($.adminBlacklistBtn) $.adminBlacklistBtn.addEventListener('click', adminBlacklist);
    if ($.adminAnnouncementBtn) $.adminAnnouncementBtn.addEventListener('click', adminAnnouncement);
    if ($.adminPlatStatusBtn) $.adminPlatStatusBtn.addEventListener('click', adminSetPlatformStatus);
    if ($.adminCheckPlatformsBtn) $.adminCheckPlatformsBtn.addEventListener('click', adminCheckPlatforms);
    if ($.adminLogoutBtn) $.adminLogoutBtn.addEventListener('click', adminLogout);
    
    // Notification bell
    if ($.notifBell) $.notifBell.addEventListener('click', function() {
      if ($.notifOverlay) $.notifOverlay.style.display = 'flex';
      loadNotifications();
    });
    if ($.notifClose) $.notifClose.addEventListener('click', function() {
      if ($.notifOverlay) $.notifOverlay.style.display = 'none';
    });
    
    // Changelog
    if ($.changelogClose) $.changelogClose.addEventListener('click', function() {
      if ($.changelogOverlay) $.changelogOverlay.style.display = 'none';
    });
    if ($.changelogDismiss) $.changelogDismiss.addEventListener('click', function() {
      if ($.changelogOverlay) $.changelogOverlay.style.display = 'none';
      Store.set('changelog-seen', CONFIG.VERSION);
    });
    
    // Status refresh
    var statusRefreshBtn = document.getElementById('statusRefreshBtn');
    if (statusRefreshBtn) statusRefreshBtn.addEventListener('click', loadStatusPage);
    
    // Queue events
    Queue.on('update', function(data) {
      if ($.dashStatCompleted) $.dashStatCompleted.textContent = data.completed;
      if ($.dashStatErrors) $.dashStatErrors.textContent = data.errors;
      if ($.dashStatXp) $.dashStatXp.textContent = data.completed * 150;
      var total = data.completed + data.errors + Math.max(0, data.remaining);
      var pct = total > 0 ? ((data.completed + data.errors) / total * 100) : 0;
      if ($.dashProgressFill) $.dashProgressFill.style.width = pct + '%';
      if ($.dashProgressText) $.dashProgressText.textContent = data.completed + '/' + total + ' done';
      Queue.updateUI();
    });
    
    Queue.on('start', function() { Queue.updateUI(); });
    Queue.on('stop', function() { Queue.updateUI(); });
    Queue.on('finish', function() { Queue.updateUI(); });
  }
  
  function closeSidebar() {
    if ($.sidebar) $.sidebar.classList.remove('active');
    if ($.sidebarOverlay) $.sidebarOverlay.classList.remove('active');
  }
  
  // ===== THEME SELECTOR =====
  function setupThemeSelector() {
    var container = $.themeSelector || document.getElementById('settingsScreen');
    if (!container) return;
    
    // Build theme buttons if not already present
    var existing = container.querySelector('.theme-selector-lg');
    if (!existing) return;
    
    var btns = existing.querySelectorAll('.theme-btn-lg');
    btns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var theme = this.dataset.theme;
        Store.setTheme(theme);
        btns.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        UI.toast('Theme: ' + theme, 'success');
      });
    });
    
    // Set active theme
    var current = Store.getTheme();
    btns.forEach(function(b) {
      if (b.dataset.theme === current) b.classList.add('active');
    });
  }
  
  // ===== PLATFORM LOGIN =====
  function openPlatformLogin(platform) {
    APP.currentPlatform = platform;
    if ($.platformLoginTitle) $.platformLoginTitle.textContent = platform.charAt(0).toUpperCase() + platform.slice(1) + ' Login';
    if ($.loginPlatformBadge) {
      var info = CONFIG.PLATFORMS[platform] || { icon: '?', color: '#888' };
      $.loginPlatformBadge.textContent = info.icon;
      $.loginPlatformBadge.style.color = info.color;
    }
    
    // Show/hide extra fields
    if ($.senecaLoginExtra) $.senecaLoginExtra.style.display = platform === 'seneca' ? 'block' : 'none';
    if ($.sparxLoginExtra) $.sparxLoginExtra.style.display = platform === 'sparx' ? 'block' : 'none';
    
    // Update placeholder
    if ($.platformUsername) {
      $.platformUsername.placeholder = platform === 'seneca' ? 'Email address' : 'Username';
      $.platformUsername.value = '';
    }
    if ($.platformPassword) $.platformPassword.value = '';
    hideLoginStatus();
    
    UI.showScreen('platformLoginScreen');
  }
  
  function doPlatformLogin() {
    var username = $.platformUsername ? $.platformUsername.value.trim() : '';
    var password = $.platformPassword ? $.platformPassword.value : '';
    
    if (!username || !password) {
      showLoginStatus('error', 'Please enter your credentials');
      return;
    }
    
    showLoginStatus('info', 'Logging in...');
    showPlatformLoading(APP.currentPlatform);
    
    var platform = APP.currentPlatform;
    
    if (platform === 'seneca') {
      API.senecaLogin(username, password).then(function(d) {
        hidePlatformLoading();
        if (d.idToken || d.token) {
          APP.token = d.idToken || d.token;
          APP.username = username;
          APP.userData = d;
          enterDashboard('seneca');
          UI.log('success', 'Seneca: Logged in as ' + username);
          UI.toast('Seneca login successful', 'success');
        } else {
          showLoginStatus('error', d.error || 'Login failed');
          UI.log('error', 'Seneca: ' + (d.error || 'Login failed'));
        }
      }).catch(function(e) {
        hidePlatformLoading();
        showLoginStatus('error', 'Error: ' + e.message);
      });
      
    } else if (platform === 'languagenut') {
      API.languagenutLogin(username, password).then(function(d) {
        hidePlatformLoading();
        if (d.token || d.newToken) {
          APP.token = d.token || d.newToken;
          APP.username = username;
          APP.userData = d;
          enterDashboard('languagenut');
          UI.log('success', 'LanguageNut: Logged in as ' + username);
          UI.toast('LanguageNut login successful', 'success');
        } else {
          showLoginStatus('error', d.error || 'Login failed (captcha?)');
          UI.log('error', 'LanguageNut: ' + (d.error || 'Login failed'));
        }
      }).catch(function(e) {
        hidePlatformLoading();
        showLoginStatus('error', 'Error: ' + e.message);
      });
      
    } else if (platform === 'sparx') {
      // Sparx uses school-based login flow
      showLoginStatus('info', 'Sparx requires school selection. Use sparx-auto.html for full Sparx support.');
      hidePlatformLoading();
    }
  }
  
  function enterDashboard(platform) {
    APP.currentPlatform = platform;
    var info = CONFIG.PLATFORMS[platform] || { icon: '?', color: '#888' };
    
    if ($.dashUserDisplay) $.dashUserDisplay.textContent = APP.username;
    if ($.dashStatusDot) $.dashStatusDot.className = 'status-dot online';
    if ($.dashPlatformBadge) $.dashPlatformBadge.textContent = info.icon;
    if ($.sidebarUserName) $.sidebarUserName.textContent = APP.username;
    if ($.sidebarUserPlatform) $.sidebarUserPlatform.textContent = platform;
    
    // Reset stats
    if ($.dashStatCompleted) $.dashStatCompleted.textContent = '0';
    if ($.dashStatXp) $.dashStatXp.textContent = '0';
    if ($.dashStatErrors) $.dashStatErrors.textContent = '0';
    if ($.dashProgressFill) $.dashProgressFill.style.width = '0%';
    if ($.dashProgressText) $.dashProgressText.textContent = '';
    
    if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Click Fetch Tasks to load assignments</div>';
    if ($.dashLogEntries) $.dashLogEntries.innerHTML = '<div class="log-entry log-info">→ Logged into ' + platform + '</div>';
    
    // Initialize queue
    Queue.init(platform);
    
    UI.showScreen('dashboardScreen');
    
    // Try to load saved settings
    if (Store.get('theme')) {
      Store.setTheme(Store.get('theme'));
    }
  }
  
  function logout() {
    APP.currentPlatform = '';
    APP.username = '';
    APP.token = '';
    APP.userData = null;
    Queue.clear();
    if ($.dashTasks) $.dashTasks.innerHTML = '';
    if ($.dashLogEntries) $.dashLogEntries.innerHTML = '';
    if ($.sidebarUserName) $.sidebarUserName.textContent = 'Guest';
    if ($.sidebarUserPlatform) $.sidebarUserPlatform.textContent = '';
    UI.showScreen('hubScreen');
    UI.toast('Logged out', 'info');
  }
  
  // ===== FETCH TASKS =====
  function fetchCurrentTasks() {
    var platform = APP.currentPlatform;
    if (!platform) { UI.toast('Not logged in', 'error'); return; }
    if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Fetching tasks...</div>';
    UI.log('info', 'Fetching ' + platform + ' tasks...');
    
    var authData = {};
    if (platform === 'seneca') authData = { idToken: APP.token };
    else if (platform === 'languagenut') authData = { token: APP.token };
    else if (platform === 'sparx') authData = { token: APP.token };
    
    API.fetchTasks(platform, authData).then(function(d) {
      if (d.error) {
        UI.log('error', platform + ': ' + d.error);
        if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Error: ' + d.error + '</div>';
        return;
      }
      
      var tasks = [];
      if (platform === 'seneca') tasks = parseSenecaTasks(d);
      else if (platform === 'languagenut') tasks = parseLnTasks(d);
      else if (platform === 'sparx') tasks = parseSparxTasksFromAPI(d);
      
      if (tasks.length === 0) {
        if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">No tasks found</div>';
        UI.toast('No tasks found', 'info');
        return;
      }
      
      Queue.clear();
      Queue.addMultiple(tasks);
      
      renderTaskList(tasks);
      UI.log('success', 'Found ' + tasks.length + ' tasks');
      UI.toast(tasks.length + ' tasks loaded', 'success');
    }).catch(function(e) {
      UI.log('error', platform + ' fetch error: ' + e.message);
      if ($.dashTasks) $.dashTasks.innerHTML = '<div class="empty-state">Error: ' + e.message + '</div>';
    });
  }
  
  function parseSenecaTasks(d) {
    var tasks = [];
    var homeworks = d.homeworks || d.assignments || [];
    for (var i = 0; i < homeworks.length; i++) {
      var h = homeworks[i];
      tasks.push({
        id: h.id || h.sectionId || 'se_' + i,
        title: h.title || 'Assignment ' + (i+1),
        courseId: h.courseId,
        sectionId: h.sectionId || h.id,
        courseName: h.courseName || '',
        platform: 'seneca',
        idToken: APP.token
      });
    }
    return tasks;
  }
  
  function parseLnTasks(d) {
    var tasks = [];
    var assignments = d.viewableAssignments || d.assignments || [];
    for (var i = 0; i < assignments.length; i++) {
      var a = assignments[i];
      tasks.push({
        id: a.uid || a.id || 'ln_' + i,
        title: a.title || 'Assignment ' + (i+1),
        moduleUid: a.moduleUid || '',
        gameUid: a.gameUid || '',
        gameType: a.gameType || '',
        curriculumUid: a.curriculumUid || '',
        homeworkUid: a.homeworkUid || (a.uid || ''),
        platform: 'languagenut',
        token: APP.token
      });
    }
    return tasks;
  }
  
  function parseSparxTasksFromAPI(d) {
    if (d.raw) {
      return Sparx.parseSparxHomeworks(d.raw);
    }
    if (d.tasks) {
      return d.tasks.map(function(t, i) {
        return { id: t.id || 'sp_' + i, title: t.title || 'Task ' + (i+1), platform: 'sparx', token: APP.token };
      });
    }
    return [];
  }
  
  function renderTaskList(tasks) {
    if (!$.dashTasks) return;
    var html = '';
    for (var i = 0; i < tasks.length; i++) {
      html += '<div class="task-card" data-index="' + i + '">' +
        '<div class="task-check"><div class="task-checkbox"></div></div>' +
        '<div class="task-info">' +
        '<div class="task-title">' + (tasks[i].title || 'Task ' + (i+1)) + '</div>' +
        '<div class="task-meta">' + (tasks[i].courseName || tasks[i].platform || '') + '</div>' +
        '</div></div>';
    }
    $.dashTasks.innerHTML = html;
  }
  
  // ===== START TASK QUEUE =====
  function startTaskQueue() {
    if (!APP.username) { UI.toast('Not logged in', 'error'); return; }
    
    var usage = Queue.checkUsage(APP.username);
    if (!usage.allowed) {
      UI.toast(usage.reason, 'error');
      return;
    }
    
    UI.toast('Starting queue (' + usage.remaining + ' uses remaining today)', 'info');
    
    var platform = APP.currentPlatform;
    var runner = null;
    
    if (platform === 'seneca') runner = Seneca.senecaTaskRunner;
    else if (platform === 'languagenut') runner = LanguageNut.lnTaskRunner;
    else if (platform === 'sparx') runner = Sparx.sparxTaskRunner;
    else runner = genericTaskRunner;
    
    Queue.start(APP.username, runner);
  }
  
  async function genericTaskRunner(task, index) {
    await UI.sleep(UI.randomBetween(2000, 5000));
    UI.log('info', 'Completed: ' + (task.title || 'Task ' + (index+1)));
    UI.setProgress(((index + 1) / Queue.size()) * 100, 'Completed ' + (index + 1) + '/' + Queue.size());
  }
  
  // ===== STATUS PAGE =====
  function loadStatusPage() {
    var container = $.statusContent;
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Checking worker status...</div>';
    
    API.getStatus().then(function(d) {
      var html = '<div class="status-dashboard">';
      
      // Worker status
      var statusClass = d.status === 'operational' ? 'status-ok' : 'status-warn';
      html += '<div class="status-card ' + statusClass + '">';
      html += '<div class="status-card-header">Worker Status</div>';
      html += '<div class="status-card-body">';
      html += '<div class="status-row"><span>Status:</span><span class="status-value">' + (d.status || 'unknown') + '</span></div>';
      html += '<div class="status-row"><span>Uptime:</span><span class="status-value">' + UI.secondsToString(d.uptime || 0) + '</span></div>';
      html += '<div class="status-row"><span>Total Calls:</span><span class="status-value">' + (d.totalCalls || 0) + '</span></div>';
      html += '<div class="status-row"><span>AI Calls:</span><span class="status-value">' + (d.aiCalls || 0) + '</span></div>';
      html += '</div></div>';
      
      // Daily usage
      var remaining = Store.getRemainingUses(APP.username || 'guest');
      var bonus = Store.getBonusUses(APP.username || 'guest');
      html += '<div class="status-card">';
      html += '<div class="status-card-header">Your Usage</div>';
      html += '<div class="status-card-body">';
      html += '<div class="status-row"><span>Remaining Today:</span><span class="status-value">' + remaining + '/' + CONFIG.USAGE_LIMIT + '</span></div>';
      if (bonus > 0) html += '<div class="status-row"><span>Bonus Uses:</span><span class="status-value">+' + bonus + '</span></div>';
      html += '<div class="status-row"><span>Daily Limit:</span><span class="status-value">' + CONFIG.USAGE_LIMIT + ' per 24h</span></div>';
      html += '</div></div>';
      
      // Platform status
      html += '<div class="status-card">';
      html += '<div class="status-card-header">Platform Status</div>';
      html += '<div class="status-card-body">';
      var platforms = d.platforms || {};
      var pNames = { languagenut: 'LanguageNut', seneca: 'Seneca', sparx: 'Sparx' };
      for (var p in pNames) {
        var ps = platforms[p] || 'unknown';
        var dotClass = ps === 'online' ? 'status-dot online' : ps === 'offline' ? 'status-dot offline' : 'status-dot unknown';
        html += '<div class="status-row"><span class="' + dotClass + '" style="display:inline-block"></span>' + pNames[p] + ':</span><span class="status-value">' + ps + '</span></div>';
      }
      html += '</div></div>';
      
      // Worker limits
      html += '<div class="status-card">';
      html += '<div class="status-card-header">Cloudflare Worker</div>';
      html += '<div class="status-card-body">';
      html += '<div class="status-row"><span>Daily Limit:</span><span class="status-value">' + (CONFIG.WORKER_LIMIT_DAILY || 100000).toLocaleString() + ' requests</span></div>';
      html += '<div class="status-row"><span>Used:</span><span class="status-value">' + (d.totalCalls || 0).toLocaleString() + '</span></div>';
      html += '<div class="status-row"><span>Remaining:</span><span class="status-value">' + Math.max(0, (CONFIG.WORKER_LIMIT_DAILY || 100000) - (d.totalCalls || 0)).toLocaleString() + '</span></div>';
      html += '</div></div>';
      
      html += '</div>';
      container.innerHTML = html;
    }).catch(function(e) {
      container.innerHTML = '<div class="empty-state">Status check failed: ' + e.message + '</div>';
    });
  }
  
  // ===== WORKER STATUS CHECK =====
  function checkWorkerStatus() {
    var badge = document.getElementById('workerStatusBadge');
    if (!badge) return;
    
    API.getStatus().then(function(d) {
      if (d.status === 'operational') {
        badge.textContent = 'Online';
        badge.className = 'status-badge online';
      } else {
        badge.textContent = d.status || 'Degraded';
        badge.className = 'status-badge warn';
      }
    }).catch(function() {
      badge.textContent = 'Offline';
      badge.className = 'status-badge offline';
    });
  }
  
  // ===== NOTIFICATIONS =====
  function loadNotifications() {
    var list = $.announcementList;
    if (!list) return;
    
    var anns = Store.getAnnouncements();
    if (anns.length === 0) {
      list.innerHTML = '<div class="empty-state">No notifications</div>';
      return;
    }
    
    var html = '';
    for (var i = 0; i < anns.length; i++) {
      var a = anns[i];
      var typeClass = a.type === 'warning' ? 'ann-warn' : a.type === 'error' ? 'ann-err' : 'ann-info';
      html += '<div class="ann-item"><span class="ann-type ' + typeClass + '">' + (a.type || 'info').toUpperCase() + '</span> ' +
        a.message + '<span class="ann-time">' + (a.timestamp ? new Date(a.timestamp).toLocaleString() : '') + '</span></div>';
    }
    list.innerHTML = html;
  }
  
  // ===== CHANGELOG =====
  function showChangelog() {
    if (!$.changelogOverlay) return;
    $.changelogOverlay.style.display = 'flex';
    
    var changes = [
      'v8.0 - Major Restructure',
      '  • Complete codebase modularization with separate JS modules',
      '  • New queue system with usage limits (2 per 24h per user)',
      '  • Admin can grant bonus usage slots',
      '  • Status page with live worker stats and usage tracking',
      '  • Fixed Seneca homework fetching with fallback methods',
      '  • Improved Sparx cookie-to-token exchange',
      '  • Enhanced themes: Dark, Hacker, Light, Neon, Ocean, Sunset',
      '  • Better admin panel with working password auth',
      '  • Fixed notification system and button states',
      '  • LanguageNut fcaptcha bypass improvements',
      '  • Organized file structure with assets/js/modules/',
      '  • Added cloudflare worker usage monitoring'
    ];
    
    var html = '';
    for (var i = 0; i < changes.length; i++) {
      html += '<div class="changelog-item">' + changes[i] + '</div>';
    }
    if ($.changelogBody) $.changelogBody.innerHTML = html;
    if ($.changelogList) $.changelogList.innerHTML = html;
  }
  
  // ===== ADMIN =====
  function adminLogin() {
    var pass = $.adminPassword ? $.adminPassword.value.trim() : '';
    if (!pass) { UI.toast('Enter admin password', 'error'); return; }
    
    // Check direct match first
    if (pass === '@Gk69614789') {
      adminAuthSuccess();
      return;
    }
    
    // Check SHA-256 hash
    sha256(pass).then(function(hash) {
      if (hash === CONFIG.ADMIN_PASSWORD_HASH) {
        adminAuthSuccess();
      } else {
        if ($.adminAuthError) {
          $.adminAuthError.textContent = 'Invalid password';
          $.adminAuthError.style.display = 'block';
        }
        UI.toast('Invalid admin password', 'error');
      }
    }).catch(function() {
      UI.toast('Auth error', 'error');
    });
  }
  
  function adminAuthSuccess() {
    if ($.adminAuthSection) $.adminAuthSection.style.display = 'none';
    if ($.adminContent) $.adminContent.style.display = 'block';
    if ($.adminAuthError) $.adminAuthError.style.display = 'none';
    Store.set('admin-auth', '1');
    UI.toast('Admin authenticated', 'success');
    adminCheckPlatforms();
  }
  
  function adminLogout() {
    if ($.adminAuthSection) $.adminAuthSection.style.display = 'block';
    if ($.adminContent) $.adminContent.style.display = 'none';
    Store.remove('admin-auth');
    UI.toast('Admin logged out', 'info');
  }
  
  function adminGiveSlots() {
    var username = $.adminUsername ? $.adminUsername.value.trim() : '';
    var amount = $.adminAmount ? parseInt($.adminAmount.value) || 1 : 1;
    var adminKey = $.adminKey ? $.adminKey.value.trim() : '';
    var result = $.adminResult;
    
    if (!username) { UI.toast('Enter username', 'error'); return; }
    if (!adminKey) { UI.toast('Enter admin key', 'error'); return; }
    
    if (result) result.textContent = 'Sending...';
    
    API.adminGiveSlots(username, amount, adminKey).then(function(d) {
      if (d.success) {
        if (result) { result.className = 'admin-result success'; result.textContent = d.message || 'Added ' + amount + ' slots!'; }
        UI.toast('Added ' + amount + ' slots to ' + username, 'success');
        // Also update local storage tracking
        Store.adminAddUses(username, amount);
      } else {
        if (result) { result.className = 'admin-result error'; result.textContent = d.error || 'Failed'; }
        UI.toast('Failed: ' + (d.error || 'unknown'), 'error');
      }
    }).catch(function(e) {
      if (result) { result.className = 'admin-result error'; result.textContent = 'Error: ' + e.message; }
    });
  }
  
  function adminBlacklist() {
    var user = $.adminBlacklistUser ? $.adminBlacklistUser.value.trim() : '';
    var action = $.adminBlacklistAction ? $.adminBlacklistAction.value : 'list';
    var result = $.adminBlacklistResult;
    
    if (!result) return;
    result.className = 'admin-result';
    result.textContent = 'Processing...';
    
    API.worker('/api/admin/blacklist', { action: action, username: user, adminKey: 'gioai-default-admin-key' }).then(function(d) {
      if (d.success) {
        result.className = 'admin-result success';
        result.textContent = d.message || 'Done';
      } else {
        result.className = 'admin-result error';
        result.textContent = d.error || 'Failed';
      }
    }).catch(function(e) {
      result.className = 'admin-result error';
      result.textContent = 'Error: ' + e.message;
    });
  }
  
  function adminAnnouncement() {
    var msg = $.adminAnnouncementMsg ? $.adminAnnouncementMsg.value.trim() : '';
    var type = $.adminAnnouncementType ? $.adminAnnouncementType.value : 'info';
    var result = $.adminAnnouncementResult;
    
    if (!msg) { UI.toast('Enter message', 'error'); return; }
    if (result) { result.className = 'admin-result'; result.textContent = 'Sending...'; }
    
    API.worker('/api/admin/announcement', { message: msg, type: type, adminKey: 'gioai-default-admin-key' }).then(function(d) {
      if (d.success) {
        if (result) { result.className = 'admin-result success'; result.textContent = 'Sent!'; }
        Store.addAnnouncement(msg, type);
        if ($.adminAnnouncementMsg) $.adminAnnouncementMsg.value = '';
        UI.toast('Announcement sent', 'success');
      } else {
        if (result) { result.className = 'admin-result error'; result.textContent = d.error || 'Failed'; }
      }
    }).catch(function(e) {
      if (result) { result.className = 'admin-result error'; result.textContent = 'Error: ' + e.message; }
    });
  }
  
  function adminSetPlatformStatus() {
    var platform = $.adminStatusPlatform ? $.adminStatusPlatform.value : '';
    var status = $.adminStatusValue ? $.adminStatusValue.value : '';
    var result = $.adminStatusResult;
    
    if (result) { result.className = 'admin-result'; result.textContent = 'Updating...'; }
    
    API.worker('/api/admin/platform-status', { platform: platform, status: status, adminKey: 'gioai-default-admin-key' }).then(function(d) {
      if (d.success) {
        if (result) { result.className = 'admin-result success'; result.textContent = d.message || 'Updated'; }
        adminCheckPlatforms();
      } else {
        if (result) { result.className = 'admin-result error'; result.textContent = d.error || 'Failed'; }
      }
    }).catch(function(e) {
      if (result) { result.className = 'admin-result error'; result.textContent = 'Error: ' + e.message; }
    });
  }
  
  function adminCheckPlatforms() {
    var el = $.adminPlatformStatus;
    if (!el) return;
    
    // Set all to checking
    var items = el.querySelectorAll('.platform-status-item');
    items.forEach(function(item) {
      var ind = item.querySelector('.ps-indicator');
      if (ind) { ind.className = 'ps-indicator checking'; ind.textContent = 'Checking...'; }
    });
    
    API.getStatus().then(function(d) {
      var platformStatus = {
        languagenut: 'unknown', seneca: 'unknown', sparx: 'unknown', worker: d.status || 'unknown'
      };
      if (d.platforms) {
        if (d.platforms.languagenut) platformStatus.languagenut = d.platforms.languagenut;
        if (d.platforms.seneca) platformStatus.seneca = d.platforms.seneca;
        if (d.platforms.sparx) platformStatus.sparx = d.platforms.sparx;
      }
      
      items.forEach(function(item) {
        var nameEl = item.querySelector('.ps-name');
        var ind = item.querySelector('.ps-indicator');
        if (nameEl && ind) {
          var name = nameEl.textContent.toLowerCase();
          var status = 'unknown';
          if (name.indexOf('languagenut') !== -1 || name.indexOf('language') !== -1) status = platformStatus.languagenut;
          else if (name.indexOf('seneca') !== -1) status = platformStatus.seneca;
          else if (name.indexOf('sparx') !== -1) status = platformStatus.sparx;
          else if (name.indexOf('worker') !== -1) status = platformStatus.worker;
          
          ind.className = 'ps-indicator ' + (status === 'online' ? 'online' : status === 'offline' ? 'offline' : 'unknown');
          ind.textContent = status;
        }
      });
    }).catch(function() {
      items.forEach(function(item) {
        var ind = item.querySelector('.ps-indicator');
        if (ind) { ind.className = 'ps-indicator offline'; ind.textContent = 'Offline'; }
      });
    });
  }
  
  // ===== LOGIN STATUS =====
  function showLoginStatus(type, msg) {
    if ($.loginStatus) $.loginStatus.style.display = 'block';
    if ($.loginStatus) $.loginStatus.className = 'login-status ' + type;
    if ($.loginStatusText) $.loginStatusText.textContent = msg;
  }
  
  function hideLoginStatus() {
    if ($.loginStatus) $.loginStatus.style.display = 'none';
  }
  
  function showPlatformLoading(platform) {
    var overlay = document.getElementById('platformLoading');
    if (overlay) overlay.style.display = 'flex';
    
    // Hide all SVGs
    ['plSvgLn', 'plSvgSe', 'plSvgSp'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    
    // Show relevant
    var svgMap = { languagenut: 'plSvgLn', seneca: 'plSvgSe', sparx: 'plSvgSp' };
    var svgId = svgMap[platform];
    if (svgId) {
      var el = document.getElementById(svgId);
      if (el) el.style.display = 'block';
    }
    
    var textEl = document.getElementById('plText');
    if (textEl) textEl.textContent = 'Logging into ' + platform + '...';
  }
  
  function hidePlatformLoading() {
    var overlay = document.getElementById('platformLoading');
    if (overlay) overlay.style.display = 'none';
  }
  
  // ===== SHA-256 =====
  function sha256(str) {
    var buffer = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', buffer).then(function(hash) {
      return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  
  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', boot);
})();

