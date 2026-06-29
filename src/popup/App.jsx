import { useEffect, useState } from 'react';

const TABS = ['Resume', 'Profile', 'Settings'];

// Routes storage reads/writes through the background service worker.
function sendMsg(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response ?? {});
    });
  });
}

export default function App() {
  const [tab, setTab] = useState('Settings');
  const [settings, setSettings] = useState({ aiProvider: 'none', anthropicApiKey: '', qwenApiKey: '', geminiApiKey: '', openaiApiKey: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['aiProvider', 'anthropicApiKey', 'qwenApiKey', 'geminiApiKey', 'openaiApiKey'], (data) => {
      setSettings({
        aiProvider: data.aiProvider || 'none',
        anthropicApiKey: data.anthropicApiKey || '',
        qwenApiKey: data.qwenApiKey || '',
        geminiApiKey: data.geminiApiKey || '',
        openaiApiKey: data.openaiApiKey || '',
      });
    });
  }, []);

  function saveSettings() {
    console.log('[settings] saving provider:', settings.aiProvider);
    console.log('[settings] saving anthropic key length:', settings.anthropicApiKey?.length);
    chrome.storage.local.set(settings, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div style={{ width: 360, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>🎯</span>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#a78bfa' }}>HuntKit</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #27272a' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'none',
              border: 'none',
              color: tab === t ? '#a78bfa' : '#71717a',
              fontWeight: tab === t ? 700 : 400,
              cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #a78bfa' : '2px solid transparent',
              fontSize: 13,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
        {tab === 'Resume' && <ResumePanel />}
        {tab === 'Profile' && <ProfilePanel />}
        {tab === 'Settings' && <SettingsPanel settings={settings} onChange={setSettings} />}
      </div>

      {/* Footer — only shown on Settings tab */}
      {tab === 'Settings' && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid #27272a' }}>
          <button
            onClick={saveSettings}
            style={{
              width: '100%',
              padding: '10px',
              background: saved ? '#22c55e' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

function SettingsPanel({ settings, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <label style={labelStyle}>
        AI Provider
        <select
          value={settings.aiProvider}
          onChange={(e) => onChange({ ...settings, aiProvider: e.target.value })}
          style={inputStyle}
        >
          <option value="none">None (keyword fallback)</option>
          <option value="claude">Claude (Anthropic)</option>
          <option value="gemini">Gemini (Google)</option>
          <option value="openai">OpenAI</option>
          <option value="qwen">Qwen (Alibaba)</option>
        </select>
      </label>

      {settings.aiProvider === 'claude' && (
        <label style={labelStyle}>
          Anthropic API Key
          <input
            type="password"
            value={settings.anthropicApiKey}
            onChange={(e) => onChange({ ...settings, anthropicApiKey: e.target.value })}
            placeholder="sk-ant-…"
            style={inputStyle}
          />
        </label>
      )}

      {settings.aiProvider === 'gemini' && (
        <label style={labelStyle}>
          Google AI API Key
          <input
            type="password"
            value={settings.geminiApiKey}
            onChange={(e) => onChange({ ...settings, geminiApiKey: e.target.value })}
            placeholder="AIza…"
            style={inputStyle}
          />
        </label>
      )}

      {settings.aiProvider === 'openai' && (
        <label style={labelStyle}>
          OpenAI API Key
          <input
            type="password"
            value={settings.openaiApiKey}
            onChange={(e) => onChange({ ...settings, openaiApiKey: e.target.value })}
            placeholder="sk-…"
            style={inputStyle}
          />
        </label>
      )}

      {settings.aiProvider === 'qwen' && (
        <label style={labelStyle}>
          Qwen API Key
          <input
            type="password"
            value={settings.qwenApiKey}
            onChange={(e) => onChange({ ...settings, qwenApiKey: e.target.value })}
            placeholder="sk-…"
            style={inputStyle}
          />
        </label>
      )}

      <p style={{ color: '#71717a', fontSize: 12, lineHeight: 1.5 }}>
        API keys are stored locally and never sent anywhere except the chosen AI provider endpoint.
      </p>
    </div>
  );
}

// ─── Resume Panel ─────────────────────────────────────────────────────────────
// Upload lives in the dedicated full-tab Resume Manager (src/resume/).
// This panel shows the current list and lets the user open that tab.

function ResumePanel() {
  const [resumes, setResumes] = useState([]);

  useEffect(() => {
    loadResumes();
    const listener = (changes) => { if (changes.resumes) loadResumes(); };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function loadResumes() {
    try {
      const { resumes: all } = await sendMsg('GET_RESUMES');
      const list = Array.isArray(all) ? all : [];
      console.log(`loadResumes result: ${list.length} resumes found`);
      setResumes(list);
    } catch (err) {
      console.error('loadResumes failed:', err);
    }
  }

  async function handleDelete(id) {
    await sendMsg('DELETE_RESUME', { id });
    await loadResumes();
  }

  async function handleSetDefault(id) {
    await sendMsg('SET_DEFAULT_RESUME', { id });
    await loadResumes();
  }

  function openResumeManager() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/resume/index.html') });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        onClick={openResumeManager}
        style={{
          padding: '10px 16px',
          background: '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
        }}
      >
        <span>📂</span> Open Resume Manager
      </button>

      {resumes.length === 0 ? (
        <p style={{ color: '#52525b', fontSize: 12, textAlign: 'center', paddingTop: 8 }}>
          No resumes yet. Open the manager to upload.
        </p>
      ) : (
        resumes.map((r) => (
          <ResumeCard
            key={r.id}
            resume={r}
            onDelete={() => handleDelete(r.id)}
            onSetDefault={() => handleSetDefault(r.id)}
          />
        ))
      )}
    </div>
  );
}

function ResumeCard({ resume, onDelete, onSetDefault }) {
  const icon = resume.filename.toLowerCase().endsWith('.pdf') ? '📄' : '📝';
  const preview = resume.text?.slice(0, 300).replace(/\s+/g, ' ') || '';

  return (
    <div style={{
      background: resume.isDefault ? '#1a1a2e' : '#18181b',
      border: `1px solid ${resume.isDefault ? '#4338ca' : '#27272a'}`,
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
          <span style={{
            fontSize: 13, fontWeight: 600, color: '#f4f4f5',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={resume.filename}>
            {resume.filename}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {resume.isDefault && (
            <span style={{
              background: '#312e81', color: '#a5b4fc',
              padding: '2px 8px', borderRadius: 10,
              fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
            }}>Default</span>
          )}
          <button onClick={onDelete} title="Remove" style={{
            background: 'none', border: 'none', color: '#71717a',
            cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: '0 2px',
          }}>×</button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#52525b' }}>
        Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
      </div>

      {preview && (
        <div style={{
          fontSize: 11, color: '#71717a', lineHeight: 1.5,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>
          {preview}
        </div>
      )}

      {!resume.isDefault && (
        <button onClick={onSetDefault} style={{
          padding: '5px 0', background: 'none',
          border: '1px solid #3f3f46', borderRadius: 6,
          color: '#a1a1aa', cursor: 'pointer', fontSize: 12, marginTop: 2,
        }}>
          Set as Default
        </button>
      )}
    </div>
  );
}

// ─── Profile Panel ────────────────────────────────────────────────────────────

function ProfilePanel() {
  const [profile, setProfile] = useState(null);
  const [autofillStatus, setAutofillStatus] = useState('');

  useEffect(() => {
    loadProfile();
    const listener = (changes) => { if (changes.userProfile) loadProfile(); };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function loadProfile() {
    try {
      const { profile: p } = await sendMsg('GET_PROFILE');
      setProfile(p);
    } catch (err) {
      console.error('loadProfile failed:', err);
    }
  }

  function openProfileForm() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/profile/index.html') });
  }

  async function handleAutofill() {
    setAutofillStatus('');
    try {
      const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
      const tab = tabs[0];
      const { profile: p } = await sendMsg('GET_PROFILE');
      if (!p || !p.firstName) {
        setAutofillStatus('Complete your profile first');
        return;
      }
      function showResult(filled) {
        setAutofillStatus(filled > 0 ? `✓ Filled ${filled} fields` : 'No fields matched');
      }
      chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', payload: { profile: p } }, async (response) => {
        if (chrome.runtime.lastError) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content/generic.js'],
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL', payload: { profile: p } }, (res) => {
                if (chrome.runtime.lastError) {
                  setAutofillStatus('Cannot autofill this page');
                  return;
                }
                showResult(res?.filled || 0);
              });
            }, 500);
          } catch (_injectErr) {
            setAutofillStatus('Cannot autofill this page');
          }
          return;
        }
        showResult(response?.filled || 0);
      });
    } catch (err) {
      setAutofillStatus('Error: ' + err.message);
    }
  }

  const hasProfile = profile && (profile.firstName || profile.email);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        padding: '10px 14px',
        background: hasProfile ? '#0d1f0d' : '#18181b',
        border: `1px solid ${hasProfile ? '#16a34a' : '#27272a'}`,
        borderRadius: 8,
        fontSize: 13,
        color: hasProfile ? '#86efac' : '#52525b',
        lineHeight: 1.4,
      }}>
        {hasProfile
          ? `✓ Profile saved — ${profile.firstName}${profile.email ? ` · ${profile.email}` : ''}`
          : 'No profile saved yet'
        }
      </div>

      <button onClick={openProfileForm} style={{
        padding: '10px 16px', background: '#6366f1', color: 'white',
        border: 'none', borderRadius: 8, cursor: 'pointer',
        fontWeight: 600, fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      }}>
        <span>📝</span> Open Profile Form
      </button>

      <button onClick={handleAutofill} style={{
        padding: '10px 16px', background: '#18181b', color: '#a78bfa',
        border: '1px solid #4338ca', borderRadius: 8, cursor: 'pointer',
        fontWeight: 600, fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      }}>
        🤖 Autofill Current Page
      </button>

      {autofillStatus && (
        <p style={{
          fontSize: 12, textAlign: 'center', padding: '2px 0',
          color: autofillStatus.startsWith('✓') ? '#86efac' : '#fbbf24',
        }}>
          {autofillStatus}
        </p>
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: '#d4d4d8',
  fontWeight: 500,
};

const inputStyle = {
  padding: '8px 12px',
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  color: '#f4f4f5',
  fontSize: 13,
  outline: 'none',
  width: '100%',
};
