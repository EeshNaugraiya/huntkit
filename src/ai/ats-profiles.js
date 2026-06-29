// Port of github.com/sunnypatell/ats-screener scoring engine (MIT License)
// Source: src/lib/engine/scorer/ + nlp/ — ported from TypeScript by huntkit

// ─── Stop words (nlp/tokenizer.ts) ───────────────────────────────────────────
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','as','is','was','are','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'need','not','no','nor','so','if','then','than','too','very','just','about',
  'above','after','again','all','also','am','any','because','before','between',
  'both','each','few','further','get','got','here','how','i','into','it','its',
  'me','more','most','my','myself','now','only','other','our','out','over','own',
  'same','she','he','her','him','his','some','such','that','their','them','there',
  'these','they','this','those','through','under','until','up','us','we','what',
  'when','where','which','while','who','whom','why','you','your','etc','ie','eg',
  'per','via',
  // JD boilerplate — prevents common filler phrases from inflating missing-keyword lists
  'job','minimum','qualifications','required','preferred','bachelor','equivalent',
  'practical','strong','good','ability','following','include','including','must',
  'have','nice','plus','bonus','least','seek','looking','ideal','like','want',
  'high','degree','experience','languages','year','technology','human','learning',
  'team','work','role','position','candidate','company','skills','knowledge',
  'understanding','working','related','relevant','years','using','used','use',
  'able','well','within','across','provide','ensure','support','manage','develop',
  'build','create','senior','junior','lead','responsible','opportunity','business',
  'based','background','proven','demonstrated','excellent','effective',
  'collaborative','communication','written','verbal','analytical','oriented',
  'environment','growing','scale','detail','fast','paced',
]);

// Filters display keyword lists — removes stop words, pure numbers, and short tokens
const SKILL_FILTER = (kw) =>
  kw.length > 3 &&
  !STOP_WORDS.has(kw.toLowerCase()) &&
  !/^\d+$/.test(kw);

