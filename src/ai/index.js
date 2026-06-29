import { analyzeWithClaude } from './claude.js';
import { analyzeWithQwen } from './qwen.js';
import { analyzeWithGemini } from './gemini.js';
import { analyzeWithOpenAI } from './openai.js';
import { analyzeWithNoAI } from './noai.js';

const ANALYSIS_PROMPT = (jdText, resumeText) => `
You are an expert career coach and recruiter. Analyze the job description against the candidate's resume.

JOB DESCRIPTION:
${jdText}

${resumeText ? `CANDIDATE RESUME:\n${resumeText}` : 'No resume provided — analyze the JD only.'}

Respond with a JSON object matching this exact schema:
{
  "matchScore": 0.0-1.0,
  "summary": "2-3 sentence overall assessment",
  "strongPoints": ["skill or experience that matches", ...],
  "missingSkills": ["skill or requirement the candidate likely lacks", ...],
  "coverLetter": "A concise, personalized cover letter paragraph (3-4 sentences)"
}

Be specific, honest, and actionable. Match score should reflect realistic fit.
`.trim();

export async function analyzeJD({ jdText, resumeText, provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey }) {
  const prompt = ANALYSIS_PROMPT(jdText, resumeText);
  try {
    if (provider === 'claude') return await analyzeWithClaude(prompt, { apiKey: anthropicApiKey });
    if (provider === 'qwen') return await analyzeWithQwen(prompt, { apiKey: qwenApiKey });
    if (provider === 'gemini') return await analyzeWithGemini(prompt, { apiKey: geminiApiKey });
    if (provider === 'openai') return await analyzeWithOpenAI(prompt, { apiKey: openaiApiKey });
    return analyzeWithNoAI(jdText, resumeText);
  } catch {
    return {
      matchScore: 0.5,
      summary: 'Could not parse AI response. Try again or check your API key.',
      strongPoints: [],
      missingSkills: [],
      coverLetter: '',
    };
  }
}

async function callProvider(prompt, { provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey, maxTokens = 1024 }) {
  if (provider === 'claude') return analyzeWithClaude(prompt, { apiKey: anthropicApiKey, maxTokens });
  if (provider === 'qwen') return analyzeWithQwen(prompt, { apiKey: qwenApiKey, maxTokens });
  if (provider === 'gemini') return analyzeWithGemini(prompt, { apiKey: geminiApiKey, maxTokens });
  if (provider === 'openai') return analyzeWithOpenAI(prompt, { apiKey: openaiApiKey, maxTokens });
  return null;
}

const EXTRACT_PROFILE_PROMPT = (resumeText) => `Extract structured profile information from this resume.
Return ONLY a JSON object with these exact keys:
{
  "firstName": "", "lastName": "", "email": "", "phone": "",
  "city": "", "state": "", "country": "", "zipCode": "",
  "linkedin": "", "github": "", "portfolio": "",
  "currentJob": { "isEmployed": false, "company": "", "title": "", "location": "", "startMonth": "", "startYear": "", "description": "" },
  "experience": [{ "company": "", "title": "", "type": "full-time", "location": "", "startMonth": "", "startYear": "", "endMonth": "", "endYear": "", "description": "" }],
  "education": [{ "institution": "", "degree": "", "field": "", "startYear": "", "endYear": "", "gpa": "", "honors": "" }],
  "skills": "", "languages": "", "tools": "",
  "expectedCTC": "", "noticePeriod": ""
}
Set isEmployed to true if the person has a current/ongoing job with no end date.
For missing fields use empty string. Return raw JSON only, no markdown.

RESUME:
${resumeText}`.trim();

export async function extractProfileFromResume({ resumeText, provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey }) {
  const prompt = EXTRACT_PROFILE_PROMPT(resumeText);
  const raw = await callProvider(prompt, { provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey, maxTokens: 3000 });
  if (!raw) throw new Error('No AI provider configured. Set an API key in Settings.');
  return raw;
}

const REWRITE_BULLETS_PROMPT = (jdText, bulletsText) => `
You are an expert resume writer. Rewrite each resume bullet to:
- Start with a strong action verb
- Naturally incorporate keywords from the job description
- Add a quantification prompt "[Add a metric here]" where a number would strengthen the bullet
- Keep the same core meaning, improve ATS and recruiter score

JOB DESCRIPTION:
${jdText}

BULLETS TO REWRITE (one per line):
${bulletsText}

Respond with JSON only:
{ "bullets": [{ "original": "...", "rewritten": "...", "tip": "..." }] }
`.trim();

export async function rewriteBullets({ bulletsText, jdText, provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey }) {
  const raw = await callProvider(REWRITE_BULLETS_PROMPT(jdText, bulletsText), { provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey });
  if (!raw) return null;
  return raw;
}

