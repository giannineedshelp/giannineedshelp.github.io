// ============================================================
// GIOAI v8.0 - API Utility
// ============================================================
var API = (function() {
  'use strict';
  
  function call(endpoint, data, method) {
    method = method || 'POST';
    var url = endpoint.startsWith('http') ? endpoint : CONFIG.API_BASE + endpoint;
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(15000)
    }).then(function(r) {
      // Handle non-JSON responses
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') !== -1 || ct.indexOf('text/javascript') !== -1) {
        return r.json().catch(function() { return { error: 'Invalid JSON response', status: r.status }; });
      }
      return r.text().then(function(t) { return { raw: t, status: r.status }; });
    }).catch(function(e) {
      if (e.name === 'TimeoutError') return { error: 'Request timed out' };
      return { error: e.message || 'Network error' };
    });
  }
  
  // Worker API calls
  function worker(endpoint, data) {
    return call(CONFIG.WORKER_URL + endpoint, data);
  }
  
  // Platform login
  function senecaLogin(email, password) {
    return worker('/api/seneca/login', { email: email, password: password });
  }
  
  function languagenutLogin(username, password) {
    return worker('/api/lnut/login', { username: username, password: password });
  }
  
  function sparxExchangeCookies(cookies, schoolId) {
    return worker('/api/sparx/exchange', { cookies: cookies, school_id: schoolId });
  }
  
  function sparxLogin(school, username, password) {
    return worker('/api/sparx/login', { school: school, username: username, password: password });
  }
  
  function sparxManualAuth(token) {
    return worker('/api/sparx/manual-auth', { token: token });
  }
  
  // Fetch tasks
  function fetchTasks(platform, auth) {
    var ep = '/api/' + platform + '/homeworks';
    return worker(ep, auth);
  }
  
  // Status
  function getStatus() {
    return worker('/api/status', {});
  }
  
  // Admin
  function adminGiveSlots(username, amount, adminKey) {
    return worker('/api/admin/give-slots', { username: username, amount: amount, adminKey: adminKey });
  }
  
  function adminBlacklist(action, username, adminKey) {
    return worker('/api/admin/blacklist', { action: action, username: username, adminKey: adminKey });
  }
  
  function adminAnnouncement(message, type, adminKey) {
    return worker('/api/admin/announcement', { message: message, type: type, adminKey: adminKey });
  }
  
  function adminSetPlatformStatus(platform, status, adminKey) {
    return worker('/api/admin/platform-status', { platform: platform, status: status, adminKey: adminKey });
  }
  
  return {
    call: call,
    worker: worker,
    senecaLogin: senecaLogin,
    languagenutLogin: languagenutLogin,
    sparxExchangeCookies: sparxExchangeCookies,
    sparxLogin: sparxLogin,
    sparxManualAuth: sparxManualAuth,
    fetchTasks: fetchTasks,
    getStatus: getStatus,
    adminGiveSlots: adminGiveSlots,
    adminBlacklist: adminBlacklist,
    adminAnnouncement: adminAnnouncement,
    adminSetPlatformStatus: adminSetPlatformStatus
  };
})();

