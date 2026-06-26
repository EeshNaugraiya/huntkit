import { useEffect, useRef, useState } from 'react';
import { extractTextFromFile } from '../utils/file-parser.js';

const MAX_RESUMES = 5;

// All storage ops go through the background service worker.
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

export default function ResumePage() {
  const [resumes, setResumes] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    loadResumes();
    // Refresh when another extension page (e.g. popup) mutates storage
    const listener = (changes) => {
      if (changes.resumes) loadResumes();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
      clearTimeout(toastTimer.current);
    };
  }, []);

  async function loadResumes() {
    try {
      const { resumes: all } = await sendMsg('GET_RESUMES');
      const list = Array.isArray(all) ? all : [];
      setResumes(list);
      console.log(`loadResumes result: ${list.length} resumes found`);
    } catch (err) {
      console.error('loadResumes failed:', err);
    }
  }

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function handleFiles(files) {
    const validFiles = Array.from(files).filter((f) => /\.(pdf|docx)$/i.test(f.name));
    const invalidCount = files.length - validFiles.length;
    setError(null);

    if (invalidCount > 0) {
      setError(`${invalidCount} file(s) skipped — only .pdf and .docx accepted`);
    }
    if (validFiles.length === 0) return;

    if (resumes.length + validFiles.length > MAX_RESUMES) {
      setError(`Maximum ${MAX_RESUMES} resumes allowed. Delete one first.`);
      return;
    }

    for (const file of validFiles) {
      setCurrentFile(file.name);
      setExtracting(true);
      setError(null);

      try {
        const text = await extractTextFromFile(file);
        const { resume } = await sendMsg('SAVE_RESUME', { filename: file.name, text });
        console.log('Saved to storage via service worker, id:', resume?.id);

        const verify = await sendMsg('GET_RESUMES');
        console.log('Storage after save:', verify.resumes?.length, 'resumes');

        await loadResumes();
        showToast(`✓ ${file.name} uploaded successfully`);
      } catch (err) {
        console.error(`Upload failed for ${file.name}:`, err);
        setError(`Failed to process "${file.name}": ${err.message}`);
      } finally {
        setExtracting(false);
        setCurrentFile(null);
      }
    }
  }

  function onDragOver(e) {
    e.preventDefault();
    if (!extracting) setDragging(true);
  }
  function onDragLeave() { setDragging(false); }
  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (!extracting) handleFiles(e.dataTransfer.files);
  }
  function onFileInput(e) {
    if (!extracting) handleFiles(e.target.files);
    e.target.value = '';
  }

  async function handleDelete(id) {
    await sendMsg('DELETE_RESUME', { id });
    await loadResumes();
  }

  async function handleSetDefault(id) {
    await sendMsg('SET_DEFAULT_RESUME', { id });
    await loadResumes();
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <span style={{ fontSize: 26 }}>🎯</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#a78bfa' }}>HuntKit</div>
          <div style={{ fontSize: 13, color: '#71717a', marginTop: 1 }}>Resume Manager</div>
        </div>
      </div>

      {/* Drop zone */}
      {resumes.length < MAX_RESUMES && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !extracting && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#6366f1' : extracting ? '#27272a' : '#3f3f46'}`,
            borderRadius: 12,
            padding: '36px 24px',
            textAlign: 'center',
            cursor: extracting ? 'not-allowed' : 'pointer',
            background: dragging ? '#1e1b4b44' : 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
            opacity: extracting ? 0.7 : 1,
            marginBottom: 20,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            multiple
            onChange={onFileInput}
            style={{ display: 'none' }}
          />
          {extracting ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div className="huntkit-spinner" />
              <span style={{ color: '#a78bfa', fontSize: 14 }}>
                Extracting text from {currentFile}…
              </span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
              <p style={{ color: '#d4d4d8', fontSize: 15, fontWeight: 500 }}>
                Drop PDF or DOCX files here
              </p>
              <p style={{ color: '#71717a', fontSize: 12, marginTop: 6 }}>
                or click to browse · max {MAX_RESUMES} resumes · PDF and DOCX only
              </p>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#450a0a',
          border: '1px solid #7f1d1d',
          borderRadius: 8,
          padding: '10px 14px',
          color: '#fca5a5',
          fontSize: 13,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {resumes.length === 0 && !extracting && (
        <p style={{ color: '#52525b', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
          No resumes uploaded yet. Drop a file above to get started.
        </p>
      )}

      {/* Resume cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {resumes.map((r) => (
          <ResumeCard
            key={r.id}
            resume={r}
            onDelete={() => handleDelete(r.id)}
            onSetDefault={() => handleSetDefault(r.id)}
          />
        ))}
      </div>

      {/* Max capacity notice */}
      {resumes.length >= MAX_RESUMES && (
        <p style={{ color: '#71717a', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
          Maximum {MAX_RESUMES} resumes reached. Delete one to add another.
        </p>
      )}

      {/* Success toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '11px 20px',
          background: '#15803d',
          color: '#dcfce7',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
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
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#f4f4f5',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }} title={resume.filename}>
            {resume.filename}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {resume.isDefault && (
            <span style={{
              background: '#312e81',
              color: '#a5b4fc',
              padding: '2px 10px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.3,
            }}>
              Default
            </span>
          )}
          <button onClick={onDelete} title="Remove" style={{
            background: 'none', border: 'none', color: '#71717a',
            cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px',
          }}>×</button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#52525b' }}>
        Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
        {resume.text?.length >= 8000 && (
          <span style={{ color: '#78716c', marginLeft: 8 }}>(text truncated to 8000 chars)</span>
        )}
      </div>

      {preview && (
        <div style={{
          fontSize: 12,
          color: '#71717a',
          lineHeight: 1.6,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}>
          {preview}
        </div>
      )}

      {!resume.isDefault && (
        <button onClick={onSetDefault} style={{
          padding: '6px 0',
          background: 'none',
          border: '1px solid #3f3f46',
          borderRadius: 6,
          color: '#a1a1aa',
          cursor: 'pointer',
          fontSize: 12,
          marginTop: 2,
        }}>
          Set as Default
        </button>
      )}
    </div>
  );
}
