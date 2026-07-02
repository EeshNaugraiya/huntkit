import { analyzeJD, rewriteBullets, generateQuestions, generateRoadmap, extractProfileFromResume } from '../ai/index.js';
import { scoreAllPlatforms } from '../ai/ats-profiles.js';
import { saveJob, findDuplicate } from '../storage/tracker.js';
import { getAllResumes, addResume, deleteResume, setDefaultResume } from '../storage/resume.js';

function setBadge(tabId, count) {
  if (!tabId) return;
  if (count === 0) {
    chrome.action.setBadgeText({ text: '', tabId });
  } else {
    chrome.action.setBadgeText({ text: String(count), tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
  }
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    seedDefaultSettings();
  }
});

async function seedDefaultSettings() {
  const existing = await chrome.storage.local.get(['aiProvider']);
  if (!existing.aiProvider) {
    await chrome.storage.local.set({
      aiProvider: import.meta.env.VITE_AI_PROVIDER || 'none',
      anthropicApiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
      qwenApiKey: import.meta.env.VITE_QWEN_API_KEY || '',
    });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ANALYZE_JD') {
    handleAnalyzeJD(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'COMPARE_RESUMES') {
    handleCompareResumes(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'SAVE_JOB') {
    handleSaveJob(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'REWRITE_BULLETS') {
    handleRewriteBullets(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'GENERATE_QUESTIONS') {
    handleGenerateQuestions(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'GENERATE_ROADMAP') {
    handleGenerateRoadmap(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'SCORE_ATS_PLATFORMS') {
    handleScoreATSPlatforms(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'GET_RESUMES') {
    getAllResumes().then((resumes) => sendResponse({ resumes }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'SAVE_RESUME') {
    addResume(message.payload).then((resume) => sendResponse({ resume }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'DELETE_RESUME') {
    deleteResume(message.payload.id).then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'SET_DEFAULT_RESUME') {
    setDefaultResume(message.payload.id).then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'GET_PROFILE') {
    chrome.storage.local.get('userProfile').then(({ userProfile }) => {
      sendResponse({ profile: userProfile || null });
    }).catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'SAVE_PROFILE') {
    chrome.storage.local.set({ userProfile: message.payload.profile }).then(() => {
      sendResponse({ success: true });
    }).catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['aiProvider', 'anthropicApiKey', 'qwenApiKey', 'geminiApiKey', 'openaiApiKey'])
      .then((settings) => sendResponse({ settings }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'SET_BADGE') {
    const tabId = message.payload?.tabId || _sender?.tab?.id;
    setBadge(tabId, message.payload?.count ?? 0);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'OPEN_PROFILE_TAB') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/profile/index.html') });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'IMPORT_PROFILE_FROM_RESUME') {
    handleImportProfileFromResume().then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }
});

async function getSettings() {
  return chrome.storage.local.get([
    'aiProvider', 'anthropicApiKey', 'qwenApiKey', 'geminiApiKey', 'openaiApiKey', 'resumes', 'resumeText',
  ]);
}

function resolveDefaultResumeText(settings) {
  // New multi-resume schema takes precedence; fall back to legacy resumeText
  if (settings.resumes?.length > 0) {
    const def = settings.resumes.find((r) => r.isDefault) || settings.resumes[0];
    return def?.text || '';
  }
  return settings.resumeText || '';
}

async function handleSaveJob(payload) {
  if (!payload.forceSave) {
    const dup = await findDuplicate(payload.title, payload.company);
    if (dup) {
      return {
        duplicate: true,
        existing: { id: dup.id, title: dup.title, company: dup.company, status: dup.status, savedAt: dup.savedAt },
      };
    }
  }
  return saveJob(payload);
}

async function handleRewriteBullets(payload) {
  const settings = await getSettings();
  return rewriteBullets({
    bulletsText: payload.bulletsText,
    jdText: payload.jdText,
    provider: settings.aiProvider,
    anthropicApiKey: settings.anthropicApiKey,
    qwenApiKey: settings.qwenApiKey,
    geminiApiKey: settings.geminiApiKey,
    openaiApiKey: settings.openaiApiKey,
  });
}

async function handleGenerateQuestions(payload) {
  const settings = await getSettings();
  return generateQuestions({
    jdText: payload.jdText,
    resumeText: resolveDefaultResumeText(settings),
    provider: settings.aiProvider,
    anthropicApiKey: settings.anthropicApiKey,
    qwenApiKey: settings.qwenApiKey,
    geminiApiKey: settings.geminiApiKey,
    openaiApiKey: settings.openaiApiKey,
  });
}

async function handleGenerateRoadmap(payload) {
  const settings = await getSettings();
  return generateRoadmap({
    jdText: payload.jdText,
    resumeText: resolveDefaultResumeText(settings),
    provider: settings.aiProvider,
    anthropicApiKey: settings.anthropicApiKey,
    qwenApiKey: settings.qwenApiKey,
    geminiApiKey: settings.geminiApiKey,
    openaiApiKey: settings.openaiApiKey,
  });
}

async function handleImportProfileFromResume() {
  const settings = await getSettings();
  const resumeText = resolveDefaultResumeText(settings);
  if (!resumeText) throw new Error('No resume found. Upload a resume in the Resume tab first.');
  return extractProfileFromResume({
    resumeText,
    provider: settings.aiProvider,
    anthropicApiKey: settings.anthropicApiKey,
    qwenApiKey: settings.qwenApiKey,
    geminiApiKey: settings.geminiApiKey,
    openaiApiKey: settings.openaiApiKey,
  });
}

async function handleScoreATSPlatforms(payload) {
  const settings = await getSettings();
  const resumeText = resolveDefaultResumeText(settings);
  return scoreAllPlatforms(resumeText, payload.jdText);
}

async function handleAnalyzeJD(payload) {
  const settings = await getSettings();
  console.log('[huntkit] provider:', settings.aiProvider);
  console.log('[huntkit] anthropic key length:', settings.anthropicApiKey?.length);
  console.log('[huntkit] anthropic key prefix:', settings.anthropicApiKey?.slice(0, 10));
  const result = await analyzeJD({
    jdText: payload.jdText,
    resumeText: resolveDefaultResumeText(settings),
    provider: settings.aiProvider,
    anthropicApiKey: settings.anthropicApiKey,
    qwenApiKey: settings.qwenApiKey,
    geminiApiKey: settings.geminiApiKey,
    openaiApiKey: settings.openaiApiKey,
  });
  return result;
}

async function handleCompareResumes(payload) {
  const settings = await getSettings();
  const resumes = settings.resumes || [];

  if (resumes.length === 0) {
    return { results: [], recommended: null };
  }

  const results = await Promise.all(
    resumes.map(async (resume) => {
      try {
        const result = await analyzeJD({
          jdText: payload.jdText,
          resumeText: resume.text,
          provider: settings.aiProvider,
          anthropicApiKey: settings.anthropicApiKey,
          qwenApiKey: settings.qwenApiKey,
          geminiApiKey: settings.geminiApiKey,
          openaiApiKey: settings.openaiApiKey,
        });
        return {
          resumeId: resume.id,
          filename: resume.filename,
          matchScore: result.matchScore,
          missingSkills: (result.missingSkills || []).slice(0, 3),
          isDefault: resume.isDefault,
        };
      } catch (err) {
        return {
          resumeId: resume.id,
          filename: resume.filename,
          matchScore: 0,
          missingSkills: [],
          isDefault: resume.isDefault,
          error: err.message,
        };
      }
    })
  );

  const sorted = results.sort((a, b) => b.matchScore - a.matchScore);
  return { results: sorted, recommended: sorted[0]?.filename || null };
}
