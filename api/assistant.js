const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const DEFAULT_APP_URL = process.env.OPENROUTER_APP_URL || 'https://your-vercel-app.vercel.app';
const DEFAULT_APP_NAME = process.env.OPENROUTER_APP_NAME || 'Chiller Energy Optimizer';
const DEFAULT_SYSTEM_PROMPT =
  'You are an energy efficiency assistant for a chiller plant. Help operators understand optimization recommendations and fault detections. Be concise and practical. When useful, return JSON only with keys: reply, suggestedTitle, and optional chart. The chart object may include type, title, unit, labels, and series where series is an array of { name, data }.';

function extractFirstJsonObject(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const fencedMatch = value.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : value;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildDashboardSummary(context) {
  if (!context || typeof context !== 'object') {
    return 'No dashboard context available.';
  }

  const lines = [];

  if (context.liveConditions) {
    lines.push('Live conditions:');
    lines.push(`  • Location: ${context.liveConditions.location || 'unknown'}`);
    lines.push(`  • Source: ${context.liveConditions.source || 'manual'}`);
    lines.push(`  • Outdoor temperature: ${context.liveConditions.outdoorTemperatureC ?? 'unknown'}°C`);
    lines.push(`  • Humidity: ${context.liveConditions.humidityPct ?? 'unknown'}%`);
    lines.push(`  • Wet bulb: ${context.liveConditions.wetBulbC ?? 'unknown'}°C`);
  }

  if (context.optimizationInputs) {
    lines.push('Optimization operating point:');
    lines.push(`  • Cooling load: ${context.optimizationInputs.coolingLoadTons ?? 'unknown'} tons`);
    lines.push(`  • Current setpoint: ${context.optimizationInputs.currentChwSetpointC ?? 'unknown'}°C`);
    lines.push(`  • Wet bulb: ${context.optimizationInputs.wetBulbC ?? 'unknown'}°C`);
    lines.push(`  • Current limit: ${context.optimizationInputs.currentLimitPct ?? 'unknown'}%`);
    lines.push(`  • Hour: ${context.optimizationInputs.hour ?? 'unknown'}`);
    lines.push(`  • Month: ${context.optimizationInputs.month ?? 'unknown'}`);
    lines.push(`  • Weekend: ${context.optimizationInputs.isWeekend ? 'yes' : 'no'}`);
    lines.push(`  • Chillers running: ${context.optimizationInputs.chillersRunning ?? 'unknown'}`);
  }

  if (Array.isArray(context.optimizationHistory) && context.optimizationHistory.length) {
    lines.push(`Optimization history (last ${context.optimizationHistory.length} items):`);
    context.optimizationHistory.slice(0, 5).forEach((entry, index) => {
      lines.push(`  ${index + 1}. ${entry.timestamp || 'unknown timestamp'} — current ${entry.currentEfficiencyKwPerTon ?? 'N/A'} kW/ton, optimal ${entry.optimalEfficiencyKwPerTon ?? 'N/A'} kW/ton, improvement ${entry.improvementPercent ?? 'N/A'}%`);
    });
  }

  if (context.faultDetection) {
    lines.push('Fault detection:');
    lines.push(`  • Active faults: ${context.faultDetection.activeFaults ?? 0}`);
    if (Array.isArray(context.faultDetection.alerts) && context.faultDetection.alerts.length) {
      lines.push('  • Alerts:');
      context.faultDetection.alerts.slice(0, 3).forEach((alert, index) => {
        lines.push(`    ${index + 1}. ${alert}`);
      });
    }
  }

  if (context.systemMetrics) {
    lines.push('System metrics:');
    lines.push(`  • Current efficiency: ${context.systemMetrics.currentEfficiencyKwPerTon ?? 'unknown'} kW/ton`);
    lines.push(`  • Optimal efficiency: ${context.systemMetrics.optimalEfficiencyKwPerTon ?? 'unknown'} kW/ton`);
    lines.push(`  • Chillers running: ${context.systemMetrics.chillersRunning ?? 'unknown'}`);
  }

  return lines.join('\n');
}

function buildSystemPrompt(systemPrompt, context) {
  const basePrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const dashboardSummary = buildDashboardSummary(context);
  return `${basePrompt}\n\nUse the following dashboard snapshot to answer the user question accurately:\n${dashboardSummary}`;
}

function buildMessages({ question, context, conversation }) {
  const messages = [];

  if (Array.isArray(conversation) && conversation.length) {
    conversation.slice(-12).forEach((message) => {
      if (message?.role && message?.content) {
        messages.push({
          role: message.role,
          content: String(message.content),
        });
      }
    });
  }

  messages.push({
    role: 'user',
    content: `Current dashboard context:\n${JSON.stringify(context || {}, null, 2)}\n\nUser question:\n${question}`,
  });

  return messages;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Missing OPENROUTER_API_KEY in Vercel environment variables.',
    });
  }

  try {
    const { question, context, conversation, model, systemPrompt } = req.body || {};

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const selectedModel = model || DEFAULT_MODEL;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': DEFAULT_APP_URL,
        'X-Title': DEFAULT_APP_NAME,
      },
      body: JSON.stringify({
        model: selectedModel,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(systemPrompt, context),
          },
          ...buildMessages({ question, context, conversation }),
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: payload?.error?.message || payload?.error || 'OpenRouter request failed.',
      });
    }

    const content = payload?.choices?.[0]?.message?.content || '';
    const parsed = extractFirstJsonObject(content);

    if (parsed) {
      return res.status(200).json({
        reply: parsed.reply || 'No assistant reply returned.',
        chart: parsed.chart || null,
        suggestedTitle: parsed.suggestedTitle || '',
        model: payload?.model || selectedModel,
      });
    }

    return res.status(200).json({
      reply: content || 'No assistant reply returned.',
      chart: null,
      suggestedTitle: '',
      model: payload?.model || selectedModel,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected assistant server error.',
    });
  }
}
