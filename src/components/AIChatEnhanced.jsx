import { useMemo } from 'react';
import AIChatAssistant from './AIChatAssistant.jsx';
import { buildAssistantContext } from '../services/assistantContext.js';
import './assistant.css';

const exampleQuestions = [
  'Compare current vs optimal efficiency using the latest dashboard data.',
  'What operator action should I take for the current load and wet bulb conditions?',
  'Summarize the last 10 optimization recommendations and any trends.',
  'Explain why the current setpoint is higher or lower than optimal.',
  'Do the live conditions suggest I should run more chillers?' ,
];

export default function AIChatEnhanced() {
  const assistantContext = useMemo(
    () =>
      buildAssistantContext({
        weather: {
          loading: false,
          error: '',
          location: '',
          temperature: null,
          humidity: null,
          wetBulb: null,
          source: 'none',
        },
        inputs: {},
        result: null,
      }),
    [],
  );

  return (
    <section className="assistant-enhanced-shell">
      <div className="assistant-enhanced-header glass-card">
        <div>
          <p className="section-label">AI Assistant</p>
          <h1>Context-Aware Chat</h1>
          <p className="hero-copy">Ask the assistant questions using current dashboard data and optimization history.</p>
        </div>
        <div className="assistant-prompt-list">
          {exampleQuestions.map((prompt) => (
            <div key={prompt} className="assistant-chip">
              {prompt}
            </div>
          ))}
        </div>
      </div>
      <AIChatAssistant context={assistantContext} />
    </section>
  );
}
