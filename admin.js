// ============================================================
// GIOAI v6.0 - Admin Panel (standalone)
// Handles: Auth, Blacklist, Announcements, Platform Status, Slots
// ============================================================

var ADMIN_PASSWORD = '@Gk69614789';
var WORKER_URL = 'https://gioai.giannikei12.workers.dev';
var API_BASE = WORKER_URL + '/api';

// Check if we're in standalone admin.html or embedded
var isStandalone = window.location.pathname.indexOf('admin.html') !== -1;

// ===== ADMIN STATE =====
var A = {
  authenticated: false,
  adminKey: localStorage.getItem('gioai-admin-key') || 'gioai-default-admin-key',
  blacklist: JSON.parse(localStorage.getItem('gioai-blacklist') || '[]'),
  announcements: JSON.parse(localStorage.getItem('gioai-announcements') || '[]')
};

// ===== INIT =====
function adminInit() {
  if (isStandalone) {
    // Check if already authenticated
    if (localStorage.getItem('gioai-admin-auth') === '1') {
      A.authenticated = true;
      showAdminPanel();
    }
    bindEl('adminLoginBtn', 'click', adminLogin);
    bindEl('adminPassword', 'keydown', function(e) {
      if (e.key === 'Enter') adminLogin();
    });
  }
  
  // Admin panel actions
  bindEl('giveSlotsBtn', 'click', giveSlots);
  bindEl('blacklistBtn', 'click', manageBlacklist);
  bindEl('announcementBtn', 'click', sendAnnouncement);
  bindEl('platformStatusBtn', 'click', setPlatformStatus);
  bindEl('checkPlatformsBtn', 'click', checkAllPlatforms);
  bindEl('refreshStatusBtn', 'click', refreshStatus);
  bindEl('logoutBtn', 'click', adminLogout);
  
  // Load data
  loadBlacklist();
  loadAnnouncements();
}

function bindEl(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

// ===== AUTHENTICATION =====
function adminLogin() {
  var pass = document.getElementById('adminPassword');
  if (!pass) return;
  var val = pass.value.trim();
  if (val === ADMIN_PASSWORD) {
    A.authenticated = true;
    localStorage.setItem('gioai-admin-auth', '1');
    showAdminPanel();
    toast('Admin authenticated', 'success');
  } else {
    // Also try SHA-256
    sha256(val).then(function(hash) {
      if (hash === 'b38c75356f6a622c2df4036e9c96c4f455f2e298685bf0ae03c602a1b32b0b9a') {
        A.authenticated = true;
        localStorage.setItem('gioai-admin-auth', '1');
        showAdminPanel();
        toast('Admin authenticated (hash)', 'success');
      } else {
        toast('Invalid password', 'error');
      }
    }).catch(function() {
      toast('Invalid password', 'error');
    });
  }
}

function adminLogout() {
  A.authenticated = false;
  localStorage.removeItem('gioai-admin-auth');
  if (isStandalone) {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
  }
  toast('Logged out', 'info');
}

function showAdminPanel() {
  if (isStandalone) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
  }
  loadAnnouncements();
  loadBlacklist();
  refreshStatus();
  checkAllPlatforms();
}

// ===== API CALLS =====
function adminApi(path, data) {
  data.adminKey = A.adminKey;
  return fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(function(r) { return r.json(); });
}

// ===== GIVE SLOTS =====
function giveSlots() {
  var username = document.getElementById('adminUsername');
  var amount = document.getElementById('adminAmount');
  var result = document.getElementById('adminResult');
  if (!username || !amount || !result) return;
  var u = username.value.trim();
  var a = parseInt(amount.value) || 1;
  if (!u) { result.className = 'admin-result error'; result.textContent = 'Enter a username'; return; }
  
  result.className = 'admin-result';
  result.textContent = 'Processing...';
  
  adminApi('/admin/give-slots', { username: u, amount: a }).then(function(d) {
    if (d.success) {
      result.className = 'admin-result success';
      result.textContent = d.message || 'Added ' + a + ' slots to ' + u;
    } else {
      result.className = 'admin-result error';
      result.textContent = d.error || 'Failed';
    }
  }).catch(function(e) {
    result.className = 'admin-result error';
    result.textContent = 'Error: ' + e.message;
  });
}

