#!/usr/bin/env node

'use strict';

// ============================================================
// GIOAI Sparx Automator v1.0
// CLI Entry Point - Node.js + Puppeteer browser automation
// 
// Usage:
//   node index.js <command> [options]
//
// Commands:
//   search   Search for a school by name
//   login    Authenticate and get token
//   fetch    Fetch homework tasks (requires token)
//   run      Run/complete homework tasks (requires token)
//   full     Full flow: login -> fetch -> run
//   health   Check Sparx API health
//
// Examples:
//   node index.js search "West Exe"
//   node index.js login --school <id> --username <user> --password <pass>
//   node index.js fetch --token <token>
//   node index.js run --token <token>
//   node index.js full --school <id> --username <user> --password <pass>
//
// Ported from GIOAI v7.0 with browser automation enhancements
// ============================================================

const SparxAutomator = require('./sparx-automator');
const schools = require('./sparx-schools');

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'help';

  // Parse named options
  function getOpt(name, short) {
    const idx = args.findIndex(a => a === `--${name}` || (short && a === `-${short}`));
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return null;
  }

  function hasFlag(name, short) {
    return args.some(a => a === `--${name}` || (short && a === `-${short}`));
  }

  const schoolId = getOpt('school', 's');
  const username = getOpt('username', 'u');
  const password = getOpt('password', 'p');
  const token = getOpt('token', 't');
  const mode = getOpt('mode', 'm') || 'auto';
  const query = getOpt('query', 'q') || args[1];

  try {
    switch (cmd) {

      case 'search':
      case 'schools':
        if (!query) {
          console.log('Usage: node index.js search <school-name>');
          process.exit(1);
        }
        console.log(`Searching for schools matching "${query}"...`);
        const allSchools = await schools.getSchools();
        const results = require('./sparx-api').searchSchools(allSchools, query);
        schools.displaySchools(results);
        if (results.length === 0) {
          console.log('  No schools found. Try a different search term.\n');
        }
        break;

      case 'login':
        if (!schoolId || !username || !password) {
          console.log('Usage: node index.js login --school <school-id> --username <user> --password <pass> [--mode api|browser]');
          process.exit(1);
        }
        const automator = new SparxAutomator({ schoolId, mode });
        try {
          const ok = await automator.login(username, password, schoolId);
          if (ok) {
            console.log('\n  Login successful!');
            console.log(`  Token: ${automator.token.substring(0, 40)}...`);
            console.log(`  Session ID: ${automator.sessionId || '(none)'}\n`);
            console.log('  To use this token in other commands:');
            console.log(`  node index.js fetch --token "${automator.token}"`);
          }
        } finally {
          await automator.cleanup();
        }
        break;

      case 'fetch':
        if (!token) {
          console.log('Usage: node index.js fetch --token <token> [--session <session-id>]');
          process.exit(1);
        }
        const fetcher = new SparxAutomator();
        fetcher.setToken(token, getOpt('session', '') || '');
        const tasks = await fetcher.fetchTasks();
        if (tasks.length > 0) {
          console.log('  Tasks:');
          for (const t of tasks) {
            console.log(`    ID: ${t.id}`);
            console.log(`    Title: ${t.title}`);
            console.log(`    Package: ${t.package_id ? t.package_id.substring(0, 32) + '...' : 'N/A'}`);
            console.log('');
          }
        }
        break;

      case 'run':
        if (!token) {
          console.log('Usage: node index.js run --token <token> [--session <session-id>] [--delay-min <s>] [--delay-max <s>]');
          process.exit(1);
        }
        const runner = new SparxAutomator({
          delayMin: parseInt(getOpt('delay-min') || '5'),
          delayMax: parseInt(getOpt('delay-max') || '15'),
        });
        runner.setToken(token, getOpt('session', '') || '');
        await runner.fetchTasks();
        console.log('Starting task execution... (press Ctrl+C to stop)');
        await runner.runTasks();
        break;

      case 'full':
        if (!schoolId || !username || !password) {
          console.log('Usage: node index.js full --school <school-id> --username <user> --password <pass> [--mode api|browser]');
          process.exit(1);
        }
        const full = new SparxAutomator({
          schoolId,
          mode,
          delayMin: parseInt(getOpt('delay-min') || '5'),
          delayMax: parseInt(getOpt('delay-max') || '15'),
        });
        try {
          const loggedIn = await full.login(username, password, schoolId);
          if (!loggedIn) throw new Error('Login failed');
          await full.fetchTasks();
          await full.runTasks();
        } finally {
          await full.cleanup();
        }
        console.log('\nFull automation completed.');
        break;

      case 'health':
        const checker = new SparxAutomator();
        const online = await checker.healthCheck();
        process.exit(online ? 0 : 1);
        break;

      case 'help':
      default:
        console.log(`
  ╔══════════════════════════════════════════════╗
  ║   GIOAI Sparx Automator v1.0                 ║
  ║   Node.js + Puppeteer Browser Automation     ║
  ╚══════════════════════════════════════════════╝

  USAGE:
    node index.js <command> [options]

  COMMANDS:
    search <query>     Search for a Sparx school
    login              Authenticate with Sparx
    fetch              Fetch homework tasks
    run                Run/complete homework tasks
    full               Full: login + fetch + run
    health             Check Sparx API status
    help               Show this help

  OPTIONS:
    --school, -s       School UUID
    --username, -u     Username
    --password, -p     Password
    --token, -t        Existing auth token
    --mode, -m         Mode: auto, api, browser
    --session          Session ID
    --delay-min        Min delay between tasks (seconds)
    --delay-max        Max delay between tasks (seconds)
    --query, -q        Search query for schools

  EXAMPLES:
    node index.js search "West Exe"
    node index.js search -q "Academy"
    node index.js full -s <school-id> -u <user> -p <pass>
    node index.js login -s <school-id> -u <user> -p <pass> --mode browser
    node index.js fetch -t "<token>"
    node index.js run -t "<token>" --delay-min 3 --delay-max 10
`);
    }
  } catch (e) {
    console.error(`[error] ${e.message}`);
    process.exit(1);
  }
}

main();

