import { useEffect, useState } from 'react';
import JobTracker from './JobTracker.jsx';
import { getJobs } from '../storage/tracker.js';

const TABS = ['Analysis', 'Jobs', 'Cover', 'Stats', 'Interview'];

export default function Sidebar() {
  const [tab, setTab] = useState('Analysis');
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [hasResume, setHasResume] = useState(null);

  useEffect(() => {
    // Mark sidebar as open; clear on close so content scripts know the state
    chrome.storage.local.set({ sidebarWasOpen: true });
    const handleUnload = () => chrome.storage.local.set({ sidebarWasOpen: false });
    window.addEventListener('beforeunload', handleUnload);

    chrome.storage.local.get(['lastAnalysis', 'resumes', 'resumeText'], (data) => {
      if (data.lastAnalysis) setAnalysis(data.lastAnalysis);
      setHasResume((data.resumes?.length > 0) || !!data.resumeText);
    });

    const listener = (changes) => {
      if (changes.lastAnalysis?.newValue) {
        setAnalysis(changes.lastAnalysis.newValue);
        setAnalyzing(false);
        setTab('Analysis');
      }
      // New job detected — clear stale analysis and show loading until lastAnalysis arrives
      if (changes.currentJobId?.newValue) {
        setAnalysis(null);
        setAnalyzing(true);
      }
      if (changes.resumes || changes.resumeText) {
        chrome.storage.local.get(['resumes', 'resumeText'], (data) => {
          setHasResume((data.resumes?.length > 0) || !!data.resumeText);
        });
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#a78bfa', flex: 1 }}>HuntKit</span>
        <button
          onClick={() => window.parent.postMessage({ type: 'HUNTKIT_CLOSE' }, '*')}
          title="Close"
          style={{
            background: 'none',
            border: 'none',
            color: '#71717a',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            padding: '0 2px',
            flexShrink: 0,
          }}
        >×</button>
      </div>

      {hasResume === false && (
        <div style={{
          padding: '12px 16px',
          background: '#1a1040',
          borderBottom: '1px solid #4338ca',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>👋</span>
          <div style={{ fontSize: 12, color: '#c7d2fe', lineHeight: 1.5 }}>
            Add your resume to get started →{' '}
            <button
              onClick={() => window.open(chrome.runtime.getURL('src/popup/index.html'))}
              style={{
                background: 'none',
                border: 'none',
                color: '#a78bfa',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12,
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Open Resume Manager
            </button>
          </div>
        </div>
      )}

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
              fontSize: 10,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {tab === 'Analysis' && <AnalysisPanel analysis={analysis} analyzing={analyzing} />}
        {tab === 'Jobs' && <JobTracker />}
        {tab === 'Cover' && <CoverLetterPanel analysis={analysis} />}
        {tab === 'Stats' && <StatsPanel />}
        {tab === 'Interview' && <InterviewPrepPanel analysis={analysis} />}
      </div>
    </div>
  );
}

// ─── Analysis Panel ───────────────────────────────────────────────────────────

function AnalysisPanel({ analysis, analyzing }) {
  const [comparing, setComparing] = useState(false);
  const [compareResults, setCompareResults] = useState(null);
  const [compareError, setCompareError] = useState(null);
  const [dupWarning, setDupWarning] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCompareResults(null);
    setCompareError(null);
    setDupWarning(null);
    setSaved(false);
  }, [analysis]);

  function handleSave(force = false) {
    const rawScore = analysis.matchScore ?? 0;
    const normalizedScore = rawScore > 1 ? rawScore / 100 : rawScore;
    const payload = {
      ...analysis.jdData,
      matchScore: normalizedScore,
      status: 'interested',
      savedAt: Date.now(),
      ...(force ? { forceSave: true } : {}),
    };
    chrome.runtime.sendMessage({ type: 'SAVE_JOB', payload }, (response) => {
      if (chrome.runtime.lastError || response?.error) return;
      if (response?.duplicate) {
        setDupWarning(response.existing);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

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
        {analyzing ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <p style={{ color: '#d4d4d8', fontWeight: 500 }}>Analyzing new job…</p>
            <p style={{ marginTop: 8 }}>Scoring against your resume</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ color: '#d4d4d8', fontWeight: 500 }}>Click Analyze to score this job</p>
            <p style={{ marginTop: 8 }}>
              Click <strong style={{ color: '#a78bfa' }}>HuntKit Analyze</strong> on any job listing.
            </p>
          </>
        )}
      </div>
    );
  }

  const { matchScore, missingSkills, strongPoints, summary } = analysis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ScoreBar score={matchScore} />

      <PlatformBreakdown jdText={analysis?.jdData?.description} />

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

      {/* Duplicate warning */}
      {dupWarning && (
        <div style={{
          background: '#1c1917',
          border: '1px solid #f59e0b',
          borderRadius: 8,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <p style={{ fontSize: 12, color: '#fbbf24', margin: 0, lineHeight: 1.5 }}>
            ⚠️ You already saved <strong>{dupWarning.title}</strong> at <strong>{dupWarning.company}</strong> on{' '}
            {new Date(dupWarning.savedAt).toLocaleDateString()} (Status: {dupWarning.status}).
            Save anyway?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setDupWarning(null); handleSave(true); }}
              style={{ ...actionBtn, flex: 1, background: '#92400e', fontSize: 12, padding: '7px' }}
            >
              Yes, save again
            </button>
            <button
              onClick={() => setDupWarning(null)}
              style={{ ...actionBtn, flex: 1, background: '#27272a', color: '#d4d4d8', fontSize: 12, padding: '7px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Save + Compare row */}
      {!dupWarning && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleSave(false)}
            style={{ ...actionBtn, flex: 1, background: saved ? '#16a34a' : '#6366f1' }}
          >
            {saved ? '✓ Saved' : 'Save to Tracker'}
          </button>
          <button
            onClick={handleCompare}
            disabled={comparing}
            style={{ ...actionBtn, background: '#27272a', color: '#d4d4d8', flex: 1, opacity: comparing ? 0.6 : 1 }}
          >
            {comparing ? 'Comparing…' : 'Compare Resumes'}
          </button>
        </div>
      )}

      {compareError && (
        <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{compareError}</p>
      )}

      {compareResults && (
        <CompareResults results={compareResults.results} recommended={compareResults.recommended} />
      )}

      <BulletRewriter jdText={analysis?.jdData?.description} />
    </div>
  );
}

// ─── Bullet Rewriter ──────────────────────────────────────────────────────────

function BulletRewriter({ jdText }) {
  const [bullets, setBullets] = useState('');
  const [rewriting, setRewriting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  function handleRewrite() {
    if (!bullets.trim() || !jdText) return;
    setRewriting(true);
    setResult(null);
    setError(null);
    chrome.runtime.sendMessage(
      { type: 'REWRITE_BULLETS', payload: { bulletsText: bullets, jdText } },
      (response) => {
        setRewriting(false);
        if (chrome.runtime.lastError || response?.error) {
          setError(response?.error || chrome.runtime.lastError?.message);
          return;
        }
        if (!response || !response.bullets) {
          setError('no-ai');
          return;
        }
        setResult(response.bullets);
      }
    );
  }

  function copyAll() {
    if (!result) return;
    navigator.clipboard.writeText(result.map((b) => b.rewritten).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Section title="Rewrite Bullets">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          value={bullets}
          onChange={(e) => setBullets(e.target.value)}
          placeholder={'Paste your resume bullets here, one per line…\n• Led development of payment API\n• Managed team of 3 engineers'}
          rows={4}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: 6,
            color: '#f4f4f5',
            fontSize: 12,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleRewrite}
          disabled={rewriting || !bullets.trim()}
          style={{ ...actionBtn, opacity: rewriting || !bullets.trim() ? 0.6 : 1 }}
        >
          {rewriting ? 'Rewriting…' : 'Rewrite Bullets'}
        </button>

        {error === 'no-ai' && (
          <p style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5, margin: 0 }}>
            Enable Claude, Gemini, or OpenAI in Settings to use this feature.
          </p>
        )}
        {error && error !== 'no-ai' && (
          <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
        )}

        {result && result.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                Results
              </span>
              <button onClick={copyAll} style={copyBtnStyle}>
                {copied ? '✓ Copied' : 'Copy all rewritten'}
              </button>
            </div>
            {result.map((b, i) => (
              <div key={i} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: '#52525b', lineHeight: 1.5 }}>
                  <span style={{ color: '#71717a', fontWeight: 600 }}>Before: </span>{b.original}
                </div>
                <div style={{ fontSize: 12, color: '#86efac', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600 }}>After: </span>{b.rewritten}
                </div>
                {b.tip && (
                  <div style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.4 }}>
                    💡 {b.tip}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
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
          const rawScore = r.matchScore ?? r.score ?? 0;
          const pct = rawScore > 1 ? Math.round(rawScore) : Math.round(rawScore * 100);
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
                    style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={r.filename}
                  >
                    {r.filename}
                  </span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color, flexShrink: 0, marginLeft: 8 }}>{pct}%</span>
              </div>
              {r.error ? (
                <span style={{ fontSize: 11, color: '#ef4444' }}>Error: {r.error}</span>
              ) : r.missingSkills?.length > 0 ? (
                <span style={{ fontSize: 11, color: '#71717a' }}>Missing: {r.missingSkills.join(', ')}</span>
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

// ─── Platform Breakdown ───────────────────────────────────────────────────────

function PlatformBreakdown({ jdText }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [atsFit, setAtsFit] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    if (loading) return;
    setLoading(true);
    setError(null);
    chrome.runtime.sendMessage(
      { type: 'SCORE_ATS_PLATFORMS', payload: { jdText } },
      (response) => {
        setLoading(false);
        if (chrome.runtime.lastError || response?.error) {
          setError(response?.error || chrome.runtime.lastError?.message || 'Scoring failed');
          return;
        }
        setAtsFit(response);
      }
    );
  }

  function toggle() {
    const opening = !open;
    setOpen(opening);
    if (opening && !atsFit && !loading) load();
  }

  if (!jdText) return null;

  return (
    <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={toggle}
        style={{
          width: '100%',
          padding: '11px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
          Platform Breakdown
        </span>
        <span style={{ color: '#52525b', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {loading && (
            <p style={{ fontSize: 12, color: '#71717a', textAlign: 'center', margin: '4px 0' }}>Scoring platforms…</p>
          )}
          {error && (
            <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
          )}
          {atsFit?.platforms && (
            <>
              {atsFit.platforms.map((p, i) => {
                const pct = Math.round(p.score);
                const isGreen = pct >= 70;
                const isRed = pct < 45;
                const dot = isGreen ? '🟢' : isRed ? '🔴' : '🟡';
                const color = isGreen ? '#22c55e' : isRed ? '#ef4444' : '#f59e0b';
                const isBest = i === 0;
                const isWorst = i === atsFit.platforms.length - 1;
                return (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                    <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{dot}</span>
                    <span style={{ flex: 1, color: '#d4d4d8', fontWeight: isBest ? 600 : 400 }}>{p.name}</span>
                    <span style={{ fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{pct}%</span>
                    {isBest && (
                      <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 500, flexShrink: 0 }}>
                        Most likely to pass
                      </span>
                    )}
                    {isWorst && !isBest && (
                      <span style={{ fontSize: 10, color: '#71717a', flexShrink: 0 }}>
                        Hardest to pass
                      </span>
                    )}
                  </div>
                );
              })}
              <div style={{
                marginTop: 4,
                paddingTop: 8,
                borderTop: '1px solid #27272a',
                fontSize: 11,
                color: '#71717a',
                lineHeight: 1.5,
              }}>
                Best: <span style={{ color: '#22c55e', fontWeight: 600 }}>{atsFit.best}</span>
                {' · '}
                Hardest: <span style={{ color: '#ef4444', fontWeight: 600 }}>{atsFit.hardest}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const raw = score ?? 0;
  const pct = raw > 1 ? Math.round(raw) : Math.round(raw * 100);
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
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.7, color: '#d4d4d8', background: '#18181b', padding: 14, borderRadius: 8 }}>
        {analysis.coverLetter}
      </pre>
    </div>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

function StatsPanel() {
  const [jobs, setJobs] = useState([]);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    load();
    const listener = (changes) => { if (changes.trackedJobs) load(); };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function load() {
    const all = await getJobs();
    setJobs(all);
  }

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const filtered = period === 'week' ? jobs.filter((j) => now - j.savedAt < weekMs) : jobs;

  const total = filtered.length;
  const applied = filtered.filter((j) => j.status !== 'interested').length;
  const interviews = filtered.filter((j) => j.status === 'interview' || j.status === 'offer').length;
  const offers = filtered.filter((j) => j.status === 'offer').length;
  const responseRate = applied > 0 ? Math.round((interviews / applied) * 100) : 0;

  const platformCounts = {};
  filtered.forEach((j) => {
    const p = j.platform || 'Other';
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  });
  const topPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const thisWeekCount = jobs.filter((j) => now - j.savedAt < weekMs).length;
  const lastWeekCount = jobs.filter((j) => now - j.savedAt >= weekMs && now - j.savedAt < 2 * weekMs).length;

  const appliedWithTime = filtered.filter((j) => j.appliedAt && j.savedAt);
  const avgDays = appliedWithTime.length > 0
    ? Math.round(appliedWithTime.reduce((s, j) => s + (j.appliedAt - j.savedAt), 0) / appliedWithTime.length / (24 * 60 * 60 * 1000))
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Period toggle */}
      <div style={{ display: 'flex', background: '#18181b', borderRadius: 8, padding: 3, gap: 3 }}>
        {['week', 'all'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 6,
              border: 'none',
              background: period === p ? '#3f3f46' : 'none',
              color: period === p ? '#f4f4f5' : '#71717a',
              fontSize: 12,
              fontWeight: period === p ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {p === 'week' ? 'This week' : 'All time'}
          </button>
        ))}
      </div>

      {/* Primary stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Saved" value={total} color="#a78bfa" />
        <StatCard label="Applied" value={applied} color="#3b82f6" />
        <StatCard label="Interviews" value={interviews} color="#f59e0b" />
        <StatCard label="Offers" value={offers} color="#22c55e" />
      </div>

      <StatCard label="Response Rate" value={`${responseRate}%`} color={responseRate >= 20 ? '#22c55e' : responseRate >= 10 ? '#f59e0b' : '#ef4444'} wide />

      {/* Week comparison */}
      <Section title="Applications">
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#a78bfa' }}>{thisWeekCount}</div>
            <div style={{ fontSize: 11, color: '#71717a' }}>This week</div>
          </div>
          <div style={{ width: 1, background: '#27272a' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#52525b' }}>{lastWeekCount}</div>
            <div style={{ fontSize: 11, color: '#71717a' }}>Last week</div>
          </div>
        </div>
      </Section>

      {avgDays !== null && (
        <StatCard label="Avg days saved → applied" value={`${avgDays}d`} color="#6366f1" wide />
      )}

      {topPlatforms.length > 0 && (
        <Section title="Top Platforms">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topPlatforms.map(([platform, count]) => (
              <div key={platform} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#d4d4d8' }}>{platform}</span>
                <span style={{ fontSize: 12, color: '#71717a' }}>{count} job{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {total === 0 && (
        <p style={{ fontSize: 13, color: '#52525b', textAlign: 'center', paddingTop: 16 }}>
          No jobs tracked yet. Save jobs from the Analysis tab.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, color, wide }) {
  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: 8,
      padding: '12px 14px',
      textAlign: 'center',
      gridColumn: wide ? '1 / -1' : undefined,
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#71717a', marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ─── Interview Prep Panel ─────────────────────────────────────────────────────

function InterviewPrepPanel({ analysis }) {
  const [qLoading, setQLoading] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [qError, setQError] = useState(null);
  const [rLoading, setRLoading] = useState(false);
  const [roadmap, setRoadmap] = useState(null);
  const [rError, setRError] = useState(null);

  const jdText = analysis?.jdData?.description;

  function generateQuestions() {
    if (!jdText) return;
    setQLoading(true);
    setQuestions(null);
    setQError(null);
    chrome.runtime.sendMessage(
      { type: 'GENERATE_QUESTIONS', payload: { jdText } },
      (response) => {
        setQLoading(false);
        if (chrome.runtime.lastError || response?.error) {
          setQError(response?.error || chrome.runtime.lastError?.message);
          return;
        }
        setQuestions(response);
      }
    );
  }

  function generateRoadmap() {
    if (!jdText) return;
    setRLoading(true);
    setRoadmap(null);
    setRError(null);
    chrome.runtime.sendMessage(
      { type: 'GENERATE_ROADMAP', payload: { jdText } },
      (response) => {
        console.log('[huntkit] roadmap response:', response);
        setRLoading(false);
        if (chrome.runtime.lastError) {
          setRError(chrome.runtime.lastError.message);
          return;
        }
        if (!response) {
          setRError('no-ai');
          return;
        }
        if (response.error) {
          setRError(response.error);
          return;
        }
        setRoadmap(response);
      }
    );
  }

  if (!analysis) {
    return (
      <div style={{ color: '#71717a', fontSize: 13, paddingTop: 24, textAlign: 'center' }}>
        <p>Analyze a job first to generate interview prep.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Section A — Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
            Interview Questions
          </span>
          <button
            onClick={generateQuestions}
            disabled={qLoading}
            style={{ ...actionBtn, padding: '6px 12px', fontSize: 12, opacity: qLoading ? 0.6 : 1 }}
          >
            {qLoading ? 'Generating…' : 'Generate Questions'}
          </button>
        </div>

        {qError && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{qError}</p>}

        {questions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <QuestionCategory title="Technical" items={questions.technical} color="#60a5fa" />
            <QuestionCategory title="Behavioral" items={questions.behavioral} color="#a78bfa" />
            <QuestionCategory title="Role-Specific" items={questions.roleSpecific} color="#34d399" />
          </div>
        )}
      </div>

      <div style={{ height: 1, background: '#27272a' }} />

      {/* Section B — Roadmap */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
            Study Roadmap
          </span>
          <button
            onClick={generateRoadmap}
            disabled={rLoading}
            style={{ ...actionBtn, padding: '6px 12px', fontSize: 12, opacity: rLoading ? 0.6 : 1 }}
          >
            {rLoading ? 'Generating…' : 'Generate Roadmap'}
          </button>
        </div>

        {rError === 'no-ai' && (
          <p style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5, margin: 0 }}>
            Enable Claude, Gemini, or OpenAI in Settings to generate a personalized roadmap.
          </p>
        )}
        {rError && rError !== 'no-ai' && (
          <p style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5, margin: 0 }}>
            Error: {rError}
          </p>
        )}

        {roadmap && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roadmap.timeframe && (
              <p style={{ fontSize: 12, color: '#a78bfa', margin: 0, fontWeight: 600 }}>
                Estimated timeframe: {roadmap.timeframe}
              </p>
            )}
            {(roadmap.topics || []).map((t, i) => (
              <RoadmapTopic key={i} topic={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCategory({ title, items, color }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((q, i) => <QuestionItem key={i} item={q} />)}
      </div>
    </div>
  );
}

function QuestionItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 7, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '9px 12px',
          background: 'none',
          border: 'none',
          color: '#d4d4d8',
          fontSize: 12,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          lineHeight: 1.5,
        }}
      >
        <span>{item.question}</span>
        <span style={{ flexShrink: 0, color: '#52525b', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && item.hint && (
        <div style={{ padding: '0 12px 10px', fontSize: 11, color: '#fbbf24', lineHeight: 1.5 }}>
          💡 {item.hint}
        </div>
      )}
    </div>
  );
}

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

function RoadmapTopic({ topic }) {
  const [checked, setChecked] = useState(false);
  const pc = PRIORITY_COLORS[topic.priority] || '#71717a';
  return (
    <div style={{
      background: '#18181b',
      border: `1px solid ${checked ? '#27272a' : pc + '44'}`,
      borderLeft: `3px solid ${checked ? '#3f3f46' : pc}`,
      borderRadius: 7,
      padding: '10px 12px',
      opacity: checked ? 0.5 : 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ flexShrink: 0, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: checked ? '#52525b' : '#f4f4f5' }}>{topic.topic}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: pc, fontWeight: 600, textTransform: 'uppercase' }}>{topic.priority}</span>
          <span style={{ fontSize: 10, color: '#52525b' }}>{(topic.days || 1)}d</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#71717a', paddingLeft: 24 }}>
        {topic.resources || 'Search online'}
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
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
  padding: '6px 12px',
  background: '#27272a',
  color: '#d4d4d8',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  alignSelf: 'flex-end',
};
