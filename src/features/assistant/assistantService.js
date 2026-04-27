import { ASSISTANT_API_URL, ASSISTANT_SYSTEM_PROMPT } from './assistantConfig';

export async function sendAssistantMessage({ question, context }) {
  const response = await fetch(ASSISTANT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      context,
      systemPrompt: ASSISTANT_SYSTEM_PROMPT,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Assistant endpoint returned ${response.status}`);
  }

  const data = await response.json();
  return data.reply || 'No assistant reply was returned.';
}
