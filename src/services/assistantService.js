import { ASSISTANT_API_URL, ASSISTANT_DEFAULT_MODEL } from './assistantConfig.js';

export async function sendAssistantMessage({ question, context, conversation, settings }) {
  const response = await fetch(settings?.apiUrl || ASSISTANT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      context: context || {},
      conversation: conversation || [],
      model: settings?.model || ASSISTANT_DEFAULT_MODEL,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Assistant request failed with status ${response.status}`);
  }

  return {
    reply: data.reply || 'No assistant reply was returned.',
    chart: data.chart || null,
    suggestedTitle: data.suggestedTitle || '',
    model: data.model || settings?.model || ASSISTANT_DEFAULT_MODEL,
  };
}
