// ============================================================
// GIOAI v8.0 - UI Utilities
// ============================================================
var UI = (function() {
  'use strict';
  
  // Toast notification system
  function toast(msg, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    var container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    el.style.cssText = 'padding:12px 20px;border-radius:8px;font-size:.85rem;font-weight:500;animation:slideIn .3s;max-width:350px;box-shadow:0 4px 20px rgba(0,0,0,.4)';
    if (type === 'success') el.style.background = '#00ff41'; 
    else if (type === 'error') { el.style.background = '#ff6b6b'; el.style.color = '#fff'; }
    else if (type === 'warn') el.style.background = '#ffd93d';
    else el.style.background = '#00d4ff';
    if (type !== 'success') el.style.color = '#000';
    container.appendChild(el);
    setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = '0.3s ease'; }, duration);
    setTimeout(function() { el.remove(); }, duration + 500);
  }
  
  // Log system
  function log(type, msg, container) {
    container = container || document.getElementById('globalLog') || document.getElementById('dashLogEntries');
    if (!container) return;
    var entry = document.createElement('div');
    entry.className = 'log-entry log-' + type;
    var icon = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warn' ? '⚠' : '→';
    entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + icon + ' ' + msg;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }
  
  // Progress bar update
  function setProgress(percent, text) {
    var fill = document.getElementById('dashProgressFill');
    var txt = document.getElementById('dashProgressText');
    if (fill) fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
    if (txt && text) txt.textContent = text;
  }
  
  // Show/hide screen
  function showScreen(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.remove('active');
    }
    var target = document.getElementById(id);
    if (target) target.classList.add('active');
  }
  
  // Format seconds
  function secondsToString(secs) {
    if (secs >= 86400) return Math.floor(secs / 86400) + 'd ' + Math.floor((secs % 86400) / 3600) + 'h';
    if (secs >= 3600) return Math.floor(secs / 3600) + 'h ' + Math.floor((secs % 3600) / 60) + 'm';
    if (secs >= 60) return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
    return secs + 's';
  }
  
  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  function sleep(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }
  
  // Debounce helper
  function debounce(fn, ms) {
    var timer = null;
    return function() {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
  }
  
  return {
    toast: toast,
    log: log,
    setProgress: setProgress,
    showScreen: showScreen,
    secondsToString: secondsToString,
    randomBetween: randomBetween,
    sleep: sleep,
    debounce: debounce
  };
})();

