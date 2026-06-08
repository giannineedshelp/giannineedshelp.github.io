// ============================================================
// GIOAI v8.0 - Queue System with Usage Limits
// ============================================================
var Queue = (function() {
  'use strict';
  
  var _queue = [];
  var _running = false;
  var _platform = '';
  var _callbacks = {};
  
  function init(platform) {
    _queue = [];
    _running = false;
    _platform = platform;
    updateUI();
  }
  
  function add(task) {
    _queue.push(task);
    updateUI();
    return _queue.length;
  }
  
  function addMultiple(tasks) {
    for (var i = 0; i < tasks.length; i++) {
      _queue.push(tasks[i]);
    }
    updateUI();
    return _queue.length;
  }
  
  function remove(index) {
    if (index >= 0 && index < _queue.length) {
      _queue.splice(index, 1);
      updateUI();
    }
  }
  
  function clear() {
    _queue = [];
    updateUI();
  }
  
  function size() {
    return _queue.length;
  }
  
  function isRunning() {
    return _running;
  }
  
  function on(event, fn) {
    _callbacks[event] = _callbacks[event] || [];
    _callbacks[event].push(fn);
  }
  
  function emit(event, data) {
    var cbs = _callbacks[event] || [];
    for (var i = 0; i < cbs.length; i++) {
      try { cbs[i](data); } catch(e) {}
    }
  }
  
  // Check if user can run (usage limit)
  function checkUsage(username) {
    if (!username) return { allowed: false, reason: 'Not logged in' };
    var remaining = Store.getRemainingUses(username);
    var bonus = Store.getBonusUses(username);
    if (remaining + bonus > 0) return { allowed: true, remaining: remaining, bonus: bonus };
    return { allowed: false, reason: 'Daily limit reached (' + CONFIG.USAGE_LIMIT + '/24h). Ask admin for more uses.', remaining: 0 };
  }
  
  // Run the queue
  async function start(username, taskRunner) {
    if (_running) return;
    if (_queue.length === 0) {
      UI.toast('No tasks in queue', 'warn');
      return;
    }
    
    // Check usage
    var usage = checkUsage(username);
    if (!usage.allowed) {
      UI.toast(usage.reason, 'error');
      emit('error', usage.reason);
      return;
    }
    
    _running = true;
    emit('start', { total: _queue.length });
    UI.log('info', 'Queue started: ' + _queue.length + ' tasks');
    
    var completed = 0;
    var errors = 0;
    
    for (var i = 0; i < _queue.length; i++) {
      if (!_running) {
        UI.log('warn', 'Queue stopped by user');
        break;
      }
      
      var task = _queue[i];
      UI.log('info', 'Processing ' + (i+1) + '/' + _queue.length + ': ' + (task.title || 'Task'));
      emit('progress', { current: i+1, total: _queue.length, task: task });
      
      try {
        if (typeof taskRunner === 'function') {
          await taskRunner(task, i);
        } else {
          await UI.sleep(UI.randomBetween(2000, 5000));
        }
        completed++;
        // Track usage after each successful task completion
        if (username) Store.addUsage(username);
        emit('complete', { task: task, index: i });
      } catch(e) {
        errors++;
        UI.log('error', 'Task failed: ' + (e.message || 'Unknown error'));
        emit('error', { task: task, error: e.message });
      }
      
      emit('update', { completed: completed, errors: errors, remaining: _queue.length - i - 1 });
    }
    
    _running = false;
    emit('finish', { completed: completed, errors: errors, total: _queue.length });
    UI.log('success', 'Queue finished: ' + completed + ' completed, ' + errors + ' errors');
    
    if (completed > 0) {
      UI.toast('Done! ' + completed + '/' + _queue.length + ' tasks', 'success');
    }
    
    updateUI();
  }
  
  function stop() {
    _running = false;
    UI.log('warn', 'Queue stopping...');
    emit('stop', {});
    updateUI();
  }
  
  function updateUI() {
    var totalEl = document.getElementById('queueTotal');
    var statusEl = document.getElementById('queueStatus');
    if (totalEl) totalEl.textContent = _queue.length;
    if (statusEl) {
      if (_running) statusEl.textContent = 'Running...';
      else if (_queue.length > 0) statusEl.textContent = 'Ready (' + _queue.length + ' tasks)';
      else statusEl.textContent = 'Idle';
    }
    
    // Update start/stop buttons
    var startBtn = document.getElementById('dashStartBtn');
    var stopBtn = document.getElementById('dashStopBtn');
    if (startBtn) startBtn.disabled = _running || _queue.length === 0;
    if (stopBtn) stopBtn.disabled = !_running;
    
    // Update fetch btn
    var fetchBtn = document.getElementById('dashFetchBtn');
    if (fetchBtn) fetchBtn.disabled = _running;
  }
  
  return {
    init: init,
    add: add,
    addMultiple: addMultiple,
    remove: remove,
    clear: clear,
    size: size,
    isRunning: isRunning,
    on: on,
    checkUsage: checkUsage,
    start: start,
    stop: stop,
    updateUI: updateUI
  };
})();

