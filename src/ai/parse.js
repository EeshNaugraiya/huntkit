export function parseJSON(text) {
  if (!text) throw new Error('Empty response');
  let clean = text
    .replace(/^[\s\S]*?```json\s*/i, '')
    .replace(/^[\s\S]*?```\s*/i, '')
    .replace(/```[\s\S]*$/i, '')
    .trim();
  const start = Math.min(
    clean.indexOf('{') === -1 ? Infinity : clean.indexOf('{'),
    clean.indexOf('[') === -1 ? Infinity : clean.indexOf('[')
  );
  if (start > 0 && start !== Infinity) clean = clean.slice(start);
  const lastBrace = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
  if (lastBrace !== -1) clean = clean.slice(0, lastBrace + 1);
  return JSON.parse(clean);
}
