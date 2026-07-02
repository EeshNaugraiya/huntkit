import { extractIndeedJD } from '../utils/jd-extractor.js';
import { injectHuntKitButton, injectSidebarTrigger } from './generic.js';

let lastUrl = location.href;
// Indeed split-view uses ?vjk=JOBID on the /jobs listing page
let lastVjk = new URLSearchParams(location.search).get('vjk') || null;

injectSidebarTrigger();

function getVjk() {
  return new URLSearchParams(location.search).get('vjk') || null;
}

function handleNewJobDetected() {
  chrome.storage.local.get(['sidebarWasOpen', 'resumes', 'resumeText'], (data) => {
    const hasResume = (data.resumes?.length > 0) || !!data.resumeText;

    if (!hasResume) {
      const s = document.getElementById('huntkit-root'); if (s) s.style.transform = 'translateX(0)';
    } else if (data.sidebarWasOpen) {
      const s = document.getElementById('huntkit-root'); if (s) s.style.transform = 'translateX(0)';
    }
  });
}

function init(attempts = 0) {
  if (!isJobDetailPage()) return;

  if (attempts === 0) {
    document.getElementById('huntkit-analyze-btn')?.remove();
    chrome.storage.local.set({ currentJobUrl: location.href });
  }

  const jd = extractIndeedJD();
  if (jd) {
    const container =
      document.querySelector('.jobsearch-IndeedApplyButton-buttonWrapper') ||
      document.querySelector('.jobsearch-JobInfoHeader-title-container');
    injectHuntKitButton({ container, jdData: jd });
  } else if (attempts < 5) {
    setTimeout(() => init(attempts + 1), 1000);
  }
}

function isJobDetailPage() {
  return (
    location.pathname === '/viewjob' ||
    location.pathname.includes('/jobs') ||
    location.search.includes('vjk=') ||
    document.querySelector('.jobsearch-JobInfoHeader-title') !== null
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    handleNewJobDetected();
    init(0);
  });
} else {
  handleNewJobDetected();
  init(0);
}

window.addEventListener('popstate', () => setTimeout(() => init(0), 500));

// ─── Split-view: poll for vjk param changes ───────────────────────────────────

setInterval(() => {
  const newVjk = getVjk();
  if (newVjk && newVjk !== lastVjk) {
    lastVjk = newVjk;
    chrome.storage.local.set({ currentJobUrl: location.href });
    handleNewJobDetected();
    setTimeout(() => init(0), 1200);
  }
}, 600);

// ─── SPA navigation fallback ──────────────────────────────────────────────────

const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    lastVjk = getVjk();
    if (isJobDetailPage()) {
      chrome.storage.local.set({ currentJobUrl: location.href });
      handleNewJobDetected();
      setTimeout(() => init(0), 800);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
