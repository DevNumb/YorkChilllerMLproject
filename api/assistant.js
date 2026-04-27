export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, context, systemPrompt } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  // Get API key from server-side environment variable (never exposed to client)
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY not configured in environment variables');
    return res.status(500).json({ error: 'Server configuration error: API key not set' });
  }

  try {
    // Build messages for OpenRouter API
    const messages = [];

    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add context as user message if provided
    if (context && Object.keys(context).length > 0) {
      messages.push({
        role: 'user',
        content: `Context: ${JSON.stringify(context)}`
      });
    }

    // Add the actual question
    messages.push({ role: 'user', content: question });

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

    // Handle specific error codes
    if (response.status === 401) {
      console.error('OpenRouter API error: Invalid API key');
      return res.status(401).json({ error: 'Invalid API key. Please check your OpenRouter API key.' });
    }

    if (response.status === 403) {
      console.error('OpenRouter API error: Permission denied');
      return res.status(403).json({ error: 'Permission denied. Check your API key permissions.' });
    }

    if (response.status === 429) {
      console.error('OpenRouter API error: Rate limit exceeded');
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return res.status(500).json({ error: `OpenRouter API error: ${response.status}` });
    }

    const data = await response.json();

    // Extract the assistant's reply
    const reply = data.choices?.[0]?.message?.content || '';

    if (!reply) {
      console.error('No response content from OpenRouter:', data);
      return res.status(500).json({ error: 'No response from AI model' });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Assistant API error:', error.message);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}