/**
 * Autofill form fields using resume data stored in chrome.storage.
 * Call fillForm() from a content script to populate visible inputs on the page.
 */
export async function fillForm() {
  const data = await chrome.storage.local.get(['resumeData']);
  const resume = data.resumeData;
  if (!resume) return;

  const fields = detectFields();
  for (const { element, fieldType } of fields) {
    const value = resume[fieldType];
    if (value) setFieldValue(element, value);
  }
}

function detectFields() {
  const inputs = Array.from(document.querySelectorAll('input, textarea'));
  return inputs
    .map((el) => ({ element: el, fieldType: classifyField(el) }))
    .filter((f) => f.fieldType !== null);
}

function classifyField(el) {
  const hints = [el.name, el.id, el.placeholder, el.getAttribute('aria-label')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/first.?name|fname/.test(hints)) return 'firstName';
  if (/last.?name|lname|surname/.test(hints)) return 'lastName';
  if (/email/.test(hints)) return 'email';
  if (/phone|mobile|tel/.test(hints)) return 'phone';
  if (/linkedin/.test(hints)) return 'linkedinUrl';
  if (/github/.test(hints)) return 'githubUrl';
  if (/portfolio|website|url/.test(hints)) return 'websiteUrl';
  if (/city|location/.test(hints)) return 'city';
  if (/cover.?letter|summary|objective/.test(hints)) return 'coverLetter';

  return null;
}

function setFieldValue(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.value = value;
  }
}
