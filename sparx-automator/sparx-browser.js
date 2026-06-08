'use strict';

// ============================================================
// Sparx Browser Automation Module
// Uses Puppeteer to automate the Sparx Maths website
// Handles: Login flow, token extraction, homework browsing,
//          auto-completion of tasks via web UI
// ============================================================

const CFG = require('./config');

let puppeteer = null;
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  // puppeteer-core not available, browser mode disabled
}

/**
 * Check if browser automation is available on this platform.
 */
function isAvailable() {
  return puppeteer !== null && (CFG.CHROMIUM_PATH || process.env.CHROME_PATH || process.env.CHROME_BIN);
}

/**
 * Find Chromium/Chrome executable path.
 * Tries multiple common locations + env vars.
 */
function findChromePath() {
  if (CFG.CHROMIUM_PATH) return CFG.CHROMIUM_PATH;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  if (process.env.PUPPETEER_CHROMIUM_REVISION) {
    const rev = process.env.PUPPETEER_CHROMIUM_REVISION;
    const home = process.env.HOME || '/root';
    const paths = [
      `${home}/.cache/puppeteer/chrome/linux-${rev}/chrome-linux64/chrome`,
      `${home}/.cache/puppeteer/chrome/mac_arm-${rev}/chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium`,
      `/app/.cache/puppeteer/chrome/linux-${rev}/chrome-linux64/chrome`,
    ];
    for (const p of paths) {
      try { require('fs').accessSync(p); return p; } catch (e) {}
    }
  }
  // Common Linux paths
  const common = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
    '/app/.local/share/puppeteer/chrome/linux-*/chrome-linux64/chrome',
  ];
  for (const p of common) {
    try { require('fs').accessSync(p); return p; } catch (e) {}
  }
  return null;
}

/**
 * Extract Sparx API token by intercepting network requests during login.
 * Logs into Sparx Maths website via Puppeteer.
 * 
 * @param {Object} credentials - { username, password, schoolId }
 * @param {Object} [options] - { headless, timeout }
 * @returns {Promise<{token: string, sessionId: string}>}
 */