// ─── Synonym groups (nlp/synonyms.ts) ────────────────────────────────────────
const SYNONYM_GROUPS = [
  // programming languages
  ['javascript','js','ecmascript','es6','es2015'],
  ['typescript','ts'],
  ['python','py','python3'],
  ['c++','cpp','c plus plus'],
  ['c#','csharp','c sharp'],
  ['golang','go'],
  ['rust','rustlang'],
  ['ruby','rb'],
  ['kotlin','kt'],
  ['swift','swiftlang'],
  ['objective-c','objc','obj-c'],
  // frameworks / libraries
  ['react','reactjs','react.js'],
  ['angular','angularjs','angular.js'],
  ['vue','vuejs','vue.js'],
  ['svelte','sveltejs','sveltekit'],
  ['next.js','nextjs','next'],
  ['node.js','nodejs','node'],
  ['express','expressjs','express.js'],
  ['django','django rest framework','drf'],
  ['flask','flask api'],
  ['spring','spring boot','spring framework'],
  ['.net','dotnet','.net core','asp.net'],
  ['ruby on rails','rails','ror'],
  ['laravel','laravel php'],
  ['fastapi','fast api'],
  // databases
  ['postgresql','postgres','psql'],
  ['mysql','my sql'],
  ['mongodb','mongo'],
  ['microsoft sql server','mssql','sql server','tsql','t-sql'],
  ['dynamodb','dynamo db','aws dynamodb'],
  ['elasticsearch','elastic search','es'],
  ['redis','redis cache'],
  ['cassandra','apache cassandra'],
  ['sqlite','sqlite3'],
  // cloud / infrastructure
  ['amazon web services','aws'],
  ['google cloud platform','gcp','google cloud'],
  ['microsoft azure','azure'],
  ['docker','containerization','containers'],
  ['kubernetes','k8s'],
  ['terraform','infrastructure as code','iac'],
  ['ci/cd','cicd','continuous integration','continuous deployment'],
  ['github actions','gh actions'],
  ['jenkins','jenkins ci'],
  ['gitlab ci','gitlab ci/cd'],
  // data / ML
  ['machine learning','ml'],
  ['artificial intelligence','ai'],
  ['deep learning','dl'],
  ['natural language processing','nlp'],
  ['computer vision','cv'],
  ['tensorflow','tf'],
  ['pytorch','torch'],
  ['pandas','python pandas'],
  ['numpy','np'],
  ['scikit-learn','sklearn'],
  ['data science','data analytics'],
  ['business intelligence','bi'],
  ['extract transform load','etl'],
  ['data warehouse','dwh','data warehousing'],
  ['large language model','llm'],
  ['retrieval augmented generation','rag'],
  ['mlops','machine learning operations'],
  // finance
  ['generally accepted accounting principles','gaap'],
  ['certified public accountant','cpa'],
  ['chartered financial analyst','cfa'],
  ['profit and loss','p&l','pnl'],
  ['return on investment','roi'],
  ['key performance indicator','kpi','kpis'],
  ['enterprise resource planning','erp'],
  ['mergers and acquisitions','m&a'],
  ['discounted cash flow','dcf'],
  // marketing
  ['search engine optimization','seo'],
  ['search engine marketing','sem'],
  ['customer relationship management','crm'],
  ['salesforce','sfdc','salesforce crm'],
  ['google analytics','ga','ga4'],
  ['content management system','cms'],
  ['a/b testing','ab testing','split testing'],
  ['net promoter score','nps'],
  ['customer lifetime value','clv','ltv'],
  // HR
  ['human resources','hr'],
  ['applicant tracking system','ats'],
  ['human resource information system','hris'],
  ['diversity equity and inclusion','dei','de&i'],
  // project management
  ['project management','pm'],
  ['project management professional','pmp'],
  ['certified scrum master','csm'],
  ['agile','agile methodology'],
  ['scrum','scrum framework'],
  ['kanban','kanban board'],
  ['jira','atlassian jira'],
  // legal
  ['intellectual property','ip'],
  ['non-disclosure agreement','nda'],
  ['service level agreement','sla'],
  ['general data protection regulation','gdpr'],
  // supply chain
  ['supply chain management','scm'],
  ['six sigma','6 sigma','6sigma'],
  ['lean manufacturing','lean'],
  // education / degrees
  ['bachelor of science','bs','b.s.'],
  ['bachelor of arts','ba','b.a.'],
  ['master of science','ms','m.s.'],
  ['master of arts','ma','m.a.'],
  ['master of business administration','mba','m.b.a.'],
  ['doctor of philosophy','phd','ph.d.'],
  // general professional
  ['microsoft office','ms office','office 365','microsoft 365'],
  ['microsoft excel','excel','ms excel'],
  ['microsoft powerpoint','powerpoint','ms powerpoint','ppt'],
  ['tableau','tableau desktop','tableau server'],
  ['power bi','powerbi','microsoft power bi'],
  ['cross functional','cross-functional'],
  ['stakeholder management','stakeholder engagement'],
  ['problem solving','problem-solving'],
  ['team leadership','team lead','team management'],
];

// Build canonical lookup map: every variant → first term in group
const _synonymMap = new Map();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const variant of group) _synonymMap.set(variant.toLowerCase(), canonical);
}

function getCanonical(term) {
  return _synonymMap.get(term.toLowerCase()) ?? term.toLowerCase();
}

function areSynonyms(t1, t2) {
  return getCanonical(t1) === getCanonical(t2);
}

