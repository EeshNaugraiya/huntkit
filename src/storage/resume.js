const KEY = 'resumes';

// Backward-compatible: returns the default resume as a plain text string.
// Used by ANALYZE_JD and COMPARE_RESUMES in the service worker.
export async function getResume() {
  const all = await getAllResumes();
  const def = all.find((r) => r.isDefault) || all[0];
  return def?.text || '';
}

export async function getAllResumes() {
  const data = await chrome.storage.local.get([KEY]);
  console.log(`[storage] getAllResumes raw:`, data[KEY] === undefined ? 'undefined' : `array(${data[KEY]?.length})`);
  return data[KEY] || [];
}

// Accepts already-extracted text — file parsing happens in the popup via file-parser.js.
// Text is truncated to 8000 chars to stay well within chrome.storage.local per-item limits.
export async function addResume({ filename, text }) {
  const truncated = text.length > 8000 ? text.slice(0, 8000) : text;
  if (text.length > 8000) {
    console.warn(`[storage] Text truncated from ${text.length} to 8000 chars for "${filename}"`);
  }

  const resumes = await getAllResumes();
  const resume = {
    id: `resume_${Date.now()}`,
    filename,
    text: truncated,
    uploadedAt: Date.now(),
    isDefault: resumes.length === 0,
  };
  const payload = { [KEY]: [...resumes, resume] };

  console.log(`[storage] Writing ${payload[KEY].length} resume(s), new entry id=${resume.id}`);
  try {
    await chrome.storage.local.set(payload);
    console.log('[storage] Write succeeded');
  } catch (err) {
    console.error('[storage] Write failed:', err);
    throw err; // re-throw so handleFiles can show the error
  }
  return resume;
}

export async function deleteResume(id) {
  const resumes = await getAllResumes();
  const wasDefault = resumes.find((r) => r.id === id)?.isDefault;
  const remaining = resumes.filter((r) => r.id !== id);
  // Promote first remaining resume to default if the deleted one was default
  if (wasDefault && remaining.length > 0) {
    remaining[0] = { ...remaining[0], isDefault: true };
  }
  await chrome.storage.local.set({ [KEY]: remaining });
}

export async function setDefaultResume(id) {
  const resumes = await getAllResumes();
  await chrome.storage.local.set({
    [KEY]: resumes.map((r) => ({ ...r, isDefault: r.id === id })),
  });
}

export async function clearResume() {
  await chrome.storage.local.remove([KEY]);
}
