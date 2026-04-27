import { useMemo, useState } from 'react';
import { sendAssistantMessage } from './assistantService';
import './assistant.css';

const starterMessages = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Ask about the current recommendation, likely savings drivers, or what an operator should check next.',
  },
];

function ChatMessage({ role, content }) {
  return (
    <div className={`assistant-message ${role === 'user' ? 'user' : 'assistant'}`}>
      <span className="assistant-message-role">{role === 'user' ? 'Operator' : 'AI Assistant'}</span>
      <p>{content}</p>
    </div>
  );
}

function buildQuickQuestions(context) {
  const questions = ['What should the operator do first based on the latest recommendation?'];

  if (context?.lastRecommendation) {
    questions.push('Explain the expected savings in simple terms.');
  }

  if (context?.liveConditions?.wetBulbC !== null && context?.liveConditions?.wetBulbC !== undefined) {
    questions.push('How does the current wet bulb condition affect chiller efficiency?');
  }

  return questions;
}

export default function AIChatAssistant({ context }) {
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const quickQuestions = useMemo(() => buildQuickQuestions(context), [context]);

  async function submitQuestion(questionText) {
    const trimmed = questionText.trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setLoading(true);
    setError('');

    try {
      const reply = await sendAssistantMessage({
        question: trimmed,
        context,
      });

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: reply,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The assistant request failed. Check the assistant endpoint and API key.',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitQuestion(draft);
  }

  return (
    <section className="glass-card panel-stack assistant-panel">
      <div className="section-title-row">
        <div>
          <p className="section-label">AI Assistant</p>
          <h2>Operator Guidance Chat</h2>
        </div>
        <span className={`status-pill ${loading ? 'warn' : 'ok'}`}>{loading ? 'Thinking' : 'Ready'}</span>
      </div>

      <div className="assistant-chat-log">
        {messages.map((message) => (
          <ChatMessage key={message.id} role={message.role} content={message.content} />
        ))}
      </div>

      <div className="assistant-quick-actions">
        {quickQuestions.map((question) => (
          <button
            key={question}
            type="button"
            className="assistant-chip"
            onClick={() => submitQuestion(question)}
            disabled={loading}
          >
            {question}
          </button>
        ))}
      </div>

      <form className="assistant-form" onSubmit={handleSubmit}>
        <textarea
          className="assistant-input"
          rows={4}
          placeholder="Ask about savings, setpoints, wet bulb impact, or what to check on the plant..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="assistant-form-footer">
          <span className="assistant-context-note">
            Sends live conditions, current inputs, and the latest recommendation with your question.
          </span>
          <button type="submit" className="primary-button" disabled={loading || !draft.trim()}>
            {loading ? 'Sending...' : 'Ask Assistant'}
          </button>
        </div>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}
    </section>
  );
}