// ─── Tokenizer (nlp/tokenizer.ts) ────────────────────────────────────────────
// Split on whitespace/comma/semicolon/pipe; strip leading/trailing punctuation
// (preserve internal hyphens, dots, +, #); filter stop words + min length 2
function tokenize(text) {
  text = (text || '').replace(/\.(?=\d)/g, ' ');
  const words = text.split(/[\s,;|]+/);
  const tokens = [];
  for (let i = 0; i < words.length; i++) {
    const cleaned = words[i].replace(/^[^a-zA-Z0-9#+]+|[^a-zA-Z0-9#+]+$/g, '');
    if (!cleaned) continue;
    const normalized = cleaned.toLowerCase();
    if (STOP_WORDS.has(normalized) || normalized.length < 2) continue;
    tokens.push({ normalized, position: i });
  }
  return tokens;
}

// ─── Keyword matcher (scorer/keyword-matcher.ts) ─────────────────────────────
// exact:    token-level exact match only
// fuzzy:    exact + synonym/canonical matching
// semantic: fuzzy + partial substring (len≥3) + raw-text substring fallback
// Score formula: (exactMatches + synonymMatches×0.8) / totalJdTerms × 100
function matchKeywords(resumeText, jdText, strategy) {
  if (!jdText || !jdText.trim()) return { score: 100, matched: [], missing: [], synonymMatched: [] };

  const resumeTokens = tokenize(resumeText);
  const jdTokens = tokenize(jdText);

  const resumeTerms = new Set(resumeTokens.map((t) => t.normalized));
  const jdTerms = [...new Set(jdTokens.map((t) => t.normalized))];
  const resumeCanonicals = new Set(resumeTokens.map((t) => getCanonical(t.normalized)));
  const resumeLower = (resumeText || '').toLowerCase();

  const matched = [];
  const missing = [];
  const synonymMatched = [];

  for (const jdTerm of jdTerms) {
    // 1. exact match
    if (resumeTerms.has(jdTerm)) { matched.push(jdTerm); continue; }
    if (strategy === 'exact') { missing.push(jdTerm); continue; }

    // 2. fuzzy: canonical / synonym match
    if (resumeCanonicals.has(getCanonical(jdTerm))) { synonymMatched.push(jdTerm); continue; }
    let foundSyn = false;
    for (const rt of resumeTerms) {
      if (areSynonyms(rt, jdTerm)) { synonymMatched.push(jdTerm); foundSyn = true; break; }
    }
    if (foundSyn) continue;
    if (strategy === 'fuzzy') { missing.push(jdTerm); continue; }

    // 3. semantic: partial substring match (min 3 chars overlap)
    let foundPartial = false;
    for (const rt of resumeTerms) {
      if ((rt.includes(jdTerm) || jdTerm.includes(rt)) && Math.min(rt.length, jdTerm.length) >= 3) {
        synonymMatched.push(jdTerm); foundPartial = true; break;
      }
    }
    if (foundPartial) continue;

    // 4. semantic: raw text contains (handles multi-word compound skills)
    if (jdTerm.length >= 4 && resumeLower.includes(jdTerm)) { matched.push(jdTerm); continue; }

    missing.push(jdTerm);
  }

  const total = jdTerms.length;
  if (total === 0) return { score: 100, matched, missing, synonymMatched };

  const effective = matched.length + synonymMatched.length * 0.8;
  return { score: Math.round(Math.min(100, (effective / total) * 100)), matched, missing, synonymMatched };
}

// ─── Resume parser ────────────────────────────────────────────────────────────
// Extracts structured signals from raw text for the scoring engine.
// (The original receives pre-parsed structured data; we derive it here.)

function _detectSections(text) {
  const sections = new Set();
  // contact: email, phone, or international number
  if (/\b[\w.+-]+@[\w-]+\.\w{2,}\b/.test(text) ||
      /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(text) ||
      /\+\d[\d\s\-()​]{8,}/.test(text)) {
    sections.add('contact');
  }
  for (const line of text.toLowerCase().split('\n')) {
    const t = line.trim();
    if (!t || t.length > 60) continue;
    if (/\b(summary|objective|profile|about|overview)\b/.test(t)) sections.add('summary');
    if (/\b(experience|work|employment|career|history)\b/.test(t)) sections.add('experience');
    if (/\b(education|degree|academic|qualification|schooling)\b/.test(t)) sections.add('education');
    if (/\b(skill|technolog|technical|competenc|proficienc|expertise)\b/.test(t)) sections.add('skills');
    if (/\b(project|portfolio|open.?source|contribution)\b/.test(t)) sections.add('projects');
    if (/\b(certif|license|credential|accreditation)\b/.test(t)) sections.add('certifications');
  }
  // education fallback: degree keywords anywhere
  if (!sections.has('education') &&
      /\b(bachelor|master|phd|b\.tech|btech|b\.s\.|m\.s\.|mba|university|college|institute)\b/i.test(text)) {
    sections.add('education');
  }
  return [...sections];
}

function _extractBullets(text) {
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const bulletSet = new Set();

  // Pass 1: explicit bullet symbols (standard resumes)
  for (const l of lines) {
    if ((/^[-•*·▪►➤○●]\s+/.test(l) || /^\d+\.\s+/.test(l)) && l.length > 20) {
      bulletSet.add(l.replace(/^[-•*·▪►➤○●]\s+/, '').replace(/^\d+\.\s+/, '').trim());
    }
  }

  // Pass 2: PDF fallback — plain lines that look like experience bullets without symbols
  const _sectionPat = /^(experience|education|skills|projects|certif|summary|objective|work|employment|profile|contact|about|overview)/i;
  for (const l of lines) {
    if (l.length < 40 || l.length > 200) continue;
    if (l === l.toUpperCase() && /[A-Z]/.test(l)) continue; // all-caps header
    if (_sectionPat.test(l) && l.length < 60) continue;
    if (/^[-•*·▪►➤○●]\s+/.test(l) || /^\d+\.\s+/.test(l)) continue; // already caught
    const firstWord = l.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (/^[A-Z]/.test(l) || (firstWord && STRONG_ACTION_VERBS.has(firstWord))) {
      bulletSet.add(l);
    }
  }

  return [...bulletSet];
}

function _extractEducationText(text) {
  const lines = text.split('\n');
  let inEdu = false;
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!inEdu && /^(education|academic|qualification|degree)/i.test(t) && t.length < 40) {
      inEdu = true; continue;
    }
    if (inEdu && /^(experience|work|skill|project|certif|summary|objective|publication|award)/i.test(t) && t.length < 40) {
      inEdu = false;
    }
    if (inEdu && t.length > 0) out.push(t);
  }
  if (out.length === 0) {
    const m = text.match(/.*(bachelor|master|phd|b\.tech|btech|b\.s\.|m\.s\.|mba|doctorate|university|college|institute).*/gi);
    return m ? m.slice(0, 6).join('\n') : '';
  }
  return out.slice(0, 20).join('\n');
}

