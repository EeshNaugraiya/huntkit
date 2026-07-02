// AI-powered form filler — runs in content script context

let _fieldCounter = 0;

function nextId() {
  return `hk-f-${++_fieldCounter}`;
}

function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = window.getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden';
}

function detectPageType() {
  const url = location.href;
  if (/workday|myworkdayjobs/i.test(url)) return 'workday';
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io/i.test(url)) return 'greenhouse';
  if (/jobs\.lever\.co/i.test(url)) return 'lever';
  return 'generic';
}

// ─── Workday field scraper ────────────────────────────────────────────────────

function scrapeWorkday() {
  const fields = [];
  for (const container of document.querySelectorAll('[data-automation-id^="formField-"]')) {
    const automationId = container.getAttribute('data-automation-id');
    const rawName = automationId.replace('formField-', '');

    const legend = container.querySelector('legend');
    const labelEl = container.querySelector('label');
    const label = (legend?.textContent?.trim() || labelEl?.textContent?.trim() || rawName)
      .replace(/\s*\*\s*$/, '').trim();

    const input = container.querySelector('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file])');
    const textarea = container.querySelector('textarea');
    const sel = container.querySelector('select');
    const active = input || textarea || sel;

    if (!active && !container.querySelector('[data-automation-id="multiselectInputContainer"]')) continue;
    if (!isVisible(active || container)) continue;

    let type = 'text';
    if (textarea) type = 'textarea';
    else if (sel) type = 'select';
    else if (input?.type === 'radio') type = 'radio';
    else if (input?.type === 'checkbox') type = 'checkbox';
    else if (container.querySelector('[data-automation-id="multiselectInputContainer"]')) type = 'select';

    const options = [];
    container.querySelectorAll('[role="option"]').forEach(o => {
      const t = o.textContent?.trim(); if (t) options.push(t);
    });
    if (sel) [...sel.options].forEach(o => { if (o.text?.trim()) options.push(o.text.trim()); });

    fields.push({
      fieldId: automationId,
      label,
      type,
      options,
      currentValue: active?.value || '',
      element: active || container,
      _container: container,
      _platform: 'workday',
    });
  }
  return fields;
}

// ─── Greenhouse / Lever scraper (label+input pattern) ────────────────────────

function scrapeGreenhouseLever() {
  const fields = [];
  const seen = new Set();
  const SKIP = /^(hidden|submit|button|file|password|image|reset)$/;

  for (const lbl of document.querySelectorAll('label')) {
    const labelText = lbl.textContent.trim().replace(/\s*\*\s*$/, '').trim();
    if (!labelText) continue;

    let el = null;
    if (lbl.htmlFor) el = document.getElementById(lbl.htmlFor);
    if (!el) el = lbl.querySelector('input, select, textarea');
    if (!el) {
      let sib = lbl.nextElementSibling;
      while (sib && !['INPUT', 'SELECT', 'TEXTAREA'].includes(sib.tagName)) sib = sib.nextElementSibling;
      el = sib;
    }

    if (!el || seen.has(el)) continue;
    if (SKIP.test(el.type || '')) continue;
    if (!isVisible(el)) continue;
    seen.add(el);

    let type = 'text';
    if (el.tagName === 'TEXTAREA') type = 'textarea';
    else if (el.tagName === 'SELECT') type = 'select';
    else if (el.type === 'radio') type = 'radio';
    else if (el.type === 'checkbox') type = 'checkbox';

    const options = [];
    if (el.tagName === 'SELECT') [...el.options].forEach(o => { if (o.text?.trim()) options.push(o.text.trim()); });

    const fieldId = el.id || (() => { const id = nextId(); el.dataset.hkId = id; return id; })();

    fields.push({ fieldId, label: labelText, type, options, currentValue: el.value || '', element: el, _platform: 'standard' });
  }
  return fields;
}

// ─── Generic page scraper ─────────────────────────────────────────────────────

