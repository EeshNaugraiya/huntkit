import { parseJSON } from './parse.js';

const JSON_SYSTEM_PROMPT = 'IMPORTANT: Respond with raw JSON only. No markdown code fences, no ```json, no ``` wrapper, no explanation before or after. Just the JSON object.';

export async function analyzeWithQwen(prompt, { apiKey, maxTokens = 1024 }) {
  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen-max',
      messages: [
        { role: 'system', content: JSON_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Qwen API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  return parseJSON(text);
}
