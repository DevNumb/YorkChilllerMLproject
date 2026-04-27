// Use relative API path - Vercel will route /api/assistant to the serverless function
// In production, use relative path; in development, use localhost
const isProduction = import.meta.env.PROD;
export const ASSISTANT_API_URL =
  import.meta.env.VITE_ASSISTANT_API_URL ||
  (isProduction ? '/api/assistant' : 'http://localhost:8787/api/assistant');

export const ASSISTANT_SYSTEM_PROMPT =
  'You are an energy efficiency assistant for a chiller plant. Help operators understand optimization recommendations and fault detections. Be concise and practical.';
