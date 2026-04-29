import { useMemo } from 'react';
import AIChatAssistant from '../components/AIChatAssistant';
import { buildAssistantContext } from '../services/assistantContext';
import './ChatPage.css';

export default function ChatPage() {
  // Build context for the assistant (empty for now, can be enhanced later)
  const assistantContext = useMemo(() => buildAssistantContext({
    weather: { loading: false, error: '', location: '', temperature: null, humidity: null, wetBulb: null, source: 'none' },
    inputs: {},
    result: null,
  }), []);

  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <h1>AI Assistant</h1>
        <p>Ask questions about energy optimization, chiller operations, or recommendations.</p>
      </div>
      <div className="chat-page-content">
        <AIChatAssistant context={assistantContext} />
      </div>
    </div>
  );
}