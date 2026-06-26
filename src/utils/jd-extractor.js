export function extractLinkedInJD() {
  const titleEl =
    document.querySelector('.job-details-jobs-unified-top-card__job-title h1') ||
    document.querySelector('.jobs-unified-top-card__job-title h1') ||
    document.querySelector('.jobs-unified-top-card__job-title') ||
    document.querySelector('h1[class*="job-title"]');

  const companyEl =
    document.querySelector('.job-details-jobs-unified-top-card__company-name') ||
    document.querySelector('.jobs-unified-top-card__company-name') ||
    document.querySelector('[class*="company-name"]') ||
    document.querySelector('.jobs-unified-top-card__subtitle-primary-grouping a');

  // Try selectors from most-specific to broadest; LinkedIn rotates class names frequently
  const descEl =
    document.querySelector('#job-details') ||
    document.querySelector('.jobs-description__content') ||
    document.querySelector('.jobs-description') ||
    document.querySelector('.job-details-module') ||
    document.querySelector('[class*="jobs-description"]') ||
    document.querySelector('[class*="job-description"]');

  if (!descEl) return null;

  return {
    source: 'linkedin',
    url: location.href,
    title: titleEl?.textContent?.trim() || '',
    company: companyEl?.textContent?.trim() || '',
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