// ===== BLACKLIST =====
function manageBlacklist() {
  var username = document.getElementById('blacklistUser');
  var action = document.getElementById('blacklistAction');
  var result = document.getElementById('blacklistResult');
  if (!action || !result) return;
  var u = username ? username.value.trim() : '';
  var a = action.value;
  
  if (!u && a !== 'list') { result.className = 'admin-result error'; result.textContent = 'Enter a username'; return; }
  
  result.className = 'admin-result';
  result.textContent = 'Processing...';
  
  adminApi('/admin/blacklist', { username: u, action: a }).then(function(d) {
    if (d.success) {
      A.blacklist = d.blacklist || [];
      localStorage.setItem('gioai-blacklist', JSON.stringify(A.blacklist));
      
      if (a === 'add') {
        result.className = 'admin-result success';
        result.textContent = u + ' blacklisted';
      } else if (a === 'remove') {
        result.className = 'admin-result success';
        result.textContent = u + ' removed from blacklist';
      } else {
        result.className = 'admin-result success';
        result.textContent = 'Blacklisted: ' + (d.blacklist && d.blacklist.length ? d.blacklist.join(', ') : 'none');
      }
      loadBlacklist();
    } else {
      result.className = 'admin-result error';
      result.textContent = d.error || 'Failed';
    }
  }).catch(function(e) {
    result.className = 'admin-result error';
    result.textContent = 'Error: ' + e.message;
  });
}

function loadBlacklist() {
  A.blacklist = JSON.parse(localStorage.getItem('gioai-blacklist') || '[]');
  var el = document.getElementById('blacklistResult');
  if (el && A.blacklist.length) {
    el.className = 'admin-result success';
    el.textContent = 'Blacklisted users: ' + A.blacklist.join(', ');
  } else if (el) {
    el.className = 'admin-result';
    el.textContent = 'No users blacklisted';
  }
}

// ===== ANNOUNCEMENTS =====
function sendAnnouncement() {
  var msg = document.getElementById('announcementMsg');
  var type = document.getElementById('announcementType');
  var result = document.getElementById('announcementResult');
  if (!msg || !type || !result) return;
  var m = msg.value.trim();
  var t = type.value;
  
  if (!m) { result.className = 'admin-result error'; result.textContent = 'Enter a message'; return; }
  
  result.className = 'admin-result';
  result.textContent = 'Sending...';
  
  adminApi('/admin/announcement', { message: m, type: t }).then(function(d) {
    if (d.success) {
      result.className = 'admin-result success';
      result.textContent = 'Announcement sent!';
      msg.value = '';
      // Save locally
      A.announcements.unshift(d.announcement);
      if (A.announcements.length > 50) A.announcements = A.announcements.slice(0, 50);
      localStorage.setItem('gioai-announcements', JSON.stringify(A.announcements));
      loadAnnouncements();
    } else {
      result.className = 'admin-result error';
      result.textContent = d.error || 'Failed';
    }
  }).catch(function(e) {
    result.className = 'admin-result error';
    result.textContent = 'Error: ' + e.message;
  });
}

function loadAnnouncements() {
  A.announcements = JSON.parse(localStorage.getItem('gioai-announcements') || '[]');
  var list = document.getElementById('announcementList');
  if (!list) return;
  if (!A.announcements.length) {
    list.innerHTML = '<div class="empty-state">No announcements</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < A.announcements.length; i++) {
    var a = A.announcements[i];
    html += '<div class="ann-item">' +
      '<span class="ann-type ' + (a.type === 'warning' ? 'ann-warn' : a.type === 'error' ? 'ann-err' : 'ann-info') + '">' + a.type.toUpperCase() + '</span> ' +
      a.message +
      '<span class="ann-time">' + (a.timestamp ? new Date(a.timestamp).toLocaleString() : '') + '</span>' +
      '</div>';
  }
  list.innerHTML = html;
}

