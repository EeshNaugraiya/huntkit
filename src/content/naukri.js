import { extractNaukriJD } from '../utils/jd-extractor.js';
import { injectHuntKitButton } from './generic.js';

function init() {
  if (!isJobDetailPage()) return;

  const jd = extractNaukriJD();
  if (jd) {
    const container =
      document.querySelector('.apply-button-container') ||
      document.querySelector('.job-header');
    injectHuntKitButton({ container, jdData: jd });
  }
}

function isJobDetailPage() {
  return location.pathname.includes('/job-listings-') ||
         document.querySelector('.jd-header') !== null;
}

// Naukri loads content dynamically
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Handle SPA navigation
window.addEventListener('popstate', () => setTimeout(init, 500));