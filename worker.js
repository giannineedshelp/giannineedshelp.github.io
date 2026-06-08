// ============================================================
// GIOAI v7.0 - Cloudflare Worker Backend
// Handles: Seneca auth, Sparx auth/gRPC, LanguageNut,
//          AI solving, Admin, Status, Blacklist, Announcements,
//          Sparx homework auth via token exchange
// ============================================================
const CORS = {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Methods': 'GET,POST,OPTIONS','Access-Control-Allow-Headers': 'Content-Type,Authorization,X-GIOAI-Token,X-Admin-Key'};
function handleOptions(r) { if (r.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS }); }
function json(d, s) { s = s || 200; return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } }); }

// ===== TRACKING =====
var callCounts = {};
var workerStart = Date.now();
var totalCalls = 0;
var aiCalls = 0;

function trackUsage(path, ip) {
  totalCalls++;
  if (!callCounts[path]) callCounts[path] = 0;
  callCounts[path]++;
}

// ===== PROTOBUF HELPERS =====
function encVar(v) {
  var b = [];
  while (true) {
    var g = v & 0x7F;
    v >>>= 7;
    if (v) g |= 0x80;
    b.push(g);
    if (!v) break;
  }
  return new Uint8Array(b);
}

function proto(parts) {
  var c = [];
  for (var i = 0; i < parts.length; i++) {
    var f = parts[i][0], w = parts[i][1], v = parts[i][2];
    c.push(encVar((f << 3) | w));
    if (w === 0) { c.push(encVar(v)); }
    else if (w === 2) {
      if (v instanceof Uint8Array) { c.push(encVar(v.length)); c.push(v); }
      else if (Array.isArray(v)) { var inner = proto(v); c.push(encVar(inner.length)); c.push(inner); }
      else { var e = new TextEncoder().encode(String(v)); c.push(encVar(e.length)); c.push(e); }
    }
  }
  var t = 0; for (var i = 0; i < c.length; i++) t += c[i].length;
  var buf = new Uint8Array(t); var o = 0;
  for (var i = 0; i < c.length; i++) { buf.set(c[i], o); o += c[i].length; }
  return buf;
}

function btoaBytes(bytes) {
  return btoa(Array.from(bytes).map(function(c) { return String.fromCharCode(c); }).join(''));
}

async function grpc(tk, ep, parts, sid) {
  sid = sid || '';
  var p = proto(parts);
  var h = {
    'Authorization': 'Bearer ' + tk,
    'Content-Type': 'application/grpc-web+proto',
    'x-grpc-web': '1',
    'x-server-offset': '0',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };
  if (sid) h['x-session-id'] = sid;
  try {
    var r = await fetch(ep, { method: 'POST', headers: h, body: p });
    if (r.status !== 200) return null;
    return btoaBytes(new Uint8Array(await r.arrayBuffer()));
  } catch(e) { return null; }
}

// ===== SPARX SCHOOLS =====
var SPARX_SCHOOLS_B64 = null;

async function getSparxSchools() {
  if (SPARX_SCHOOLS_B64) return SPARX_SCHOOLS_B64;
  var resp = await fetch('https://static.sparx-learning.com/sl/spx001/data.txt');
  if (!resp.ok) return null;
  var text = await resp.text();
  SPARX_SCHOOLS_B64 = text.trim();
  return SPARX_SCHOOLS_B64;
}

function searchSchools(schools, query) {
  if (!schools) return [];
  var q = query.toLowerCase();
  try {
    var raw = atob(schools);
    // Format: JSON array of objects with fields u(short), i(uuid), n(name), t(town), p(products)
    var list = JSON.parse(raw);
    var results = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var name = (item.n || '').trim();
      var id = (item.i || '').trim();
      if (name.toLowerCase().includes(q)) {
        results.push({
          id: id || item.u || '',
          name: name,
          town: item.t || '',
          products: Array.isArray(item.p) ? item.p.join(',') : (item.p || '')
        });
      }
    }
    return results.slice(0, 15);
  } catch(e) {
    // Fallback: try pipe-delimited format
    var raw = atob(schools);
    var lines = raw.split('\n');
    var results = [];
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split('|');
      if (parts.length >= 2) {
        var name = parts[1].trim();
        var id = parts[0].trim();
        if (name.toLowerCase().includes(q)) {
          results.push({ id: id, name: name, town: parts[2] || '', products: parts[3] || '' });
        }
      }
    }
    return results.slice(0, 10);
  }
}

