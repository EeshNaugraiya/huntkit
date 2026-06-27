const STOP_WORDS = new Set([
  // Articles, conjunctions, prepositions
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'is', 'are', 'was', 'you', 'we', 'will', 'be', 'have', 'has', 'it',
  'that', 'this', 'our', 'your', 'they', 'their', 'them', 'from', 'not', 'by',
  'can', 'may', 'must', 'shall', 'been', 'were', 'had', 'did', 'does', 'do',
  // Job-description filler — Fix 1
  'about', 'role', 'job', 'work', 'team', 'good', 'strong',
  'experience', 'ability', 'skills', 'knowledge', 'understanding',
  'working', 'including', 'related', 'relevant', 'required',
  'preferred', 'plus', 'years', 'year', 'time', 'new', 'well',
  'also', 'within', 'across', 'using', 'used', 'use', 'under',
  'over', 'per', 'any', 'all', 'other', 'such', 'both', 'each',
  'more', 'most', 'than', 'then', 'when', 'where', 'who', 'how',
  'what', 'which', 'while', 'through', 'into', 'onto', 'upon',
  'after', 'before', 'between', 'during', 'without', 'provide',
  'ensure', 'support', 'manage', 'develop', 'build', 'create',
  'senior', 'junior', 'lead', 'description', 'proficiency',
  'guidance', 'responsible', 'opportunity', 'position', 'candidate',
  'company', 'business', 'based', 'identified', 'feasibility',
  'fine', 'dataset', 'conduct', 'execute', 'perform', 'deliver',
]);

// Fix 3 — known tech prefixes / patterns
const TECH_PATTERNS = /^(react|python|pytorch|tensorflow|docker|kubernetes|langchain|fastapi|mongodb|postgres|redis|aws|gcp|azure|nodejs|typescript|graphql|kafka|spark|hadoop|scikit|opencv|hugging)/i;

function isTechToken(w) {
  if (TECH_PATTERNS.test(w)) return true;
  if (/\d/.test(w)) return true;                           // python3, gpt-4, s3
  if (/[+#]/.test(w)) return true;                        // c++, c#
  if (/\.(js|py|ml|ai|db|api|css|sql|ts|go|rb)$/.test(w)) return true; // node.js
  if (w.length > 4 && /(js|py|sql|api|css|xml|sdk|cli|iam|ecs|eks|rds)$/.test(w)) return true;
  return false;
}

// Returns frequency map of all raw tokens in text
function tokenFreq(text) {
  const words = text.toLowerCase().match(/\b[a-z][a-z+#.-]{2,}\b/g) || [];
  const freq = {};
  words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
  return freq;
}

// Returns deduplicated token array, filtered to meaningful words (Fix 2: length > 3)
function tokenize(text) {
  return [
    ...new Set(text.toLowerCase().match(/\b[a-z][a-z+#.-]{2,}\b/g) || []),
  ].filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

export function analyzeWithNoAI(jdText, resumeText) {
  const jdFreq = tokenFreq(jdText);

  // Unique filtered JD tokens (used for scoring and display)
  const jdTokens = [...new Set(Object.keys(jdFreq))].filter(
    (w) => w.length > 3 && !STOP_WORDS.has(w)
  );

  const resumeSet = new Set(resumeText ? tokenize(resumeText) : []);

  // Fix 3 — weighted scoring: tech tokens count 2×
  let matchWeight = 0;
  let totalWeight = 0;
  for (const w of jdTokens) {
    const weight = isTechToken(w) ? 2 : 1;
    totalWeight += weight;
    if (resumeSet.has(w)) matchWeight += weight;
  }

  const matchScore = totalWeight > 0
    ? parseFloat(Math.min(matchWeight / totalWeight, 1).toFixed(2))
    : 0;

  // Fix 4 — display only likely-skill tokens: tech OR high-frequency in JD
  const isSkillToken = (w) => isTechToken(w) || (jdFreq[w] || 0) >= 2;

  const strongPoints = jdTokens.filter((w) => resumeSet.has(w) && isSkillToken(w)).slice(0, 8);
  const missingSkills = jdTokens.filter((w) => !resumeSet.has(w) && isSkillToken(w)).slice(0, 8);

  return {
    matchScore,
    summary: 'Keyword-based analysis (no AI provider configured). Enable Claude, Gemini, or OpenAI in Settings for detailed insights.',
    strongPoints,
    missingSkills,
    coverLetter: '',
  };
}
