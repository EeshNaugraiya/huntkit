import { parseJSON } from './parse.js';

const JSON_SYSTEM_PROMPT = 'IMPORTANT: Respond with raw JSON only. No markdown code fences, no ```json, no ``` wrapper, no explanation before or after. Just the JSON object.';

export async function analyzeWithClaude(prompt, { apiKey }) {
  console.log('[claude] making request with key length:', apiKey?.length);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: JSON_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  console.log('[claude] response status:', response.status);
  const rawText = await response.text();
  console.log('[claude] raw response:', rawText.slice(0, 200));

  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}: ${rawText}`);
  }

  const data = JSON.parse(rawText);
  const text = data.content[0].text;
  return parseJSON(text);
}
