/**
 * AI Assistant API - Vercel Serverless Function
 * Handles chat requests to OpenRouter API
 * 
 * Environment Variables (set in Vercel Dashboard):
 * - OPENAI_API_KEY: Your OpenRouter API key
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { question, context } = req.body;

  // Validate question
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required and must be a string.' });
  }

  if (question.trim().length === 0) {
    return res.status(400).json({ error: 'Question cannot be empty.' });
  }

  if (question.length > 2000) {
    return res.status(400).json({ error: 'Question is too long. Maximum 2000 characters.' });
  }

  // Get API key from server-side environment variable (NEVER from .env file)
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('[Assistant] OPENAI_API_KEY not configured in Vercel environment variables');
    return res.status(500).json({ error: 'Server configuration error: API key not set. Please add OPENAI_API_KEY in Vercel dashboard settings.' });
  }

  if (apiKey === 'your-actual-key-goes-in-vercel-dashboard-not-here') {
    console.error('[Assistant] Using placeholder API key - not configured in Vercel');
    return res.status(500).json({ error: 'API key not configured. Please add OPENAI_API_KEY in Vercel dashboard.' });
  }

  console.log('[Assistant] Received question:', question.substring(0, 100));
  console.log('[Assistant] Context keys:', context ? Object.keys(context) : 'none');

  try {
    // Build messages for OpenRouter API
    const messages = [];

    // System prompt
    messages.push({
      role: 'system',
      content: `You are an energy efficiency assistant for a chiller plant. Help operators understand optimization recommendations and fault detections. Be concise, practical, and focused on energy savings. Current context: ${JSON.stringify(context || {})}`
    });

    // User question
    messages.push({ role: 'user', content: question });

    console.log('[Assistant] Making request to OpenRouter with model: google/gemma-2-9b-it:free');

    // Make request to OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://chiller-energy-optimizer.vercel.app',
        'X-Title': 'Chiller Energy Optimizer',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-2-9b-it:free',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    console.log('[Assistant] OpenRouter response status:', response.status);

    // Handle specific error codes
    if (response.status === 401) {
      console.error('[Assistant] OpenRouter API error: Invalid API key');
      return res.status(401).json({ error: 'Invalid API key. Please check your OpenRouter API key in Vercel settings.' });
    }

    if (response.status === 403) {
      console.error('[Assistant] OpenRouter API error: Permission denied');
      return res.status(403).json({ error: 'Permission denied. Check your API key permissions.' });
    }

    if (response.status === 429) {
      console.error('[Assistant] OpenRouter API error: Rate limit exceeded');
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again in a few seconds.' });
    }

    if (response.status === 404) {
      console.error('[Assistant] OpenRouter API error: Model not found');
      return res.status(500).json({ error: 'Model not available. Please try a different model.' });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Assistant] OpenRouter API error:', response.status, errorText);
      return res.status(500).json({ error: `OpenRouter API error: ${response.status}` });
    }

    const data = await response.json();
    console.log('[Assistant] Received response from OpenRouter');

    // Extract the assistant's reply
    const reply = data.choices?.[0]?.message?.content || '';

    if (!reply) {
      console.error('[Assistant] No response content from OpenRouter:', data);
      return res.status(500).json({ error: 'No response from AI model. Please try again.' });
    }

    console.log('[Assistant] Sending reply to client, length:', reply.length);

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('[Assistant] Server error:', error.message);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}