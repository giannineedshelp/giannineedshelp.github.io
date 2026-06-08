'use strict';

// ============================================================
// Sparx Schools Module
// Handles loading, searching, and managing Sparx school data
// ============================================================

const fs = require('fs');
const path = require('path');
const CFG = require('./config');
const { randomUA } = require('./grpc-helper');

/**
 * Load schools from local JSON file.
 * @param {string} [filePath] - Path to schools JSON file
 * @returns {Array} Schools array
 */
function loadSchoolsFromFile(filePath) {
  if (!filePath) {
    filePath = path.join(__dirname, 'sparx_schools.json');
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('[schools] Failed to load schools file:', e.message);
    return [];
  }
}

/**
 * Fetch schools data from Sparx CDN.
 * @returns {Promise<Array|null>} Parsed schools array or null
 */
async function fetchSchoolsFromCDN() {
  try {
    const resp = await fetch(CFG.SPARX_API.SCHOOLS_DATA, {
      headers: { 'User-Agent': randomUA() },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    const decoded = Buffer.from(text.trim(), 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error('[schools] CDN fetch failed:', e.message);
    return null;
  }
}

/**
 * Get schools from best available source (local file > CDN).
 * @returns {Promise<Array>}
 */
async function getSchools() {
  let schools = loadSchoolsFromFile();
  if (schools.length === 0) {
    console.log('[schools] Local file empty, trying CDN...');
    schools = await fetchSchoolsFromCDN();
  }
  if (!schools || schools.length === 0) {
    throw new Error('No school data available. Download sparx_schools.json or check connectivity.');
  }
  return schools;
}

/**
 * Find a school by its UUID.
 * @param {Array} schools
 * @param {string} id
 * @returns {Object|null}
 */
function findSchoolById(schools, id) {
  return schools.find(s => s.i === id || s.u === id) || null;
}

/**
 * Find a school by name (exact or partial match).
 * @param {Array} schools
 * @param {string} name
 * @returns {Object|null}
 */
function findSchoolByName(schools, name) {
  const q = name.toLowerCase();
  return schools.find(s => (s.n || '').toLowerCase().includes(q)) || null;
}

/**
 * Display schools in a formatted table.
 * @param {Array} results
 * @param {number} [max=20]
 */
function displaySchools(results, max = 20) {
  const display = results.slice(0, max);
  console.log('\n  School results:');
  console.log('  ' + '-'.repeat(70));
  for (const s of display) {
    const name = (s.n || s.name || '?').padEnd(35);
    const town = (s.t || s.town || '');
    const id = (s.i || s.id || '');
    console.log(`  ${name} ${town} [${id}]`);
  }
  if (results.length > max) {
    console.log(`  ... and ${results.length - max} more`);
  }
  console.log('');
}

module.exports = {
  loadSchoolsFromFile,
  fetchSchoolsFromCDN,
  getSchools,
  findSchoolById,
  findSchoolByName,
  searchSchools: require('./sparx-api').searchSchools,
  displaySchools,
};

