import { parseJSON } from './parse.js';

const JSON_SYSTEM_PROMPT = 'IMPORTANT: Respond with raw JSON only. No markdown code fences, no ```json, no ``` wrapper, no explanation before or after. Just the JSON object.';

export async function analyzeWithOpenAI(prompt, { apiKey }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: JSON_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  return parseJSON(text);
}
