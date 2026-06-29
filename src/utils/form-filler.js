export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const SKIP_PATTERNS = [
  /hear.?about|how.?did.?you|referral.?source/,
  /previously.?worked|worked.?before|former.?employee/,
  /agree|consent|certif|acknowledge/,
  /captcha|security/,
  /password|confirm.?password/,
];

export function getFieldHint(el) {
  const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
  const siblingLabel = el.previousElementSibling?.tagName === 'LABEL' ? el.previousElementSibling : null;
  const container = el.closest('.field, .form-field, .form-group, [data-automation-id], .form-control-wrap');
  const containerLabel = container
    ? (container.querySelector('label') || container.querySelector('[class*="label"]') || container.querySelector('legend'))
    : null;
  const legend = el.closest('fieldset')?.querySelector('legend');
  const texts = [
    el.name, el.id, el.placeholder,
    el.getAttribute('aria-label'),
    el.getAttribute('data-automation-id'),
    el.getAttribute('data-automation-label'),
    labelEl?.textContent, el.closest('label')?.textContent,
    siblingLabel?.textContent, containerLabel?.textContent, legend?.textContent,
  ].filter(Boolean);
  return [...new Set(texts)].join(' ').toLowerCase();
}

export function matchProfile(hint, profile, eduIdx = 0, expIdx = 0) {
  if (SKIP_PATTERNS.some(p => p.test(hint))) return null;
  if (/given.?name|first.?name|fname/.test(hint)) return profile.firstName;
  if (/family.?name|last.?name|lname|surname/.test(hint)) return profile.lastName;
  if (/^name$|full.?name|your.?name/.test(hint)) return `${profile.firstName} ${profile.lastName}`;
  if (/email/.test(hint)) return profile.email;
  if (/phone|mobile|cell/.test(hint)) return profile.phone;
  if (/city|town/.test(hint)) return profile.city;
  if (/state|province|region/.test(hint)) return profile.state;
  if (/country/.test(hint)) return profile.country;
  if (/zip|postal|pin/.test(hint)) return profile.zipCode;
  if (/linkedin/.test(hint)) return profile.linkedin;
  if (/github/.test(hint)) return profile.github;
  if (/portfolio|website/.test(hint)) return profile.portfolio;
  if (/current.?company|present.?employer/.test(hint)) return profile.currentJob?.isEmployed ? profile.currentJob.company : null;
  if (/current.?title|present.?role/.test(hint)) return profile.currentJob?.isEmployed ? profile.currentJob.title : null;
  if (/authorized|eligible|legally/.test(hint)) return profile.workAuthorized;
  if (/sponsor|visa/.test(hint)) return profile.requiresSponsorship;
  if (/notice.?period|joining|available/.test(hint)) return profile.noticePeriod;
  if (/current.?ctc|current.?sal/.test(hint)) return profile.currentCTC;
  if (/expected.?ctc|desired.?sal/.test(hint)) return profile.expectedCTC;
  if (/company|employer|organization/.test(hint)) return profile.experience?.[expIdx]?.company || null;
  if (/title|designation|position/.test(hint)) return profile.experience?.[expIdx]?.title || null;
  if (/school|university|college|institution/.test(hint)) return profile.education?.[eduIdx]?.institution || null;
  if (/degree|qualification/.test(hint)) return profile.education?.[eduIdx]?.degree || null;
  if (/field.?of.?study|major|discipline|branch|stream/.test(hint)) return profile.education?.[eduIdx]?.field || null;
  if (/overall.?result|gpa|cgpa|grade|percentage/.test(hint)) return profile.education?.[eduIdx]?.gpa || null;
  if (/\bfrom\b|start.?year/.test(hint)) return profile.education?.[eduIdx]?.startYear || null;
  if (/\bto\b|actual.?or.?expected|end.?year|graduation|pass.?out/.test(hint)) return profile.education?.[eduIdx]?.endYear || null;
  if (/cover.?letter|motivation|message/.test(hint)) return profile.coverLetter;
  if (/gender|sex/.test(hint)) return profile.gender;
  if (/veteran/.test(hint)) return profile.veteran;
  if (/disabilit/.test(hint)) return profile.disability;
  if (/skill/.test(hint)) return profile.skills;
  if (/summary|objective|about.?yourself/.test(hint)) return profile.coverLetter;
  return null;
}

