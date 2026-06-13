// ============================================================
// GIOAI v8.0 - Global Configuration
// Website is a thin UI client for the Playwright backend
// ============================================================
var CONFIG = {
  VERSION: '8.1',
  WORKER_URL: 'https://gioai.giannikei12.workers.dev',
  API_BASE: 'https://gioai.giannikei12.workers.dev/api',

  // Local Playwright backend (primary - handles all platforms)
  PLAYWRIGHT_API: localStorage.getItem('gioai-playwright-api') || 'http://localhost:3456',
  PLAYWRIGHT_WS: (localStorage.getItem('gioai-playwright-api') || 'http://localhost:3456').replace('http', 'ws'),

  // Default delays per platform
  DELAYS: {
    languagenut: { min: 3, max: 6, fakeTime: 8000 },
    seneca: { min: 3, max: 6, fakeTime: 8000 },
    sparx: { min: 8, max: 15, fakeTime: 30000 }
  },

  // Usage limits
  USAGE_LIMIT: 2,
  USAGE_WINDOW_MS: 86400000,

  // Admin
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

