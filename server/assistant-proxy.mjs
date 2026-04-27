import { createServer } from 'node:http';
import 'dotenv/config';

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

createServer(async (request, response) => {
  console.log(`Received ${request.method} request to ${request.url}`);
  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method !== 'POST' || request.url !== '/api/assistant') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  if (!OPENAI_API_KEY) {
    sendJson(response, 500, {
      error: 'Missing OPENAI_API_KEY. Set it in your server environment before starting the assistant proxy.',
    });
    return;
  }

  try {
    const { question, context, systemPrompt } = await readBody(request);

    if (!question || typeof question !== 'string') {
      sendJson(response, 400, { error: 'A question string is required.' });
      return;
    }

    const prompt = {
      screenData: context || {},
      userQuestion: question,
    };

    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: JSON.stringify(prompt),
          },
        ],
      }),
    });

    const data = await llmResponse.json();

    if (!llmResponse.ok) {
      sendJson(response, llmResponse.status, {
        error: data?.error?.message || 'LLM request failed.',
      });
      return;
    }

    const reply = data?.choices?.[0]?.message?.content || 'No response content returned.';
    sendJson(response, 200, { reply });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unexpected assistant proxy error.',
    });
  }
}).listen(PORT, () => {
  console.log(`Assistant proxy listening on http://localhost:${PORT}`);
});
