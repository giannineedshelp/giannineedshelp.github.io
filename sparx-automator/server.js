#!/usr/bin/env node

'use strict';

// ============================================================
// GIOAI Sparx Backend Server
// Express-based HTTP API server that the website communicates with
// 
// Start: node server.js [--port 3456]
// The website uses this as backend for Sparx operations
// ============================================================

const http = require('http');
const SparxAutomator = require('./sparx-automator');
const api = require('./sparx-api');
const schools = require('./sparx-schools');
const CFG = require('./config');

const PORT = parseInt(process.argv.find(a => a.startsWith('--port=') ? a.split('=')[1] : null) || process.env.PORT || 3456);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-GIOAI-Token',
};

function json(res, data, status = 200) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // ===== HEALTH =====
    if (path === '/api/sparx/health' && req.method === 'GET') {
      const online = await api.checkHealth();
      return json(res, { status: online ? 'operational' : 'degraded', platform: 'sparx', timestamp: Date.now() });
    }

    // ===== SEARCH SCHOOLS =====
    if (path === '/api/sparx/search-school' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.query) return json(res, { error: 'query required' }, 400);
      const schoolList = await schools.getSchools().catch(() => schools.loadSchoolsFromFile());
      const results = api.searchSchools(schoolList, body.query);
      return json(res, { results });
    }

    // ===== LOGIN =====
    if (path === '/api/sparx/login' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.username || !body.password) return json(res, { error: 'username and password required' }, 400);

      const schoolId = body.schoolId || body.school || '';
      const autoToken = await api.getApiToken(schoolId);
      if (autoToken) {
        return json(res, { token: autoToken, session_id: '', username: body.username, schoolId, message: 'Sparx token via API' });
      }
      return json(res, {
        autoLoginFailed: true,
        error: 'Sparx requires browser-based OAuth. Start the Node.js server on a desktop with Chromium, or paste cookies manually.'
      }, 401);
    }

    // ===== FETCH HOMEWORKS =====
    if (path === '/api/sparx/homeworks' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.token) return json(res, { error: 'token required' }, 400);
      try {
        const tasks = await api.fetchHomeworks(body.token, body.session_id || '');
        return json(res, { tasks, count: tasks.length });
      } catch (e) {
        return json(res, { error: e.message }, 401);
      }
    }

    // ===== START ACTIVITY =====
    if (path === '/api/sparx/start-activity' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.token || !body.package_id) return json(res, { error: 'token and package_id required' }, 400);
      const result = await api.startActivity(body.token, body.package_id, body.task_index || 0, body.session_id || '');
      return json(res, { started: !!result, raw: result ? result.b64 : '' });
    }

    // ===== STATUS =====
    if (path === '/api/status' && req.method === 'GET') {
      const sparxOk = await api.checkHealth();
      return json(res, {
        status: 'operational', version: '1.0.0', platform: 'sparx-backend',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        sparx: sparxOk ? 'online' : 'offline',
        endpoints: ['/api/sparx/health', '/api/sparx/search-school', '/api/sparx/login', '/api/sparx/homeworks', '/api/sparx/start-activity', '/api/status'],
      });
    }

    return json(res, { error: 'Not found', path }, 404);
  } catch (e) {
    console.error('[server] Error:', e.message);
    return json(res, { error: e.message }, 500);
  }
}

const startTime = Date.now();
const server = http.createServer(handleRequest);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  GIOAI Sparx Backend Server running on http://0.0.0.0:${PORT}\n`);
});

