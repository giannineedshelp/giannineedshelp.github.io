// build-env.js
// Run: node build-env.js
// Reads .env file and generates env-config.js
// Also computes the SHA-256 hash of ADMIN_PASSWORD

const fs = require('fs');
const crypto = require('crypto');

// Read .env file
const envPath = '.env';
if (!fs.existsSync(envPath)) {
  console.error('.env file not found! Create one from .env.example');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const vars = {};

envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) return;
  const name = line.substring(0, eqIdx).trim();
  let value = line.substring(eqIdx + 1).trim();
  // Remove surrounding quotes if any
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  vars[name] = value;
});

// Compute hash for admin password
let adminHash = '';
if (vars['ADMIN_PASSWORD']) {
  adminHash = crypto.createHash('sha256').update(vars['ADMIN_PASSWORD']).digest('hex');
}

// Generate output
let output = '// Auto-generated from .env - DO NOT EDIT manually\n';
output += '// Generated: ' + new Date().toISOString() + '\n';
output += '(function() {\n';
output += '  window.__ENV__ = window.__ENV__ || {};\n\n';

Object.keys(vars).forEach(key => {
  const val = vars[key].replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  output += `  window.__ENV__['${key}'] = '${val}';\n`;
});

// Add computed hash
output += `\n  window.__ENV__['ADMIN_PASSWORD_HASH'] = '${adminHash}';\n`;

output += '})();\n';

fs.writeFileSync('env-config.js', output);
console.log('✓ env-config.js generated successfully');
console.log('  Admin password hash: ' + adminHash);
