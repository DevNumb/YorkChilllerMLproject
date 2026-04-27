import { useState, useRef, useEffect } from 'react';
import { sendAssistantMessage } from '../services/assistantService';
import './assistant.css';

/**
 * AI Chat Assistant Component
 * Provides a chat interface for energy efficiency questions
 * 
 * @param {Object} props - Component props
 * @param {Object} props.context - Context data (lastRecommendation, liveConditions, etc.)
 */
export default function AIChatAssistant({ context = {} }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your energy efficiency assistant. Ask me about optimizing your chiller plant, understanding recommendations, or fault detection.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Quick question suggestions based on context
  const quickQuestions = [
    'How can I reduce energy consumption?',
    'What do my current recommendations mean?',
    'Explain the fault detection alerts',
    'What is the optimal setpoint for my chillers?'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const question = input.trim();
    if (!question || isLoading) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const reply = await sendAssistantMessage({
        question,
        context
      });

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error('Assistant error:', err);
      setError(err.message);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = async (question) => {
    setInput(question);
    // Trigger form submission
    const form = document.getElementById('assistant-form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    }
  };

  return (
    <div className="assistant-container glass-card">
      <div className="assistant-header">
        <h3>🤖 Energy Assistant</h3>
        <span className="assistant-status">
          {isLoading ? 'Thinking...' : 'Ready'}
        </span>
      </div>

      {/* Error Display */}
      {error && (
        <div className="assistant-error">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">×</button>
        </div>
      )}

      {/* Messages Display */}
      <div className="assistant-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message message-${msg.role}`}>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="message message-assistant">
            <div className="message-content loading">
              <span className="loading-dots">...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      <div className="quick-questions">
        {quickQuestions.map((q, index) => (
          <button
            key={index}
            className="quick-btn"
            onClick={() => handleQuickQuestion(q)}
            disabled={isLoading}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form id="assistant-form" className="assistant-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about energy optimization..."
          disabled={isLoading}
          maxLength={2000}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? '...' : '➤'}
        </button>
      </form>
    </div>
  );
}