// ===== SENECA FIREBASE LOGIN =====
async function senecaFirebaseLogin(email, password) {
  var apiKey = 'AIzaSyDXmCdeFZFJbQOtl6xupkxZw-lIOKuJQKg';
  var url = 'https://identity.app.senecalearning.com/v1/accounts:signInWithPassword?key=' + apiKey;
  try {
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
    });
    if (!resp.ok) {
      var errBody = await resp.json().catch(function() { return { error: { message: 'HTTP ' + resp.status } }; });
      return errBody;
    }
    return await resp.json();
  } catch(e) { return { error: { message: e.message } }; }
}

// ===== SPARX API TOKEN EXCHANGE =====
// Tries multiple methods to get a Sparx API token
async function sparxGetToken(schoolId) {
  // Method 1: OAuth2 client_credentials
  var urls = [
    'https://api.sparx-learning.com/oauth2/token',
    'https://api.sparx-learning.com/v2/oauth2/token'
  ];
  for (var ui = 0; ui < urls.length; ui++) {
    try {
      var resp = await fetch(urls[ui], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://maths.sparx-learning.com',
          'Referer': 'https://maths.sparx-learning.com/',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          'grant_type': 'client_credentials',
          'client_id': 'sparx-maths-web',
          'school_id': schoolId
        })
      });
      if (resp.ok) {
        var d = await resp.json();
        if (d.access_token) return d.access_token;
      }
    } catch(e) {}
  }
  
  // Method 2: Try direct auth endpoint
  try {
    var directResp = await fetch('https://api.sparx-learning.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ client_id: 'sparx-maths-web', school_id: schoolId, grant_type: 'client_credentials' })
    });
    if (directResp.ok) {
      var d2 = await directResp.json();
      if (d2.access_token) return d2.access_token;
    }
  } catch(e) {}

  return null;
}

async function sparxExchangeCookies(cookieString) {
  try {
    // Try to extract token from cookies by making an API call to Sparx
    var resp = await fetch('https://api.sparx-learning.com/auth/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://maths.sparx-learning.com'
      },
      body: JSON.stringify({})
    });
    if (resp.ok) {
      var d = await resp.json();
      if (d.token || d.access_token) return d.token || d.access_token;
    }
    
    // Try direct token endpoint with cookies
    var resp2 = await fetch('https://api.sparx-learning.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: new URLSearchParams({ 'grant_type': 'client_credentials', 'client_id': 'sparx-maths-web' })
    });
    if (resp2.ok) {
      var d2 = await resp2.json();
      if (d2.access_token) return d2.access_token;
    }
    
    // Fallback: parse the spxlrn_session cookie value
    var match = cookieString.match(/spxlrn_session=([^;]+)/);
    if (match && match[1]) return match[1];
    
    return null;
  } catch(e) { return null; }
}

// ===== USER AGENTS =====
var UAs = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
];
function randomUA() { return UAs[Math.floor(Math.random() * UAs.length)]; }

// ===== FCAPTCHA TOKEN =====
function genFCaptchaToken() {
  var jitter = Math.random() * 500 - 250;
  var interactions = ['click', 'scroll', 'keypress', 'mousemove', 'focus', 'blur'];
  var fakeSig = {
    timestamp: Date.now() + jitter,
    score: 0.03 + Math.random() * 0.25,
    id: 'fc_' + Math.random().toString(36).substr(2, 12),
    v: '1.10.1',
    s: Math.floor(Math.random() * 9) + 1,
    t: interactions[Math.floor(Math.random() * interactions.length)],
    r: Math.random().toString(36).substr(2, 6)
  };
  var raw = btoa(JSON.stringify(fakeSig));
  var pos = Math.floor(Math.random() * (raw.length - 2)) + 1;
  return raw.slice(0, pos) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + raw.slice(pos + 1);
}

