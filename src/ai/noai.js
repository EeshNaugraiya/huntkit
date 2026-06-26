export function analyzeWithNoAI(jdText, resumeText) {
  const jdWords = tokenize(jdText);
  const resumeWords = new Set(resumeText ? tokenize(resumeText) : []);

  const matched = jdWords.filter((w) => resumeWords.has(w));
  const matchScore = resumeWords.size > 0
    ? Math.min(matched.length / Math.max(jdWords.length, 1), 1)
    : 0;

  return {
    matchScore: parseFloat(matchScore.toFixed(2)),
    summary: 'Keyword-based analysis (no AI provider configured). Enable Claude or Qwen in Settings for detailed insights.',
    strongPoints: matched.slice(0, 8),
    missingSkills: jdWords.filter((w) => !resumeWords.has(w)).slice(0, 8),
    coverLetter: '',
  };
}

function tokenize(text) {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'you', 'we', 'will', 'be', 'have', 'has', 'it', 'that', 'this', 'our', 'your']);
  return [
    ...new Set(
      text.toLowerCase().match(/\b[a-z][a-z+#.-]{2,}\b/g) || []
    ),
  ].filter((w) => !stopWords.has(w));
}
