import { useState, useEffect } from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DEFAULT_PROFILE = {
  firstName: '', lastName: '', email: '', phone: '',
  city: '', state: '', country: 'India', zipCode: '',
  linkedin: '', github: '', portfolio: '',
  workAuthorized: 'yes', requiresSponsorship: 'no',
  noticePeriod: '30', currentCTC: '', expectedCTC: '',
  currentJob: {
    isEmployed: false,
    company: '', title: '', location: '',
    startMonth: '', startYear: '', description: '',
  },
  experience: [],
  education: [],
  skills: '', languages: '', tools: '',
  gender: 'prefer_not_to_say',
  veteran: 'no',
  disability: 'prefer_not_to_say',
  coverLetter: '',
};

function sendMsg(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      if (response?.error) { reject(new Error(response.error)); return; }
      resolve(response ?? {});
    });
  });
}

function normalizeExtracted(raw, currentProfile) {
  const base = { ...DEFAULT_PROFILE, ...raw };
  base.experience = (raw.experience || []).map((e, i) => ({ type: 'full-time', ...e, id: Date.now() + i }));
  base.education = (raw.education || []).map((e, i) => ({ ...e, id: Date.now() + 1000 + i }));
  base.currentJob = (raw.currentJob && typeof raw.currentJob === 'object')
    ? { ...DEFAULT_PROFILE.currentJob, ...raw.currentJob, isEmployed: raw.currentJob.isEmployed === true || raw.currentJob.isEmployed === 'true' }
    : { ...DEFAULT_PROFILE.currentJob };
  base.country = raw.country || currentProfile.country;
  base.workAuthorized = raw.workAuthorized || currentProfile.workAuthorized;
  base.requiresSponsorship = raw.requiresSponsorship || currentProfile.requiresSponsorship;
  base.noticePeriod = raw.noticePeriod || currentProfile.noticePeriod;
  base.gender = raw.gender || currentProfile.gender;
  base.veteran = raw.veteran || currentProfile.veteran;
  base.disability = raw.disability || currentProfile.disability;
  return base;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [toast, setToast] = useState('');
  const [identityOpen, setIdentityOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    sendMsg('GET_PROFILE').then(({ profile: p }) => {
      if (p) setProfile(p);
    }).catch(console.error);
    sendMsg('GET_SETTINGS').then(({ settings }) => {
      const hasKey = !!(settings?.anthropicApiKey || settings?.geminiApiKey || settings?.openaiApiKey || settings?.qwenApiKey);
      setHasApiKey(hasKey);
    }).catch(() => {});
  }, []);

  async function handleImport() {
    setImportLoading(true);
    setToast('');
    try {
      const { resumes } = await sendMsg('GET_RESUMES');
      if (!resumes?.length) {
        setToast('Upload your resume first in the Resume tab');
        return;
      }
      const extracted = await sendMsg('IMPORT_PROFILE_FROM_RESUME');
      setProfile(normalizeExtracted(extracted, profile));
      setToast('✓ Profile imported — review and save');
    } catch (err) {
      setToast('Import failed: ' + err.message);
    } finally {
      setImportLoading(false);
    }
  }

  function set(field, value) {
    setProfile(prev => ({ ...prev, [field]: value }));
  }

  function setJob(field, value) {
    setProfile(prev => ({ ...prev, currentJob: { ...prev.currentJob, [field]: value } }));
  }

  async function handleSave() {
    try {
      await sendMsg('SAVE_PROFILE', { profile });
      setToast('✓ Profile saved');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setToast('Error: ' + err.message);
      setTimeout(() => setToast(''), 4000);
    }
  }

  function addExperience() {
    setProfile(prev => ({
      ...prev,
      experience: [...prev.experience, {
        id: Date.now(), company: '', title: '', type: 'full-time',
        location: '', startMonth: '', startYear: '',
        endMonth: '', endYear: '', description: '',
      }],
    }));
  }

  function removeExperience(id) {
    setProfile(prev => ({ ...prev, experience: prev.experience.filter(e => e.id !== id) }));
  }

  function updateExperience(id, field, value) {
    setProfile(prev => ({
      ...prev,
      experience: prev.experience.map(e => e.id === id ? { ...e, [field]: value } : e),
    }));
  }

  function addEducation() {
    setProfile(prev => ({
      ...prev,
      education: [...prev.education, {
        id: Date.now(), institution: '', degree: '', field: '',
        startYear: '', endYear: '', gpa: '', honors: '',
      }],
    }));
  }

  function removeEducation(id) {
    setProfile(prev => ({ ...prev, education: prev.education.filter(e => e.id !== id) }));
  }

  function updateEducation(id, field, value) {
    setProfile(prev => ({
      ...prev,
      education: prev.education.map(e => e.id === id ? { ...e, [field]: value } : e),
    }));
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 120px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🎯</span> HuntKit Profile
          </h1>
          <p style={{ color: '#71717a', fontSize: 13, marginTop: 6 }}>
            Stored locally — used to autofill job application forms.
          </p>
        </div>
        {hasApiKey && (
          <button
            onClick={handleImport}
            disabled={importLoading}
            style={{
              padding: '9px 16px',
              background: importLoading ? '#27272a' : '#1e1b4b',
              color: importLoading ? '#71717a' : '#a78bfa',
              border: '1px solid #4338ca',
              borderRadius: 8,
              cursor: importLoading ? 'default' : 'pointer',
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {importLoading ? '⏳ Extracting…' : '✨ Import from Resume'}
          </button>
        )}
      </div>

      {/* Section 1 — Personal Info */}
      <Section title="Personal Info">
        <TwoCol>
          <Field label="First Name"><Inp value={profile.firstName} onChange={v => set('firstName', v)} /></Field>
          <Field label="Last Name"><Inp value={profile.lastName} onChange={v => set('lastName', v)} /></Field>
        </TwoCol>
        <TwoCol>
          <Field label="Email"><Inp type="email" value={profile.email} onChange={v => set('email', v)} /></Field>
          <Field label="Phone"><Inp type="tel" value={profile.phone} onChange={v => set('phone', v)} /></Field>
        </TwoCol>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Field label="City"><Inp value={profile.city} onChange={v => set('city', v)} /></Field>
          <Field label="State"><Inp value={profile.state} onChange={v => set('state', v)} /></Field>
          <Field label="Country"><Inp value={profile.country} onChange={v => set('country', v)} /></Field>
          <Field label="Zip / PIN"><Inp value={profile.zipCode} onChange={v => set('zipCode', v)} /></Field>
        </div>
        <Field label="LinkedIn URL"><Inp value={profile.linkedin} onChange={v => set('linkedin', v)} placeholder="https://linkedin.com/in/…" /></Field>
        <Field label="GitHub URL"><Inp value={profile.github} onChange={v => set('github', v)} placeholder="https://github.com/…" /></Field>
        <Field label="Portfolio / Website"><Inp value={profile.portfolio} onChange={v => set('portfolio', v)} placeholder="https://…" /></Field>
      </Section>

      {/* Section 2 — Current Job */}
      <Section title="Current Job">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: '#d4d4d8', fontWeight: 500 }}>Currently employed?</span>
          {['Yes', 'No'].map(opt => (
            <button key={opt}
              onClick={() => setJob('isEmployed', opt === 'Yes')}
              style={{
                padding: '6px 18px',
                background: (opt === 'Yes') === profile.currentJob.isEmployed ? '#6366f1' : '#27272a',
                color: 'white', border: 'none', borderRadius: 6,
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >{opt}</button>
          ))}
        </div>
        {profile.currentJob.isEmployed && (
          <>
            <TwoCol>
              <Field label="Company Name"><Inp value={profile.currentJob.company} onChange={v => setJob('company', v)} /></Field>
              <Field label="Job Title"><Inp value={profile.currentJob.title} onChange={v => setJob('title', v)} /></Field>
            </TwoCol>
            <TwoCol>
              <Field label="Start Month">
                <Sel value={profile.currentJob.startMonth} onChange={v => setJob('startMonth', v)}>
                  <option value="">Month</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </Sel>
              </Field>
              <Field label="Start Year"><Inp value={profile.currentJob.startYear} onChange={v => setJob('startYear', v)} placeholder="2022" /></Field>
            </TwoCol>
            <Field label="Location"><Inp value={profile.currentJob.location} onChange={v => setJob('location', v)} /></Field>
            <Field label="Description"><Txta rows={3} value={profile.currentJob.description} onChange={v => setJob('description', v)} /></Field>
          </>
        )}
      </Section>

      {/* Section 3 — Work Authorization */}
      <Section title="Work Authorization">
        <TwoCol>
          <Field label="Authorized to work?">
            <Sel value={profile.workAuthorized} onChange={v => set('workAuthorized', v)}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Sel>
          </Field>
          <Field label="Require visa sponsorship?">
            <Sel value={profile.requiresSponsorship} onChange={v => set('requiresSponsorship', v)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Sel>
          </Field>
        </TwoCol>
        <Field label="Notice Period">
          <Sel value={profile.noticePeriod} onChange={v => set('noticePeriod', v)}>
            <option value="0">Immediate</option>
            <option value="15">15 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </Sel>
        </Field>
        <TwoCol>
          <Field label="Current CTC"><Inp value={profile.currentCTC} onChange={v => set('currentCTC', v)} placeholder="e.g. 12 LPA" /></Field>
          <Field label="Expected CTC"><Inp value={profile.expectedCTC} onChange={v => set('expectedCTC', v)} placeholder="e.g. 18 LPA" /></Field>
        </TwoCol>
      </Section>

      {/* Section 4 — Experience History */}
      <Section title="Experience History">
        {profile.experience.map(exp => (
          <ExperienceCard key={exp.id} exp={exp}
            onChange={(f, v) => updateExperience(exp.id, f, v)}
            onDelete={() => removeExperience(exp.id)}
          />
        ))}
        <button onClick={addExperience} style={addBtnStyle}>＋ Add Experience</button>
      </Section>

      {/* Section 5 — Education */}
      <Section title="Education">
        {profile.education.map(edu => (
          <EducationCard key={edu.id} edu={edu}
            onChange={(f, v) => updateEducation(edu.id, f, v)}
            onDelete={() => removeEducation(edu.id)}
          />
        ))}
        <button onClick={addEducation} style={addBtnStyle}>＋ Add Education</button>
      </Section>

      {/* Section 6 — Skills */}
      <Section title="Skills">
        <Field label="Skills (comma separated)">
          <Inp value={profile.skills} onChange={v => set('skills', v)} placeholder="React, Node.js, Python…" />
        </Field>
        <Field label="Programming Languages">
          <Inp value={profile.languages} onChange={v => set('languages', v)} placeholder="JavaScript, TypeScript, Go…" />
        </Field>
        <Field label="Tools & Technologies">
          <Inp value={profile.tools} onChange={v => set('tools', v)} placeholder="Git, Docker, AWS…" />
        </Field>
      </Section>

      {/* Section 7 — Identity (collapsible) */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => setIdentityOpen(o => !o)} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: '1px solid #27272a', borderRadius: identityOpen ? '8px 8px 0 0' : 8,
          padding: '12px 16px', color: '#a1a1aa', cursor: 'pointer',
          fontSize: 14, fontWeight: 600,
        }}>
          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: identityOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
          Identity (Optional)
        </button>
        {identityOpen && (
          <div style={{ border: '1px solid #27272a', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '16px' }}>
            <p style={{ color: '#52525b', fontSize: 12, marginBottom: 14 }}>
              Optional — used only for diversity forms
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Gender">
                <Sel value={profile.gender} onChange={v => set('gender', v)}>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                </Sel>
              </Field>
              <Field label="Veteran Status">
                <Sel value={profile.veteran} onChange={v => set('veteran', v)}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </Sel>
              </Field>
              <Field label="Disability">
                <Sel value={profile.disability} onChange={v => set('disability', v)}>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </Sel>
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Section 8 — Cover Letter */}
      <Section title="Cover Letter">
        <p style={{ color: '#52525b', fontSize: 12 }}>
          Used when application forms ask for a cover letter
        </p>
        <Txta rows={6} value={profile.coverLetter} onChange={v => set('coverLetter', v)} placeholder="Dear Hiring Manager,…" />
      </Section>

      {/* Sticky Save */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '14px 24px',
        background: 'rgba(15,15,16,0.97)',
        borderTop: '1px solid #27272a',
        zIndex: 100,
        backdropFilter: 'blur(6px)',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={handleSave} style={{
            flex: 1, padding: '12px 24px',
            background: '#6366f1', color: 'white',
            border: 'none', borderRadius: 8,
            cursor: 'pointer', fontWeight: 700, fontSize: 15,
          }}>
            Save Profile
          </button>
          {toast && (
            <span style={{ fontSize: 14, fontWeight: 600, color: toast.startsWith('Error') ? '#ef4444' : '#22c55e', whiteSpace: 'nowrap' }}>
              {toast}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#d4d4d8', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #27272a' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function TwoCol({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      {children}
    </label>
  );
}

function Inp({ value, onChange, type = 'text', placeholder = '' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={inputStyle} />
  );
}

function Sel({ value, onChange, children }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      {children}
    </select>
  );
}

function Txta({ value, onChange, rows = 3, placeholder = '' }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)}
      rows={rows} placeholder={placeholder}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
  );
}

