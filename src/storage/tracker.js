const KEY = 'trackedJobs';

export async function getJobs() {
  const data = await chrome.storage.local.get([KEY]);
  return data[KEY] || [];
}

export async function saveJob(jobData) {
  const jobs = await getJobs();
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newJob = { id, status: 'interested', savedAt: Date.now(), ...jobData };
  await chrome.storage.local.set({ [KEY]: [newJob, ...jobs] });
  return newJob;
}

export async function updateJobStatus(id, status) {
  const jobs = await getJobs();
  const updated = jobs.map((j) => j.id === id ? { ...j, status, updatedAt: Date.now() } : j);
  await chrome.storage.local.set({ [KEY]: updated });
}

export async function deleteJob(id) {
  const jobs = await getJobs();
  await chrome.storage.local.set({ [KEY]: jobs.filter((j) => j.id !== id) });
}

export async function clearJobs() {
  await chrome.storage.local.remove([KEY]);
}

export async function findDuplicate(title, company) {
  const jobs = await getJobs();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const t = (title || '').toLowerCase().trim();
  const c = (company || '').toLowerCase().trim();
  return jobs.find(
    (j) =>
      (j.title || '').toLowerCase().trim() === t &&
      (j.company || '').toLowerCase().trim() === c &&
      now - j.savedAt < thirtyDays
  ) || null;
}
