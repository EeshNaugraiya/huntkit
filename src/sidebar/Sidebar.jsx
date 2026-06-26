import { useEffect, useState } from 'react';
import JobTracker from './JobTracker.jsx';

const TABS = ['Analysis', 'Jobs', 'Cover Letter'];

export default function Sidebar() {
  const [tab, setTab] = useState('Analysis');
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    chrome.storage.local.get(['lastAnalysis'], (data) => {
      if (data.lastAnalysis) setAnalysis(data.lastAnalysis);
    });

    const listener = (changes) => {
      if (changes.lastAnalysis?.newValue) {
        setAnalysis(changes.lastAnalysis.newValue);
        setTab('Analysis');
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#a78bfa' }}>HuntKit</span>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #27272a' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '9px 0',
              background: 'none',
              border: 'none',
              color: tab === t ? '#a78bfa' : '#71717a',
              fontWeight: tab === t ? 700 : 400,
              cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #a78bfa' : '2px solid transparent',
              fontSize: 12,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {tab === 'Analysis' && <AnalysisPanel analysis={analysis} />}
        {tab === 'Jobs' && <JobTracker />}
        {tab === 'Cover Letter' && <CoverLetterPanel analysis={analysis} />}
      </div>
    </div>
  );
}

// ─── Analysis Panel ───────────────────────────────────────────────────────────

function AnalysisPanel({ analysis }) {
  const [comparing, setComparing] = useState(false);
  const [compareResults, setCompareResults] = useState(null);
  const [compareError, setCompareError] = useState(null);

  // Reset comparison when a new analysis arrives
  useEffect(() => {
    setCompareResults(null);
    setCompareError(null);
  }, [analysis]);

  function handleCompare() {
    const jdText = analysis?.jdData?.description;
    if (!jdText) return;
    setComparing(true);
    setCompareResults(null);
    setCompareError(null);

    chrome.runtime.sendMessage(
      { type: 'COMPARE_RESUMES', payload: { jdText } },
      (response) => {
        setComparing(false);
        if (chrome.runtime.lastError || response?.error) {
          setCompareError(response?.error || chrome.runtime.lastError?.message);
          return;
        }
        setCompareResults(response);
      }
    );
  }

  if (!analysis) {
    return (
      <div style={{ color: '#71717a', fontSize: 13, paddingTop: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <p>No analysis yet.</p>
        <p style={{ marginTop: 8 }}>
          Click <strong style={{ color: '#a78bfa' }}>HuntKit Analyze</strong> on any job listing.
        </p>
      </div>
    );
  }

  const { matchScore, missingSkills, strongPoints, summary } = analysis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScoreBar score={matchScore} />

      {summary && (
        <Section title="Summary">
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#d4d4d8' }}>{summary}</p>
        </Section>
      )}

      {strongPoints?.length > 0 && (
        <Section title="Your Strengths">
          <ul style={listStyle}>
            {strongPoints.map((s, i) => (
              <li key={i} style={{ color: '#86efac' }}>✓ {s}</li>
            ))}
          </ul>
        </Section>
      )}

      {missingSkills?.length > 0 && (
        <Section title="Gaps to Address">
          <ul style={listStyle}>
            {missingSkills.map((s, i) => (
              <li key={i} style={{ color: '#fca5a5' }}>✗ {s}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Save + Compare row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => {
            chrome.runtime.sendMessage({
              type: 'SAVE_JOB',
              payload: { ...analysis.jdData, matchScore, status: 'interested', savedAt: Date.now() },
            });
          }}
          style={{ ...actionBtn, flex: 1 }}
        >
          Save to Tracker
        </button>
        <button
          onClick={handleCompare}
          disabled={comparing}
          style={{ ...actionBtn, background: '#27272a', color: '#d4d4d8', flex: 1, opacity: comparing ? 0.6 : 1 }}
        >
          {comparing ? 'Comparing…' : 'Compare Resumes'}
        </button>
      </div>

      {compareError && (
        <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{compareError}</p>
      )}

      {compareResults && (
        <CompareResults results={compareResults.results} recommended={compareResults.recommended} />
      )}
    </div>
  );
}

// ─── Compare Results ──────────────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉'];

function CompareResults({ results, recommended }) {
  if (!results?.length) {
    return (
      <Section title="Resume Comparison">
        <p style={{ fontSize: 13, color: '#71717a' }}>
          No resumes uploaded. Add resumes in the popup → Resume tab.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Resume Comparison">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map((r, i) => {
          const pct = Math.round((r.matchScore || 0) * 100);
          const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
          return (
            <div
              key={r.resumeId}
              style={{
                background: '#18181b',
                border: `1px solid ${r.isDefault ? '#4338ca' : '#27272a'}`,
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{MEDALS[i] || `#${i + 1}`}</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#f4f4f5',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={r.filename}
                  >
                    {r.filename}
                  </span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color, flexShrink: 0, marginLeft: 8 }}>
                  {pct}%
                </span>
              </div>

              {r.error ? (
                <span style={{ fontSize: 11, color: '#ef4444' }}>Error: {r.error}</span>
              ) : r.missingSkills?.length > 0 ? (
                <span style={{ fontSize: 11, color: '#71717a' }}>
                  Missing: {r.missingSkills.join(', ')}
                </span>
              ) : null}
            </div>
          );
        })}

        {recommended && (
          <div style={{ marginTop: 4, fontSize: 13, color: '#86efac', fontWeight: 500 }}>
            ✅ Recommended: {recommended}
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ background: '#18181b', borderRadius: 10, padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 36, fontWeight: 800, color }}>{pct}%</div>
      <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>Match Score</div>
      <div style={{ marginTop: 10, height: 6, background: '#27272a', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

// ─── Cover Letter Panel ───────────────────────────────────────────────────────

function CoverLetterPanel({ analysis }) {
  if (!analysis?.coverLetter) {
    return (
      <div style={{ color: '#71717a', fontSize: 13, paddingTop: 24, textAlign: 'center' }}>
        <p>Analyze a job first to generate a cover letter.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        onClick={() => navigator.clipboard.writeText(analysis.coverLetter)}
        style={copyBtnStyle}
      >
        Copy to Clipboard
      </button>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontSize: 12,
          lineHeight: 1.7,
          color: '#d4d4d8',
          background: '#18181b',
          padding: 14,
          borderRadius: 8,
        }}
      >
        {analysis.coverLetter}
      </pre>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#71717a',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

const listStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  lineHeight: 1.5,
  paddingLeft: 4,
  listStyle: 'none',
};

const actionBtn = {
  padding: '10px',
  background: '#6366f1',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
};

const copyBtnStyle = {
  padding: '8px 16px',
  background: '#27272a',
  color: '#d4d4d8',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  alignSelf: 'flex-end',
};
