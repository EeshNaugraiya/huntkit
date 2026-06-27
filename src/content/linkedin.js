import { extractLinkedInJD } from '../utils/jd-extractor.js';
import { injectHuntKitButton, injectSidebarTrigger, showNewJobToast } from './generic.js';

window.__huntkit_linkedin = true;

if (!window.__huntkit_linkedin_init) {
  window.__huntkit_linkedin_init = true;

  let lastJobId = null;

  injectSidebarTrigger();

  // Extract job ID from query param (?currentJobId=123) or path (/jobs/view/123/)
  function getCurrentJobId() {
    const param = new URLSearchParams(location.search).get('currentJobId');
    if (param) return param;
    const match = location.pathname.match(/\/jobs\/view\/(\d+)/);
    if (match) return match[1];
    return null;
  }

  function findContainer() {
    return (
      document.querySelector('.jobs-apply-button--top-card') ||
      document.querySelector('.job-details-jobs-unified-top-card__content--two-pane') ||
      document.querySelector('.job-details-jobs-unified-top-card__container') ||
      document.querySelector('.jobs-details__main-content') ||
      document.querySelector('.scaffold-layout__detail')
    );
  }

  function autoAnalyze(jd) {
    chrome.runtime.sendMessage(
      { type: 'ANALYZE_JD', payload: { jdText: jd.description } },
      (response) => {
        if (chrome.runtime.lastError || !response || response.error) return;
        chrome.storage.local.set({
          lastAnalysis: { ...response, jdData: jd, analyzedAt: Date.now() },
        });
      }
    );
  }

  function extractAndInject(jobId, attempts = 0) {
    const jd = extractLinkedInJD();
    if (jd && jd.description.length >= 100) {
      // Remove stale badge, inject fresh one for new job
      document.getElementById('huntkit-analyze-btn')?.remove();
      injectHuntKitButton({ container: findContainer(), jdData: jd });

      // Store current job context and trigger auto-analysis
      chrome.storage.local.set({
        currentJobId: jobId,
        currentJobTitle: jd.title,
        currentJobCompany: jd.company,
      });
      autoAnalyze(jd);
    } else if (attempts < 6) {
      setTimeout(() => extractAndInject(jobId, attempts + 1), 1000);
    }
  }

  function handleNewJobDetected(jobId, isInitialLoad) {
    chrome.storage.local.set({ currentJobId: jobId });

    chrome.storage.local.get(['sidebarWasOpen', 'resumes', 'resumeText'], (data) => {
      const hasResume = (data.resumes?.length > 0) || !!data.resumeText;

      if (!hasResume) {
        // First-time: auto-open so onboarding banner is shown
        const s = document.getElementById('huntkit-root'); if (s) s.style.display = 'flex';
      } else if (data.sidebarWasOpen) {
        const s = document.getElementById('huntkit-root'); if (s) s.style.display = 'flex';
      } else if (!isInitialLoad) {
        // Navigation to a new job with sidebar closed → toast
        showNewJobToast();
      }
    });
  }

  // ─── Poll for jobId changes every 500ms ──────────────────────────────────────

  setInterval(() => {
    const jobId = getCurrentJobId();
    if (jobId && jobId !== lastJobId) {
      lastJobId = jobId;
      handleNewJobDetected(jobId, false);
      // Wait for LinkedIn's panel to finish rendering the new JD
      setTimeout(() => extractAndInject(jobId, 0), 1500);
    }
  }, 500);

  // ─── Initial load ─────────────────────────────────────────────────────────────

  const jobId = getCurrentJobId();
  if (jobId) {
    lastJobId = jobId;
    handleNewJobDetected(jobId, true);
    setTimeout(() => extractAndInject(jobId, 0), 800);
  }
}