function _extractSkills(text) {
  const lines = text.toLowerCase().split('\n');
  let inSkills = false;
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!inSkills && /^(skill|technolog|technical|competenc|expertise)/i.test(t) && t.length < 50) {
      inSkills = true; continue;
    }
    if (inSkills && /^(experience|work|education|project|certif|summary|objective)/i.test(t) && t.length < 40) {
      inSkills = false;
    }
    if (inSkills && t.length > 1) out.push(t);
  }
  if (out.length === 0) return [];
  return out.join(' ').split(/[,|•·/\\]|\s{2,}/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40);
}

function _parseResume(text) {
  const t = text || '';
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const pipeCount = (t.match(/\|/g) || []).length;
  const lines = t.split('\n');
  const shortLines = lines.filter((l) => l.trim().length > 5 && l.trim().length < 40).length;
  return {
    resumeText: t,
    resumeSections: _detectSections(t),
    resumeSkills: _extractSkills(t),
    experienceBullets: _extractBullets(t),
    educationText: _extractEducationText(t),
    hasMultipleColumns: shortLines > lines.length * 0.6 && lines.length > 20,
    hasTables: pipeCount > 10,
    hasImages: false,
    pageCount: Math.max(1, Math.ceil(wordCount / 400)),
    wordCount,
  };
}

