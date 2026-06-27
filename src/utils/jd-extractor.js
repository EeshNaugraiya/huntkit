const LI_DESC_SELECTORS = [
  '.jobs-description__content',
  '.jobs-description-content__text',
  '.jobs-box__html-content',
  '#job-details',
  '[class*="jobs-description"]',
  '[class*="job-description"]',
  '[data-test="job-description"]',
  '.scaffold-layout__detail',
  '.jobs-unified-top-card__job-insight',
];

const LI_TITLE_SELECTORS = [
  '.job-details-jobs-unified-top-card__job-title h1',
  '.jobs-unified-top-card__job-title h1',
  'h1[class*="job-title"]',
  '.t-24.t-bold',
];

const LI_COMPANY_SELECTORS = [
  '.job-details-jobs-unified-top-card__company-name',
  '.jobs-unified-top-card__company-name',
  '[class*="company-name"] a',
];

function firstEl(selectors, minTextLen = 0) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > minTextLen) return el;
    } catch {
      // invalid selector — skip
    }
  }
  return null;
}

export function extractLinkedInJD() {
  const descEl = firstEl(LI_DESC_SELECTORS, 100);
  if (!descEl) return null;

  return {
    source: 'linkedin',
    url: location.href,
    title: firstEl(LI_TITLE_SELECTORS)?.textContent?.trim() || '',
    company: firstEl(LI_COMPANY_SELECTORS)?.textContent?.trim() || '',
    description: descEl.textContent.trim(),
  };
}

export function extractNaukriJD() {
  const titleEl = document.querySelector('.jd-header-title') ||
                  document.querySelector('h1.title');
  const companyEl = document.querySelector('.jd-header-comp-name') ||
                    document.querySelector('.company-name');
  const descEl = document.querySelector('.job-desc') ||
                 document.querySelector('.dang-inner-html');

  if (!descEl) return null;

  return {
    source: 'naukri',
    url: location.href,
    title: titleEl?.textContent?.trim() || '',
    company: companyEl?.textContent?.trim() || '',
    description: descEl.textContent.trim(),
  };
}

export function extractIndeedJD() {
  const titleEl = document.querySelector('h1.jobsearch-JobInfoHeader-title') ||
                  document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]');
  const companyEl = document.querySelector('[data-testid="inlineHeader-companyName"]') ||
                    document.querySelector('.jobsearch-InlineCompanyRating');
  const descEl = document.querySelector('#jobDescriptionText') ||
                 document.querySelector('.jobsearch-jobDescriptionText');

  if (!descEl) return null;

  return {
    source: 'indeed',
    url: location.href,
    title: titleEl?.textContent?.trim() || '',
    company: companyEl?.textContent?.trim() || '',
    description: descEl.textContent.trim(),
  };
}

export function extractGenericJD() {
  const titleEl = document.querySelector('h1') || document.querySelector('h2');
  const descEl =
    document.querySelector('[class*="job-desc"]') ||
    document.querySelector('[class*="description"]') ||
    document.querySelector('article') ||
    document.querySelector('main');

  if (!descEl) return null;

  return {
    source: 'generic',
    url: location.href,
    title: titleEl?.textContent?.trim() || document.title,
    company: '',
    description: descEl.textContent.trim().slice(0, 8000),
  };
}
