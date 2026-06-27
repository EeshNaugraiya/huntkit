import { parseJSON } from './parse.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const JSON_SYSTEM_PROMPT = 'IMPORTANT: Respond with raw JSON only. No markdown code fences, no ```json, no ``` wrapper, no explanation before or after. Just the JSON object.';

export async function analyzeWithGemini(prompt, { apiKey }) {
  const response = await fetch(`${BASE}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: JSON_SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  return parseJSON(text);
}
