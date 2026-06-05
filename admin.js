(function() {
    'use strict';

    var ADMIN_PASSWORD = '@Gk69614789';
    var STORAGE_KEY = 'gioai-platform-status';
    var BOT_STATUS_KEY = 'gioai-bot-status';
    var WEBSITE_STATUS_KEY = 'gioai-website-status';
    var ANNOUNCEMENTS_KEY = 'gioai-announcements';
    var BLACKLIST_KEY = 'gioai-platform-blacklist';
    var LOGS_KEY = 'gioai-admin-logs';
    var STATS_KEY = 'gioai-admin-stats';

    var defaultStatuses = [
        { id: 'languagenut', label: 'LanguageNut', status: 'unstable' },
        { id: 'seneca', label: 'Seneca', status: 'unstable' },
        { id: 'sparx', label: 'Sparx Maths', status: 'working' }
    ];
    var statusOptions = ['working', 'unstable', 'maintenance', 'down', 'coming'];
    var platformNames = { languagenut: 'LanguageNut', sparx: 'Sparx Maths', seneca: 'Seneca Learning', all: 'All Platforms' };
    var platformList = ['sparx', 'languagenut', 'seneca'];

    /* ===== STORAGE HELPERS ===== */
    function loadStatuses() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || JSON.parse(JSON.stringify(defaultStatuses)); }
        catch(e) { return JSON.parse(JSON.stringify(defaultStatuses)); }
    }
    function saveStatuses(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

    function loadBotStatus() {
        try { return JSON.parse(localStorage.getItem(BOT_STATUS_KEY)) || { global: 'online' }; }
        catch(e) { return { global: 'online' }; }
    }
    function saveBotStatus(b) { localStorage.setItem(BOT_STATUS_KEY, JSON.stringify(b)); }

    function loadBlacklist() {
        try { return JSON.parse(localStorage.getItem(BLACKLIST_KEY)) || []; }
        catch(e) { return []; }
    }
    function saveBlacklist(b) { localStorage.setItem(BLACKLIST_KEY, JSON.stringify(b)); }

    function loadLogs() {
        try { return JSON.parse(localStorage.getItem(LOGS_KEY)) || []; }
        catch(e) { return []; }
    }
    function saveLogs(l) { localStorage.setItem(LOGS_KEY, JSON.stringify(l)); }

    function addLog(msg, type, platform) {
        type = type || 'info';
        platform = platform || 'general';
        var logs = loadLogs();
        logs.push({ msg: msg, type: type, platform: platform, time: new Date().toISOString() });
        if (logs.length > 500) logs = logs.slice(-500);
        saveLogs(logs);
    }

    function loadStats() {
        try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { totalTasks: 0, todayTasks: 0, errors: 0, platforms: {} }; }
        catch(e) { return { totalTasks: 0, todayTasks: 0, errors: 0, platforms: {} }; }
    }
    function saveStats(s) { localStorage.setItem(STATS_KEY, JSON.stringify(s)); }

    /* ===== SAVED ACCOUNTS HELPERS ===== */
    function getSavedAccounts(platform) {
        try { return JSON.parse(localStorage.getItem('gioai-saved-accounts-' + platform) || '[]'); }
        catch(e) { return []; }
    }
    function saveSavedAccounts(platform, accounts) {
        localStorage.setItem('gioai-saved-accounts-' + platform, JSON.stringify(accounts));
    }

    /* ===== RENDER FUNCTIONS ===== */
    function renderStatusGrid(statuses) {
        var grid = document.getElementById('platformStatusGrid');
        if (!grid) return;
        var html = '';
        statuses.forEach(function(s) {
            html += '<div class="status-item">' +
                '<label>' + s.label + '</label>' +
                '<select data-id="' + s.id + '" class="status-select">' +
                statusOptions.map(function(o) { return '<option value="' + o + '"' + (o === s.status ? ' selected' : '') + '>' + o.charAt(0).toUpperCase() + o.slice(1) + '</option>'; }).join('') +
                '</select></div>';
        });
        grid.innerHTML = html;
    }

    function renderQuickStatus() {
        var statuses = loadStatuses();
        statuses.forEach(function(s) {
            var el = document.getElementById('qs-' + s.id);
            if (el) el.textContent = s.status;
        });
    }

    function renderBlacklist() {
        var container = document.getElementById('blacklistContainer');
        if (!container) return;
        var list = loadBlacklist();
        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state">No users blacklisted.</div>';
            return;
        }
        var html = '';
        list.forEach(function(item, idx) {
            var platforms = item.platforms || [];
            var username = item.username || 'unknown';
            var passwordInfo = item.password ? ' (pw req)' : '';
            html += '<div class="blacklist-item" data-idx="' + idx + '">' +
                '<span style="font-weight:600">' + username + '</span>' +
                '<span style="font-size:.7rem;color:var(--text3)">' + passwordInfo + '</span>' +
                '<div class="platform-tags">';
            platformList.forEach(function(p) {
                var active = platforms.indexOf('all') >= 0 || platforms.indexOf(p) >= 0;
                html += '<span class="platform-tag' + (active ? ' active-tag' : '') + '" data-idx="' + idx + '" data-platform="' + p + '">' + platformNames[p] + '</span>';
            });
            html += '</div>' +
                '<span class="unban" data-idx="' + idx + '">Remove</span></div>';
        });
        container.innerHTML = html;

        // Platform tag toggles
        container.querySelectorAll('.platform-tag').forEach(function(tag) {
            tag.addEventListener('click', function() {
                var idx = parseInt(this.dataset.idx);
                var platform = this.dataset.platform;
                var list = loadBlacklist();
                if (idx < 0 || idx >= list.length) return;
                var p = list[idx].platforms || [];
                if (platform === 'all') {
                    if (p.indexOf('all') >= 0) { list.splice(idx, 1); saveBlacklist(list); renderBlacklist(); return; }
                    else { list[idx].platforms = ['all']; }
                } else {
                    var allIdx = p.indexOf('all');
                    if (allIdx >= 0) p.splice(allIdx, 1);
                    var pi = p.indexOf(platform);
                    if (pi >= 0) { p.splice(pi, 1); } else { p.push(platform); }
                    if (p.length === 0) { list.splice(idx, 1); saveBlacklist(list); renderBlacklist(); return; }
                    list[idx].platforms = p;
                }
                saveBlacklist(list);
                renderBlacklist();
                addLog('Toggled blacklist platform for ' + (list[idx] ? list[idx].username : 'user'), 'info', 'general');
            });
        });

        // Remove buttons
        container.querySelectorAll('.unban').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var idx = parseInt(this.dataset.idx);
                var list = loadBlacklist();
                if (idx >= 0 && idx < list.length) {
                    var name = list[idx].username;
                    list.splice(idx, 1);
                    saveBlacklist(list);
                    renderBlacklist();
                    addLog('Unbanned ' + name, 'info', 'general');
                }
            });
        });
    }

    function renderLogs(filter, platform) {
        filter = filter || 'all';
        platform = platform || 'all';
        var container = document.getElementById('logContent');
        if (!container) return;
        var logs = loadLogs();
        if (filter !== 'all') logs = logs.filter(function(l) { return l.type === filter; });
        if (platform !== 'all') logs = logs.filter(function(l) { return l.platform === platform; });
        if (logs.length === 0) {
            container.innerHTML = '<div style="color:var(--text3)">No logs found.</div>';
            return;
        }
        var html = '';
        logs.slice(-50).reverse().forEach(function(l) {
            var d = new Date(l.time);
            var timeStr = d.toLocaleTimeString();
            var color = l.type === 'error' ? 'var(--danger)' : l.type === 'success' ? 'var(--success)' : l.type === 'warning' ? 'var(--warning)' : 'var(--text2)';
            html += '<div style="color:' + color + '">[' + timeStr + '] [' + l.type + '] ' + l.msg + '</div>';
        });
        container.innerHTML = html;
        container.scrollTop = 0;
    }

    function renderAnnouncements() {
        var container = document.getElementById('announceContainer');
        if (!container) return;
        try {
            var ann = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_KEY) || '[]');
            if (ann.length === 0) { container.innerHTML = '<div class="empty-state">No announcements posted yet.</div>'; return; }
            var html = '';
            ann.forEach(function(a, i) {
                var d = new Date(a.time);
                var type = a.type || 'announcement';
                html += '<div class="announce-item">' +
                    '<span><span style="font-size:.65rem;padding:.1rem .4rem;border-radius:3px;background:' + (type === 'changelog' ? 'var(--success)' : 'var(--accent)') + ';color:#fff;margin-right:.3rem">' + type + '</span>' +
                    a.text + ' <span style="font-size:.7rem;color:var(--text3)">(' + d.toLocaleDateString() + ')</span></span>' +
                    '<span class="del" data-idx="' + i + '">X</span></div>';
            });
            container.innerHTML = html;
            container.querySelectorAll('.del').forEach(function(el) {
                el.addEventListener('click', function() {
                    var idx = parseInt(this.dataset.idx);
                    try {
                        var a = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_KEY) || '[]');
                        a.splice(idx, 1);
                        localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(a));
                        renderAnnouncements();
                    } catch(e) {}
                });
            });
        } catch(e) {}
    }

    function renderSavedAccounts() {
        var plat = document.getElementById('accountsPlatformSelect');
        if (!plat) return;
        var platform = plat.value;
        var container = document.getElementById('accountsContainer');
        if (!container) return;
        var accounts = getSavedAccounts(platform);
        if (accounts.length === 0) {
            container.innerHTML = '<div class="empty-state">No saved accounts for ' + platformNames[platform] + '.</div>';
            return;
        }
        var html = '';
        accounts.forEach(function(a, i) {
            html += '<div class="account-item">' +
                '<span><strong>' + a.username + '</strong> <span style="color:var(--text3);font-size:.7rem">(' + (a.uses || 0) + ' uses)</span></span>' +
                '<div class="manage">' +
                '<input type="number" class="uses-input" data-idx="' + i + '" value="' + (a.uses || 0) + '" min="0" style="width:60px;padding:.2rem .3rem;font-size:.75rem">' +
                '<button class="btn btn-sm update-uses" data-idx="' + i + '">Set</button>' +
                '<button class="btn btn-sm" style="color:var(--danger)" onclick="var a=JSON.parse(localStorage.getItem(\'gioai-saved-accounts-' + platform + '\')||\'[]\');a.splice(' + i + ',1);localStorage.setItem(\'gioai-saved-accounts-' + platform + '\',JSON.stringify(a));document.getElementById(\'refreshAccountsBtn\').click()">X</button></div></div>';
        });
        container.innerHTML = html;
        container.querySelectorAll('.update-uses').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var idx = parseInt(this.dataset.idx);
                var input = this.parentElement.querySelector('.uses-input');
                var val = parseInt(input.value);
                if (isNaN(val) || val < 0) { alert('Enter a valid number'); return; }
                var accounts = getSavedAccounts(platform);
                if (idx >= 0 && idx < accounts.length) {
                    accounts[idx].uses = val;
                    saveSavedAccounts(platform, accounts);
                    renderSavedAccounts();
                    addLog('Updated uses for ' + accounts[idx].username + ' to ' + val, 'info', 'general');
                }
            });
        });
    }

    function updateTimestamp() {
        var el = document.getElementById('timestamp');
        if (el) el.textContent = new Date().toLocaleString();
    }

    function updateStats() {
        var stats = loadStats();
        var totalEl = document.getElementById('statTotal');
        var todayEl = document.getElementById('statToday');
        var errorsEl = document.getElementById('statErrors');
        var platEl = document.getElementById('statPlatforms');
        if (totalEl) totalEl.textContent = stats.totalTasks || 0;
        if (todayEl) todayEl.textContent = stats.todayTasks || 0;
        if (errorsEl) errorsEl.textContent = stats.errors || 0;
        if (platEl) platEl.textContent = Object.keys(stats.platforms || {}).length || 0;
    }

    /* ===== AUTH ===== */
    var authDiv = document.getElementById('adminAuth');
    var panelDiv = document.getElementById('adminPanel');
    var passInput = document.getElementById('adminPass');
    var loginBtn = document.getElementById('adminLoginBtn');
    var logoutBtn = document.getElementById('adminLogoutBtn');
    var adminError = document.getElementById('adminError');

    function enterPanel() {
        if (authDiv) authDiv.style.display = 'none';
        if (panelDiv) panelDiv.style.display = 'block';
        var statuses = loadStatuses();
        renderStatusGrid(statuses);
        renderQuickStatus();
        updateTimestamp();
        updateStats();
        renderLogs('all', 'all');
        renderAnnouncements();
        renderBlacklist();
        renderSavedAccounts();
        loadBotStatusUI();
        loadWebsiteStatusUI();
    }

    if (sessionStorage.getItem('gioai-admin-auth') === 'true') {
        enterPanel();
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            var pass = passInput ? passInput.value : '';
            if (pass === ADMIN_PASSWORD) {
                sessionStorage.setItem('gioai-admin-auth', 'true');
                if (adminError) adminError.style.display = 'none';
                if (passInput) passInput.value = '';
                enterPanel();
                addLog('Admin logged in', 'info', 'general');
            } else {
                if (adminError) { adminError.textContent = 'Invalid password. Try again.'; adminError.style.display = 'block'; }
                if (passInput) { passInput.value = ''; passInput.focus(); }
            }
        });
    }
    if (passInput) {
        passInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && loginBtn) loginBtn.click();
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            sessionStorage.removeItem('gioai-admin-auth');
            location.reload();
        });
    }

    /* ===== PLATFORM STATUS ===== */
    document.getElementById('saveStatusBtn') && document.getElementById('saveStatusBtn').addEventListener('click', function() {
        var selects = document.querySelectorAll('.status-select');
        var statuses = [];
        selects.forEach(function(sel) {
            statuses.push({ id: sel.dataset.id, label: defaultStatuses.find(function(s) { return s.id === sel.dataset.id; })?.label || sel.dataset.id, status: sel.value });
        });
        saveStatuses(statuses);
        renderQuickStatus();
        addLog('Platform statuses saved', 'success', 'general');
        updateTimestamp();
    });

    document.getElementById('refreshBtn') && document.getElementById('refreshBtn').addEventListener('click', function() {
        var s = loadStatuses();
        renderStatusGrid(s);
        updateTimestamp();
        updateStats();
    });

    document.getElementById('resetDefaultsBtn') && document.getElementById('resetDefaultsBtn').addEventListener('click', function() {
        if (confirm('Reset all platform statuses to defaults?')) {
            localStorage.removeItem(STORAGE_KEY);
            var s = loadStatuses();
            renderStatusGrid(s);
            renderQuickStatus();
            updateTimestamp();
            addLog('Platform statuses reset to defaults', 'info', 'general');
        }
    });

    /* ===== BOT STATUS ===== */
    function loadBotStatusUI() {
        var bs = loadBotStatus();
        var sel = document.getElementById('globalBotStatus');
        if (sel && bs.global) sel.value = bs.global;
    }
    document.getElementById('globalBotStatus') && document.getElementById('globalBotStatus').addEventListener('change', function() {
        var bs = loadBotStatus();
        bs.global = this.value;
        saveBotStatus(bs);
        addLog('Bot status set to: ' + this.value, 'info', 'general');
    });

    /* ===== WEBSITE STATUS ===== */
    function loadWebsiteStatusUI() {
        var s = localStorage.getItem(WEBSITE_STATUS_KEY) || 'online';
        var sel = document.getElementById('websiteStatusSelect');
        if (sel) sel.value = s;
    }
    document.getElementById('websiteStatusSelect') && document.getElementById('websiteStatusSelect').addEventListener('change', function() {
        localStorage.setItem(WEBSITE_STATUS_KEY, this.value);
        addLog('Website status set to: ' + this.value, 'info', 'general');
    });

    /* ===== LOG TABS ===== */
    document.querySelectorAll('#logTabs .tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('#logTabs .tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            var filter = document.querySelector('#logTabs .tab.active');
            var plat = document.querySelector('#logPlatformTabs .tab.active');
            renderLogs(filter ? filter.dataset.filter : 'all', plat ? plat.dataset.platform : 'all');
        });
    });
    document.querySelectorAll('#logPlatformTabs .tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('#logPlatformTabs .tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            var filter = document.querySelector('#logTabs .tab.active');
            var plat = document.querySelector('#logPlatformTabs .tab.active');
            renderLogs(filter ? filter.dataset.filter : 'all', plat ? plat.dataset.platform : 'all');
        });
    });

    document.getElementById('clearLogsBtn') && document.getElementById('clearLogsBtn').addEventListener('click', function() {
        if (confirm('Clear all activity logs?')) {
            localStorage.removeItem(LOGS_KEY);
            renderLogs('all', 'all');
        }
    });

    /* ===== ANNOUNCEMENTS ===== */
    document.getElementById('postAnnounceBtn') && document.getElementById('postAnnounceBtn').addEventListener('click', function() {
        var input = document.getElementById('announceInput');
        var typeSelect = document.getElementById('announceTypeSelect');
        var text = input ? input.value.trim() : '';
        var type = typeSelect ? typeSelect.value : 'announcement';
        if (!text) { alert('Enter announcement text'); return; }
        try {
            var ann = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_KEY) || '[]');
            ann.push({ text: text, time: new Date().toISOString(), type: type });
            localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(ann));
            if (input) input.value = '';
            renderAnnouncements();
            // Reset notification seen so users see new ones
            localStorage.removeItem('gioai-notif-seen');
            addLog('Posted ' + type + ': ' + text.substring(0, 40), 'info', 'general');
        } catch(e) {}
    });

    document.getElementById('clearAnnounceBtn') && document.getElementById('clearAnnounceBtn').addEventListener('click', function() {
        if (confirm('Clear all announcements?')) {
            localStorage.removeItem(ANNOUNCEMENTS_KEY);
            localStorage.removeItem('gioai-notif-seen');
            renderAnnouncements();
            addLog('All announcements cleared', 'info', 'general');
        }
    });

    /* ===== BLACKLIST (ADD with PASSWORD) ===== */
    document.getElementById('addBlacklistBtn') && document.getElementById('addBlacklistBtn').addEventListener('click', function() {
        var input = document.getElementById('blacklistInput');
        var passInput = document.getElementById('blacklistPassInput');
        var platformSelect = document.getElementById('blacklistPlatformSelect');
        var user = input ? input.value.trim().toLowerCase() : '';
        var pass = passInput ? passInput.value.trim() : '';
        var plat = platformSelect ? platformSelect.value : 'all';
        if (!user) { alert('Enter username to blacklist'); return; }
        try {
            var list = loadBlacklist();
            var existing = list.findIndex(function(item) { return item.username === user; });
            if (existing >= 0) {
                if (plat === 'all') { list[existing].platforms = ['all']; }
                else {
                    var p = list[existing].platforms || [];
                    if (p.indexOf('all') < 0 && p.indexOf(plat) < 0) { p.push(plat); }
                    list[existing].platforms = p;
                }
                if (pass) list[existing].password = pass;
            } else {
                var entry = { username: user, platforms: [plat] };
                if (pass) entry.password = pass;
                list.push(entry);
            }
            saveBlacklist(list);
            if (input) input.value = '';
            if (passInput) passInput.value = '';
            renderBlacklist();
            addLog('Blacklisted ' + user + ' on ' + (platformNames[plat] || plat) + (pass ? ' with password filter' : ''), 'warning', 'general');
        } catch(e) {}
    });

    /* ===== SAVED ACCOUNTS MANAGEMENT ===== */
    document.getElementById('refreshAccountsBtn') && document.getElementById('refreshAccountsBtn').addEventListener('click', renderSavedAccounts);
    document.getElementById('accountsPlatformSelect') && document.getElementById('accountsPlatformSelect').addEventListener('change', renderSavedAccounts);

    /* ===== INCREASE ACCOUNT USES ===== */
    document.getElementById('increaseUsesBtn') && document.getElementById('increaseUsesBtn').addEventListener('click', function() {
        var plat = document.getElementById('increasePlatformSelect');
        var userInput = document.getElementById('increaseUsernameInput');
        var amountInput = document.getElementById('increaseAmountInput');
        var resultEl = document.getElementById('increaseResult');
        if (!plat || !userInput || !amountInput || !resultEl) return;
        var platform = plat.value;
        var username = userInput.value.trim();
        var amount = parseInt(amountInput.value) || 1;
        if (!username) { alert('Enter username'); return; }
        var accounts = getSavedAccounts(platform);
        var found = false;
        for (var i = 0; i < accounts.length; i++) {
            if (accounts[i].username === username) {
                accounts[i].uses = (accounts[i].uses || 0) + amount;
                found = true;
                break;
            }
        }
        if (!found) {
            resultEl.style.display = 'block';
            resultEl.style.color = 'var(--danger)';
            resultEl.textContent = 'Account "' + username + '" not found on ' + platformNames[platform];
            return;
        }
        saveSavedAccounts(platform, accounts);
        resultEl.style.display = 'block';
        resultEl.style.color = 'var(--success)';
        resultEl.textContent = 'Added ' + amount + ' uses to ' + username + ' on ' + platformNames[platform] + ' (total: ' + accounts.find(function(a) { return a.username === username; }).uses + ')';
        addLog('Increased uses for ' + username + ' on ' + platform + ' by ' + amount, 'info', 'general');
        userInput.value = '';
        renderSavedAccounts();
    });

    /* ===== INIT ===== */
    window.addEventListener('storage', function(e) {
        if (e.key === STATS_KEY || e.key === LOGS_KEY) {
            updateStats();
            var filter = document.querySelector('#logTabs .tab.active');
            var plat = document.querySelector('#logPlatformTabs .tab.active');
            renderLogs(filter ? filter.dataset.filter : 'all', plat ? plat.dataset.platform : 'all');
        }
    });

    updateTimestamp();
    setInterval(function() {
        updateStats();
        updateTimestamp();
    }, 10000);
})();

