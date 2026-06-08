# GIOAI v2.5 — Unified Multi-Platform Homework Autocompleter

Single-page application combining **LanguageNut**, **Seneca Learning**, and **Sparx Maths** autocompleters with a hacker-style dashboard UI.

## Architecture

### Unified SPA
- **index.html** — Single-page app with hub, login, dashboard, settings, donate, admin screens
- **styles.css** — 4 themes (Dark, Hacker, Light, Neon) with glitch animations and smooth UI
- **script.js** — All app logic (auth, task completion, settings, admin, notifications)
- **worker.js** — Cloudflare Worker backend (Sparx gRPC proxy, LN login with FCaptcha bypass, Seneca API proxy, AI solve via Gemini, admin endpoints)

### Platform-Specific Fallbacks (legacy)
- `languagenut.html` + `languagenut.js` — standalone LN direct API client
- `seneca.html` — standalone Seneca client
- `sparx.html` — standalone Sparx client
- `admin.html` + `admin.js` — standalone admin panel
- `notifications.html` — standalone notifications

## Features

### All Platforms
- Single unified login with per-platform authentication
- Platform-specific settings (fake timing, show past homework, show working out)
- Task display with checkboxes for selective completion
- Real-time progress tracking
- Persistent settings (localStorage)

### LanguageNut
- Direct API calls (no worker proxy needed)
- FCaptcha bypass via generated client-side tokens
- Fake time slider (default 5-8s)
- Vocab/score XP farming
- Show past homework toggle

### Seneca Learning
- Worker-based authentication proxy
- Course/section browsing
- Session submission with DynamicSessionGenerator
- Fake time slider (default 5-8s)
- Show past homework toggle

### Sparx Maths
- Full gRPC-web proxy via Cloudflare Worker
- OAuth2 authentication flow
- Task list, activity retrieval, answer submission, bookwork checks
- AI-powered answer solving (Gemini 2.0 Flash)
- Fake time slider (default 60-70s per question)
- Show working out toggle
- Show past homework toggle

### UI/UX
- 4 themes: Dark, Hacker (matrix-style), Light, Neon
- Glitch text animations, smooth transitions
- Toast notifications system
- Sidebar navigation with hamburger menu
- Platform status checking (admin)
- Changelog overlay (auto-shows on new version)
- Tutorial modal (visual guide)
- Mobile-responsive layout

### Admin Panel
- Give Slots (assign usage slots by username)
- Platform status monitoring (live API checks)
- Configurable admin key

## Setup

### 1. Deploy Cloudflare Worker
Upload `worker.js` to Cloudflare Workers dashboard:
- Go to https://dash.cloudflare.com -> Workers & Pages
- Create a new worker, paste `worker.js` content
- Set environment variables in worker settings:
  - `GEMINI_KEY` — Google Gemini API key (for Sparx AI solving)
  - `ADMIN_KEY` — Admin panel secret key
- Deploy and note your worker URL (e.g., `https://gioai.your-subdomain.workers.dev`)

### 2. Configure script.js
Open `script.js` and set the worker URL:
```js
S.worker = 'https://your-worker.your-subdomain.workers.dev';
```

### 3. Deploy to GitHub Pages
```bash
git add -A
git commit -m "v2.5: Unified app with all platforms"
git push origin main
```
Enable GitHub Pages in repo settings (Source: main branch, root folder).

### 4. Access
Visit `https://giannineedshelp.github.io/`

## Technical Details

### FCaptcha Bypass
The Friendly Captcha (v1.10.1) is loaded site-wide on LanguageNut. Tokens are generated client-side as:
```
btoa(JSON.stringify({timestamp: Date.now(), score: 0.05-0.25, id: random, v: '1.10.1'}))
```
This produces a plausible but fake token that passes client-side checks.

### Sparx gRPC
Sparx uses gRPC-web for all API calls. The worker implements protobuf encoding (`encVar` for varint, `proto` for message serialization) to communicate with `studentapi.api.sparxmaths.uk` without needing the protobuf library.

### Seneca API
Seneca uses a session-based API. The worker proxies login (captures idToken), course listing, section listing, and session submission. Answer generation uses `DynamicSessionGenerator` format.

## Files
```
index.html          — Main SPA (~376 lines)
styles.css          — Theme system and animations (~348 lines)
script.js           — Application logic (~972 lines)
worker.js           — Cloudflare Worker backend (~141 lines)
CHANGELOG.md        — Version history
languagenut.html    — Legacy standalone LN
languagenut.js      — Legacy standalone LN logic
seneca.html         — Legacy standalone Seneca
sparx.html          — Legacy standalone Sparx
admin.html          — Legacy admin panel
admin.js            — Legacy admin logic
notifications.html  — Legacy notifications
fcaptcha.js         — FCaptcha library (99KB, not used by SPA)
.env                — Local config (gitignored)
```

## License
Educational automation tool. Use responsibly.