function ExperienceCard({ exp, onChange, onDelete }) {
  return (
    <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, padding: 16, position: 'relative' }}>
      <button onClick={onDelete} style={deleteBtnStyle} title="Remove">×</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TwoCol>
          <Field label="Company"><Inp value={exp.company} onChange={v => onChange('company', v)} /></Field>
          <Field label="Title"><Inp value={exp.title} onChange={v => onChange('title', v)} /></Field>
        </TwoCol>
        <Field label="Employment Type">
          <Sel value={exp.type} onChange={v => onChange('type', v)}>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="internship">Internship</option>
            <option value="contract">Contract</option>
            <option value="freelance">Freelance</option>
          </Sel>
        </Field>
        <Field label="Location"><Inp value={exp.location} onChange={v => onChange('location', v)} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Field label="Start Month">
            <Sel value={exp.startMonth} onChange={v => onChange('startMonth', v)}>
              <option value="">Month</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </Sel>
          </Field>
          <Field label="Start Year"><Inp value={exp.startYear} onChange={v => onChange('startYear', v)} placeholder="2020" /></Field>
          <Field label="End Month">
            <Sel value={exp.endMonth} onChange={v => onChange('endMonth', v)}>
              <option value="">Month</option>
              <option value="Present">Present</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </Sel>
          </Field>
          <Field label="End Year"><Inp value={exp.endYear} onChange={v => onChange('endYear', v)} placeholder="2023" /></Field>
        </div>
        <Field label="Description"><Txta rows={3} value={exp.description} onChange={v => onChange('description', v)} /></Field>
      </div>
    </div>
  );
}