function scrapeGeneric() {
  const fields = [];
  const seen = new Set();
  const SKIP = /^(hidden|submit|button|file|password|image|reset)$/;

  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (SKIP.test(el.type || '')) continue;
    if (el.disabled || el.readOnly) continue;
    if (!isVisible(el)) continue;
    if (seen.has(el)) continue;

    let labelText = '';
    if (el.id) {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      if (lbl) labelText = lbl.textContent.trim();
    }
    if (!labelText) labelText = el.getAttribute('aria-label') || '';
    if (!labelText) {
      const p = el.closest('label');
      if (p) labelText = p.textContent.trim();
    }
    if (!labelText && el.previousElementSibling?.tagName === 'LABEL')
      labelText = el.previousElementSibling.textContent.trim();
    if (!labelText) labelText = el.placeholder || el.name || el.id || '';
    labelText = labelText.replace(/\s*\*\s*$/, '').trim();
    if (!labelText) continue;

    seen.add(el);

    let type = 'text';
    if (el.tagName === 'TEXTAREA') type = 'textarea';
    else if (el.tagName === 'SELECT') type = 'select';
    else if (el.type === 'radio') type = 'radio';
    else if (el.type === 'checkbox') type = 'checkbox';

    const options = [];
    if (el.tagName === 'SELECT') [...el.options].forEach(o => { if (o.text?.trim()) options.push(o.text.trim()); });

    const fieldId = el.id || (() => { const id = nextId(); el.dataset.hkId = id; return id; })();

    fields.push({ fieldId, label: labelText, type, options, currentValue: el.value || '', element: el, _platform: 'generic' });
  }
  return fields;
}

function scrapeFields(pageType) {
  if (pageType === 'workday') return scrapeWorkday();
  if (pageType === 'greenhouse' || pageType === 'lever') return scrapeGreenhouseLever();
  return scrapeGeneric();
}

// ─── LLM prompt ──────────────────────────────────────────────────────────────

function buildPrompt(profile, fields) {
  const fieldsForLLM = fields.map(f => ({
    fieldId: f.fieldId,
    label: f.label,
    type: f.type,
    options: f.options,
    currentValue: f.currentValue,
  }));

  return `You are helping fill a job application form.

User profile:
${JSON.stringify(profile, null, 2)}

Form fields on this page:
${JSON.stringify(fieldsForLLM, null, 2)}

For each field return the best value and confidence level:
- "known": value comes directly from profile data
- "inferred": calculated from profile (e.g. years of experience from work dates, notice period from current job, highest degree from education)
- "guessed": LLM had to guess, no profile basis (e.g. salary expectation, arbitrary questions)

Rules:
- For dropdowns, return EXACTLY one of the provided options strings, or null if none match
- For fields already correctly filled, return existing value with confidence "known"
- Skip file upload fields (type: file), return null
- Return null for fields you cannot answer

Respond ONLY with a JSON array, no markdown:
[
  {
    "fieldId": "...",
    "value": "...",
    "confidence": "known|inferred|guessed",
    "reason": "one line explanation"
  }
]`;
}

// ─── LLM calls ───────────────────────────────────────────────────────────────