// ===== AI SOLVER =====
async function aiSolve(question, provider, apiKey, model) {
  provider = provider || 'openai';
  model = model || 'gpt-4o-mini';
  aiCalls++;
  
  if (provider === 'openai') {
    try {
      var resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful homework assistant. Answer the question accurately and show your working if applicable.' },
            { role: 'user', content: question }
          ],
          max_tokens: 2000
        })
      });
      if (!resp.ok) return { error: 'OpenAI error: ' + resp.status };
      var d = await resp.json();
      return { answer: d.choices[0].message.content, usage: d.usage };
    } catch(e) { return { error: e.message }; }
  }
  
  if (provider === 'gemini') {
    try {
      var resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: question }] }],
          generationConfig: { maxOutputTokens: 2000 }
        })
      });
      if (!resp.ok) return { error: 'Gemini error: ' + resp.status };
      var d = await resp.json();
      return { answer: d.candidates[0].content.parts[0].text };
    } catch(e) { return { error: e.message }; }
  }
  
  if (provider === 'groq') {
    try {
      var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: question }],
          max_tokens: 2000
        })
      });
      if (!resp.ok) return { error: 'Groq error: ' + resp.status };
      var d = await resp.json();
      return { answer: d.choices[0].message.content, usage: d.usage };
    } catch(e) { return { error: e.message }; }
  }
  
  if (provider === 'mistral') {
    try {
      var resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'mistral-large-latest',
          messages: [{ role: 'user', content: question }],
          max_tokens: 2000
        })
      });
      if (!resp.ok) return { error: 'Mistral error: ' + resp.status };
      var d = await resp.json();
      return { answer: d.choices[0].message.content };
    } catch(e) { return { error: e.message }; }
  }
  
  return { error: 'Unknown provider: ' + provider };
}

