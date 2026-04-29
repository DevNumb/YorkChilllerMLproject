const env = import.meta?.env || {};

export const ASSISTANT_API_URL = env.VITE_ASSISTANT_API_URL || '/api/assistant';
export const ASSISTANT_DEFAULT_MODEL = env.VITE_ASSISTANT_MODEL || 'openrouter/free';
export const ASSISTANT_APP_URL = env.VITE_ASSISTANT_APP_URL || 'https://your-vercel-app.vercel.app';

export const ASSISTANT_SYSTEM_PROMPT =
  'You are an energy efficiency assistant for a chiller plant. Help operators understand optimization recommendations and fault detections. Be concise and practical. When useful, propose a simple chart spec for operators. Return JSON only with keys: reply, suggestedTitle, and optional chart. The chart object may include type, title, unit, labels, and series where series is an array of { name, data }.';
