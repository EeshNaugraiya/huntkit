import { useEffect, useState } from 'react';

const DOT_COLOR = {
  known: '#22c55e',
  inferred: '#eab308',
  guessed: '#f97316',
};

function jumpToField(fieldId) {
  // Ask parent page (content script) to scroll to the field
  window.parent.postMessage({ type: 'HUNTKIT_JUMP_TO', fieldId }, '*');
}

function FieldRow({ result }) {
  const dot = DOT_COLOR[result.confidence] || '#71717a';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      background: '#18181b',
      borderRadius: 6,
      border: '1px solid #27272a',
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: dot,
        flexShrink: 0,
      }} />
      <span style={{
        flex: 1,
        fontSize: 12,
        color: '#d4d4d8',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }} title={result.label}>
        {result.label}
      </span>
      <span style={{
        fontSize: 11,
        color: '#71717a',
        maxWidth: 90,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }} title={String(result.value ?? '')}>
        {String(result.value ?? '')}
      </span>
      <button
        onClick={() => jumpToField(result.fieldId)}
        title="Jump to field"
        style={{
          background: 'none',
          border: '1px solid #3f3f46',
          borderRadius: 4,
          color: '#a78bfa',
          cursor: 'pointer',
          fontSize: 11,
          padding: '2px 6px',
          flexShrink: 0,
          lineHeight: 1.4,
        }}
      >↗</button>
    </div>
  );
}

export default function ConfidencePanel({ results: propResults }) {
  const [results, setResults] = useState(propResults || []);

  useEffect(() => {
    if (propResults?.length) {
      setResults(propResults);
      return;
    }
    chrome.storage.local.get('lastAIFillResults', ({ lastAIFillResults }) => {
      if (lastAIFillResults?.length) setResults(lastAIFillResults);
    });
  }, [propResults]);

  useEffect(() => {
    const listener = (changes) => {
      if (changes.lastAIFillResults?.newValue) {
        setResults(changes.lastAIFillResults.newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const filledResults = results.filter(r => r.status === 'filled');
  const guessedResults = filledResults.filter(r => r.confidence === 'guessed');

  if (results.length === 0) {
    return (
      <div style={{ color: '#71717a', fontSize: 13, paddingTop: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
        <p style={{ color: '#d4d4d8', fontWeight: 500 }}>No AI fill results yet</p>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          Click <strong style={{ color: '#a78bfa' }}>AI Autofill</strong> in the popup to fill this page.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, color: '#f4f4f5', fontWeight: 600 }}>
          {filledResults.length} field{filledResults.length !== 1 ? 's' : ''} filled
        </span>
        {guessedResults.length > 0 && (
          <span style={{
            fontSize: 11,
            color: '#f97316',
            fontWeight: 600,
            background: '#431407',
            padding: '2px 8px',
            borderRadius: 10,
          }}>
            {guessedResults.length} need review
          </span>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#71717a', paddingLeft: 2 }}>
        {[['known', '#22c55e', 'From profile'], ['inferred', '#eab308', 'Calculated'], ['guessed', '#f97316', 'Estimated']].map(([key, color, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Field list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filledResults.map(r => <FieldRow key={r.fieldId} result={r} />)}
        {results.filter(r => r.status !== 'filled').map(r => (
          <div key={r.fieldId} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 10px',
            borderRadius: 6,
            opacity: 0.4,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3f3f46', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 11, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.label}
            </span>
            <span style={{ fontSize: 10, color: '#52525b', flexShrink: 0 }}>
              {r.status}
            </span>
          </div>
        ))}
      </div>

      {/* Review Required */}
      {guessedResults.length > 0 && (
        <div style={{
          background: '#1c0d06',
          border: '1px solid #7c2d12',
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Review Required ({guessedResults.length})
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {guessedResults.map(r => (
              <li key={r.fieldId} style={{ fontSize: 12, color: '#fb923c', lineHeight: 1.5 }}>
                <button
                  onClick={() => jumpToField(r.fieldId)}
                  style={{
                    background: 'none', border: 'none', color: '#fb923c',
                    cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline',
                    textAlign: 'left',
                  }}
                >
                  {r.label}
                </button>
                {r.reason && <span style={{ color: '#78716c', fontSize: 11 }}> — {r.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