function EducationCard({ edu, onChange, onDelete }) {
  return (
    <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, padding: 16, position: 'relative' }}>
      <button onClick={onDelete} style={deleteBtnStyle} title="Remove">×</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Institution"><Inp value={edu.institution} onChange={v => onChange('institution', v)} /></Field>
        <TwoCol>
          <Field label="Degree">
            <Sel value={edu.degree} onChange={v => onChange('degree', v)}>
              <option value="">Select degree</option>
              <option value="B.Tech">B.Tech</option>
              <option value="B.E">B.E</option>
              <option value="B.Sc">B.Sc</option>
              <option value="M.Tech">M.Tech</option>
              <option value="M.Sc">M.Sc</option>
              <option value="MBA">MBA</option>
              <option value="PhD">PhD</option>
              <option value="Other">Other</option>
            </Sel>
          </Field>
          <Field label="Field of Study"><Inp value={edu.field} onChange={v => onChange('field', v)} placeholder="Computer Science" /></Field>
        </TwoCol>
        <TwoCol>
          <Field label="Start Year"><Inp value={edu.startYear} onChange={v => onChange('startYear', v)} placeholder="2018" /></Field>
          <Field label="End Year"><Inp value={edu.endYear} onChange={v => onChange('endYear', v)} placeholder="2022" /></Field>
        </TwoCol>
        <TwoCol>
          <Field label="GPA / CGPA"><Inp value={edu.gpa} onChange={v => onChange('gpa', v)} placeholder="8.5" /></Field>
          <Field label="Honors / Achievements"><Inp value={edu.honors} onChange={v => onChange('honors', v)} /></Field>
        </TwoCol>
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle = {
  padding: '8px 12px',
  background: '#09090b',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  color: '#f4f4f5',
  fontSize: 13,
  outline: 'none',
  width: '100%',
};

const addBtnStyle = {
  marginTop: 6,
  padding: '9px 16px',
  background: 'none',
  border: '1px dashed #3f3f46',
  borderRadius: 8,
  color: '#71717a',
  cursor: 'pointer',
  fontSize: 13,
  width: '100%',
  transition: 'color 0.15s, border-color 0.15s',
};

const deleteBtnStyle = {
  position: 'absolute',
  top: 10, right: 10,
  background: 'none', border: 'none',
  color: '#71717a', cursor: 'pointer',
  fontSize: 22, lineHeight: 1, padding: '0 4px',
};