// ─── React props fill ─────────────────────────────────────────────────────────
function fillViaReactProps(el, value) {
  for (const key in el) {
    if (!key.startsWith('__reactProps')) continue;
    const props = el[key];
    if (!props) return false;
    el.value = value;
    props.onChange?.({ target: el, currentTarget: el, preventDefault: () => {} });
    props.onBlur?.({ target: el, currentTarget: el });
    return true;
  }
  return false;
}

// ─── Get React internal props from a DOM element ─────────────────────────────
function getReactProps(el) {
  for (const key in el) {
    if (key.startsWith('__reactProps')) return el[key];
  }
  return null;
}

// ─── Textarea fill: set value then fire onBlur only (job_app_filler pattern) ─
// Workday textarea handlers read value on blur, not on change — skipping
// onChange avoids a double-fire that can clear the field in some versions.
function fillTextareaViaBlur(el, value) {
  const props = getReactProps(el);
  if (!props) return false;
  el.value = value;
  props.onBlur?.({ target: el, currentTarget: el, preventDefault: () => {} });
  return true;
}

// ─── Native setter with _valueTracker ────────────────────────────────────────
function fillNative(el, value) {
  const prev = el.value;
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value); else el.value = value;
  if (el._valueTracker) el._valueTracker.setValue(prev);
  el.setAttribute('value', value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function fillField(el, value) {
  if (!value) return false;
  try {
    return fillViaReactProps(el, value) || fillNative(el, value);
  } catch {
    return false;
  }
}

export function fillSelect(el, value) {
  if (!value) return false;
  const match = [...el.options].find(o =>
    o.value.toLowerCase() === value.toLowerCase() ||
    o.text.toLowerCase().includes(value.toLowerCase())
  );
  if (!match) return false;
  el.value = match.value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  for (const key in el) {
    if (key.startsWith('__reactProps')) { el[key]?.onChange?.({ target: el }); break; }
  }
  return true;
}

// ─── Workday: detect current step ────────────────────────────────────────────
function getWorkdayCurrentStep() {
  const activeStep = document.querySelector('[data-automation-id="progressBarActiveStep"]');
  return activeStep?.textContent?.trim().toLowerCase() || 'unknown';
}

// ─── Workday: scan all formField-* containers dynamically ────────────────────
function getAllWorkdayFields() {
  const containers = document.querySelectorAll('[data-automation-id^="formField-"]');
  const fields = [];
  for (const container of containers) {
    const automationId = container.getAttribute('data-automation-id');
    const fieldName = automationId.replace('formField-', '');
    const input = container.querySelector('input, select, textarea');
    const isMultiselect = !!container.querySelector('[data-automation-id="multiselectInputContainer"]');
    const isDropdown = !!container.querySelector(
      '[data-automation-id="multiSelectContainer"], button[data-automation-id], select'
    );
    fields.push({ fieldName, container, input, isMultiselect, isDropdown });
  }
  return fields;
}

// ─── Workday: map formField-* name → profile value ───────────────────────────
function mapFieldToProfile(fieldName, profile, sectionIndex = 0) {
  const f = fieldName.toLowerCase();

  if (/firstname|givenname|legalfirst/.test(f)) return profile.firstName;
  if (/lastname|familyname|legallast/.test(f)) return profile.lastName;
  if (/email/.test(f)) return profile.email;
  if (/phone|mobile/.test(f)) return profile.phone;
  if (/city|town/.test(f)) return profile.city;
  if (/state|province/.test(f)) return profile.state;
  if (/country/.test(f)) return profile.country;
  if (/postal|zip|pincode/.test(f)) return profile.zipCode;
  if (/linkedin/.test(f)) return profile.linkedin;
  if (/github/.test(f)) return profile.github;
  if (/portfolio|website/.test(f)) return profile.portfolio;
  if (/authorized|eligible|legalright/.test(f)) return profile.workAuthorized;
  if (/sponsor|visa/.test(f)) return profile.requiresSponsorship;
  if (/notice/.test(f)) return profile.noticePeriod;
  if (/currentctc|currentsalary|currcomp/.test(f)) return profile.currentCTC;
  if (/expectedctc|expectedsalary|desiredcomp/.test(f)) return profile.expectedCTC;

  const edu = profile.education?.[sectionIndex];
  if (/schoolname|school|university|institution/.test(f)) return edu?.institution;
  if (/degree|qualification/.test(f)) return edu?.degree;
  if (/fieldofstudy|major|field|discipline/.test(f)) return edu?.field;
  if (/gradeaverage|gpa|cgpa|grade|result/.test(f)) return edu?.gpa;
  if (/firstyear|startyear|startdate|fromyear/.test(f)) return edu?.startYear;
  if (/lastyear|endyear|enddate|toyear|gradyear/.test(f)) return edu?.endYear;
  if (/honors|achievement|award/.test(f)) return edu?.honors;

  // For experience, section 0 is currentJob (if employed), then experience[0], [1], ...
  const isCurrentJobSection = sectionIndex === 0 && profile.currentJob?.isEmployed;
  const expOffset = profile.currentJob?.isEmployed ? sectionIndex - 1 : sectionIndex;
  const exp = isCurrentJobSection ? profile.currentJob : profile.experience?.[expOffset];
  if (/jobtitle|title|position|role|designation/.test(f)) return exp?.title;
  if (/companyname|company|employer|organization/.test(f)) return exp?.company;
  if (/joblocation|location/.test(f)) return exp?.location;
  if (/startdate|startmonth|startyear|datefrom/.test(f)) return exp?.startYear;
  if (/enddate|endmonth|endyear|dateto/.test(f)) return exp?.endYear;
  if (/description|summary|duties|responsibilities/.test(f)) return exp?.description;

  if (/skill/.test(f)) return profile.skills;
  if (/coverletter|motivation|message/.test(f)) return profile.coverLetter;
  if (/gender/.test(f)) return profile.gender;
  if (/veteran/.test(f)) return profile.veteran;
  if (/disabilit/.test(f)) return profile.disability;

  return null;
}

// ─── Workday: get all containers with a given formField name ─────────────────
function groupFieldsBySectionIndex(fieldName) {
  return [...document.querySelectorAll(`[data-automation-id="formField-${fieldName}"]`)];
}

// ─── Workday: fill a multiselect/typeahead container ─────────────────────────
async function fillWorkdayMultiselect(container, value) {
  if (!container || !value) return false;
  const input = container.querySelector(
    '[data-automation-id="multiselectInputContainer"] input, input'
  );
  if (!input || !isVisible(input)) return false;

  input.click();
  input.focus();
  await sleep(300);

  fillViaReactProps(input, String(value)) || fillNative(input, String(value));
  await sleep(800);

  const listbox = document.querySelector('ul[role="listbox"], [data-automation-id="promptSelectionLabel"]');
  if (listbox) {
    const options = [...listbox.querySelectorAll('li[role="option"], li, [role="option"]')];
    const val = String(value).toLowerCase();
    const match =
      options.find(o => o.textContent.toLowerCase() === val) ||
      options.find(o => o.textContent.toLowerCase().startsWith(val.slice(0, 6))) ||
      options.find(o => o.textContent.toLowerCase().includes(val.slice(0, 6))) ||
      options.find(o => {
        const t = o.textContent.toLowerCase();
        return val.split('').filter(c => t.includes(c)).length >= Math.min(5, val.length * 0.7);
      }) ||
      options[0];
    if (match) { match.click(); await sleep(300); return true; }
  }
  // No dropdown appeared — leave typed value in place (better than empty)
  return true;
}

// ─── Workday: fill any formField-* container ─────────────────────────────────
// Handles: multiselect typeahead, month+year date, plain input, textarea, select
async function fillWorkdayField(container, value, isMultiselect) {
  if (!container || !value) return false;

  if (isMultiselect) return fillWorkdayMultiselect(container, value);

  // Date container (month+year aria-label pattern from job_app_filler xpaths.ts)
  const monthInput = container.querySelector('input[aria-label="Month"]');
  const yearInput  = container.querySelector('input[aria-label="Year"]');
  if (monthInput || yearInput) {
    // value is expected to be a year; month-only containers also exist
    await fillWorkdayDate(container, null, value);
    return true;
  }

  const input = container.querySelector('input, textarea');
  if (input && isVisible(input)) return fillViaReactProps(input, String(value)) || fillNative(input, String(value));

  const select = container.querySelector('select');
  if (select && isVisible(select)) return fillSelect(select, String(value));

  return false;
}

// ─── Workday: fill with up to 2 retries ──────────────────────────────────────
async function fillWithRetry(container, value, isMultiselect, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ok = await fillWorkdayField(container, value, isMultiselect);
    if (ok) return true;
    if (attempt < maxRetries) await sleep(500);
  }
  return false;
}