async function callClaude(prompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'Respond with raw JSON only. No markdown, no code fences.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

async function callGemini(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Respond with raw JSON only. No markdown, no code fences.' }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4096 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function callLLM(prompt, { provider, anthropicApiKey, geminiApiKey }) {
  if (provider === 'claude' && anthropicApiKey) return callClaude(prompt, anthropicApiKey);
  if (provider === 'gemini' && geminiApiKey) return callGemini(prompt, geminiApiKey);
  throw new Error('No AI provider configured. Set an API key in Settings.');
}

function parseResponse(text) {
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const s = clean.indexOf('[');
  const e = clean.lastIndexOf(']');
  if (s !== -1 && e !== -1) clean = clean.slice(s, e + 1);
  return JSON.parse(clean);
}

// ─── Value injection ──────────────────────────────────────────────────────────

function getReactProps(el) {
  for (const k in el) {
    if (k.startsWith('__reactProps')) return el[k];
  }
  return null;
}

async function injectWorkday(el, value) {
  // Textarea: set value + call onBlur (Workday reads on blur)
  if (el.tagName === 'TEXTAREA') {
    const props = getReactProps(el);
    if (props) {
      el.value = value;
      props.onBlur?.({ target: el, currentTarget: el, preventDefault: () => {} });
      return true;
    }
  }

  // Input: native setter + React synthetic events
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value); else el.value = value;
  if (el._valueTracker) el._valueTracker.setValue('');

  el.dispatchEvent(new Event('input', { bubbles: true }));

  const props = getReactProps(el);
  if (props) {
    props.onChange?.({
      target: el, currentTarget: el, type: 'change',
      bubbles: true, preventDefault: () => {}, stopPropagation: () => {},
    });
    props.onBlur?.({
      target: el, currentTarget: el, type: 'blur',
      relatedTarget: null, bubbles: true, preventDefault: () => {}, stopPropagation: () => {},
    });
  }

  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  return true;
}

async function injectStandard(el, value) {
  if (el.tagName === 'SELECT') {
    const lower = value.toLowerCase();
    const match = [...el.options].find(o =>
      o.value.toLowerCase() === lower ||
      o.text.toLowerCase().includes(lower) ||
      lower.includes(o.text.toLowerCase().trim())
    );
    if (!match) return false;
    el.value = match.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const props = getReactProps(el);
    if (props) props.onChange?.({ target: el });
    return true;
  }

  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

async function injectField(field, value) {
  if (field.type === 'file') return false;
  if (!value) return false;
  try {
    if (field._platform === 'workday') return await injectWorkday(field.element, value);
    return await injectStandard(field.element, value);
  } catch (e) {
    console.warn('[huntkit:ai] inject error', field.label, e.message);
    return false;
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function aiAutofillPage() {
  const pageType = detectPageType();
  console.log('[huntkit:ai] autofill, pageType:', pageType);

  const fields = scrapeFields(pageType);
  console.log('[huntkit:ai] scraped fields:', fields.length, fields.map(f => f.label));

  if (fields.length === 0) return [];

  const stored = await chrome.storage.local.get([
    'userProfile', 'aiProvider', 'anthropicApiKey', 'geminiApiKey',
  ]);

  const profile = stored.userProfile;
  if (!profile) throw new Error('No profile saved. Open Profile Form to add your info.');

  const prompt = buildPrompt(profile, fields);
  const rawText = await callLLM(prompt, {
    provider: stored.aiProvider,
    anthropicApiKey: stored.anthropicApiKey,
    geminiApiKey: stored.geminiApiKey,
  });

  let llmAnswers;
  try {
    llmAnswers = parseResponse(rawText);
  } catch (e) {
    throw new Error('AI returned invalid JSON: ' + e.message);
  }

  const fieldMap = new Map(fields.map(f => [f.fieldId, f]));
  const results = [];

  for (const answer of llmAnswers) {
    const field = fieldMap.get(answer.fieldId);
    if (!field) continue;

    if (!answer.value || field.type === 'file') {
      results.push({
        fieldId: answer.fieldId,
        label: field.label,
        value: answer.value || null,
        confidence: answer.confidence || 'guessed',
        reason: answer.reason || '',
        status: 'skipped',
      });
      continue;
    }

    const ok = await injectField(field, String(answer.value));
    results.push({
      fieldId: answer.fieldId,
      label: field.label,
      value: answer.value,
      confidence: answer.confidence || 'guessed',
      reason: answer.reason || '',
      status: ok ? 'filled' : 'failed',
    });
  }

  await chrome.storage.local.set({ lastAIFillResults: results });

  // Badge: count guessed fields that were filled
  try {
    const guessedCount = results.filter(r => r.confidence === 'guessed' && r.status === 'filled').length;
    chrome.runtime.sendMessage({ type: 'SET_BADGE', payload: { count: guessedCount } });
  } catch (_) {}

  return results;
}
