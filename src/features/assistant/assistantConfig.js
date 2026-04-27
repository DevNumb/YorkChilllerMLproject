export const ASSISTANT_API_URL =
  import.meta.env.VITE_ASSISTANT_API_URL || 'http://localhost:8787/api/assistant';

export const ASSISTANT_SYSTEM_PROMPT =
  'You are an energy efficiency assistant for a chiller plant. Help operators understand optimization recommendations and fault detections. Be concise and practical.';
