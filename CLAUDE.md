# HuntKit — Chrome Extension (MV3)

AI-powered job hunting toolkit. Injects an "Analyze" button on LinkedIn, Naukri, and Indeed job pages. Sends the JD + resume to Claude or Qwen, shows a match score + gap analysis in a side panel, and tracks applications.

## Quick Start

```bash
npm install
npm run build          # outputs to dist/
npm run dev            # watch mode for development
```

Load the extension: Chrome → `chrome://extensions` → **Load unpacked** → select `dist/`.

**Icons are required** — add PNG files to `public/icons/` (16px, 48px, 128px) before the extension will load. A simple colored square works for dev.

## Project Layout

```
src/
  background/service-worker.js   # MV3 service worker — handles AI calls, messaging
  content/
    linkedin.js                  # LinkedIn SPA observer + inject
    naukri.js                    # Naukri content script
    indeed.js                    # Indeed content script
    generic.js                   # Shared button inject + toast util
  popup/
    index.html + main.jsx + App.jsx   # Extension popup — settings, resume, tracker link
  sidebar/
    index.html + main.jsx + Sidebar.jsx + JobTracker.jsx  # Side panel UI
  ai/
    index.js     # Routes to the right provider, parses JSON
    claude.js    # Anthropic SDK (@anthropic-ai/sdk)
    qwen.js      # Qwen via fetch (dashscope OpenAI-compat endpoint)
    noai.js      # Keyword fallback (no API key needed)
  storage/
    resume.js    # chrome.storage.local helpers for resume text
    tracker.js   # CRUD for tracked jobs array
  utils/
    jd-extractor.js   # DOM selectors per job board
    form-filler.js    # Autofill form fields from resume data
```

## Architecture

- **Content scripts** only extract DOM data and inject a button. They never call AI APIs.
- **Background service worker** receives `ANALYZE_JD` messages, reads API keys from `chrome.storage.local`, calls the AI, and returns the result.
- **Sidebar + Popup** read `lastAnalysis` from `chrome.storage.local` and react to `onChanged` events.
- All inter-component communication uses `chrome.runtime.sendMessage`.

## AI Providers

Set in popup Settings tab (or seed via `.env`):

| Provider | Key | Model |
|---|---|---|
| `claude` | Anthropic API key | `claude-opus-4-8` (direct fetch to api.anthropic.com) |
| `qwen` | DashScope key | `qwen-max` |
| `none` | — | Keyword match fallback |

API keys are stored in `chrome.storage.local` — never sent anywhere except the provider endpoint.

## Key Selectors

Selectors are in `src/utils/jd-extractor.js`. They will break when job boards update their DOM. When they do, update the relevant `extract*JD()` function. LinkedIn's selectors are the most volatile (SPA + A/B testing).

## Adding a New Job Board

1. Add a content script entry in `manifest.json` under `content_scripts`.
2. Add an `extract*JD()` function in `jd-extractor.js`.
3. Create `src/content/<board>.js` that imports and calls both.

## Environment Variables

Copy `.env.example` to `.env`. `VITE_*` variables are embedded at build time — they seed `chrome.storage` on first install via `service-worker.js`. Do **not** commit real API keys.