// ─── Workday helpers ──────────────────────────────────────────────────────────

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function scrollToCenter(el) {
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function verifyFilled(container, expectedValue) {
  if (!expectedValue) return false;
  const input = container?.querySelector('input, textarea');
  return !!input?.value?.toLowerCase().includes(String(expectedValue).toLowerCase().slice(0, 5));
}

// ─── Workday: find Add button with 4 fallback strategies ─────────────────────
function findAddButton() {
  const allBtns = [...document.querySelectorAll('button')];

  const btn1 = document.querySelector('[data-automation-id="add-button"]');
  if (btn1 && isVisible(btn1)) return btn1;

  const btn2 = allBtns.find(b => /^\s*add\s*$/i.test(b.textContent) && isVisible(b));
  if (btn2) return btn2;

  const btn3 = allBtns.find(b =>
    (b.getAttribute('aria-label') || '').toLowerCase().includes('add') && isVisible(b)
  );
  if (btn3) return btn3;

  const btn4 = allBtns.find(b =>
    (b.textContent.includes('+') || b.innerHTML.includes('plus')) && isVisible(b)
  );
  if (btn4) return btn4;

  return null;
}

// ─── Workday: ensure enough repeating sections exist (polling-based wait) ────
async function ensureWorkdaySections(fieldName, neededCount) {
  console.log('[huntkit] ensureWorkdaySections:', fieldName, 'need', neededCount, 'have', groupFieldsBySectionIndex(fieldName).length);
  for (let i = 0; i < neededCount - 1; i++) {
    const before = groupFieldsBySectionIndex(fieldName).length;
    if (before >= neededCount) break;

    const addBtn = findAddButton();
    if (!addBtn) {
      console.log('[huntkit] Add button not found for', fieldName);
      break;
    }

    console.log('[huntkit] clicking Add button, before count:', before);
    addBtn.click();

    let waited = 0;
    while (waited < 5000) {
      await sleep(300);
      waited += 300;
      if (groupFieldsBySectionIndex(fieldName).length > before) {
        console.log('[huntkit] new section appeared after', waited, 'ms');
        break;
      }
    }

    if (groupFieldsBySectionIndex(fieldName).length <= before) {
      console.log('[huntkit] Add button click failed — section count unchanged');
      break;
    }

    await sleep(500);
  }
}

// ─── Workday: fill separate month + year inputs (aria-label pattern) ─────────
// job_app_filler xpaths.ts: date fields use aria-label='Month' / aria-label='Year'
async function fillWorkdayDate(container, monthValue, yearValue) {
  const monthInput = container.querySelector('input[aria-label="Month"]');
  const yearInput  = container.querySelector('input[aria-label="Year"]');
  if (monthInput && monthValue && isVisible(monthInput)) {
    fillViaReactProps(monthInput, String(monthValue)) || fillNative(monthInput, String(monthValue));
    await sleep(200);
  }
  if (yearInput && yearValue && isVisible(yearInput)) {
    fillViaReactProps(yearInput, String(yearValue)) || fillNative(yearInput, String(yearValue));
    await sleep(200);
  }
}

// ─── Workday: skills typeahead — one skill at a time ─────────────────────────
async function fillWorkdaySkills(profile) {
  const container = document.querySelector('[data-automation-id="formField-skills"]');
  if (!container) return;

  const skillsList = (profile.skills || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  for (const skill of skillsList) {
    try {
      // Re-query input FRESH every iteration — Workday re-renders it after each selection
      const getInput = () => container.querySelector(
        '[data-automation-id="monikerSearchBox"],' +
        '[data-automation-id="multiselectInputContainer"] input,' +
        'input[type="text"]'
      );

      let input = getInput();
      if (!input || !isVisible(input)) continue;

      input.click();
      input.focus();
      await sleep(300);

      // Re-query after click/focus in case Workday re-rendered
      input = getInput();
      if (!input || !document.contains(input)) continue;

      fillViaReactProps(input, skill) || fillNative(input, skill);
      await sleep(1200);

      // Strategy 1: promptOption (job_app_filler selector)
      const promptOptions = document.querySelectorAll('[data-automation-id="promptOption"]');
      if (promptOptions.length > 0) {
        const match = [...promptOptions].find(o =>
          o.textContent.toLowerCase().includes(skill.toLowerCase().slice(0, 8))
        ) || promptOptions[0];
        match.click();
        await sleep(600);
        continue;
      }

      // Strategy 2: ReactVirtualized grid (autofill-jobs selector)
      const rvItems = document.querySelectorAll(
        '.ReactVirtualized__Grid__innerScrollContainer [aria-label]'
      );
      if (rvItems.length > 0) {
        const match = [...rvItems].find(o =>
          (o.getAttribute('aria-label') || '').toLowerCase().includes(skill.toLowerCase().slice(0, 6))
        ) || rvItems[0];
        match.click();
        await sleep(600);
        continue;
      }

      // No dropdown — re-query before escape (element may have changed)
      input = getInput();
      if (input && document.contains(input)) {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      }
      await sleep(300);

    } catch (e) {
      console.warn('[huntkit] skill fill error for', skill, e.message);
    }
  }
}

// ─── Workday: job description textarea or contenteditable ────────────────────
async function fillWorkdayDescription(exp, index) {
  const descContainers = groupFieldsBySectionIndex('jobDescription');
  if (descContainers[index]) {
    const textarea = descContainers[index].querySelector('textarea');
    const richText = descContainers[index].querySelector('[contenteditable="true"], [role="textbox"]');
    if (textarea && isVisible(textarea)) {
      fillTextareaViaBlur(textarea, exp.description) || fillNative(textarea, exp.description);
      return;
    }
    if (richText && isVisible(richText)) {
      richText.focus();
      richText.textContent = exp.description;
      richText.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }
  const allTextareas = [...document.querySelectorAll('textarea')].filter(t => isVisible(t) && !t.value);
  if (allTextareas[index]) {
    fillTextareaViaBlur(allTextareas[index], exp.description) || fillNative(allTextareas[index], exp.description);
    return;
  }
  const editables = [...document.querySelectorAll('[contenteditable="true"]')].filter(e => isVisible(e));
  if (editables[index]) {
    editables[index].focus();
    editables[index].textContent = exp.description;
    editables[index].dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ─── Workday: main page-aware autofill ───────────────────────────────────────
async function autofillWorkday(profile) {
  try {
    const step = getWorkdayCurrentStep();
    console.log('[huntkit] Workday step:', step);
    console.log('[huntkit] formField-* containers found:', getAllWorkdayFields().map(f => f.fieldName));

    const isExpStep  = /experience|background/i.test(step);
    const isEduStep  = /education/i.test(step);
    const isInfoStep = /information|contact|personal/i.test(step) || (!isExpStep && !isEduStep);

    // ── Personal info ──────────────────────────────────────────────────────────
    if (isInfoStep) {
      const PERSONAL_FIELDS = /firstname|givenname|legalfirst|lastname|familyname|legallast|email|phone|mobile|city|town|state|province|country|postal|zip|pincode|linkedin|github|portfolio|authorized|eligible|sponsor|visa|notice|currentctc|expectedctc/i;
      for (const field of getAllWorkdayFields()) {
        if (!PERSONAL_FIELDS.test(field.fieldName)) continue;
        const value = mapFieldToProfile(field.fieldName, profile, 0);
        if (!value) continue;
        const input = field.container.querySelector('input, textarea, select');
        if (!isVisible(input)) continue;
        scrollToCenter(field.container);
        await fillWithRetry(field.container, value, field.isMultiselect);
        await sleep(200);
      }
    }

    // ── Work experience (experience step only) ────────────────────────────────
    if (isExpStep) {
      const allExp = [
        ...(profile.currentJob?.isEmployed ? [profile.currentJob] : []),
        ...(profile.experience || []),
      ].filter(e => e?.company);

      if (allExp.length > 0) {
        await ensureWorkdaySections('jobTitle', allExp.length);
        const titleContainers = groupFieldsBySectionIndex('jobTitle');
        console.log('[huntkit] exp sections after ensure:', titleContainers.length, '/ need:', allExp.length);

        // tryFill re-queries containers each call so indexes stay fresh after DOM updates
        const tryFill = async (fieldName, value, isMultiselect = false) => {
          const containers = groupFieldsBySectionIndex(fieldName);
          const c = containers[i];
          if (!c) { console.log('[huntkit] no container for', fieldName, 'index', i); return false; }
          const input = c.querySelector('input, textarea');
          if (!isVisible(input)) { console.log('[huntkit]', fieldName, i, 'not visible'); return false; }
          scrollToCenter(c);
          const result = await fillWithRetry(c, value, isMultiselect);
          console.log('[huntkit]', fieldName, i, '→', result, String(value ?? '').slice(0, 40));
          await sleep(200);
          return result;
        };

        for (var i = 0; i < Math.min(titleContainers.length, allExp.length); i++) {
          const exp = allExp[i];
          console.log('[huntkit] filling exp', i, exp.title, '|', exp.company);

          await tryFill('jobTitle', exp.title);
          await tryFill('companyName', exp.company);

          const locContainers = groupFieldsBySectionIndex('jobLocation');
          if (locContainers[i] && exp.location) {
            const isRealMultiselect = !!locContainers[i].querySelector('[data-automation-id="multiselectInputContainer"]');
            await tryFill('jobLocation', exp.location, isRealMultiselect);
          }

          const startC = groupFieldsBySectionIndex('startDate')[i];
          if (startC && isVisible(startC.querySelector('input'))) {
            scrollToCenter(startC);
            await fillWorkdayDate(startC, exp.startMonth, exp.startYear);
          }
          const endC = groupFieldsBySectionIndex('endDate')[i];
          if (endC && isVisible(endC.querySelector('input'))) {
            scrollToCenter(endC);
            await fillWorkdayDate(endC, exp.endMonth, exp.endYear);
          }

          if (exp.description) {
            await fillWorkdayDescription(exp, i);
            await sleep(300);
          }

          await sleep(500);
        }
      }

      await fillWorkdaySkills(profile);
    }

    // ── Education (education step only) ───────────────────────────────────────
    if (isEduStep) {
      const eduList = profile.education?.filter(e => e?.institution) || [];
      if (eduList.length > 0) {
        await ensureWorkdaySections('schoolName', eduList.length);
        const schoolContainers = groupFieldsBySectionIndex('schoolName');
        console.log('[huntkit] edu sections after ensure:', schoolContainers.length, '/ need:', eduList.length);

        const isRealMultiselect = (c) => !!c?.querySelector('[data-automation-id="multiselectInputContainer"]');

        const tryFill = async (fieldName, value, isMultiselect = false) => {
          const containers = groupFieldsBySectionIndex(fieldName);
          const c = containers[i];
          if (!c || !value) return false;
          const input = c.querySelector('input, select, textarea');
          if (!isVisible(input)) { console.log('[huntkit]', fieldName, i, 'not visible'); return false; }
          scrollToCenter(c);
          const result = await fillWithRetry(c, value, isMultiselect);
          console.log('[huntkit]', fieldName, i, '→', result, String(value).slice(0, 40));
          if (!verifyFilled(c, value)) {
            console.log('[huntkit] fill unverified for', c.getAttribute('data-automation-id'));
          }
          await sleep(200);
          return result;
        };

        for (var i = 0; i < Math.min(schoolContainers.length, eduList.length); i++) {
          const edu = eduList[i];
          console.log('[huntkit] filling edu', i, edu.institution);

          await tryFill('schoolName', edu.institution, isRealMultiselect(schoolContainers[i]));

          const degreeC = groupFieldsBySectionIndex('degree');
          await tryFill('degree', edu.degree, isRealMultiselect(degreeC[i]));

          const fosC = groupFieldsBySectionIndex('fieldOfStudy');
          await tryFill('fieldOfStudy', edu.field, isRealMultiselect(fosC[i]));

          await tryFill('gradeAverage', edu.gpa ? String(edu.gpa) : null, false);

          const startC = groupFieldsBySectionIndex('firstYearAttended')[i];
          if (startC && isVisible(startC.querySelector('input'))) {
            scrollToCenter(startC);
            await fillWorkdayDate(startC, edu.startMonth, edu.startYear);
          }
          const endC = groupFieldsBySectionIndex('lastYearAttended')[i];
          if (endC && isVisible(endC.querySelector('input'))) {
            scrollToCenter(endC);
            await fillWorkdayDate(endC, edu.endMonth, edu.endYear);
          }

          await sleep(500);
        }
      }

      await fillWorkdaySkills(profile);
    }

  } catch (e) {
    console.error('[huntkit] autofill error:', e);
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function autofillPage(profile) {
  console.log('[huntkit] autofillPage called on:', location.href);
  console.log('[huntkit] profile received:', JSON.stringify(profile).slice(0, 300));

  const isWorkday = /workday|myworkdayjobs/.test(location.hostname);

  if (isWorkday) {
    await autofillWorkday(profile);
    return 1;
  }

  // ── Generic section-aware scan: Greenhouse, Lever, iCIMS, plain forms ───────
  let filled = 0;
  const alreadyFilled = new Set();
  const INPUT_SEL = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=password]), select, textarea';
  const EDU_SEL = [
    '[id*="education"]', '[class*="education-section"]',
    '[class*="education-item"]', '[class*="edu-block"]',
  ].join(', ');
  const EXP_SEL = [
    '[id*="experience"]', '[id*="employment"]',
    '[class*="experience-section"]', '[class*="experience-item"]',
    '[class*="exp-block"]', '[class*="employment"]',
  ].join(', ');

  let lastEduContainer = null, lastExpContainer = null, eduIdx = -1, expIdx = -1;

  for (const el of document.querySelectorAll(INPUT_SEL)) {
    if (el.disabled || el.readOnly) continue;
    const eduContainer = el.closest(EDU_SEL);
    const expContainer = el.closest(EXP_SEL);
    if (eduContainer && eduContainer !== lastEduContainer) { lastEduContainer = eduContainer; eduIdx++; }
    if (expContainer && expContainer !== lastExpContainer) { lastExpContainer = expContainer; expIdx++; }
    const curEduIdx = eduContainer ? eduIdx : 0;
    const curExpIdx = expContainer ? expIdx : 0;
    if (eduContainer && curEduIdx >= (profile.education?.length ?? 0)) continue;
    if (expContainer && curExpIdx >= (profile.experience?.length ?? 0)) continue;
    const hint = getFieldHint(el);
    const value = matchProfile(hint, profile, curEduIdx, curExpIdx);
    if (!value || alreadyFilled.has(el)) continue;
    const ok = el.tagName === 'SELECT' ? fillSelect(el, value) : fillField(el, value);
    if (ok) { alreadyFilled.add(el); filled++; }
  }

  return filled;
}
