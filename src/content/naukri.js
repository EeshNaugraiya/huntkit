import { extractNaukriJD } from '../utils/jd-extractor.js';
import { injectHuntKitButton, injectSidebarTrigger } from './generic.js';

let lastUrl = location.href;

injectSidebarTrigger();

function init() {
  if (!isJobDetailPage()) return;

  document.getElementById('huntkit-analyze-btn')?.remove();
  chrome.storage.local.set({ currentJobUrl: location.href });

  const jd = extractNaukriJD();
  if (jd) {
    const container =
      document.querySelector('.apply-button-container') ||
      document.querySelector('.job-header');
    injectHuntKitButton({ container, jdData: jd });
  } else {
    // Retry up to 4× for dynamically loaded content
    let attempts = 0;
    const retry = setInterval(() => {
      const jd2 = extractNaukriJD();
      if (jd2) {
        clearInterval(retry);
        const container =
          document.querySelector('.apply-button-container') ||
          document.querySelector('.job-header');
        injectHuntKitButton({ container, jdData: jd2 });
      } else if (++attempts >= 4) {
        clearInterval(retry);
      }
    }, 1000);
  }
}

function isJobDetailPage() {
  return (
    location.pathname.includes('/job-listings-') ||
    document.querySelector('.jd-header') !== null
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('popstate', () => setTimeout(init, 500));

// Naukri sometimes pushes new job content without a popstate event
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(init, 500);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
