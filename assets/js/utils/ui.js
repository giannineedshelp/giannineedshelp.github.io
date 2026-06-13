// ============================================================
// GIOAI v8.0 - UI Utilities
// ============================================================
var UI = (function() {
  'use strict';

  function toast(msg, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    var container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function() {
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      el.style.transition = '0.3s ease';
    }, duration);
    setTimeout(function() { el.remove(); }, duration + 500);
  }

  function log(type, msg, container) {
    container = container || document.getElementById('dashLogEntries');
    if (!container) return;
    var entry = document.createElement('div');
    entry.className = 'log-entry log-' + type;
    var icon = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warn' ? '⚠' : '→';
    entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + icon + ' ' + msg;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  function setProgress(percent, text) {
    var fill = document.getElementById('dashProgressFill');
    var txt = document.getElementById('dashProgressText');
    if (fill) fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
    if (txt && text) txt.textContent = text;
  }

  function showScreen(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.remove('active');
    }
    var target = document.getElementById(id);
    if (target) target.classList.add('active');

    // Update topbar nav
    var navBtns = document.querySelectorAll('.topbar-nav button');
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].classList.toggle('active', navBtns[i].dataset.screen === id.replace('Screen', '').toLowerCase());
    }
  }

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

  function debounce(fn, ms) {
    var timer = null;
    return function() {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
  }

  function setServerStatus(status) {
    var dot = document.getElementById('serverDot');
    var label = document.getElementById('serverLabel');
    if (dot && label) {
      dot.className = 'server-dot ' + status;
      label.textContent = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Checking...';
    }
  }

  return {
    toast: toast,
    log: log,
    setProgress: setProgress,
    showScreen: showScreen,
    secondsToString: secondsToString,
    randomBetween: randomBetween,
    sleep: sleep,
    debounce: debounce,
    setServerStatus: setServerStatus
  };
})();

