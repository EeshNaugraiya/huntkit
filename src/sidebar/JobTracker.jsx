import { useEffect, useState } from 'react';
import { getJobs, updateJobStatus, deleteJob } from '../storage/tracker.js';

const STATUSES = ['interested', 'applied', 'interview', 'offer', 'rejected'];

const STATUS_COLORS = {
  interested: '#6366f1',
  applied: '#3b82f6',
  interview: '#f59e0b',
  offer: '#22c55e',
  rejected: '#ef4444',
};

export default function JobTracker() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadJobs();
    const listener = () => loadJobs();
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function loadJobs() {
    const all = await getJobs();
    setJobs(all);
  }

  async function changeStatus(id, status) {
    await updateJobStatus(id, status);
    loadJobs();
  }

  async function removeJob(id) {
    await deleteJob(id);
    loadJobs();
  }

  function exportCSV() {
    const headers = ['title', 'company', 'platform', 'status', 'url', 'savedAt', 'appliedAt', 'notes'];
    const rows = jobs.map((j) =>
      headers.map((h) => {
        const v = j[h] ?? '';
        if (h === 'savedAt' || h === 'appliedAt') return v ? new Date(v).toLocaleDateString() : '';
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      })
    );
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `huntkit-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const displayed = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter + Export row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
          {STATUSES.map((s) => (
            <FilterChip key={s} label={s} active={filter === s} onClick={() => setFilter(s)} color={STATUS_COLORS[s]} />
          ))}
        </div>
        {jobs.length > 0 && (
          <button
            onClick={exportCSV}
            title="Export as CSV"
            style={{
              flexShrink: 0,
              padding: '4px 10px',
              background: 'none',
              border: '1px solid #3f3f46',
              borderRadius: 6,
              color: '#a1a1aa',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ↓ CSV
          </button>
        )}
      </div>

      {/* Job cards */}
      {displayed.length === 0 ? (
        <p style={{ color: '#71717a', fontSize: 13, textAlign: 'center', paddingTop: 16 }}>
          No jobs tracked yet.
        </p>
      ) : (
        displayed.map((job) => (
          <JobCard key={job.id} job={job} onStatusChange={changeStatus} onDelete={removeJob} />
        ))
      )}
    </div>
  );
}

function JobCard({ job, onStatusChange, onDelete }) {
  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: 10,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#f4f4f5' }}>{job.title || 'Untitled Role'}</div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{job.company || 'Unknown Company'}</div>
        </div>
        {job.matchScore != null && (
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#a78bfa',
            background: '#1e1b4b',
            padding: '2px 8px',
            borderRadius: 12,
          }}>
            {Math.round(job.matchScore * 100)}% match
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select
          value={job.status}
          onChange={(e) => onStatusChange(job.id, e.target.value)}
          style={{
            flex: 1,
            padding: '5px 8px',
            background: '#09090b',
            border: `1px solid ${STATUS_COLORS[job.status] || '#3f3f46'}`,
            borderRadius: 6,
            color: STATUS_COLORS[job.status] || '#d4d4d8',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}
          >
            View →
          </a>
        )}

        <button
          onClick={() => onDelete(job.id)}
          style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
          title="Remove"
        >
          ×
        </button>
      </div>

      {job.savedAt && (
        <div style={{ fontSize: 11, color: '#52525b' }}>
          Saved {new Date(job.savedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 12,
        border: `1px solid ${active ? (color || '#a78bfa') : '#3f3f46'}`,
        background: active ? (color || '#a78bfa') + '22' : 'transparent',
        color: active ? (color || '#a78bfa') : '#71717a',
        fontSize: 11,
        cursor: 'pointer',
        textTransform: 'capitalize',
      }}
    >
      {label}
    </button>
  );
}
