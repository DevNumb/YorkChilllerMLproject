import { useState, useCallback, useRef, useMemo } from 'react';
import AIChatAssistant from '../components/AIChatAssistant';
import { buildAssistantContext } from '../services/assistantContext';
import { fetchPlantData, fetchMaintenanceData, buildContextPrompt } from '../services/contextFetcher';
import { sendAssistantMessage } from '../services/assistantService';
import { ASSISTANT_DEFAULT_MODEL } from '../services/assistantConfig';
import './ChatPage.css';

export default function ChatPage() {
  const [liveContext, setLiveContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const lastFetchRef = useRef(0);

  const assistantContext = useMemo(() => buildAssistantContext({
    weather: { loading: false, error: '', location: '', temperature: null, humidity: null, wetBulb: null, source: 'none' },
    inputs: {},
    result: null,
  }), []);

  const handleEnhancedSend = useCallback(async ({ question, context, settings, conversation }) => {
    setContextLoading(true);

    try {
      const now = Date.now();
      if (now - lastFetchRef.current > 30000) {
        const [plantData, maintenanceData] = await Promise.all([
          fetchPlantData(),
          fetchMaintenanceData(),
        ]);

        const builtContext = buildContextPrompt(plantData, maintenanceData);
        setLiveContext(builtContext);
        lastFetchRef.current = now;
      }

      const contextPrefix = liveContext || '';
      const enrichedQuestion = contextPrefix
        ? `${contextPrefix}\n\n[USER QUESTION]\n${question}`
        : question;

      const response = await sendAssistantMessage({
        question: enrichedQuestion,
        context: {
          ...context,
          _liveContextAttached: true,
          contextSource: 'direct-fetch',
        },
        conversation,
        settings,
      });

      return response;
    } finally {
      setContextLoading(false);
    }
  }, [liveContext]);

  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <div>
          <h1>AI Assistant</h1>
          <div className="flex items-center gap-3 mt-2">
            {liveContext && (
              <div className="chat-context-indicator">
                <span className="chat-context-dot" /> Live plant data connected
              </div>
            )}
            {contextLoading && (
              <div className="chat-context-loading">
                Fetching live data...
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="chat-page-content p-4 md:p-6 lg:p-7">
        <AIChatAssistant context={assistantContext} onEnhancedSend={handleEnhancedSend} />
      </div>
    </div>
  );
}