// ===== PLATFORM STATUS =====
function setPlatformStatus() {
  var platform = document.getElementById('statusPlatform');
  var status = document.getElementById('statusValue');
  var result = document.getElementById('statusResult');
  if (!platform || !status || !result) return;
  
  result.className = 'admin-result';
  result.textContent = 'Updating...';
  
  adminApi('/admin/platform-status', { platform: platform.value, status: status.value }).then(function(d) {
    if (d.success) {
      result.className = 'admin-result success';
      result.textContent = d.message || 'Updated';
      checkAllPlatforms();
    } else {
      result.className = 'admin-result error';
      result.textContent = d.error || 'Failed';
    }
  }).catch(function(e) {
    result.className = 'admin-result error';
    result.textContent = 'Error: ' + e.message;
  });
}

function checkAllPlatforms() {
  var el = document.getElementById('platformStatuses');
  if (!el) return;
  el.innerHTML = 'Checking...';
  
  var results = {};
  var done = 0;
  
  function checkDone() {
    done++;
    if (done >= 3) {
      var html = '';
      var names = { languagenut: 'LanguageNut', seneca: 'Seneca', sparx: 'Sparx', worker: 'Worker' };
      for (var p in results) {
        var s = results[p];
        html += '<div class="ps-row"><span class="ps-name">' + (names[p] || p) + ':</span>' +
          '<span class="ps-indicator ' + (s === 'online' ? 'online' : s === 'offline' ? 'offline' : 'checking') + '">' + s + '</span></div>';
      }
      el.innerHTML = html || 'No data';
    }
  }
  
  // Check LanguageNut
  fetch('https://api.languagenut.com/publicTranslationController/getTranslations', { signal: AbortSignal.timeout(5000) })
    .then(function(r) { results.languagenut = r.ok ? 'online' : 'offline'; checkDone(); })
    .catch(function() { results.languagenut = 'offline'; checkDone(); });
  
  // Check Worker
  fetch(API_BASE + '/status', { signal: AbortSignal.timeout(5000) })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      results.worker = d.status === 'operational' ? 'online' : 'degraded';
      if (d.platforms) {
        results.seneca = d.platforms.seneca || 'unknown';
        results.sparx = d.platforms.sparx || 'unknown';
      }
      checkDone(); checkDone(); checkDone();
    })
    .catch(function() {
      results.worker = 'offline';
      results.seneca = 'unknown';
      results.sparx = 'unknown';
      checkDone(); checkDone(); checkDone();
    });
}

// ===== STATUS REFRESH =====
function refreshStatus() {
  var el = document.getElementById('workerStatus');
  if (!el) return;
  el.innerHTML = 'Loading...';
  
  fetch(API_BASE + '/status', { signal: AbortSignal.timeout(5000) })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var html = '<div class="status-grid">';
      html += '<div class="stat-item"><span class="stat-label">Worker Status:</span><span class="stat-value ' + (d.status === 'operational' ? 'text-success' : 'text-warn') + '">' + d.status + '</span></div>';
      html += '<div class="stat-item"><span class="stat-label">Uptime:</span><span class="stat-value">' + formatUptime(d.uptime || 0) + '</span></div>';
      html += '<div class="stat-item"><span class="stat-label">Total Calls:</span><span class="stat-value">' + (d.totalCalls || 0) + '</span></div>';
      html += '<div class="stat-item"><span class="stat-label">AI Calls:</span><span class="stat-value">' + (d.aiCalls || 0) + '</span></div>';
      html += '<div class="stat-item"><span class="stat-label">Version:</span><span class="stat-value">' + (d.version || '?') + '</span></div>';
      html += '</div>';
      el.innerHTML = html;
    })
    .catch(function(e) {
      el.innerHTML = '<div class="text-error">Connection error: ' + e.message + '</div>';
    });
}

function formatUptime(s) {
  if (s >= 86400) return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
  if (s >= 3600) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
  if (s >= 60) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return s + 's';
}

// ===== TOAST =====
function toast(msg, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = '0.3s ease'; }, 3000);
  setTimeout(function() { el.remove(); }, 3500);
}

// ===== SHA-256 =====
function sha256(str) {
  // Simple SHA-256 implementation using Web Crypto API
  var buffer = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', buffer).then(function(hash) {
    return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', adminInit);


