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
async function fillViaReactProps(el, value) {
  for (const key in el) {
    if (!key.startsWith('__reactProps')) continue;
    const props = el[key];
    if (!props) return false;

    // Set DOM value via native setter so el.value reflects it when React reads target.value
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;

    if (el._valueTracker) el._valueTracker.setValue('');

    el.dispatchEvent(new Event('input', { bubbles: true }));

    // Call onChange if it exists (some fields have it)
    props.onChange?.({
      target: el,
      currentTarget: el,
      type: 'change',
      bubbles: true,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    // CRITICAL: ALWAYS call onBlur — confirmed commit mechanism for Workday text
    // fields even when onChange exists. relatedTarget:null matches a real blur event.
    props.onBlur?.({
      target: el,
      currentTarget: el,
      type: 'blur',
      relatedTarget: null,
      bubbles: true,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    // Give React time to process the blur and flush validation state
    await new Promise(r => setTimeout(r, 150));

    // Retry onBlur once if aria-invalid persists despite value being set
    if (el.getAttribute('aria-invalid') === 'true') {
      console.warn('[huntkit] field still invalid after fill, retrying onBlur');
      for (const k in el) {
        if (k.startsWith('__reactProps')) {
          el[k].onBlur?.({
            target: el, currentTarget: el, type: 'blur',
            relatedTarget: null, bubbles: true,
            preventDefault: () => {}, stopPropagation: () => {},
          });
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    return true;
  }
  return false;
}

// ─── Verify React internal state actually updated (blur/refocus check) ────────
async function verifyReactState(el) {
  const valueBefore = el.value;
  el.blur();
  await sleep(100);
  el.focus();
  await sleep(100);
  const valueAfter = el.value;
  if (valueBefore !== valueAfter) {
    console.warn('[huntkit] STATE DESYNC detected:', 'before:', valueBefore, 'after:', valueAfter);
    return false;
  }
  return true;
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

export async function fillField(el, value) {
  if (!value) return false;
  try {
    return (await fillViaReactProps(el, value)) || fillNative(el, value);
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

  (await fillViaReactProps(input, String(value))) || fillNative(input, String(value));
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
  if (input && isVisible(input)) return (await fillViaReactProps(input, String(value))) || fillNative(input, String(value));

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



// ─── Workday: find Add button for a specific section by heading context ───────
// On "My Experience" there are 4 add-buttons (Work Experience, Education,
// Languages, Websites). Walk up the DOM to find the nearest heading and match
// the requested section name so we click the RIGHT one.
function findAddButtonForSection(sectionName) {
  const addButtons = Array.from(
    document.querySelectorAll('[data-automation-id="add-button"]')
  );

  for (const btn of addButtons) {
    if (!isVisible(btn)) continue;

    let parent = btn.parentElement;
    let context = '';
    for (let j = 0; j < 8 && parent; j++) {
      const heading = parent.querySelector(
        'h1, h2, h3, h4, legend, [data-automation-id*="Section"]'
      );
      if (heading) {
        context = heading.textContent.trim().toLowerCase();
        break;
      }
      parent = parent.parentElement;
    }

    if (context.includes(sectionName.toLowerCase())) {
      return btn;
    }
  }

  return null;
}

// ─── Workday: ensure enough repeating sections exist (polling-based wait) ────
async function ensureWorkdaySections(fieldName, neededCount) {
  const sectionMap = {
    'jobTitle': 'work experience',
    'schoolName': 'education',
  };
  const sectionName = sectionMap[fieldName] || fieldName;

  let current = groupFieldsBySectionIndex(fieldName).length;

  while (current < neededCount) {
    console.log('[huntkit] ensuring section', current + 1, 'for', fieldName);
    const addBtn = findAddButtonForSection(sectionName);
    if (!addBtn) {
      console.warn('[huntkit] No add button found for section:', sectionName);
      break;
    }

    console.log('[huntkit] clicking Add for', sectionName, '- current count:', current);
    addBtn.click();

    let waited = 0;
    let newCount = current;
    while (waited < 5000) {
      await sleep(300);
      waited += 300;
      newCount = groupFieldsBySectionIndex(fieldName).length;
      if (newCount > current) {
        console.log('[huntkit] new', sectionName, 'section appeared after', waited, 'ms');
        break;
      }
    }

    if (newCount <= current) {
      console.warn('[huntkit] Add click had no effect for', sectionName);
      break;
    }

    current = newCount;
    await sleep(500);
  }
}

// ─── Workday: fill separate month + year inputs (aria-label pattern) ─────────
// job_app_filler xpaths.ts: date fields use aria-label='Month' / aria-label='Year'
async function fillWorkdayDate(container, monthValue, yearValue) {
  const monthInput = container.querySelector('input[aria-label="Month"]');
  const yearInput  = container.querySelector('input[aria-label="Year"]');
  if (monthInput && monthValue && isVisible(monthInput)) {
    (await fillViaReactProps(monthInput, String(monthValue))) || fillNative(monthInput, String(monthValue));
    await sleep(200);
  }
  if (yearInput && yearValue && isVisible(yearInput)) {
    (await fillViaReactProps(yearInput, String(yearValue))) || fillNative(yearInput, String(yearValue));
    await sleep(200);
  }
}

// ─── Workday: skills typeahead — one skill at a time ─────────────────────────
// Confirmed DOM: activeListContainer listbox → role="option" items with
// data-automation-id="checkbox" wrapper div that toggles the inner checkbox.
// Confirmed fix: full keydown+keypress+keyup sequence (with code/keyCode/which/
// cancelable) is required to trigger the Workday search handler.
async function fillWorkdaySkills(profile) {
  const container = document.querySelector(
    '[data-automation-id="formField-skills"]'
  );
  if (!container) return;

  const skillsList = (profile.skills || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;

  const enterProps = {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
    bubbles: true, cancelable: true,
  };

  for (const skill of skillsList) {
    try {
      const input = container.querySelector('input');
      if (!input || !document.contains(input)) continue;

      input.focus();
      input.click();
      await sleep(200);

      // Set full value at once and notify React
      setter.call(input, skill);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      for (const key in input) {
        if (key.startsWith('__reactProps')) {
          input[key].onChange?.({ target: input, currentTarget: input });
        }
      }
      await sleep(300);

      // Full Enter sequence confirmed to trigger Workday search
      input.dispatchEvent(new KeyboardEvent('keydown', enterProps));
      input.dispatchEvent(new KeyboardEvent('keypress', enterProps));
      input.dispatchEvent(new KeyboardEvent('keyup', enterProps));

      // Confirmed: ~15 options appear after ~1.5s
      await sleep(1500);

      const listbox = document.querySelector(
        '[data-automation-id="activeListContainer"]'
      );
      if (!listbox) {
        console.warn('[huntkit] no listbox for skill:', skill);
        continue;
      }

      const options = listbox.querySelectorAll('[role="option"]');
      console.log('[huntkit] skill options found:', options.length, 'for', skill);

      const searchVal = skill.toLowerCase();
      const match = [...options].find(o =>
        (o.id || '').toLowerCase().includes(searchVal) ||
        (o.getAttribute('aria-label') || '').toLowerCase().includes(searchVal)
      ) || options[0];

      if (match) {
        const checkboxDiv = match.querySelector('[data-automation-id="checkbox"]');
        if (checkboxDiv) {
          checkboxDiv.click();
        } else {
          match.click();
        }
        await sleep(500);

        // Confirm selection with same full Enter sequence
        input.dispatchEvent(new KeyboardEvent('keydown', enterProps));
        input.dispatchEvent(new KeyboardEvent('keypress', enterProps));
        input.dispatchEvent(new KeyboardEvent('keyup', enterProps));
        await sleep(500);

        const freshInput = container.querySelector('input');
        if (freshInput && document.contains(freshInput)) {
          freshInput.click();
          freshInput.focus();
          await sleep(300);
        }
      } else {
        console.warn('[huntkit] no match for skill:', skill);
      }

      // Clear for next skill
      const freshInput2 = container.querySelector('input');
      if (freshInput2 && document.contains(freshInput2)) {
        setter.call(freshInput2, '');
        freshInput2.dispatchEvent(new Event('input', { bubbles: true }));
      }

      await sleep(400);

    } catch (e) {
      console.warn('[huntkit] skill fill error for', skill, e.message);
      continue;
    }
  }
}

// ─── Workday: job description textarea or contenteditable ────────────────────
// Tries roleDescription first (confirmed Workday field name), then jobDescription.
async function fillWorkdayDescription(exp, index) {
  for (const fieldName of ['roleDescription', 'jobDescription']) {
    const containers = groupFieldsBySectionIndex(fieldName);
    console.log('[huntkit] fillWorkdayDescription index', index, 'fieldName', fieldName, 'containers:', containers.length);
    if (containers[index]) {
      const textarea = containers[index].querySelector('textarea');
      const richText = containers[index].querySelector('[contenteditable="true"], [role="textbox"]');
      console.log('[huntkit] EXP', index, fieldName, '— textarea:', !!textarea, 'contenteditable:', !!richText);
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

// ─── Workday: final validation sweep — re-fires onBlur on any aria-invalid fields ─
async function finalValidationSweep() {
  await sleep(500);

  const invalidFields = document.querySelectorAll('[aria-invalid="true"]');
  console.log('[huntkit] final sweep — invalid fields found:', invalidFields.length);

  for (const field of invalidFields) {
    const value = field.value;
    if (!value) continue;

    console.log('[huntkit] re-fixing invalid field:', field.id, 'value:', value);

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;

    setter.call(field, field.value + ' ');

    field.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ', code: 'Space', keyCode: 32, which: 32,
      bubbles: true, cancelable: true,
    }));
    field.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertText', data: ' ',
    }));
    field.dispatchEvent(new KeyboardEvent('keyup', {
      key: ' ', code: 'Space', keyCode: 32, which: 32,
      bubbles: true, cancelable: true,
    }));

    await sleep(300);
  }

  await sleep(500);
  const stillInvalid = document.querySelectorAll('[aria-invalid="true"]');
  console.log('[huntkit] after re-fix sweep, still invalid:', stillInvalid.length);
  stillInvalid.forEach(f => console.log(' -', f.id, f.value));
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

      for (let i = 0; i < allExp.length; i++) {
        const exp = allExp[i];

        console.log('[huntkit] ensuring section', i, 'for jobTitle');
        await ensureWorkdaySections('jobTitle', i + 1);

        const titleContainers = groupFieldsBySectionIndex('jobTitle');
        if (!titleContainers[i]) {
          console.warn('[huntkit] experience section', i, 'still missing after add');
          continue;
        }

        console.log('[huntkit] section', i, 'ready, filling fields for exp:', exp.title, '|', exp.company);

        const tryFill = async (fieldName, value, isMultiselect = false) => {
          const containers = groupFieldsBySectionIndex(fieldName);
          const c = containers[i];
          if (!c) { console.log('[huntkit] no container for', fieldName, 'index', i); return false; }
          const input = c.querySelector('input, textarea');
          if (!isVisible(input)) { console.log('[huntkit]', fieldName, i, 'not visible'); return false; }
          scrollToCenter(c);
          const result = await fillWithRetry(c, value, isMultiselect);
          console.log('[huntkit] section', i, 'field', fieldName, 'filled:', result);
          if (result && input) await verifyReactState(input);
          await sleep(200);
          return result;
        };

        // ── jobTitle diagnostic block ──────────────────────────────────────────
        {
          const titleInput = titleContainers[i].querySelector('input');
          console.log('[huntkit] BEFORE fill - jobTitle', i, 'value:', titleInput?.value);

          const fillResult = await fillWorkdayField(titleContainers[i], exp.title, false);
          console.log('[huntkit] fillWorkdayField result:', fillResult);

          await sleep(300);

          // Re-query to detect if React replaced the DOM node after our fill
          const freshTitleContainers = groupFieldsBySectionIndex('jobTitle');
          const freshInput = freshTitleContainers[i]?.querySelector('input');
          console.log('[huntkit] AFTER fill - jobTitle', i, 'value:', freshInput?.value);
          console.log('[huntkit] same element?', titleInput === freshInput);

          // Wait for validation to settle then check for error indicators
          await sleep(500);
          const reFreshContainers = groupFieldsBySectionIndex('jobTitle');
          const errorEl = reFreshContainers[i]?.querySelector(
            '[class*="error"], [role="alert"], [data-automation-id*="error"]'
          );
          console.log('[huntkit] jobTitle', i, 'error present:', errorEl?.textContent || 'NONE');

          // Also snapshot all jobTitle values across ALL sections to detect cross-section resets
          const allTitleInputs = groupFieldsBySectionIndex('jobTitle').map(c => c.querySelector('input')?.value);
          console.log('[huntkit] ALL jobTitle values after fill', i, ':', allTitleInputs);
        }

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
          console.log('[huntkit] section', i, 'field startDate filled');
        }
        const endC = groupFieldsBySectionIndex('endDate')[i];
        if (endC && isVisible(endC.querySelector('input'))) {
          scrollToCenter(endC);
          await fillWorkdayDate(endC, exp.endMonth, exp.endYear);
          console.log('[huntkit] section', i, 'field endDate filled');
        }

        if (exp.description) {
          const allJobTitleCs = groupFieldsBySectionIndex('jobTitle');
          const allRoleDescCs = groupFieldsBySectionIndex('roleDescription');
          const allJobDescCs  = groupFieldsBySectionIndex('jobDescription');
          console.log('[huntkit] EXP', i, 'jobTitle containers:', allJobTitleCs.length);
          console.log('[huntkit] EXP', i, 'roleDescription containers:', allRoleDescCs.length, '| jobDescription:', allJobDescCs.length);
          console.log('[huntkit] EXP', i, 'counts equal (title vs roleDesc)?', allJobTitleCs.length === allRoleDescCs.length);
          await fillWorkdayDescription(exp, i);
          console.log('[huntkit] EXP', i, 'description fill done');
          await sleep(300);
        }

        await sleep(500);
      }

      await fillWorkdaySkills(profile);
    }

    // ── Education (runs on its own step OR alongside experience on "My Experience" page) ─
    // Confirmed: Workday shows Education Add button on the same "My Experience" page
    // as Work Experience, so isExpStep must also trigger the education loop.
    console.log('[huntkit] checking EDU loop — step:', step, '| isExpStep:', isExpStep, '| isEduStep:', isEduStep);
    if (isEduStep || isExpStep) {
      console.log('[huntkit] EDU LOOP start, profile.education:', JSON.stringify(profile.education));
      const isRealMultiselect = (c) => !!c?.querySelector('[data-automation-id="multiselectInputContainer"]');

      for (let i = 0; i < (profile.education?.length || 0); i++) {
        const edu = profile.education[i];
        console.log('[huntkit] EDU', i, 'data:', edu);
        if (!edu?.institution) {
          console.log('[huntkit] EDU', i, 'skipped - no institution');
          continue;
        }

        console.log('[huntkit] EDU', i, 'ensuring section exists');
        await ensureWorkdaySections('schoolName', i + 1);

        const schoolContainers = groupFieldsBySectionIndex('schoolName');
        console.log('[huntkit] EDU', i, 'schoolContainers.length:', schoolContainers.length);
        if (!schoolContainers[i]) {
          console.warn('[huntkit] EDU', i, 'container still missing after ensure');
          continue;
        }

        console.log('[huntkit] EDU', i, 'ready, filling fields for:', edu.institution);

        const r0 = await fillWorkdayField(schoolContainers[i], edu.institution, isRealMultiselect(schoolContainers[i]));
        console.log('[huntkit] EDU', i, 'field schoolName filled:', r0);
        await sleep(300);

        const degreeContainers = groupFieldsBySectionIndex('degree');
        console.log('[huntkit] degree container HTML:', degreeContainers[0]?.outerHTML?.slice(0, 500));
        if (degreeContainers[i]) {
          const r1 = await fillWorkdayField(degreeContainers[i], edu.degree, isRealMultiselect(degreeContainers[i]));
          console.log('[huntkit] EDU', i, 'field degree filled:', r1);
          await sleep(300);
        }

        const fosContainers = groupFieldsBySectionIndex('fieldOfStudy');
        if (fosContainers[i]) {
          const r2 = await fillWorkdayField(fosContainers[i], edu.field, isRealMultiselect(fosContainers[i]));
          console.log('[huntkit] EDU', i, 'field fieldOfStudy filled:', r2);
          await sleep(300);
        }

        const gpaContainers = groupFieldsBySectionIndex('gradeAverage');
        if (gpaContainers[i] && edu.gpa) {
          const r3 = await fillWorkdayField(gpaContainers[i], String(edu.gpa), false);
          console.log('[huntkit] EDU', i, 'field gradeAverage filled:', r3);
          await sleep(200);
        }

        const startContainers = groupFieldsBySectionIndex('firstYearAttended');
        if (startContainers[i]) {
          await fillWorkdayDate(startContainers[i], edu.startMonth, edu.startYear);
          console.log('[huntkit] EDU', i, 'field firstYearAttended filled');
          await sleep(200);
        }

        const endContainers = groupFieldsBySectionIndex('lastYearAttended');
        if (endContainers[i]) {
          await fillWorkdayDate(endContainers[i], edu.endMonth, edu.endYear);
          console.log('[huntkit] EDU', i, 'field lastYearAttended filled');
          await sleep(200);
        }

        await sleep(500);
      }

      // Skills already called at end of isExpStep block when on the experience page
      if (!isExpStep) {
        await fillWorkdaySkills(profile);
      }
    }

    await finalValidationSweep();

    // Force any pending blur validation to fire for the last-filled field
    document.body.click();
    await sleep(300);

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
    const ok = el.tagName === 'SELECT' ? fillSelect(el, value) : await fillField(el, value);
    if (ok) { alreadyFilled.add(el); filled++; }
  }

  return filled;
}
