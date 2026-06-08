// ============================================================
// GIOAI v8.0 - Storage Utilities
// ============================================================
var Store = (function() {
  'use strict';
  var PREFIX = 'gioai-';
  
  function get(key, def) {
    try {
      var val = localStorage.getItem(PREFIX + key);
      if (val === null || val === undefined) return def;
      // Try to parse as JSON
      try { return JSON.parse(val); } catch(e) { return val; }
    } catch(e) { return def; }
  }
  
  function set(key, val) {
    try {
      var toStore = typeof val === 'object' ? JSON.stringify(val) : String(val);
      localStorage.setItem(PREFIX + key, toStore);
      return true;
    } catch(e) { return false; }
  }
  
  function remove(key) {
    try { localStorage.removeItem(PREFIX + key); return true; } catch(e) { return false; }
  }
  
  // ===== USAGE TRACKING =====
  function getUsage(username) {
    var usage = get('usage-' + username, []);
    // Filter out expired entries
    var now = Date.now();
    var windowMs = CONFIG.USAGE_WINDOW_MS || 86400000;
    var valid = [];
    for (var i = 0; i < usage.length; i++) {
      if (now - usage[i] < windowMs) valid.push(usage[i]);
    }
    if (valid.length !== usage.length) set('usage-' + username, valid);
    return valid;
  }
  
  function addUsage(username) {
    var usage = getUsage(username);
    usage.push(Date.now());
    set('usage-' + username, usage);
    return usage.length;
  }
  
  function getRemainingUses(username) {
    var limit = CONFIG.USAGE_LIMIT || 2;
    var count = getUsage(username).length;
    return Math.max(0, limit - count);
  }
  
  function canUse(username) {
    return getRemainingUses(username) > 0;
  }
  
  // Admin ability to reset/give uses
  function adminAddUses(username, amount) {
    var usage = get('usage-' + username, []);
    // Add negative timestamps (pre-epoch) as "bonus" slots
    for (var i = 0; i < amount; i++) {
      usage.push(0); // timestamp 0 = bonus use that never expires
    }
    set('usage-' + username, usage);
    return usage.length;
  }
  
  // Get total bonus (admin-given) uses remaining
  function getBonusUses(username) {
    var usage = get('usage-' + username, []);
    var count = 0;
    for (var i = 0; i < usage.length; i++) {
      if (usage[i] === 0) count++;
    }
    return count;
  }
  
  // ===== SAVED ACCOUNTS =====
  function getAccounts(platform) {
    return get('accounts-' + platform, {});
  }
  
  function saveAccount(platform, username, password) {
    if (!username || !password) return false;
    var accounts = getAccounts(platform);
    accounts[username] = password;
    set('accounts-' + platform, accounts);
    return true;
  }
  
  function removeAccount(platform, username) {
    var accounts = getAccounts(platform);
    delete accounts[username];
    set('accounts-' + platform, accounts);
  }
  
  // ===== SETTINGS =====
  function getTheme() {
    return get('theme', 'dark');
  }
  
  function setTheme(t) {
    set('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }
  
  // ===== ANNOUNCEMENTS =====
  function getAnnouncements() {
    return get('announcements', []);
  }
  
  function addAnnouncement(msg, type) {
    var anns = getAnnouncements();
    anns.unshift({ message: msg, type: type || 'info', timestamp: new Date().toISOString() });
    if (anns.length > 50) anns = anns.slice(0, 50);
    set('announcements', anns);
    return anns;
  }
  
  return {
    get: get,
    set: set,
    remove: remove,
    getUsage: getUsage,
    addUsage: addUsage,
    getRemainingUses: getRemainingUses,
    canUse: canUse,
    adminAddUses: adminAddUses,
    getBonusUses: getBonusUses,
    getAccounts: getAccounts,
    saveAccount: saveAccount,
    removeAccount: removeAccount,
    getTheme: getTheme,
    setTheme: setTheme,
    getAnnouncements: getAnnouncements,
    addAnnouncement: addAnnouncement
  };
})();

