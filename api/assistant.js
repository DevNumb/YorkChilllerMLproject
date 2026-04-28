/**
 * AI Assistant API - Vercel Serverless Function
 * Handles chat requests to OpenRouter API
 * 
 * Environment Variables (set in Vercel Dashboard):
 * - OPENAI_API_KEY: Your OpenRouter API key
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, context, systemPrompt } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  // Read API key and model from Vercel environment
  const apiKey = process.env.OPENROUTER_API_KEY;
  const configuredModel = process.env.OPENROUTER_MODEL;
  
  // Debug log (check Vercel logs)
  console.log('API Key exists:', !!apiKey);
  console.log('Model configured:', configuredModel || 'using default list');
  console.log('Question received:', question.substring(0, 50));

  if (!apiKey) {
    console.error('OPENROUTER_API_KEY is missing from Vercel environment');
    return res.status(500).json({ 
      error: 'API key not configured. Please add OPENROUTER_API_KEY to Vercel environment variables.',
      details: 'Server missing API key'
    });
  }

  // Use configured model or fall back to default list
  const models = configuredModel 
    ? [configuredModel]
    : [
    'google/gemini-flash-1.5-8b-exp',
    'google/gemma-2-9b-it:free',
    'microsoft/phi-3-mini-128k-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free'
  ];

  let lastError = null;

  // Try each model until one works
  for (const model of models) {
    try {
      console.log(`Trying model: ${model}`);
      
      // Build messages
      const messages = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      if (context && Object.keys(context).length > 0) {
        messages.push({ 
          role: 'user', 
          content: `Current plant context: ${JSON.stringify(context, null, 2)}` 
        });
      }
      
      messages.push({ role: 'user', content: question });

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://chiller-optimizer.vercel.app',
          'X-Title': 'Chiller Energy Optimizer'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (response.status === 401) {
        const errorText = await response.text();
        console.error('Invalid API key for model:', model, errorText);
        lastError = new Error('Invalid API key');
        continue;
      }

      if (response.status === 429) {
        const errorText = await response.text();
        console.error('Rate limit for model:', model, errorText);
        lastError = new Error('Rate limit exceeded');
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.error?.message || errorJson.detail || errorText;
        } catch {}
        console.error(`Model ${model} failed:`, response.status, errorDetail);
        lastError = new Error(errorDetail);
        continue;
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;
      
      if (reply) {
        console.log(`Success with model: ${model}`);
        return res.status(200).json({ 
          reply: reply,
          model: model 
        });
      }
      
    } catch (error) {
      console.error(`Error with model ${model}:`, error.message);
      lastError = error;
    }
  }

  // If all models fail
  console.error('All models failed. Last error:', lastError);
  return res.status(500).json({ 
    error: 'No AI models available. Please check your OpenRouter API key or try again later.',
    details: lastError?.message || 'All models failed',
    debug: {
      apiKeyExists: !!apiKey,
      modelUsed: configuredModel || 'default list',
      lastStatus: lastError?.message
    }
  });
}