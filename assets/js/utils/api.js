// ============================================================
// GIOAI v8.0 - API Utility
// Routes to local Playwright server first, falls back to Worker
// ============================================================
var API = (function() {
  'use strict';

  function call(url, data, method) {
    method = method || 'POST';
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(30000)
    }).then(function(r) {
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') !== -1 || ct.indexOf('text/javascript') !== -1) {
        return r.json().catch(function() { return { error: 'Invalid JSON', status: r.status }; });
      }
      return r.text().then(function(t) { return { raw: t, status: r.status }; });
    }).catch(function(e) {
      if (e.name === 'TimeoutError') return { error: 'Request timed out' };
      return { error: e.message || 'Network error' };
    });
  }

  // Call the local Playwright server directly
  function pw(endpoint, data) {
    return call(CONFIG.PLAYWRIGHT_API + endpoint, data).then(function(r) {
      if (r.error && r.error.indexOf('Failed to fetch') !== -1) {
        return { error: 'Playwright server offline' };
      }
      return r;
    });
  }

  // Fallback to Cloudflare Worker
  function worker(endpoint, data) {
    return call(CONFIG.WORKER_URL + endpoint, data);
  }

  // Try local PW server first, fallback to Worker
  function tryLocalFirst(ep, data) {
    return pw(ep, data).then(function(r) {
      if (r.error && r.error.indexOf('Playwright server offline') !== -1) {
        console.log('[API] Local server offline, trying Worker...');
        return worker(ep, data);
      }
      return r;
    });
  }

  // ===== PLATFORM LOGINS =====
  // Primary: local Playwright server
  function languagenutLogin(username, password) {
    return pw('/api/lnut/login', { username: username, password: password });
  }

  function senecaLogin(email, password) {
    return pw('/api/seneca/login', { email: email, password: password });
  }

  function sparxLogin(school, username, password) {
    return pw('/api/sparx/login', { schoolId: school, username: username, password: password });
  }

  function sparxExchangeCookies(cookies, schoolId) {
    return pw('/api/sparx/exchange', { cookies: cookies, school_id: schoolId });
  }

  function sparxManualAuth(token) {
    return pw('/api/sparx/manual-auth', { token: token });
  }

  // ===== FETCH TASKS =====
  function fetchTasks(platform, auth) {
    return pw('/api/' + platform + '/homeworks', auth);
  }

  // ===== PLATFORM ACTIONS =====
  function startActivity(token, platform, data) {
    return pw('/api/sparx/start-activity', { token: token, package_id: data.package_id, task_index: data.task_index || 0, session_id: data.session_id || '' });
  }

  function vocabLnut(token, curriculumUid) {
    return pw('/api/lnut/vocab', { token: token, curriculumUid: curriculumUid });
  }

  function scoreLnut(token, scoreData) {
    return pw('/api/lnut/score', { token: token, scoreData: scoreData });
  }

  function submitSeneca(idToken, sessionData) {
    return pw('/api/seneca/submit-session', { idToken: idToken, sessionData: sessionData });
  }

  function completeSeneca(idToken, courseId, sectionId) {
    return pw('/api/seneca/complete', { idToken: idToken, courseId: courseId, sectionId: sectionId });
  }

  // ===== SPARX SCHOOL SEARCH =====
  function searchSchools(query) {
    // Try local server first (has pre-loaded data), fallback to Worker
    return pw('/api/sparx/search-school', { query: query }).then(function(r) {
      if (r.results) return r;
      return worker('/api/sparx/search-school', { query: query });
    });
  }

  // ===== STATUS =====
  function getStatus() {
    // Check local server health
    return pw('/api/status', {}).then(function(r) {
      if (r.status === 'operational') return r;
      return worker('/api/status', {});
    });
  }

  function getPlaywrightStatus() {
    return pw('/api/status', {});
  }

  // ===== ADMIN =====
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
    pw: pw,
    worker: worker,
    tryLocalFirst: tryLocalFirst,
    languagenutLogin: languagenutLogin,
    senecaLogin: senecaLogin,
    sparxLogin: sparxLogin,
    sparxExchangeCookies: sparxExchangeCookies,
    sparxManualAuth: sparxManualAuth,
    fetchTasks: fetchTasks,
    startActivity: startActivity,
    vocabLnut: vocabLnut,
    scoreLnut: scoreLnut,
    submitSeneca: submitSeneca,
    completeSeneca: completeSeneca,
    searchSchools: searchSchools,
    getStatus: getStatus,
    getPlaywrightStatus: getPlaywrightStatus,
    adminGiveSlots: adminGiveSlots,
    adminBlacklist: adminBlacklist,
    adminAnnouncement: adminAnnouncement,
    adminSetPlatformStatus: adminSetPlatformStatus
  };
})();

