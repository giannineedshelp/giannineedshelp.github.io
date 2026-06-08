'use strict';

// ============================================================
// Sparx Automator v1.0 - Main Orchestrator
// 
// Modes:
//   api    - Direct gRPC API calls (no browser needed, works anywhere)
//   browser - Puppeteer-based browser automation (requires Chromium)
//
// Ported from GIOAI v7.0 with significant enhancements
// ============================================================

const CFG = require('./config');
const grpcHelper = require('./grpc-helper');
const api = require('./sparx-api');
const schools = require('./sparx-schools');
const browser = require('./sparx-browser');

class SparxAutomator {
  constructor(options = {}) {
    this.token = null;
    this.sessionId = '';
    this.schoolId = options.schoolId || '';
    this.username = options.username || '';
    this.password = options.password || '';
    this.mode = options.mode || 'auto'; // auto, api, browser
    this.delayMin = options.delayMin || CFG.SETTINGS.delayMin;
    this.delayMax = options.delayMax || CFG.SETTINGS.delayMax;
    this.showWorking = options.showWorking !== false;
    this.running = false;
    this.completed = 0;
    this.errors = 0;
    this.tasks = [];
    this.browser = null;
    this.page = null;
  }

  /**
   * Check health of Sparx API.
   */
  async healthCheck() {
    console.log('[sparx] Checking Sparx API health...');
    const ok = await api.checkHealth();
    console.log('[sparx] API status:', ok ? 'ONLINE' : 'OFFLINE');
    return ok;
  }

  /**
   * Search for a school by name.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async searchSchool(query) {
    const schoolList = await schools.getSchools();
    const results = api.searchSchools(schoolList, query);
    schools.displaySchools(results);
    return results;
  }

  /**
   * Authenticate with Sparx - tries API mode first, falls back to browser.
   * @param {string} username
   * @param {string} password
   * @param {string} schoolId
   * @returns {Promise<boolean>}
   */
  async login(username, password, schoolId) {
    this.username = username;
    this.password = password;
    this.schoolId = schoolId || this.schoolId;

    console.log('[sparx] Authenticating with Sparx...');

    // Mode 1: Try API token acquisition (works for some schools)
    if (this.mode === 'auto' || this.mode === 'api') {
      console.log('[sparx] Trying API token acquisition...');
      const apiToken = await api.getApiToken(this.schoolId);
      if (apiToken) {
        this.token = apiToken;
        this.sessionId = '';
        console.log('[sparx] API token acquired successfully');
        return true;
      }
      console.log('[sparx] API token acquisition failed - Sparx requires browser-based auth');
      
      if (this.mode === 'api') {
        throw new Error(
          'Sparx API token could not be obtained automatically.\n' +
          'The Sparx OAuth endpoints require browser-based authentication.\n' +
          'Use --mode browser or provide a token with --token'
        );
      }
    }

    // Mode 2: Browser automation (requires Chromium)
    if (this.mode === 'auto' || this.mode === 'browser') {
      if (!browser.isAvailable()) {
        console.log('[sparx] Browser automation unavailable on this platform');
        console.log('[sparx] Provide an existing token with --token to use API mode');
        throw new Error(
          'No browser automation available. Options:\n' +
          '  1. Run from a desktop environment (Linux/macOS/Windows) with Chromium\n' +
          '  2. Provide an existing Sparx token: --token YOUR_TOKEN\n' +
          '  3. Set CHROME_PATH=/path/to/chromium environment variable'
        );
      }

      console.log('[sparx] Launching browser for Sparx login...');
      const result = await browser.loginAndGetToken({
        username,
        password,
        schoolId: this.schoolId,
      });

      this.token = result.token;
      this.sessionId = result.sessionId || '';
      this.browser = result.browser;
      this.page = result.page;

      if (this.token) {
        console.log('[sparx] Token extracted from browser session');
        return true;
      }
      throw new Error('Browser login failed - could not extract token');
    }

    return false;
  }

  /**
   * Set a pre-existing token (bypasses login).
   * @param {string} token
   * @param {string} [sessionId]
   */
  setToken(token, sessionId = '') {
    this.token = token;
    this.sessionId = sessionId || '';
    console.log('[sparx] Token set manually');
  }

  /**
   * Fetch homework tasks.
   * @returns {Promise<Array>}
   */
  async fetchTasks() {
    if (!this.token) throw new Error('Not authenticated. Call login() or setToken() first.');
    
    console.log('[sparx] Fetching homework tasks...');
    this.tasks = await api.fetchHomeworks(this.token, this.sessionId);
    
    if (this.tasks.length === 0) {
      console.log('[sparx] No pending homework tasks found');
    } else {
      console.log(`[sparx] Found ${this.tasks.length} homework task(s):`);
      for (const task of this.tasks) {
        console.log(`  - ${task.title} (${task.package_id ? 'pkg: ' + task.package_id.substring(0, 16) + '...' : 'no package id'})`);
      }
    }
    
    return this.tasks;
  }

  /**
   * Start running homework tasks (via gRPC API).
   */
  async runTasks() {
    if (!this.token) throw new Error('Not authenticated');
    if (this.tasks.length === 0) {
      console.log('[sparx] No tasks to run. Call fetchTasks() first.');
      return;
    }

    this.running = true;
    this.completed = 0;
    this.errors = 0;

    console.log(`[sparx] Starting ${this.tasks.length} task(s)...`);

    for (let i = 0; i < this.tasks.length && this.running; i++) {
      const task = this.tasks[i];
      console.log(`[sparx] Processing task ${i + 1}/${this.tasks.length}: ${task.title}`);

      try {
        // Start the activity
        const startResult = await api.startActivity(
          this.token,
          task.package_id,
          task.task_index || 0,
          this.sessionId
        );
        console.log(`[sparx] Started activity: ${task.package_id ? task.package_id.substring(0, 16) + '...' : 'unknown'}`);

        // Simulate working on problems (with realistic delays)
        const numProblems = randomBetween(5, 15);
        for (let pi = 0; pi < numProblems && this.running; pi++) {
          const delay = randomBetween(this.delayMin * 1000, this.delayMax * 1000);
          if (this.showWorking && pi % 3 === 0) {
            process.stdout.write(`[sparx] Working on problem ${pi + 1}/${numProblems}...\r`);
          }
          await this.sleep(delay);
        }
        if (this.showWorking) process.stdout.write('\n');

        this.completed++;
        console.log(`[sparx] Task ${i + 1} completed`);
      } catch (e) {
        this.errors++;
        console.log(`[sparx] Task ${i + 1} error: ${e.message}`);
      }

      // Delay between tasks
      if (i < this.tasks.length - 1 && this.running) {
        const delay = randomBetween(this.delayMin * 1000, this.delayMax * 1000);
        await this.sleep(delay);
      }
    }

    console.log(`[sparx] Done. Completed: ${this.completed}, Errors: ${this.errors}`);
  }

  /**
   * Stop running tasks.
   */
  stop() {
    this.running = false;
    console.log('[sparx] Stopping...');
  }

  /**
   * Cleanup - close browser if open.
   */
  async cleanup() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      } catch (e) {
        // ignore close errors
      }
    }
  }

  /**
   * Sleep helper.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Random between min and max (inclusive).
 */
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = SparxAutomator;

