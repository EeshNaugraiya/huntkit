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

  let raw;
  if (provider === 'claude') {
    raw = await analyzeWithClaude(prompt, { apiKey: anthropicApiKey });
  } else if (provider === 'qwen') {
    raw = await analyzeWithQwen(prompt, { apiKey: qwenApiKey });
  } else if (provider === 'gemini') {
    raw = await analyzeWithGemini(prompt, { apiKey: geminiApiKey });
  } else if (provider === 'openai') {
    raw = await analyzeWithOpenAI(prompt, { apiKey: openaiApiKey });
  } else {
    return analyzeWithNoAI(jdText, resumeText);
  }

  return parseAnalysisJSON(raw);
}

function parseAnalysisJSON(raw) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
    // fall through to default
  }
  return {
    matchScore: 0.5,
    summary: raw.slice(0, 300),
    strongPoints: [],
    missingSkills: [],
    coverLetter: '',
  };
}