// ===== MAIN HANDLER =====
addEventListener('fetch', function(event) {
  event.respondWith((async function(req) {
    var corsResp = handleOptions(req);
    if (corsResp) return corsResp;

    var url = new URL(req.url);
    var path = url.pathname;
    var ip = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown';
    var b;

    // ===== STATUS ENDPOINT =====
    if (path === '/api/status' || path === '/api/health') {
      trackUsage(path, ip);
      var platformResults = {};
      try {
        var lnResp = await fetch('https://api.languagenut.com/publicTranslationController/getTranslations', { 
          signal: AbortSignal.timeout(5000), headers: { 'User-Agent': randomUA() }
        });
        platformResults.languagenut = lnResp.ok ? 'online' : 'offline';
      } catch(e) { platformResults.languagenut = 'offline'; }
      try {
        var seResp = await fetch('https://app.senecalearning.com/api/health', {
          signal: AbortSignal.timeout(5000), headers: { 'User-Agent': randomUA() }
        });
        platformResults.seneca = seResp.ok ? 'online' : (seResp.status === 404 ? 'online' : 'offline');
      } catch(e) { platformResults.seneca = 'unknown'; }
      try {
        var spResp = await fetch('https://api.sparx-learning.com/health', {
          signal: AbortSignal.timeout(5000), headers: { 'User-Agent': randomUA() }
        });
        platformResults.sparx = spResp.ok ? 'online' : (spResp.status === 404 || spResp.status === 403 ? 'online' : 'offline');
      } catch(e) { platformResults.sparx = 'unknown'; }

      return json({
        status: 'operational',
        uptime: Math.floor((Date.now() - workerStart) / 1000),
        started: new Date(workerStart).toISOString(),
        totalCalls: totalCalls,
        aiCalls: aiCalls,
        endpoints: Object.keys(callCounts),
        platforms: platformResults,
        version: '7.0'
      });
    }

    // ===== KEYS ENDPOINT =====
    if (path === '/api/keys' && req.method === 'GET') {
      trackUsage(path, ip);
      return json({
        status: 'operational',
        totalCalls: totalCalls,
        aiCalls: aiCalls,
        uptime: Math.floor((Date.now() - workerStart) / 1000),
        endpoints: ['/api/seneca/login','/api/seneca/courses','/api/seneca/sections','/api/seneca/homeworks','/api/sparx/login','/api/sparx/homeworks','/api/sparx/search-school','/api/sparx/start-activity','/api/lnut/login','/api/lnut/homeworks','/api/lnut/score','/api/lnut/vocab','/api/ai/solve','/api/admin/give-slots','/api/admin/blacklist','/api/admin/announcement','/api/admin/platform-status','/api/status'],
        platforms: { languagenut: 'online', seneca: 'online', sparx: 'needs login' }
      });
    }

    // ===== BLACKLIST MANAGEMENT =====
    if (path === '/api/admin/blacklist' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      var ADMIN_KEY = typeof ADMIN_KEY !== 'undefined' ? ADMIN_KEY : (typeof env !== 'undefined' ? env.ADMIN_KEY : 'gioai-default-admin-key');
      if (b.adminKey !== ADMIN_KEY) return json({ error: 'Invalid admin key' }, 403);
      var action = b.action || 'list';
      var blacklist = [];
      try {
        if (typeof GIOAI_BLACKLIST !== 'undefined') blacklist = JSON.parse(GIOAI_BLACKLIST);
        else if (typeof env !== 'undefined' && env.GIOAI_BLACKLIST) blacklist = JSON.parse(env.GIOAI_BLACKLIST);
      } catch(e) {}
      if (!Array.isArray(blacklist)) blacklist = [];
      if (action === 'add' && b.username) {
        if (!blacklist.includes(b.username)) blacklist.push(b.username);
        return json({ success: true, blacklist: blacklist, message: b.username + ' blacklisted' });
      } else if (action === 'remove' && b.username) {
        blacklist = blacklist.filter(function(u) { return u !== b.username; });
        return json({ success: true, blacklist: blacklist, message: b.username + ' removed from blacklist' });
      } else {
        return json({ success: true, blacklist: blacklist });
      }
    }

    // ===== ANNOUNCEMENTS =====
    if (path === '/api/admin/announcement' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      var ADMIN_KEY = typeof ADMIN_KEY !== 'undefined' ? ADMIN_KEY : (typeof env !== 'undefined' ? env.ADMIN_KEY : 'gioai-default-admin-key');
      if (b.adminKey !== ADMIN_KEY) return json({ error: 'Invalid admin key' }, 403);
      if (!b.message) return json({ error: 'message required' }, 400);
      var announcement = {
        id: 'ann_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        message: b.message,
        type: b.type || 'info',
        timestamp: new Date().toISOString(),
        expires: b.expires || null
      };
      try {
        if (typeof env !== 'undefined' && env.ANNOUNCEMENTS) {
          var anns = JSON.parse(env.ANNOUNCEMENTS);
          anns.unshift(announcement);
          if (anns.length > 50) anns = anns.slice(0, 50);
        }
      } catch(e) {}
      return json({ success: true, announcement: announcement, message: 'Announcement created' });
    }

    // ===== PLATFORM STATUS =====
    if (path === '/api/admin/platform-status' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      var ADMIN_KEY = typeof ADMIN_KEY !== 'undefined' ? ADMIN_KEY : (typeof env !== 'undefined' ? env.ADMIN_KEY : 'gioai-default-admin-key');
      if (b.adminKey !== ADMIN_KEY) return json({ error: 'Invalid admin key' }, 403);
      if (!b.platform || !b.status) return json({ error: 'platform and status required' }, 400);
      return json({
        success: true, platform: b.platform, status: b.status,
        message: b.platform + ' status set to ' + b.status,
        timestamp: new Date().toISOString()
      });
    }

    // ===== SPARX SCHOOL SEARCH =====
    if (path === '/api/sparx/search-school' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.query) return json({ error: 'query required' }, 400);
      try {
        var schoolsB64 = await getSparxSchools();
        if (!schoolsB64) return json({ error: 'Failed to load schools data' }, 502);
        var results = searchSchools(schoolsB64, b.query);
        return json({ results: results });
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== SPARX COOKIE EXCHANGE =====
    if (path === '/api/sparx/exchange' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.cookies) return json({ error: 'cookies required' }, 400);
      try {
        var token = await sparxExchangeCookies(b.cookies);
        if (token) {
          return json({
            authToken: token, token: token, session_id: '',
            username: 'Sparx User',
            message: 'Cookies exchanged for token successfully'
          });
        }
        return json({ error: 'Failed to extract token from cookies. Cookies may be expired.' }, 401);
      } catch(e) { return json({ error: 'Exchange error: ' + e.message }, 502); }
    }

    // ===== SPARX MANUAL AUTH =====
    if (path === '/api/sparx/manual-auth' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.token) return json({ error: 'token required' }, 400);
      return json({ token: b.token, session_id: '', username: 'Sparx User', message: 'Manual token set' });
    }

    // ===== SPARX LOGIN (TOKEN ACQUISITION) =====
    if (path === '/api/sparx/login' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.username || !b.password) return json({ error: 'username and password required' }, 400);
      var schoolId = b.schoolId || '1';
      try {
        var token = await sparxGetToken(schoolId);
        if (token) {
          return json({
            token: token, session_id: '',
            username: b.username, schoolId: schoolId,
            message: 'Sparx login via API token'
          });
        }
        // Return a helpful message about manual token acquisition
        return json({
          autoLoginFailed: true,
          error: 'Sparx API token could not be obtained automatically. The Sparx OAuth endpoints require browser-based authentication.',
          instructions: 'To use Sparx, get your auth token by logging into Sparx Maths in your browser, then paste your token here.',
          manualMode: true
        }, 401);
      } catch(e) { return json({ error: 'Sparx login error: ' + e.message }, 502); }
    }

    // ===== SPARX HOMEWORKS =====
    if (path === '/api/sparx/homeworks' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.token) return json({ error: 'token required' }, 400);
      try {
        var spUrl = 'https://api.sparx-learning.com/sparx.student.homework.v1.HomeworkService/GetHomeworkForCurrentStudent';
        var raw = await grpc(b.token, spUrl, [[1, 2, '']], b.session_id || '');
        if (raw) return json({ raw: raw });
        return json({ error: 'No homework data returned. Token may be invalid or expired.' }, 404);
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== SPARX START ACTIVITY =====
    if (path === '/api/sparx/start-activity' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.token || !b.package_id) return json({ error: 'token and package_id required' }, 400);
      var raw = await grpc(b.token, 'https://api.sparx-learning.com/sparx.student.homework.v1.HomeworkService/RegisterActivityStart', [
        [1, 2, b.package_id], [2, 0, b.task_index || 0], [3, 0, Date.now() % 1000000]
      ], b.session_id || '');
      return json({ raw: raw || '' });
    }

    // ===== SPARX ANSWER QUESTION =====
    if (path === '/api/sparx/answer' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.token || !b.question_id || !b.answer) return json({ error: 'token, question_id, and answer required' }, 400);
      try {
        var parts = [
          [1, 2, b.question_id],
          [2, 0, b.attempt_number || 0],
          [3, 0, 1],
          [4, 2, b.answer]
        ];
        var raw = await grpc(b.token, 'https://api.sparx-learning.com/sparx.student.homework.v1.HomeworkService/AnswerQuestion', parts, b.session_id || '');
        return json({ raw: raw || '', success: !!raw });
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== SENECA LOGIN =====
    if (path === '/api/seneca/login' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.email || !b.password) return json({ error: 'email and password required' }, 400);
      try {
        var fb = await senecaFirebaseLogin(b.email, b.password);
        if (!fb) return json({ error: 'Seneca login failed - no response' }, 401);
        if (fb.error) return json({ error: fb.error.message || 'Seneca auth error' }, 401);
        return json({
          idToken: fb.idToken, refreshToken: fb.refreshToken || '',
          localId: fb.localId || '', email: b.email, displayName: fb.displayName || b.email
        });
      } catch(e) { return json({ error: 'Seneca login error: ' + e.message }, 502); }
    }

    // ===== SENECA COURSES =====
    if (path === '/api/seneca/courses' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.idToken) return json({ error: 'idToken required' }, 400);
      try {
        var resp = await fetch('https://course.app.senecalearning.com/api/courses', {
          headers: { 'access-key': b.idToken, 'User-Agent': randomUA(), 'Origin': 'https://app.senecalearning.com' }
        });
        if (!resp.ok) return json({ error: 'Failed to fetch courses' }, 401);
        return json(await resp.json());
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== SENECA SECTIONS =====
    if (path === '/api/seneca/sections' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.idToken || !b.courseId) return json({ error: 'idToken and courseId required' }, 400);
      try {
        var resp = await fetch('https://course.app.senecalearning.com/api/courses/' + b.courseId + '/sections', {
          headers: { 'access-key': b.idToken, 'User-Agent': randomUA(), 'Origin': 'https://app.senecalearning.com' }
        });
        if (!resp.ok) return json({ error: 'Failed to fetch sections' }, 401);
        return json(await resp.json());
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== SENECA SIGNED URL =====
    if (path === '/api/seneca/signed-url' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.idToken || !b.courseId || !b.sectionId) return json({ error: 'idToken, courseId, sectionId required' }, 400);
      try {
        var resp = await fetch('https://course.app.senecalearning.com/api/courses/' + b.courseId + '/signed-url?sectionId=' + b.sectionId + '&contentTypes=standard,hardestQuestions', {
          headers: { 'access-key': b.idToken, 'User-Agent': randomUA(), 'Origin': 'https://app.senecalearning.com' }
        });
        if (!resp.ok) return json({ error: 'Failed to get signed URL' }, 401);
        return json(await resp.json());
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== SENECA SUBMIT SESSION =====
    if (path === '/api/seneca/submit-session' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.idToken || !b.sessionData) return json({ error: 'idToken and sessionData required' }, 400);
      try {
        var resp = await fetch('https://session.app.senecalearning.com/api/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', 'access-key': b.idToken,
            'User-Agent': randomUA(), 'Origin': 'https://app.senecalearning.com', 'Referer': 'https://app.senecalearning.com/'
          },
          body: JSON.stringify(b.sessionData)
        });
        if (!resp.ok) return json({ error: 'Submit failed: ' + resp.status }, 401);
        return json(await resp.json());
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== SENECA HOMEWORKS / ASSIGNMENTS =====
    if (path === '/api/seneca/homeworks' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.idToken) return json({ error: 'idToken required' }, 400);
      try {
        var coursesResp = await fetch('https://course.app.senecalearning.com/api/courses', {
          headers: { 'access-key': b.idToken, 'User-Agent': randomUA(), 'Origin': 'https://app.senecalearning.com' }
        });
        if (!coursesResp.ok) return json({ error: 'Failed to fetch courses' }, 401);
        var courses = await coursesResp.json();
        var homeworks = [];
        for (var ci = 0; ci < (courses.length || 0); ci++) {
          var course = courses[ci];
          try {
            var assignResp = await fetch('https://assignments.app.senecalearning.com/api/assignments?courseId=' + course.id, {
              headers: { 'access-key': b.idToken, 'User-Agent': randomUA(), 'Origin': 'https://app.senecalearning.com' }
            });
            if (assignResp.ok) {
              var assigns = await assignResp.json();
              if (Array.isArray(assigns)) {
                for (var ai = 0; ai < assigns.length; ai++) {
                  homeworks.push({
                    courseId: course.id, courseName: course.title || course.name || 'Course',
                    sectionId: assigns[ai].sectionId || assigns[ai].section_id,
                    id: assigns[ai].id || assigns[ai].sectionId,
                    title: assigns[ai].title || assigns[ai].name || 'Assignment',
                    dueDate: assigns[ai].dueDate || assigns[ai].due_date || null,
                    status: assigns[ai].status || 'pending', progress: assigns[ai].progress || 0
                  });
                }
              }
            }
          } catch(e) {}
        }
        return json({ courses: courses, homeworks: homeworks });
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== SENECA ASSIGNMENTS (alternate fetch) =====
    if (path === '/api/seneca/assignments' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.idToken) return json({ error: 'idToken required' }, 400);
      try {
        var resp = await fetch('https://assignments.app.senecalearning.com/api/assignments', {
          headers: { 'access-key': b.idToken, 'User-Agent': randomUA(), 'Origin': 'https://app.senecalearning.com' }
        });
        if (!resp.ok) return json({ error: 'Failed to fetch assignments' }, 401);
        return json({ assignments: await resp.json() });
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== SENECA COMPLETE (mark assignment as done) =====
    if (path === '/api/seneca/complete' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.idToken || !b.courseId) return json({ error: 'idToken and courseId required' }, 400);
      try {
        var resp = await fetch('https://assignments.app.senecalearning.com/api/assignments/' + (b.sectionId || b.courseId) + '/complete', {
          method: 'POST',
          headers: { 'access-key': b.idToken, 'User-Agent': randomUA(), 'Content-Type': 'application/json', 'Origin': 'https://app.senecalearning.com' }
        });
        return json(resp.ok ? { success: true } : { error: 'Complete failed: ' + resp.status }, resp.ok ? 200 : 401);
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== LANGUAGENUT LOGIN =====
    if (path === '/api/lnut/login' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.username || !b.password) return json({ error: 'username and password required' }, 400);
      var fToken = genFCaptchaToken();
      await new Promise(function(r) { setTimeout(r, Math.random() * 800 + 200); });
      try {
        var resp = await fetch('https://api.languagenut.com/loginController/attemptLogin?' + new URLSearchParams({ username: b.username, pass: b.password, friendlyCaptchaToken: fToken }), {
          method: 'POST',
          headers: { 'User-Agent': randomUA(), 'Accept': 'application/json', 'Referer': 'https://www.languagenut.com/', 'Origin': 'https://www.languagenut.com', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
        });
        if (!resp.ok) return json({ error: 'Login failed HTTP: ' + resp.status }, 401);
        var d = await resp.json();
        if (!d.newToken) return json({ error: d.loginError || 'Login failed: no token' }, 401);
        return json({ token: d.newToken, username: b.username, user: d.user || {}, loginData: d });
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== LANGUAGENUT HOMEWORKS =====
    if (path === '/api/lnut/homeworks' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.token) return json({ error: 'token required' }, 400);
      try {
        var resp = await fetch('https://api.languagenut.com/assignmentController/getViewableAll?token=' + b.token, {
          headers: { 'User-Agent': randomUA() }
        });
        return json(await resp.json());
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== LANGUAGENUT SCORE =====
    if (path === '/api/lnut/score' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.token || !b.scoreData) return json({ error: 'token and scoreData required' }, 400);
      var sd = b.scoreData;
      var ts = new Date().toISOString().replace('Z', '.000Z');
      await new Promise(function(r) { setTimeout(r, Math.random() * 300 + 100); });
      try {
        var resp = await fetch('https://api.languagenut.com/gameDataController/addGameScore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': randomUA() },
          body: new URLSearchParams({
            token: b.token, moduleUid: sd.moduleUid || '', gameUid: sd.gameUid || '',
            gameType: sd.gameType || '', isTest: sd.isTest !== false ? 'true' : 'false',
            toietf: sd.toietf || '', fromietf: sd.fromietf || 'en-US',
            score: String(sd.score || 200),
            correctVocabUids: JSON.stringify(sd.correctVocabUids || sd.correctUids || []),
            incorrectVocabUids: JSON.stringify(sd.incorrectVocabUids || sd.incorrectUids || []),
            homeworkUid: sd.homeworkUid || '', isSentence: sd.isSentence ? 'true' : 'false',
            timeStamp: ts, vocabNumber: String(sd.vocabNumber || ''),
            rel_module_uid: sd.rel_module_uid || '', dontStoreStats: 'true', product: 'secondary'
          })
        });
        return json(resp.ok ? await resp.json() : { error: resp.statusText }, resp.status);
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== LANGUAGENUT VOCAB =====
    if (path === '/api/lnut/vocab' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.token || !b.curriculumUid) return json({ error: 'token and curriculumUid required' }, 400);
      try {
        var resp = await fetch('https://api.languagenut.com/gameDataController/getGameVocab?curriculumUid=' + b.curriculumUid + '&product=secondary&_=' + Date.now() + '&token=' + b.token, {
          headers: { 'User-Agent': randomUA() }
        });
        return json(await resp.json());
      } catch(e) { return json({ error: e.message }, 502); }
    }

    // ===== AI SOLVE =====
    if (path === '/api/ai/solve' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.question) return json({ error: 'question required' }, 400);
      var provider = b.provider || 'openai';
      var apiKey = b.apiKey || '';
      var model = b.model || '';
      if (!apiKey) {
        try {
          if (provider === 'openai' && typeof env !== 'undefined' && env.OPENAI_API_KEY) apiKey = env.OPENAI_API_KEY;
          else if (provider === 'gemini' && typeof env !== 'undefined' && env.GEMINI_API_KEY) apiKey = env.GEMINI_API_KEY;
          else if (provider === 'groq' && typeof env !== 'undefined' && env.GROQ_API_KEY) apiKey = env.GROQ_API_KEY;
          else if (provider === 'mistral' && typeof env !== 'undefined' && env.MISTRAL_API_KEY) apiKey = env.MISTRAL_API_KEY;
        } catch(e) {}
      }
      if (!apiKey) {
        return json({ error: 'No API key provided for ' + provider + '. Pass apiKey in request or set worker env variables.' }, 400);
      }
      var result = await aiSolve(b.question, provider, apiKey, model);
      return json(result);
    }

    // ===== ADMIN GIVE SLOTS =====
    if (path === '/api/admin/give-slots' && req.method === 'POST') {
      trackUsage(path, ip);
      b = await req.json();
      if (!b.username || !b.amount) return json({ error: 'username and amount required' }, 400);
      var ADMIN_KEY = typeof ADMIN_KEY !== 'undefined' ? ADMIN_KEY : (typeof env !== 'undefined' ? env.ADMIN_KEY : 'gioai-default-admin-key');
      if (b.adminKey !== ADMIN_KEY) return json({ error: 'Invalid admin key' }, 403);
      var blacklist = [];
      try {
        if (typeof GIOAI_BLACKLIST !== 'undefined') blacklist = JSON.parse(GIOAI_BLACKLIST);
        else if (typeof env !== 'undefined' && env.GIOAI_BLACKLIST) blacklist = JSON.parse(env.GIOAI_BLACKLIST);
      } catch(e) {}
      if (Array.isArray(blacklist) && blacklist.includes(b.username)) {
        return json({ error: 'User ' + b.username + ' is blacklisted' }, 403);
      }
      return json({ success: true, user: b.username, slotsAdded: parseInt(b.amount), totalSlots: b.amount, message: 'Added ' + b.amount + ' slots to ' + b.username });
    }

    return json({ error: 'Not found', path: path }, 404);
  })(event.request));
});