const GENERATE_QUESTIONS_PROMPT = (jdText, resumeText) => `You are a senior technical interviewer at a top tech company. Generate highly specific interview questions based ONLY on what is explicitly mentioned in the job description. Do not generate generic questions.

JOB DESCRIPTION:
${jdText}

${resumeText ? `CANDIDATE RESUME SUMMARY (first 500 chars):\n${resumeText.slice(0, 500)}` : 'No resume provided.'}

Generate questions that an interviewer WHO READ THIS EXACT JD would ask. Reference specific tools, frameworks, and responsibilities from the JD directly.

Rules:
- Technical questions MUST reference specific technologies named in the JD (e.g. if JD mentions PyTorch, LangChain, Kubernetes — use those exact names)
- Behavioral questions must reference scenarios relevant to the role level and domain described
- Role-specific questions must be based on actual responsibilities listed in the JD
- Every question must contain at least one proper noun (technology, framework, methodology, or company-relevant term)
- Each hint must state: what the interviewer is testing, and a tip on how to answer using the candidate's resume background
- Generate exactly 4 questions per category

Respond with JSON only — no prose before or after:
{
  "technical": [{ "question": "specific question mentioning actual tech from JD", "hint": "This tests X. Answer by referencing your experience with Y from your resume." }],
  "behavioral": [{ "question": "...", "hint": "..." }],
  "roleSpecific": [{ "question": "...", "hint": "..." }]
}`.trim();

function extractKeywords(text) {
  const stop = new Set(['the','and','for','are','you','this','that','with','from','will','have','your','our','they','been','their','has','was','not','but','all','can','when','what','who','how','which','its','use','more','also','work','using','must','able','good','new','may','any','per','each','both','make','into','only','well','than','other','team','role','experience','skills','required','preferred','job','position','company','ability','strong','including','within','across']);
  const words = text.toLowerCase().match(/\b[a-z][a-z\d+#.]{2,}\b/g) || [];
  const freq = {};
  words.forEach((w) => { if (!stop.has(w)) freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

function generateQuestionsNoAI(jdText) {
  const kw = extractKeywords(jdText).slice(0, 6);
  return {
    technical: kw.slice(0, 3).map((k) => ({
      question: `Describe your experience with ${k}.`,
      hint: `Give a specific example of a project where you used ${k} and the outcome.`,
    })),
    behavioral: [
      { question: 'Tell me about a time you overcame a significant technical challenge.', hint: 'Use STAR: Situation, Task, Action, Result.' },
      { question: 'How do you prioritize tasks when working under tight deadlines?', hint: 'Mention tools, frameworks, or communication strategies you use.' },
      { question: 'Describe a time you collaborated across teams to deliver a project.', hint: 'Focus on how you handled conflicting priorities and communication.' },
    ],
    roleSpecific: kw.slice(3, 6).map((k) => ({
      question: `How would you apply ${k} in this role?`,
      hint: `Think about the company's scale and the specific challenges this role faces.`,
    })),
  };
}

export async function generateQuestions({ jdText, resumeText, provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey }) {
  const raw = await callProvider(GENERATE_QUESTIONS_PROMPT(jdText, resumeText), { provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey });
  if (!raw) return generateQuestionsNoAI(jdText);
  return raw;
}

const GENERATE_ROADMAP_PROMPT = (jdText, resumeText) => `You are an expert career coach. Analyze the skill gap between the candidate's resume and the job requirements, then create a focused, role-specific study roadmap.

JOB DESCRIPTION:
${jdText}

${resumeText ? `CANDIDATE RESUME:\n${resumeText}` : 'No resume provided — base roadmap on common gaps for this role.'}

Instructions:
- Topics MUST come from actual skill gaps between the resume and JD — do not invent generic topics
- Each topic must explain why it matters for this specific role
- Resources must be specific: use real URLs (official docs, MDN, Kubernetes.io, PyTorch docs) or named courses (Coursera, Fast.ai, A Cloud Guru) — not vague "search online"
- Order topics by priority descending (high first)
- Generate 4–6 topics total

You MUST return ONLY this exact JSON shape — no prose, no markdown fences, no explanation:
{
  "timeframe": "2-3 weeks",
  "topics": [
    {
      "topic": "Topic name",
      "priority": "high",
      "resources": "https://specific-url.com or Course Name on Platform",
      "days": 3
    }
  ]
}`.trim();

export async function generateRoadmap({ jdText, resumeText, provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey }) {
  console.log('[huntkit] generateRoadmap called', { resume: resumeText?.slice(0, 50), jd: jdText?.slice(0, 50) });
  const raw = await callProvider(GENERATE_ROADMAP_PROMPT(jdText, resumeText), { provider, anthropicApiKey, qwenApiKey, geminiApiKey, openaiApiKey });
  if (!raw) return null;
  console.log('[huntkit] roadmap result:', raw);
  return raw;
}
