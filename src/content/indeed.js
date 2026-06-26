import { extractIndeedJD } from '../utils/jd-extractor.js';
import { injectHuntKitButton } from './generic.js';

function init() {
  if (!isJobDetailPage()) return;

  const jd = extractIndeedJD();
  if (jd) {
    const container =
      document.querySelector('.jobsearch-IndeedApplyButton-buttonWrapper') ||
      document.querySelector('.jobsearch-JobInfoHeader-title-container');
    injectHuntKitButton({ container, jdData: jd });
  }
}

function isJobDetailPage() {
  return location.pathname === '/viewjob' ||
         location.pathname.includes('/jobs') ||
         document.querySelector('.jobsearch-JobInfoHeader-title') !== null;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('popstate', () => setTimeout(init, 500));