// ─── Format scorer (scorer/format-scorer.ts) ─────────────────────────────────
// Starts at 100 and applies deductions scaled by parsingStrictness (0–1).
function _scoreFormatting(parsed, strictness) {
  let d = 0;
  const issues = [];
  if (parsed.hasMultipleColumns) { d += 15 * strictness; issues.push('Multi-column layout — use single column'); }
  if (parsed.hasTables)          { d += 12 * strictness; issues.push('Tables detected — convert to bullet lists'); }
  if (parsed.pageCount > 2)      { d += 5  * strictness; issues.push(`${parsed.pageCount} pages — trim to 1–2`); }
  if (parsed.wordCount < 150)    { d += 10 * strictness; issues.push('Too short — add more detail'); }
  else if (parsed.wordCount > 1500) { d += 3 * strictness; issues.push('Too long — consider condensing'); }

  const specialRatio = (parsed.resumeText.match(/[^\w\s.,;:!?@#$%&*()\-+=/\\'"]/g) || []).length /
                       Math.max(1, parsed.resumeText.length);
  if (specialRatio > 0.05) { d += 8 * strictness; issues.push('Special symbols may confuse ATS parsers'); }

  const lines = parsed.resumeText.split('\n');
  const capLines = lines.filter((l) => l.trim().length > 30 && l.trim() === l.trim().toUpperCase() && /[A-Z]/.test(l)).length;
  if (capLines > 3) { d += 3 * strictness; issues.push('All-caps headers may not parse correctly'); }

  const bulletLines = lines.filter((l) => /^\s*[-•*·▪►➤○●]\s/.test(l));
  const bulletKinds = new Set(bulletLines.map((l) => l.match(/^\s*([-•*·▪►➤○●])/)?.[1] ?? ''));
  if (bulletKinds.size > 2) { d += 2 * strictness; issues.push('Mixed bullet styles — standardize to one'); }

  return { score: Math.max(0, Math.min(100, Math.round(100 - d))), issues };
}

// ─── Section scorer (scorer/section-scorer.ts) ───────────────────────────────
function _scoreSections(presentSections, requiredSections) {
  const ps = new Set(presentSections.map((s) => s.toLowerCase()));
  const present = requiredSections.filter((r) => ps.has(r.toLowerCase()));
  const score = requiredSections.length > 0 ? Math.round((present.length / requiredSections.length) * 100) : 100;
  return { score, present, missing: requiredSections.filter((r) => !ps.has(r.toLowerCase())) };
}

// ─── Experience scorer (scorer/experience-scorer.ts) ─────────────────────────
const STRONG_ACTION_VERBS = new Set([
  'achieved','accelerated','administered','advanced','analyzed','architected','automated',
  'built','centralized','championed','collaborated','conceptualized','consolidated',
  'contributed','converted','coordinated','created','decreased','delivered','designed',
  'developed','directed','drove','eliminated','enabled','engineered','established',
  'exceeded','executed','expanded','facilitated','founded','generated','grew','headed',
  'identified','implemented','improved','increased','influenced','initiated','innovated',
  'integrated','introduced','launched','led','leveraged','managed','maximized','mentored',
  'migrated','modernized','negotiated','operated','optimized','orchestrated','organized',
  'outperformed','overhauled','oversaw','pioneered','planned','presented','prioritized',
  'produced','programmed','proposed','published','raised','recommended','redesigned',
  'reduced','refactored','reformed','reorganized','replaced','researched','resolved',
  'restructured','revamped','revolutionized','scaled','secured','simplified','spearheaded',
  'standardized','streamlined','strengthened','supervised','surpassed','synchronized',
  'trained','transformed','translated','unified','upgraded',
]);

const QUANT_PATTERNS = [
  /\d+%/,
  /\$[\d,]+/,
  /\d+\s*(?:x|times)/i,
  /\d+\+?\s*(?:users?|customers?|clients?|employees?|members?|team)/i,
  /\d+\+?\s*(?:projects?|products?|applications?|systems?|services?)/i,
  /(?:top|first|#)\s*\d+/i,
  /\d+\s*(?:hours?|days?|weeks?|months?|years?)/i,
  /\d{1,3}(?:,\d{3})+/,
  /\d+\s*(?:million|billion|thousand|k|m|b)\b/i,
];

// Returns { score 0-100, quantifiedBullets, totalBullets }
// quantScore(0-40) + actionScore(0-30) + bulletCountScore(10-30) = max 100
function _scoreExperience(bullets, resumeText) {
  let effectiveBullets = bullets;

  // Fallback for PDF-extracted text: scan full text when bullet detection found < 3 items
  if (bullets.length < 3 && resumeText) {
    const segments = resumeText
      .split(/\n|\.\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 300);
    const extra = segments.filter((s) => {
      const firstWord = s.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
      return (firstWord && STRONG_ACTION_VERBS.has(firstWord)) || QUANT_PATTERNS.some((p) => p.test(s));
    });
    effectiveBullets = [...new Set([...bullets, ...extra])];
  }

  if (!effectiveBullets.length) return { score: 0, quantifiedBullets: 0, totalBullets: 0 };
  let quantifiedBullets = 0;
  let actionVerbCount = 0;
  for (const b of effectiveBullets) {
    if (QUANT_PATTERNS.some((p) => p.test(b))) quantifiedBullets++;
    const first = b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (first && STRONG_ACTION_VERBS.has(first)) actionVerbCount++;
  }
  const n = effectiveBullets.length;
  const quantScore = Math.min(1, quantifiedBullets / n / 0.4) * 40;
  const actionScore = Math.min(1, actionVerbCount / n / 0.7) * 30;
  const countScore = n >= 8 ? 30 : n >= 5 ? 25 : n >= 3 ? 20 : 10;
  return { score: Math.round(Math.min(100, quantScore + actionScore + countScore)), quantifiedBullets, totalBullets: n };
}

// ─── Education scorer (scorer/education-scorer.ts) ───────────────────────────
const DEGREE_LEVELS = {
  phd: 5, 'ph.d': 5, doctor: 5, doctorate: 5,
  master: 4, "master's": 4, mba: 4, ms: 4, 'm.s': 4, ma: 4, 'm.a': 4, 'm.b.a': 4,
  mtech: 4, 'm.tech': 4,
  bachelor: 3, "bachelor's": 3, bs: 3, 'b.s': 3, ba: 3, 'b.a': 3, 'b.eng': 3,
  'b.tech': 3, btech: 3, 'b.e': 3,
  associate: 2, "associate's": 2, diploma: 1, certificate: 1, certification: 1,
};

// degree(30) + institution(20) + date(15) + field(15) + GPA(10) + honors(10) = max 100
function _scoreEducation(educationText) {
  if (!educationText || !educationText.trim()) return 20;
  const lower = educationText.toLowerCase();
  let s = 0;

  let highest = 0;
  for (const [deg, lvl] of Object.entries(DEGREE_LEVELS)) {
    if (lower.includes(deg) && lvl > highest) highest = lvl;
  }
  if (highest > 0) s += 30;

  if (/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+/.test(educationText) ||
      /\b(iit|nit|bits|iiit|iim)\b/i.test(educationText)) s += 20;

  if (/\b(19|20)\d{2}\b/.test(educationText)) s += 15;

  if (/\b(computer science|engineering|business|mathematics|biology|chemistry|physics|economics|finance|accounting|marketing|technology|information systems|information technology)\b/i.test(educationText)) s += 15;

  if (/\bgpa\b/i.test(educationText) || /\b[34]\.\d{1,2}\s*\/?\s*4\b/i.test(educationText)) s += 10;

  if (/\b(cum laude|magna cum laude|summa cum laude|dean'?s?\s*list|honors?|distinction|first class|gold medal)\b/i.test(educationText)) s += 10;

  return Math.min(100, s);
}

// ─── ATS Profiles (scorer/profiles/*.ts) ──────────────────────────────────────
// Exact weights, strategies, passing scores, and quirk logic from source profiles.
const PROFILES = [
  {
    name: 'Workday',
    // workday.ts: parsingStrictness 0.9, exact keyword strategy
    keywordStrategy: 'exact',
    parsingStrictness: 0.9,
    weights: { formatting: 0.25, keywordMatch: 0.30, sectionCompleteness: 0.15, experienceRelevance: 0.15, educationMatch: 0.10, quantification: 0.05 },
    requiredSections: ['contact', 'experience', 'education', 'skills'],
    passingScore: 70,
    tip: 'Workday uses exact + AI matching. Focus on section headers and standard formatting.',
    prioritizes: {
      checks: ['Standard section headers (Experience, Education, Skills)', 'Clean single-column formatting', 'Exact keyword matches from JD'],
      crosses: ['Tables, text boxes, headers/footers', 'Creative or graphic resume layouts'],
    },
    applyQuirks(parsed, score) {
      // workday-page-limit: may truncate beyond 2 pages (-8)
      return Math.max(0, Math.min(100, score + (parsed.pageCount > 2 ? -8 : 0)));
    },
  },
  {
    name: 'Taleo',
    // taleo.ts: parsingStrictness 0.85, exact, highest keyword weight
    keywordStrategy: 'exact',
    parsingStrictness: 0.85,
    weights: { formatting: 0.20, keywordMatch: 0.35, sectionCompleteness: 0.15, experienceRelevance: 0.15, educationMatch: 0.10, quantification: 0.05 },
    requiredSections: ['contact', 'experience', 'education', 'skills'],
    passingScore: 65,
    tip: 'Taleo is the strictest — literal keyword matching only. Add exact phrases from the JD.',
    prioritizes: {
      checks: ['Literal exact keyword phrases from JD', 'Standard chronological format', 'Spelled out acronyms'],
      crosses: ['Synonyms or paraphrased keywords', 'Abbreviations (write Python not py)'],
    },
    applyQuirks(parsed, score) {
      let adj = 0;
      // taleo-keyword-density: <5 skills detected → -10
      if (parsed.resumeSkills.length < 5) adj -= 10;
      // taleo-section-headers: >1 missing standard section → -8
      const missing = ['contact','experience','education','skills'].filter((s) => !parsed.resumeSections.includes(s));
      if (missing.length > 1) adj -= 8;
      return Math.max(0, Math.min(100, score + adj));
    },
  },
  {
    name: 'iCIMS',
    // icims.ts: parsingStrictness 0.6, fuzzy strategy (AI-assisted)
    keywordStrategy: 'fuzzy',
    parsingStrictness: 0.6,
    weights: { formatting: 0.15, keywordMatch: 0.30, sectionCompleteness: 0.15, experienceRelevance: 0.20, educationMatch: 0.10, quantification: 0.10 },
    requiredSections: ['contact', 'experience', 'education'],
    passingScore: 60,
    tip: 'iCIMS uses semantic ML — most forgiving. Context and synonyms count here.',
    prioritizes: {
      checks: ['Semantic keyword matching (synonyms count)', 'Strong experience section with metrics', 'Natural language descriptions'],
      crosses: ['Keyword stuffing (penalized)', 'Overly sparse bullet points'],
    },
    applyQuirks(parsed, score) {
      // icims-skills-taxonomy: ≥10 skills → bonus +5
      return Math.max(0, Math.min(100, score + (parsed.resumeSkills.length >= 10 ? 5 : 0)));
    },
  },
  {
    name: 'Greenhouse',
    // greenhouse.ts: parsingStrictness 0.4, semantic, rewards quantification
    keywordStrategy: 'semantic',
    parsingStrictness: 0.4,
    weights: { formatting: 0.10, keywordMatch: 0.25, sectionCompleteness: 0.10, experienceRelevance: 0.25, educationMatch: 0.10, quantification: 0.20 },
    requiredSections: ['experience', 'education'],
    passingScore: 55,
    tip: "Greenhouse doesn't auto-score. Focus on compelling narrative and quantified impact.",
    prioritizes: {
      checks: ['Compelling narrative and storytelling', 'Quantified achievements (%, $, x improvement)', 'Clear career progression'],
      crosses: ['Keyword stuffing', 'Generic bullet points without impact'],
    },
    applyQuirks(parsed, score) {
      let adj = 0;
      // greenhouse-quantification: ≥40% quantified bullets → +8
      if (parsed.experienceBullets.length > 0) {
        const qRatio = parsed.experienceBullets.filter((b) => QUANT_PATTERNS.some((p) => p.test(b))).length / parsed.experienceBullets.length;
        if (qRatio >= 0.4) adj += 8;
      }
      // greenhouse-projects: projects section present → +3
      if (parsed.resumeSections.includes('projects')) adj += 3;
      return Math.max(0, Math.min(100, score + adj));
    },
  },
  {
    name: 'Lever',
    // lever.ts: parsingStrictness 0.35, semantic, most lenient, rewards narrative quality
    keywordStrategy: 'semantic',
    parsingStrictness: 0.35,
    weights: { formatting: 0.08, keywordMatch: 0.22, sectionCompleteness: 0.10, experienceRelevance: 0.30, educationMatch: 0.10, quantification: 0.20 },
    requiredSections: ['experience'],
    passingScore: 50,
    tip: "Lever is search-dependent. Recruiters search for skills — make sure they're explicitly listed.",
    prioritizes: {
      checks: ['Explicitly listed skills (recruiter search-dependent)', 'Job titles matching searched roles', 'Location and availability clearly stated'],
      crosses: ['Implied skills not explicitly named', 'Abbreviations (write Machine Learning not ML)'],
    },
    applyQuirks(parsed, score) {
      let adj = 0;
      // lever-narrative: avg bullet 60-150 chars → +5
      if (parsed.experienceBullets.length > 0) {
        const avg = parsed.experienceBullets.reduce((s, b) => s + b.length, 0) / parsed.experienceBullets.length;
        if (avg >= 60 && avg <= 150) adj += 5;
      }
      // lever-summary: summary section present → +3
      if (parsed.resumeSections.includes('summary')) adj += 3;
      return Math.max(0, Math.min(100, score + adj));
    },
  },
  {
    name: 'SuccessFactors',
    // successfactors.ts: parsingStrictness 0.85, exact, rigid SAP field mapping
    keywordStrategy: 'exact',
    parsingStrictness: 0.85,
    weights: { formatting: 0.25, keywordMatch: 0.25, sectionCompleteness: 0.20, experienceRelevance: 0.15, educationMatch: 0.10, quantification: 0.05 },
    requiredSections: ['contact', 'experience', 'education', 'skills'],
    passingScore: 65,
    tip: 'SuccessFactors normalizes skills taxonomy. Spell out abbreviations (ML → Machine Learning).',
    prioritizes: {
      checks: ['Full skill names spelled out', 'Standardized job titles', 'Education section with degree + institution'],
      crosses: ['Abbreviated or shortened skill names', 'Non-standard section names'],
    },
    applyQuirks(parsed, score) {
      let adj = 0;
      // sf-structured-data: no dates detected → -10
      if (!/\b(19|20)\d{2}\b/.test(parsed.resumeText)) adj -= 10;
      // sf-structured-data: no experience entries → -8
      if (parsed.experienceBullets.length === 0) adj -= 8;
      // sf-section-structure: each missing required section → -5
      const missing = ['contact','experience','education','skills'].filter((s) => !parsed.resumeSections.includes(s));
      adj -= missing.length * 5;
      return Math.max(0, Math.min(100, score + adj));
    },
  },
];

// ─── Engine (scorer/engine.ts) ────────────────────────────────────────────────

function _scoreAgainstProfile(parsed, jdText, profile) {
  const kw  = matchKeywords(parsed.resumeText, jdText, profile.keywordStrategy);
  const fmt = _scoreFormatting(parsed, profile.parsingStrictness);
  const sec = _scoreSections(parsed.resumeSections, profile.requiredSections);
  const exp = _scoreExperience(parsed.experienceBullets, parsed.resumeText);
  const edu = _scoreEducation(parsed.educationText);

  // quantification is a separate dimension derived from experience bullets (engine.ts:88)
  const quantScore = exp.totalBullets > 0
    ? Math.round((exp.quantifiedBullets / exp.totalBullets) * 100)
    : 0;

  const { weights: w } = profile;
  const weighted =
    fmt.score    * w.formatting +
    kw.score     * w.keywordMatch +
    sec.score    * w.sectionCompleteness +
    exp.score    * w.experienceRelevance +
    edu          * w.educationMatch +
    quantScore   * w.quantification;

  const final = profile.applyQuirks(parsed, Math.round(weighted));

  return {
    name: profile.name,
    score: final,
    verdict: final >= profile.passingScore ? 'likely pass' : 'likely fail',
    breakdown: {
      keyword: kw.score,
      format: fmt.score,
      experience: exp.score,
      education: edu,
    },
    matchedKeywords: [...kw.matched, ...kw.synonymMatched].filter(SKILL_FILTER).slice(0, 8),
    missingKeywords: kw.missing.filter(SKILL_FILTER).slice(0, 8),
    formatIssues: fmt.issues,
    tip: profile.tip,
    prioritizes: profile.prioritizes,
  };
}

// Public API — matches the signature specified in the task
export function scoreAllPlatforms(resumeText, jdText) {
  const parsed = _parseResume(resumeText);
  const results = PROFILES
    .map((profile) => _scoreAgainstProfile(parsed, jdText, profile))
    .sort((a, b) => b.score - a.score);

  return {
    platforms: results,
    best: results[0]?.name ?? '',
    hardest: results[results.length - 1]?.name ?? '',
  };
}