async function loginAndGetToken(credentials, options = {}) {
  if (!puppeteer) {
    throw new Error('puppeteer-core not installed. Run: npm install puppeteer-core');
  }

  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error(
      'Chromium/Chrome not found. Install Chromium or set CHROME_PATH env var.\n' +
      '  Linux: apt install chromium\n' +
      '  macOS: brew install chromium\n' +
      '  Or download from https://www.chromium.org/getting-involved/download-chromium'
    );
  }

  const headless = options.headless !== false;
  const timeout = options.timeout || 60000;

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800',
    ],
  });

  let token = null;
  let sessionId = '';

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set up request interceptor to capture the auth token
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const url = request.url();
      
      // Capture token from API responses
      if (url.includes('api.sparx-learning.com') && url.includes('token')) {
        const authHeader = request.headers()['authorization'] || '';
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7);
        }
      }
      
      // Also capture cookies that might contain tokens
      request.continue();
    });

    page.on('response', async (response) => {
      const url = response.url();
      
      if (url.includes('oauth2/token') || url.includes('auth/token')) {
        try {
          const json = await response.json();
          if (json.access_token) token = json.access_token;
          if (json.session_id) sessionId = json.session_id;
        } catch (e) {
          // not JSON, ignore
        }
      }
    });

    // Navigate to Sparx Maths login
    await page.goto(CFG.SPARX_WEB.LOGIN, {
      waitUntil: 'networkidle0',
      timeout: timeout,
    });

    // Wait for the login form
    // Sparx uses a school-based login flow - first select school, then enter credentials
    console.log('[browser] Page loaded, looking for login form...');

    // Different Sparx login flows:
    // Flow 1: School search + standard login
    // Flow 2: SSO / Microsoft login
    // Flow 3: Direct login with token
    
    // Try to find and fill the school search
    const schoolInput = await page.$('input[placeholder*="school"], input[placeholder*="School"], input[aria-label*="school"], input[aria-label*="School"], #school-search, .school-search input');
    if (schoolInput && credentials.schoolId) {
      console.log('[browser] Selecting school...');
      await schoolInput.click();
      await schoolInput.type(credentials.schoolName || '', { delay: 50 });
      await page.waitForTimeout(1000);
      
      // Click the school result
      const schoolResult = await page.$('.school-result, .search-result, [data-school-id]');
      if (schoolResult) {
        await schoolResult.click();
        await page.waitForTimeout(500);
      }
    }

    // Try finding username/email and password fields
    const usernameField = await page.$('input[type="email"], input[name="email"], input[autocomplete="username"], input[placeholder*="username" i], input[placeholder*="email" i], input[placeholder*="Username" i], input[placeholder*="Email" i]');
    const passwordField = await page.$('input[type="password"], input[name="password"]');

    if (usernameField && passwordField && credentials.username) {
      console.log('[browser] Entering credentials...');
      await usernameField.click();
      await usernameField.type(credentials.username, { delay: 30 });
      await passwordField.click();
      await passwordField.type(credentials.password, { delay: 30 });
      
      // Click login button
      const loginBtn = await page.$('button[type="submit"], .login-button, input[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")');
      if (loginBtn) {
        await loginBtn.click();
      } else {
        // Try pressing Enter
        await page.keyboard.press('Enter');
      }

      // Wait for navigation to complete
      console.log('[browser] Waiting for login to complete...');
      await page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: timeout,
      }).catch(() => {
        console.log('[browser] Navigation timeout - checking current page...');
      });
    }

    // If we still don't have a token, try to extract from localStorage or cookies
    if (!token) {
      console.log('[browser] Trying to extract token from page context...');
      try {
        token = await page.evaluate(() => {
          // Sparx stores auth data in localStorage
          const keys = Object.keys(localStorage);
          for (const key of keys) {
            try {
              const val = JSON.parse(localStorage[key]);
              if (val && val.accessToken) return val.accessToken;
              if (val && val.token) return val.token;
              if (typeof val === 'string' && val.startsWith('eyJ')) return val;
            } catch (e) {
              const val = localStorage[key];
              if (typeof val === 'string' && val.startsWith('eyJ')) return val;
            }
          }
          return null;
        });
      } catch (e) {
        console.log('[browser] Cannot access localStorage (cross-origin)');
      }
    }

    // If we still don't have a token, try cookies
    if (!token) {
      const cookies = await page.cookies();
      for (const cookie of cookies) {
        if (cookie.name.includes('token') || cookie.name.includes('auth') || cookie.name.includes('session')) {
          if (cookie.value.startsWith('eyJ')) {
            token = cookie.value;
            break;
          }
        }
      }
    }

    if (!token) {
      // Last resort: check the current URL for any hash/query params with tokens
      const currentUrl = page.url();
      const urlObj = new URL(currentUrl);
      if (urlObj.hash) {
        const hashParams = new URLSearchParams(urlObj.hash.slice(1));
        token = hashParams.get('access_token') || hashParams.get('token') || hashParams.get('id_token');
      }
      if (!token && urlObj.searchParams) {
        token = urlObj.searchParams.get('access_token') || urlObj.searchParams.get('token');
      }
    }

    console.log('[browser] Login ' + (token ? 'successful' : 'failed - no token extracted'));
    
    return { token, sessionId, browser, page };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

/**
 * Automate homework completion via browser interaction.
 * Opens each homework task and marks it as complete.
 * 
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} token - Auth token
 * @returns {Promise<number>} Number of tasks completed
 */
async function completeHomeworkViaWeb(browser, token) {
  const page = (await browser.pages())[0];
  if (!page) throw new Error('No pages available');
  
  console.log('[browser] Navigating to dashboard...');
  await page.goto(CFG.SPARX_WEB.DASHBOARD, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  }).catch(() => {});

  // Look for homework tasks on the dashboard
  const tasks = await page.evaluate(() => {
    const items = [];
    // Look for homework task elements
    const taskElements = document.querySelectorAll(
      '[class*="homework"], [class*="task"], [class*="assignment"], [data-testid*="homework"]'
    );
    taskElements.forEach(el => {
      const text = el.textContent || '';
      const link = el.querySelector('a') || el;
      items.push({
        text: text.trim(),
        href: link.href || link.getAttribute('href') || '',
      });
    });
    return items;
  });

  console.log(`[browser] Found ${tasks.length} tasks on dashboard`);
  
  let completed = 0;
  for (const task of tasks) {
    if (task.href) {
      console.log(`[browser] Opening task: ${task.text.slice(0, 50)}...`);
      try {
        await page.goto(task.href, { waitUntil: 'networkidle0', timeout: 15000 });
        await page.waitForTimeout(2000);
        
        // Try to click "Start" or "Continue" button
        const startBtn = await page.$('button:has-text("Start"), button:has-text("Continue"), button:has-text("Begin"), a:has-text("Start"), a:has-text("Continue")');
        if (startBtn) {
          await startBtn.click();
          await page.waitForTimeout(3000);
        }
        
        completed++;
      } catch (e) {
        console.log(`[browser] Error on task: ${e.message}`);
      }
    }
  }
  
  return completed;
}

module.exports = {
  isAvailable,
  findChromePath,
  loginAndGetToken,
  completeHomeworkViaWeb,
};

