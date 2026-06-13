// ============================================================
// GIOAI v8.1 - Main Application Entry Point
// Thin UI client that connects to local Playwright backend
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
      'appLoading', 'bootProgress', 'bootLines',
      'hubScreen', 'platformLoginScreen', 'dashboardScreen',
      'statusScreen', 'settingsScreen', 'adminScreen', 'donateScreen',
      'backToHub', 'platformLoginTitle', 'plfIcon', 'plfTitle', 'plfDesc',
      'loginCommonFields', 'sparxFields', 'senecaTip',
      'sparxCookieSection', 'sparxTokenSection',
      'platformUsername', 'platformPassword', 'loginUserLabel',
      'platformLoginBtn', 'loginStatus', 'loginStatusText',
      'sparxSchoolSearch', 'sparxSchoolResults', 'sparxSchoolId',
      'sparxCookies', 'sparxExchangeBtn', 'sparxTokenInput', 'sparxTokenBtn',
      'dashUserDisplay', 'dashPlatformBadge', 'dashAvatar',
      'dashTasks', 'dashLogEntries', 'dashFetchBtn', 'dashStartBtn',
      'dashStopBtn', 'dashLogoutBtn', 'dashSettingsBtn',
      'dashStatCompleted', 'dashStatXp', 'dashStatErrors',
      'dashProgressFill', 'dashProgressText',
      'queueTotal', 'queueStatus', 'usesLeft',
      'statusContent', 'statusRefreshBtn',
      'settingsServerStatus', 'settingsServerAddr',
      'settingsRemainingUses', 'settingsBonusUses',
      'themeGrid',
      'adminPassword', 'adminLoginBtn', 'adminAuthError',
      'adminContent', 'adminAuthSection',
      'adminUsername', 'adminAmount', 'adminKey',
      'adminGiveSlotsBtn', 'adminResult',
      'adminPlatformStatus', 'adminCheckPlatformsBtn',
      'adminAnnouncementMsg', 'adminAnnouncementType', 'adminAnnouncementBtn', 'adminAnnouncementResult',
      'adminBlacklistUser', 'adminBlacklistAction', 'adminBlacklistBtn', 'adminBlacklistResult',
      'adminStatusPlatform', 'adminStatusValue', 'adminPlatStatusBtn', 'adminStatusResult',
      'adminLogoutBtn',
      'changelogOverlay', 'changelogClose', 'changelogDismiss', 'changelogBody', 'changelogList',
      'notifOverlay', 'notifClose',
      'announcementList', 'announcementListOverlay',
      'platformLoading', 'plfLoadingIcon', 'plfLoadingTitle', 'plfLoadingSub',
      'serverIndicator'
    ];
    for (var i = 0; i < ids.length; i++) {
      $[ids[i]] = document.getElementById(ids[i]);
    }
    $.hubCards = Array.from(document.querySelectorAll('.hub-card'));
  }

  // ===== BOOT SEQUENCE =====
  function boot() {
    cacheDOM();

    // Apply saved theme
    var savedTheme = Store.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Init modules
    Sparx.init();
    Seneca.init();
    LanguageNut.init();

    // Bind events
    bindHubCards();
    bindBackButton();
    bindLoginButton();
    bindSparxLoginFields();
    bindTopbarNav();
    bindSettings();
    bindAdmin();
    bindStatusRefresh();

    // Server health check
    checkServer();

    // Run boot animation
    runBoot().then(function() {
      hideBoot();
    });
  }

  function runBoot() {
    return new Promise(function(resolve) {
      var lines = [
        { text: '> GIOAI kernel v' + CONFIG.VERSION + ' loading...', delay: 200 },
        { text: '> Initializing modules...', delay: 400 },
        { text: '> Connecting to Playwright server...', delay: 600 },
        { text: '> Platforms: LanguageNut, Seneca, Sparx', delay: 800 },
        { text: '> <span class="success">System ready</span>', delay: 1200 }
      ];

      var progress = 0;
      function showNext(i) {
        if (i >= lines.length) {
          resolve();
          return;
        }
        var line = lines[i];
        setTimeout(function() {
          var el = document.createElement('div');
          el.className = 'boot-line';
          el.innerHTML = line.text;
          if ($.bootLines) $.bootLines.appendChild(el);
          progress = ((i + 1) / lines.length) * 100;
          if ($.bootProgress) $.bootProgress.style.width = progress + '%';
          showNext(i + 1);
        }, line.delay);
      }
      showNext(0);
    });
  }

  function hideBoot() {
    if ($.appLoading) $.appLoading.classList.add('done');
  }

  // ===== SERVER CHECK =====
  function checkServer() {
    UI.setServerStatus('checking');
    API.getPlaywrightStatus().then(function(r) {
      if (r.status === 'operational' || r.platform) {
        UI.setServerStatus('online');
      } else {
        UI.setServerStatus('offline');
      }
    }).catch(function() {
      UI.setServerStatus('offline');
    });
  }

  // ===== HUB CARDS =====
  function bindHubCards() {
    for (var i = 0; i < $.hubCards.length; i++) {
      $.hubCards[i].addEventListener('click', function() {
        var platform = this.dataset.platform;
        openPlatformLogin(platform);
      });
    }
  }

  function openPlatformLogin(platform) {
    APP.currentPlatform = platform;
    var cfg = CONFIG.PLATFORMS[platform] || { name: platform, icon: '?', color: '#fff' };

    // Set header
    if ($.plfIcon) {
      $.plfIcon.textContent = cfg.icon;
      $.plfIcon.style.color = cfg.color;
      $.plfIcon.style.background = cfg.color + '18';
    }
    if ($.plfTitle) $.plfTitle.textContent = 'Login to ' + cfg.name;

    // Hide/show platform specific fields
    if ($.loginCommonFields) $.loginCommonFields.style.display = 'block';
    if ($.sparxFields) $.sparxFields.style.display = platform === 'sparx' ? 'block' : 'none';
    if ($.senecaTip) $.senecaTip.style.display = platform === 'seneca' ? 'block' : 'none';
    if ($.sparxCookieSection) $.sparxCookieSection.style.display = platform === 'sparx' ? 'block' : 'none';
    if ($.sparxTokenSection) $.sparxTokenSection.style.display = platform === 'sparx' ? 'block' : 'none';

    // Set form labels
    if (platform === 'seneca') {
      if ($.loginUserLabel) $.loginUserLabel.textContent = 'Email';
      if ($.platformUsername) $.platformUsername.placeholder = 'student@school.edu';
    } else {
      if ($.loginUserLabel) $.loginUserLabel.textContent = 'Username';
      if ($.platformUsername) $.platformUsername.placeholder = '';
    }

    // Clear fields
    if ($.platformUsername) $.platformUsername.value = '';
    if ($.platformPassword) $.platformPassword.value = '';
    if ($.sparxSchoolSearch) $.sparxSchoolSearch.value = '';
    if ($.sparxSchoolId) $.sparxSchoolId.value = '';
    if ($.sparxCookies) $.sparxCookies.value = '';
    if ($.sparxTokenInput) $.sparxTokenInput.value = '';
    hideLoginStatus();

    UI.showScreen('platformLoginScreen');
  }

  function bindBackButton() {
    if ($.backToHub) {
      $.backToHub.addEventListener('click', function() {
        UI.showScreen('hubScreen');
      });
    }
  }

  function bindTopbarNav() {
    var btns = document.querySelectorAll('.topbar-nav button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function() {
        var screen = this.dataset.screen;
        var screenMap = {
          hub: 'hubScreen', status: 'statusScreen',
          settings: 'settingsScreen', admin: 'adminScreen',
          donate: 'donateScreen'
        };
        var target = screenMap[screen];
        if (target) {
          UI.showScreen(target);
          if (target === 'statusScreen') loadStatusPage();
        }
      });
    }
  }

  // ===== SPARX SCHOOL SEARCH =====
  function bindSparxLoginFields() {
    var schoolSearchTimer = null;

    if ($.sparxSchoolSearch && $.sparxSchoolResults) {
      $.sparxSchoolSearch.addEventListener('input', function() {
        var q = this.value.trim();
        if (q.length < 2) { $.sparxSchoolResults.classList.remove('active'); return; }
        clearTimeout(schoolSearchTimer);
        schoolSearchTimer = setTimeout(function() {
          API.searchSchools(q).then(function(d) {
            if (d.results && d.results.length) {
              var html = '';
              for (var i = 0; i < d.results.length; i++) {
                html += '<div class="school-result-item" data-id="' + d.results[i].id + '" data-name="' + (d.results[i].name || '').replace(/'/g, "\\'") + '">' +
                  (d.results[i].name || 'Unknown') + '<span class="school-result-id">' + (d.results[i].town ? ' - ' + d.results[i].town : '') + '</span></div>';
              }
              $.sparxSchoolResults.innerHTML = html;
              $.sparxSchoolResults.classList.add('active');
              Array.from($.sparxSchoolResults.children).forEach(function(item) {
                item.addEventListener('click', function() {
                  if ($.sparxSchoolSearch) $.sparxSchoolSearch.value = this.dataset.name || '';
                  if ($.sparxSchoolId) $.sparxSchoolId.value = this.dataset.id || '';
                  $.sparxSchoolResults.classList.remove('active');
                });
              });
            } else {
              $.sparxSchoolResults.classList.remove('active');
            }
          }).catch(function() {});
        }, 300);
      });

      document.addEventListener('click', function(e) {
        if ($.sparxSchoolResults && !e.target.closest('.school-search-wrap')) {
          $.sparxSchoolResults.classList.remove('active');
        }
      });
    }

    // Sparx cookie exchange
    if ($.sparxCookies && $.sparxExchangeBtn) {
      $.sparxCookies.addEventListener('input', function() {
        $.sparxExchangeBtn.disabled = !this.value.trim();
      });
      $.sparxExchangeBtn.addEventListener('click', function() {
        if (!$.sparxCookies || !$.sparxCookies.value.trim()) {
          UI.toast('Paste your Sparx cookies first', 'error');
          return;
        }
        showLoginStatus('info', 'Exchanging cookies...');
        API.sparxExchangeCookies($.sparxCookies.value.trim(), $.sparxSchoolId ? $.sparxSchoolId.value : '').then(function(d) {
          if (d.token || d.authToken) {
            var token = d.token || d.authToken;
            APP.token = token;
            APP.username = d.username || 'Sparx User';
            showLoginStatus('success', 'Token acquired! Redirecting...');
            setTimeout(function() { enterDashboard('sparx', APP.username); }, 500);
          } else {
            showLoginStatus('error', d.error || 'Exchange failed');
          }
        }).catch(function(e) {
          showLoginStatus('error', e.message);
        });
      });
    }

    // Sparx token manual
    if ($.sparxTokenBtn && $.sparxTokenInput) {
      $.sparxTokenBtn.addEventListener('click', function() {
        var token = $.sparxTokenInput.value.trim();
        if (!token) { UI.toast('Enter a token', 'error'); return; }
        APP.token = token;
        APP.username = 'Sparx User';
        showLoginStatus('success', 'Token set! Redirecting...');
        setTimeout(function() { enterDashboard('sparx', APP.username); }, 500);
      });
    }
  }

  // ===== LOGIN BUTTON =====
  function bindLoginButton() {
    if ($.platformLoginBtn) {
      $.platformLoginBtn.addEventListener('click', function() {
        performLogin();
      });
    }

    // Enter key support
    if ($.platformPassword) {
      $.platformPassword.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && $.platformLoginBtn) $.platformLoginBtn.click();
      });
    }
    if ($.platformUsername) {
      $.platformUsername.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && $.platformLoginBtn) $.platformLoginBtn.click();
      });
    }
  }

  function performLogin() {
    var platform = APP.currentPlatform;
    var username = $.platformUsername ? $.platformUsername.value.trim() : '';
    var password = $.platformPassword ? $.platformPassword.value : '';

    if (!username || !password) {
      UI.toast('Enter credentials', 'error');
      return;
    }

    hideLoginStatus();
    showPlatformLoading(platform, 'Logging in...');

    if (platform === 'languagenut') {
      LanguageNut.lnLogin(username, password);
    } else if (platform === 'seneca') {
      Seneca.seLogin(username, password);
    } else if (platform === 'sparx') {
      var schoolId = $.sparxSchoolId ? $.sparxSchoolId.value : '';
      if (!schoolId) {
        hidePlatformLoading();
        UI.toast('Search and select your school first', 'error');
        return;
      }
      sparxLoginFlow(schoolId, username, password);
    }
  }

  function sparxLoginFlow(schoolId, username, password) {
    // Use Playwright server to login via browser automation
    API.sparxLogin(schoolId, username, password).then(function(d) {
      hidePlatformLoading();
      if (d.token || d.authToken || d.success) {
        var token = d.token || d.authToken || d.sessionToken || '';
        APP.token = token;
        APP.username = d.username || username;
        showLoginStatus('success', 'Sparx login successful via Playwright!');
        setTimeout(function() { enterDashboard('sparx', APP.username); }, 500);
      } else {
        showLoginStatus('error', d.error || 'Login failed. Try cookie method instead.');
      }
    }).catch(function(e) {
      hidePlatformLoading();
      showLoginStatus('error', 'Connection error: ' + e.message);
    });
  }

  // ===== DASHBOARD =====
  function enterDashboard(platform, username) {
    APP.username = username;
    APP.currentPlatform = platform;
    if ($.dashUserDisplay) $.dashUserDisplay.textContent = username;
    if ($.dashPlatformBadge) $.dashPlatformBadge.textContent = platform;
    if ($.dashAvatar) $.dashAvatar.textContent = (username.charAt(0) || 'U').toUpperCase();

    Dashboard.resetStats();
    UI.showScreen('dashboardScreen');
  }

  var Dashboard = {
    completed: 0,
    xp: 0,
    errors: 0,
    resetStats: function() {
      this.completed = 0;
      this.xp = 0;
      this.errors = 0;
      this.updateStats();
    },
    updateStats: function() {
      if ($.dashStatCompleted) $.dashStatCompleted.textContent = this.completed;
      if ($.dashStatXp) $.dashStatXp.textContent = this.xp;
      if ($.dashStatErrors) $.dashStatErrors.textContent = this.errors;
    }
  };

  // ===== LOGOUT =====
  function bindDashboardButtons() {
    // These will be bound in each platform module
  }

  // Bind dashboard logout
  document.addEventListener('DOMContentLoaded', function() {
    if ($.dashLogoutBtn) {
      $.dashLogoutBtn.addEventListener('click', function() {
        APP.token = '';
        APP.username = '';
        APP.currentPlatform = '';
        Queue.clear();
        Dashboard.resetStats();
        UI.showScreen('hubScreen');
        UI.toast('Logged out', 'info');
      });
    }

    if ($.dashSettingsBtn) {
      $.dashSettingsBtn.addEventListener('click', function() {
        UI.showScreen('settingsScreen');
      });
    }

    if ($.dashFetchBtn) {
      $.dashFetchBtn.addEventListener('click', function() {
        var platform = APP.currentPlatform;
        if (platform === 'languagenut') LanguageNut.lnFetchHomework();
        else if (platform === 'seneca') Seneca.seFetchHomework();
        else if (platform === 'sparx') Sparx.sparxFetchHomework();
      });
    }

    if ($.dashStartBtn) {
      $.dashStartBtn.addEventListener('click', function() {
        var username = APP.username || 'user';
        var usage = Queue.checkUsage(username);
        if (!usage.allowed) {
          UI.toast(usage.reason, 'error');
          return;
        }

        var platform = APP.currentPlatform;
        var runner = null;
        if (platform === 'languagenut') runner = LanguageNut.lnTaskRunner;
        else if (platform === 'seneca') runner = Seneca.seTaskRunner;
        else if (platform === 'sparx') runner = Sparx.sparxTaskRunner;
        if (runner) Queue.start(username, runner);
      });
    }

    if ($.dashStopBtn) {
      $.dashStopBtn.addEventListener('click', function() {
        Queue.stop();
      });
    }
  });

  // ===== SETTINGS =====
  function bindSettings() {
    if ($.themeGrid) {
      var themeBtns = $.themeGrid.querySelectorAll('.theme-btn');
      for (var i = 0; i < themeBtns.length; i++) {
        themeBtns[i].addEventListener('click', function() {
          var theme = this.dataset.theme;
          Store.setTheme(theme);
          var btns = $.themeGrid.querySelectorAll('.theme-btn');
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
          this.classList.add('active');
          UI.toast('Theme: ' + theme, 'success');
        });
      }
    }

    // Update settings usage info
    function updateSettingsUsage() {
      if ($.settingsRemainingUses) {
        var username = APP.username;
        if (username) {
          var remaining = Store.getRemainingUses(username);
          var bonus = Store.getBonusUses(username);
          $.settingsRemainingUses.textContent = remaining + bonus;
        }
      }
    }
    setInterval(updateSettingsUsage, 5000);
  }

  // ===== STATUS =====
  function bindStatusRefresh() {
    if ($.statusRefreshBtn) {
      $.statusRefreshBtn.addEventListener('click', loadStatusPage);
    }
  }

  function loadStatusPage() {
    if ($.statusContent) $.statusContent.innerHTML = '<div class="empty-state">Loading...</div>';

    API.getPlaywrightStatus().then(function(r) {
      if (!$.statusContent) return;
      if (r.status === 'operational' || r.platform) {
        var html = '<div class="status-grid">';
        html += '<div class="stat-item"><span class="stat-label">Server</span><span class="stat-value">Playwright Backend</span></div>';
        html += '<div class="stat-item"><span class="stat-label">Uptime</span><span class="stat-value">' + UI.secondsToString(r.uptime || 0) + '</span></div>';
        html += '<div class="stat-item"><span class="stat-label">Version</span><span class="stat-value">' + (r.version || '8.1') + '</span></div>';
        html += '<div class="stat-item"><span class="stat-label">Playwright</span><span class="stat-value" style="color:var(--success)">✓ Active</span></div>';
        html += '</div>';

        if (r.platform) {
          html += '<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin:16px 0 8px">Platforms</h3>';
          for (var p in r.platform) {
            var s = r.platform[p];
            var cls = s === 'online' ? 'online' : s === 'offline' ? 'offline' : 'unknown';
            html += '<div class="platform-status-row"><span class="ps-name">' + p + '</span><span class="ps-indicator ' + cls + '">' + s + '</span></div>';
          }
        }
        $.statusContent.innerHTML = html;
      } else {
        $.statusContent.innerHTML = '<div class="empty-state">Playwright server offline. Start it with: cd ~/gioai-repo/sparx-automator && node server.js</div>';
      }
    }).catch(function() {
      if ($.statusContent) $.statusContent.innerHTML = '<div class="empty-state">Could not reach Playwright server</div>';
    });
  }

  // ===== ADMIN =====
  function bindAdmin() {
    if ($.adminLoginBtn) {
      $.adminLoginBtn.addEventListener('click', function() {
        var pass = $.adminPassword ? $.adminPassword.value : '';
        if (!pass) { UI.toast('Enter password', 'error'); return; }
        sha256(pass).then(function(hash) {
          if (hash === CONFIG.ADMIN_PASSWORD_HASH) {
            if ($.adminAuthSection) $.adminAuthSection.style.display = 'none';
            if ($.adminContent) $.adminContent.style.display = 'block';
            if ($.adminAuthError) $.adminAuthError.style.display = 'none';
            UI.toast('Admin authenticated', 'success');
            adminCheckPlatforms();
          } else {
            if ($.adminAuthError) { $.adminAuthError.textContent = 'Invalid password'; $.adminAuthError.style.display = 'block'; }
            UI.toast('Invalid admin password', 'error');
          }
        });
      });
    }

    if ($.adminLogoutBtn) {
      $.adminLogoutBtn.addEventListener('click', function() {
        if ($.adminAuthSection) $.adminAuthSection.style.display = 'block';
        if ($.adminContent) $.adminContent.style.display = 'none';
        UI.toast('Admin logged out', 'info');
      });
    }

    if ($.adminGiveSlotsBtn) {
      $.adminGiveSlotsBtn.addEventListener('click', function() {
        var username = $.adminUsername ? $.adminUsername.value.trim() : '';
        var amount = $.adminAmount ? parseInt($.adminAmount.value) || 1 : 1;
        var adminKey = $.adminKey ? $.adminKey.value.trim() : '';
        var result = $.adminResult;
        if (!username) { UI.toast('Enter username', 'error'); return; }
        if (!adminKey) { UI.toast('Enter admin key', 'error'); return; }
        if (result) result.textContent = 'Sending...';
        API.adminGiveSlots(username, amount, adminKey).then(function(d) {
          if (d.success) {
            if (result) { result.className = 'admin-result success'; result.textContent = d.message || 'Added!'; }
            Store.adminAddUses(username, amount);
          } else {
            if (result) { result.className = 'admin-result error'; result.textContent = d.error || 'Failed'; }
          }
        });
      });
    }

    if ($.adminBlacklistBtn) {
      $.adminBlacklistBtn.addEventListener('click', function() {
        var user = $.adminBlacklistUser ? $.adminBlacklistUser.value.trim() : '';
        var action = $.adminBlacklistAction ? $.adminBlacklistAction.value : 'list';
        var result = $.adminBlacklistResult;
        if (result) { result.className = 'admin-result'; result.textContent = 'Processing...'; }
        API.adminBlacklist(action, user, 'gioai-default-admin-key').then(function(d) {
          if (d.success) {
            result.className = 'admin-result success';
            result.textContent = d.message || (Array.isArray(d.blacklist) ? d.blacklist.join(', ') : 'Done');
          } else {
            result.className = 'admin-result error';
            result.textContent = d.error || 'Failed';
          }
        });
      });
    }

    if ($.adminAnnouncementBtn) {
      $.adminAnnouncementBtn.addEventListener('click', function() {
        var msg = $.adminAnnouncementMsg ? $.adminAnnouncementMsg.value.trim() : '';
        var type = $.adminAnnouncementType ? $.adminAnnouncementType.value : 'info';
        var result = $.adminAnnouncementResult;
        if (!msg) { UI.toast('Enter message', 'error'); return; }
        if (result) { result.className = 'admin-result'; result.textContent = 'Sending...'; }
        API.adminAnnouncement(msg, type, 'gioai-default-admin-key').then(function(d) {
          if (d.success) {
            if (result) { result.className = 'admin-result success'; result.textContent = 'Sent!'; }
            Store.addAnnouncement(msg, type);
            if ($.adminAnnouncementMsg) $.adminAnnouncementMsg.value = '';
            UI.toast('Announcement sent', 'success');
          } else {
            if (result) { result.className = 'admin-result error'; result.textContent = d.error || 'Failed'; }
          }
        });
      });
    }

    if ($.adminPlatStatusBtn) {
      $.adminPlatStatusBtn.addEventListener('click', function() {
        var platform = $.adminStatusPlatform ? $.adminStatusPlatform.value : '';
        var status = $.adminStatusValue ? $.adminStatusValue.value : '';
        var result = $.adminStatusResult;
        if (result) { result.className = 'admin-result'; result.textContent = 'Updating...'; }
        API.adminSetPlatformStatus(platform, status, 'gioai-default-admin-key').then(function(d) {
          if (d.success) {
            if (result) { result.className = 'admin-result success'; result.textContent = d.message || 'Updated'; }
            adminCheckPlatforms();
          } else {
            if (result) { result.className = 'admin-result error'; result.textContent = d.error || 'Failed'; }
          }
        });
      });
    }

    if ($.adminCheckPlatformsBtn) {
      $.adminCheckPlatformsBtn.addEventListener('click', adminCheckPlatforms);
    }
  }

  function adminCheckPlatforms() {
    var el = $.adminPlatformStatus;
    if (!el) return;
    var items = el.querySelectorAll('.platform-status-row');
    items.forEach(function(item) {
      var ind = item.querySelector('.ps-indicator');
      if (ind) { ind.className = 'ps-indicator checking'; ind.textContent = 'Checking...'; }
    });

    API.getStatus().then(function(d) {
      var platformStatus = {
        languagenut: 'unknown', seneca: 'unknown', sparx: 'unknown', 'local server': API.getPlaywrightStatus() ? 'checking' : 'unknown'
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
          if (name.indexOf('languagenut') !== -1) status = platformStatus.languagenut;
          else if (name.indexOf('seneca') !== -1) status = platformStatus.seneca;
          else if (name.indexOf('sparx') !== -1) status = platformStatus.sparx;
          else if (name.indexOf('local') !== -1) {
            // Check local server
            API.getPlaywrightStatus().then(function(r) {
              ind.className = 'ps-indicator ' + (r.status === 'operational' ? 'online' : 'offline');
              ind.textContent = r.status === 'operational' ? 'Online' : 'Offline';
            });
            return;
          }
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

  // ===== UI HELPERS =====
  function showPlatformLoading(platform, text) {
    if ($.platformLoading) $.platformLoading.style.display = 'flex';
    var cfg = CONFIG.PLATFORMS[platform] || { icon: '?', color: '#fff' };
    if ($.plfLoadingIcon) {
      $.plfLoadingIcon.textContent = cfg.icon;
      $.plfLoadingIcon.style.color = cfg.color;
    }
    if ($.plfLoadingTitle) $.plfLoadingTitle.textContent = text || 'Working...';
    if ($.plfLoadingSub) $.plfLoadingSub.textContent = platform;
  }

  function hidePlatformLoading() {
    if ($.platformLoading) $.platformLoading.style.display = 'none';
  }

  function showLoginStatus(type, msg) {
    if ($.loginStatus) $.loginStatus.style.display = 'block';
    if ($.loginStatus) $.loginStatus.className = 'login-status ' + type;
    if ($.loginStatusText) $.loginStatusText.textContent = msg;
  }

  function hideLoginStatus() {
    if ($.loginStatus) $.loginStatus.style.display = 'none';
  }

  function sha256(str) {
    var buffer = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', buffer).then(function(hash) {
      return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', boot);

  // Export globals
  window.APP = APP;
  window.Dashboard = Dashboard;
  window.showLoginStatus = showLoginStatus;
  window.hideLoginStatus = hideLoginStatus;
  window.showPlatformLoading = showPlatformLoading;
  window.hidePlatformLoading = hidePlatformLoading;
  window.enterDashboard = enterDashboard;
  window.loadStatusPage = loadStatusPage;
})();

