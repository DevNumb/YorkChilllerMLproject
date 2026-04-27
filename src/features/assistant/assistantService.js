import { ASSISTANT_SYSTEM_PROMPT } from './assistantConfig';

// Use relative API path - Vercel will route /api/assistant to the serverless function
const API_PATH = '/api/assistant';

export async function sendAssistantMessage({ question, context }) {
  const response = await fetch(API_PATH, {
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
