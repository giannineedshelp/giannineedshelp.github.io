'use strict';

// ============================================================
// gRPC-Web + Protobuf Helper
// Ported from GIOAI v7.0 worker.js - handles Sparx gRPC calls
// ============================================================

/**
 * Encode a varint (variable-length integer) into bytes.
 * @param {number} v
 * @returns {Uint8Array}
 */
function encVar(v) {
  const b = [];
  while (true) {
    let g = v & 0x7F;
    v >>>= 7;
    if (v) g |= 0x80;
    b.push(g);
    if (!v) break;
  }
  return new Uint8Array(b);
}

/**
 * Build a protobuf message from parts.
 * Each part: [fieldNumber, wireType, value]
 *   wireType 0 = varint
 *   wireType 2 = length-delimited (string, bytes, embedded message)
 * @param {Array} parts
 * @returns {Uint8Array}
 */
function proto(parts) {
  const chunks = [];
  for (let i = 0; i < parts.length; i++) {
    const f = parts[i][0], w = parts[i][1], v = parts[i][2];
    chunks.push(encVar((f << 3) | w));
    if (w === 0) {
      // varint
      chunks.push(encVar(v));
    } else if (w === 2) {
      // length-delimited
      if (v instanceof Uint8Array) {
        chunks.push(encVar(v.length));
        chunks.push(v);
      } else if (Array.isArray(v)) {
        const inner = proto(v);
        chunks.push(encVar(inner.length));
        chunks.push(inner);
      } else {
        const e = new TextEncoder().encode(String(v));
        chunks.push(encVar(e.length));
        chunks.push(e);
      }
    }
  }
  let total = 0;
  for (let i = 0; i < chunks.length; i++) total += chunks[i].length;
  const buf = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    buf.set(chunks[i], offset);
    offset += chunks[i].length;
  }
  return buf;
}

/**
 * Convert bytes to base64 string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function btoaBytes(bytes) {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Decode base64 to string
 * @param {string} b64 
 * @returns {string}
 */
function atobBytes(b64) {
  return Buffer.from(b64, 'base64').toString('binary');
}

/**
 * Make a gRPC-web request to Sparx.
 * @param {string} token - Bearer token
 * @param {string} endpoint - Full gRPC endpoint URL
 * @param {Array} parts - Protobuf parts array
 * @param {string} [sessionId] - Optional session ID
 * @returns {Promise<{b64: string, raw: Buffer}|null>}
 */
async function grpc(token, endpoint, parts, sessionId = '') {
  const body = proto(parts);
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/grpc-web+proto',
    'x-grpc-web': '1',
    'x-server-offset': '0',
    'User-Agent': randomUA(),
  };
  if (sessionId) headers['x-session-id'] = sessionId;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: body,
    });
    if (response.status !== 200) {
      const text = await response.text().catch(() => '');
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    return {
      b64: buf.toString('base64'),
      raw: buf,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Parse a base64-encoded protobuf homework response to extract package IDs.
 * Uses heuristic parsing similar to script.js parseSparxHomeworks.
 * @param {string} rawB64 - Base64 encoded protobuf response
 * @returns {Array} Array of task objects
 */
function parseHomeworks(rawB64) {
  const tasks = [];
  if (!rawB64) return tasks;
  try {
    const raw = Buffer.from(rawB64, 'base64').toString('binary');
    const len = raw.length;
    if (len < 5) return tasks;

    let pos = 0;
    let pkgCount = 0;
    while (pos < len - 4) {
      // Field 1, wire type 2 (0x0A) = package_id string
      if (raw.charCodeAt(pos) === 0x0A) {
        let strLen = 0;
        let shift = 0;
        while (true) {
          const b = raw.charCodeAt(pos + 1 + shift);
          strLen |= (b & 0x7F) << shift;
          shift += 7;
          if (!(b & 0x80)) {
            pos += 1 + shift;
            break;
          }
        }
        if (pos + strLen <= len) {
          const pkgId = raw.substr(pos, strLen);
          tasks.push({
            id: 'sp_pkg_' + pkgCount,
            package_id: pkgId,
            title: 'Homework Package ' + pkgId.substr(0, 8) + '...',
            task_index: pkgCount,
            platform: 'sparx',
          });
          pkgCount++;
        }
        pos += strLen;
      } else {
        pos++;
      }
    }

    if (tasks.length === 0) {
      tasks.push({
        id: 'sp_default',
        package_id: rawB64.substr(0, 16),
        title: 'Sparx Homework',
        task_index: 0,
        platform: 'sparx',
        rawData: rawB64,
      });
    }
  } catch (e) {
    tasks.push({
      id: 'sp_error',
      package_id: rawB64 ? rawB64.substr(0, 16) : '',
      title: 'Sparx Tasks (raw)',
      task_index: 0,
      platform: 'sparx',
      rawData: rawB64,
    });
  }
  return tasks;
}

/**
 * Random User-Agent from the list.
 */
function randomUA() {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  ];
  return uas[Math.floor(Math.random() * uas.length)];
}

module.exports = {
  encVar,
  proto,
  btoaBytes,
  atobBytes,
  grpc,
  parseHomeworks,
  randomUA,
};

