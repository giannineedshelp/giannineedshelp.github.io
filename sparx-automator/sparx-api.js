'use strict';

// ============================================================
// Sparx API Module
// Handles: Token acquisition, homework fetching, activity start,
//          question answering, school search
// Ported from GIOAI v7.0 worker.js
// ============================================================

const CFG = require('./config');
const { grpc, parseHomeworks } = require('./grpc-helper');

/**
 * Try to get a Sparx API token via OAuth2 client_credentials grant.
 * Multiple endpoint attempts, matching worker.js logic.
 * @param {string} schoolId - School UUID
 * @returns {Promise<string|null>} Access token or null
 */
async function getApiToken(schoolId) {
  // Method 1: OAuth2 token endpoints
  const urls = [
    CFG.SPARX_API.TOKEN,
    CFG.SPARX_API.TOKEN_V2,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': randomUA(),
          'Origin': 'https://maths.sparx-learning.com',
          'Referer': 'https://maths.sparx-learning.com/',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          'grant_type': 'client_credentials',
          'client_id': CFG.CLIENT_ID,
          'school_id': schoolId,
        }),
      });
      if (resp.ok) {
        const d = await resp.json();
        if (d.access_token) return d.access_token;
      }
    } catch (e) {
      // continue to next method
    }
  }

  // Method 2: Direct auth endpoint
  try {
    const directResp = await fetch(CFG.SPARX_API.TOKEN_DIRECT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': randomUA(),
      },
      body: JSON.stringify({
        client_id: CFG.CLIENT_ID,
        school_id: schoolId,
        grant_type: 'client_credentials',
      }),
    });
    if (directResp.ok) {
      const d2 = await directResp.json();
      if (d2.access_token) return d2.access_token;
    }
  } catch (e) {
    // ignore
  }

  return null;
}

/**
 * Fetch homeworks for the current student using gRPC.
 * @param {string} token - Bearer token
 * @param {string} [sessionId] - Optional session ID
 * @returns {Promise<Array>} Array of parsed homework tasks
 */
async function fetchHomeworks(token, sessionId = '') {
  const result = await grpc(
    token,
    CFG.SPARX_API.GRPC_HOMEWORKS,
    [[1, 2, '']],
    sessionId
  );

  if (!result) {
    throw new Error('No homework data returned. Token may be invalid or expired.');
  }

  const tasks = parseHomeworks(result.b64);
  return tasks;
}

/**
 * Register an activity start for a homework package.
 * @param {string} token - Bearer token
 * @param {string} packageId - Package ID
 * @param {number} [taskIndex=0] - Task index
 * @param {string} [sessionId=''] - Session ID
 * @returns {Promise<{b64: string, raw: Buffer}|null>}
 */
async function startActivity(token, packageId, taskIndex = 0, sessionId = '') {
  const result = await grpc(
    token,
    CFG.SPARX_API.GRPC_START_ACTIVITY,
    [
      [1, 2, packageId],
      [2, 0, taskIndex],
      [3, 0, Date.now() % 1000000],
    ],
    sessionId
  );
  return result;
}

/**
 * Answer a question in a Sparx activity.
 * @param {string} token - Bearer token
 * @param {string} questionId - Question ID
 * @param {string} answer - Answer text
 * @param {number} [attemptNumber=0] - Attempt number
 * @param {string} [sessionId=''] - Session ID
 * @returns {Promise<Object>} Result object
 */
async function answerQuestion(token, questionId, answer, attemptNumber = 0, sessionId = '') {
  const parts = [
    [1, 2, questionId],
    [2, 0, attemptNumber],
    [3, 0, 1],
    [4, 2, answer],
  ];
  const result = await grpc(
    token,
    CFG.SPARX_API.GRPC_ANSWER,
    parts,
    sessionId
  );
  return {
    raw: result ? result.b64 : '',
    success: !!result,
  };
}

/**
 * Check if Sparx API is online.
 * @returns {Promise<boolean>}
 */
async function checkHealth() {
  try {
    const resp = await fetch(CFG.SPARX_API.HEALTH, {
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok || resp.status === 403 || resp.status === 404 || resp.status === 405;
  } catch (e) {
    return false;
  }
}

/**
 * Search schools from the loaded schools data.
 * @param {Array} schools - Parsed schools array
 * @param {string} query - Search query
 * @returns {Array} Filtered results (max 15)
 */
function searchSchools(schools, query) {
  if (!Array.isArray(schools) || !schools.length) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const item of schools) {
    const name = (item.n || '').trim();
    if (name.toLowerCase().includes(q)) {
      results.push({
        id: item.i || item.u || '',
        name: name,
        town: item.t || '',
        products: Array.isArray(item.p) ? item.p.join(',') : (item.p || ''),
      });
    }
    if (results.length >= 15) break;
  }
  return results;
}

/**
 * Random UA string
 */
function randomUA() {
  const uas = CFG.USER_AGENTS;
  return uas[Math.floor(Math.random() * uas.length)];
}

/**
 * Sleep helper
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  getApiToken,
  fetchHomeworks,
  startActivity,
  answerQuestion,
  checkHealth,
  searchSchools,
  sleep,
  randomUA,
};


