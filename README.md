# huntkit

A free, open-source Chrome extension for AI-powered job hunting.
No subscriptions. Your API keys. Your data stays local.

Built as a personal alternative to paid tools like NextRaise.

---

## Features
- Resume–JD match score (ATS keyword score + AI semantic score)
- Multi-resume comparison — upload up to 5 resumes, see which fits best
- ATS audit — find gaps, get tailored bullet suggestions  
- Cover letter generator
- Auto-fill application forms (LinkedIn, Naukri, Indeed)
- Job tracker with kanban pipeline (saved → applied → interview → offer)
- Export tracker as CSV
- Works with Claude, Gemini, OpenAI, or completely free (no AI mode)

---

## Screenshots
<!-- Coming soon -->

---

## Installation

### Prerequisites
- Node.js 18+
- npm
- Google Chrome

### Build from source
```bash
git clone https://github.com/EeshNaugraiya/huntkit.git
cd huntkit
npm install
npm run build
```

### Load in Chrome
1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder inside the project

The huntkit icon will appear in your Chrome toolbar.

---

## Setup

### Step 1 — Add your resume
1. Click the huntkit icon in Chrome toolbar
2. Go to the **Resume** tab
3. Click **Open Resume Manager** — this opens a new tab
4. Drag and drop your resume PDF or DOCX (up to 5 resumes)
5. Wait for extraction to complete — you'll see a preview of parsed text
6. The first uploaded resume is set as Default automatically

### Step 2 — Configure AI provider
1. Click the huntkit icon → **Settings** tab
2. Choose your AI provider:
   - **No AI** — free, works offline, pure keyword matching (closest to real ATS)
   - **Claude** — best quality, get key at console.anthropic.com
   - **Gemini** — free tier available, get key at aistudio.google.com
   - **OpenAI** — fast, get key at platform.openai.com
3. Paste your API key and click **Save Changes**

### Step 3 — Start hunting
1. Open any job on LinkedIn, Naukri, or Indeed
2. The **HuntKit sidebar** opens automatically
3. Click **Analyze** to get your match score
4. Use **Compare Resumes** to find which resume fits best
5. Use **Cover Letter** tab to generate a tailored cover letter
6. Click **Save to Tracker** to add the job to your pipeline

---

## Supported Platforms
| Platform | Match Score | Auto-fill | JD Extraction |
|---|---|---|---|
| LinkedIn | ✅ | ✅ | ✅ |
| Naukri | ✅ | ✅ | ✅ |
| Indeed | ✅ | ✅ | ✅ |
| University portals | ✅ | ⚠️ partial | ✅ |

---

## AI Providers
| Provider | Model | Cost | Best for |
|---|---|---|---|
| No AI | TF-IDF keyword scoring | Free | ATS simulation |
| Claude | claude-sonnet-4-6 | ~$0.01/analysis | Best accuracy |
| Gemini | gemini-2.0-flash | Free tier | Daily use |
| OpenAI | gpt-4o-mini | ~$0.001/analysis | Fast + cheap |

---

## Tech Stack
- Chrome Manifest V3
- React 18 + Vite 5
- IndexedDB (idb) — job tracker
- mammoth.js — DOCX text extraction
- pdfjs-dist — PDF text extraction
- chrome.storage.local — resume + settings

---

## Privacy
- All data stored locally on your machine
- API keys stored in chrome.storage.local — never sent to any server
- Resume text never leaves your browser except to your chosen AI provider
- No analytics, no tracking, no accounts required

---

## Contributing
PRs welcome. Open an issue first for major changes.

---

## License
MIT

## Credits
ATS platform scoring engine adapted from 
[ats-screener](https://github.com/sunnypatell/ats-screener) 
by Sunny Patel (MIT License)
