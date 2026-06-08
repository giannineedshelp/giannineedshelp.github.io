// ============================================================
// GIOAI v8.0 - Global Configuration
// ============================================================
var CONFIG = {
  VERSION: '8.0',
  WORKER_URL: 'https://gioai.giannikei12.workers.dev',
  API_BASE: 'https://gioai.giannikei12.workers.dev/api',
  
  // Default delays per platform
  DELAYS: {
    languagenut: { min: 5, max: 8, fakeTime: 10000 },
    seneca: { min: 5, max: 8, fakeTime: 10000 },
    sparx: { min: 60, max: 70, fakeTime: 60000 }
  },
  
  // Usage limits
  USAGE_LIMIT: 2,             // completions per 24h per user
  USAGE_WINDOW_MS: 86400000,  // 24 hours
  
  // Cloudflare Worker limits (daily)
  WORKER_LIMIT_DAILY: 100000,
  
  // Admin credentials (set via env, fallback for local)
  ADMIN_PASSWORD_HASH: 'b38c75356f6a622c2df4036e9c96c4f455f2e298685bf0ae03c602a1b32b0b9a',
  
  // Platform display info
  PLATFORMS: {
    languagenut: { name: 'LanguageNut', icon: 'LN', color: '#00d4ff' },
    seneca: { name: 'Seneca', icon: 'SE', color: '#ff6e40' },
    sparx: { name: 'Sparx', icon: 'SX', color: '#00ff41' }
  },
  
  // Themes
  THEMES: ['dark', 'hacker', 'light', 'neon', 'ocean', 'sunset']
};

