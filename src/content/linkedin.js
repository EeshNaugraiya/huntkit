import { extractLinkedInJD } from '../utils/jd-extractor.js';
import { injectHuntKitButton } from './generic.js';

// Sentinel lets devs verify the script ran: window.__huntkit_linkedin === true
window.__huntkit_linkedin = true;

let lastUrl = location.href;

// Retry until the SPA has rendered the job content (up to ~5s total)
function init(attempts = 0) {
  if (!isJobDetailPage()) return;

  if (document.getElementById('huntkit-analyze-btn')) return;

  const jd = extractLinkedInJD();
  if (jd) {
    const container =
      document.querySelector('.jobs-apply-button--top-card') ||
      document.querySelector('.jobs-unified-top-card__content--two-pane') ||
      document.querySelector('.job-details-jobs-unified-top-card__container') ||
      document.querySelector('.jobs-details__main-content');
    injectHuntKitButton({ container, jdData: jd });
  } else if (attempts < 5) {
    setTimeout(() => init(attempts + 1), 1000);
  }
}

function isJobDetailPage() {
  return location.pathname.includes('/jobs/view/') ||
         location.search.includes('currentJobId=');
}

// LinkedIn SPA — re-run on URL changes
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(() => init(0), 800);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
init(0);