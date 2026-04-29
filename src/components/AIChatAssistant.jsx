import { useEffect, useMemo, useRef, useState } from 'react';
import { ASSISTANT_DEFAULT_MODEL } from '../services/assistantConfig.js';
import { buildFallbackCharts, normalizeChartSpec } from '../services/chartUtils.js';
import { sendAssistantMessage } from '../services/assistantService.js';
import {
  assistantDefaultSettings,
  deleteAssistantThread,
  loadAssistantSettings,
  loadAssistantThreads,
  saveAssistantSettings,
  saveAssistantThread,
} from '../services/assistantStorage.js';
import AssistantChart from './AssistantChart.jsx';
import './assistant.css';

const initialSections = [
  { id: 'chat', label: 'Chat' },
  { id: 'charts', label: 'Charts' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

const quickPrompts = [
  'Explain the latest recommendation in simple operator terms.',
  'What should I verify on the plant before changing the setpoint?',
  'Create a chart that compares current efficiency versus optimal efficiency.',
];

function createThread(title = 'New assistant session') {
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'I can explain recommendations, compare efficiency, and generate quick charts from the current dashboard context.',
        timestamp: new Date().toISOString(),
      },
    ],
    charts: [],
  };
}

function createUserMessage(content) {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
}

function createAssistantMessage(content, model) {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    model,
    timestamp: new Date().toISOString(),
  };
}

function getThreadPreview(thread) {
  const lastUser = [...thread.messages].reverse().find((message) => message.role === 'user');
  return lastUser?.content || thread.messages[0]?.content || 'No messages yet.';
}

function MessageBubble({ message }) {
  return (
    <div className={`assistant-message ${message.role}`}>
      <span className="assistant-message-label">
        {message.role === 'user' ? 'Operator' : message.model ? `AI Assistant · ${message.model}` : 'AI Assistant'}
      </span>
      <div className="assistant-message-bubble">{message.content}</div>
    </div>
  );
}

export default function AIChatAssistant({ context = {} }) {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [activeSection, setActiveSection] = useState('chat');
  const [settings, setSettings] = useState(assistantDefaultSettings);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function hydrateAssistant() {
      const [savedThreads, savedSettings] = await Promise.all([loadAssistantThreads(), loadAssistantSettings()]);
      const nextThreads = savedThreads.length ? savedThreads : [createThread('Operator assistant')];
      setThreads(nextThreads);
      setActiveThreadId(nextThreads[0].id);
      setSettings(savedSettings);
      setReady(true);
    }

    hydrateAssistant();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThreadId, threads, loading]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || threads[0] || null,
    [activeThreadId, threads],
  );

  const fallbackCharts = useMemo(() => buildFallbackCharts(context), [context]);
  const visibleCharts = activeThread?.charts?.length ? activeThread.charts : fallbackCharts;

  async function persistThread(thread) {
    if (!settings.saveChats) {
      return;
    }

    await saveAssistantThread(thread);
  }

  function updateThreads(nextThreads, nextActiveThreadId = activeThreadId) {
    setThreads(nextThreads);
    setActiveThreadId(nextActiveThreadId);
  }

  async function handleNewThread() {
    const nextThread = createThread(`Session ${threads.length + 1}`);
    const nextThreads = [nextThread, ...threads];
    updateThreads(nextThreads, nextThread.id);
    if (settings.saveChats) {
      await saveAssistantThread(nextThread);
    }
    setActiveSection('chat');
  }

  async function handleDeleteThread(threadId) {
    const remaining = threads.filter((thread) => thread.id !== threadId);
    const fallback = remaining[0] || createThread('Operator assistant');
    const nextThreads = remaining.length ? remaining : [fallback];
    updateThreads(nextThreads, fallback.id);
    if (settings.saveChats) {
      await deleteAssistantThread(threadId);
      if (!remaining.length) {
        await saveAssistantThread(fallback);
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || loading || !activeThread) {
      return;
    }

    const userMessage = createUserMessage(question);
    const workingThread = {
      ...activeThread,
      title: activeThread.messages.length <= 1 ? question.slice(0, 42) : activeThread.title,
      updatedAt: new Date().toISOString(),
      messages: [...activeThread.messages, userMessage],
    };

    const nextThreads = threads.map((thread) => (thread.id === activeThread.id ? workingThread : thread));
    updateThreads(nextThreads, workingThread.id);
    setDraft('');
    setError('');
    setLoading(true);

    try {
      const response = await sendAssistantMessage({
        question,
        context,
        settings,
        conversation: workingThread.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      const chart = normalizeChartSpec(response.chart);
      const assistantMessage = createAssistantMessage(response.reply, response.model);
      const finishedThread = {
        ...workingThread,
        updatedAt: new Date().toISOString(),
        messages: [...workingThread.messages, assistantMessage],
        charts: chart ? [chart, ...(workingThread.charts || [])].slice(0, 12) : workingThread.charts || [],
      };

      const finishedThreads = nextThreads.map((thread) => (thread.id === finishedThread.id ? finishedThread : thread));
      updateThreads(finishedThreads, finishedThread.id);
      await persistThread(finishedThread);

      if (chart && settings.autoOpenCharts) {
        setActiveSection('charts');
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Assistant request failed. Check your OpenRouter Vercel environment values.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(event) {
    event.preventDefault();
    const saved = await saveAssistantSettings(settings);
    setSettings(saved);
    setError('');
  }

  const threadHistoryItems = useMemo(
    () =>
      [...threads]
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .map((thread) => ({
          id: thread.id,
          title: thread.title,
          preview: getThreadPreview(thread),
          updatedAt: thread.updatedAt,
          messageCount: thread.messages.length,
          chartCount: thread.charts?.length || 0,
        })),
    [threads],
  );

  const sectionContent = {
    chat: (
      <>
        <div className="assistant-chat-area">
          {activeThread?.messages.map((message) => <MessageBubble key={message.id} message={message} />)}
          {loading ? <div className="assistant-loading">Generating assistant response...</div> : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="assistant-chat-tools">
          {quickPrompts.map((prompt) => (
            <button key={prompt} type="button" className="assistant-chip" onClick={() => setDraft(prompt)} disabled={loading}>
              {prompt}
            </button>
          ))}
        </div>

        <div className="assistant-compose">
          <form className="assistant-compose-form" onSubmit={handleSubmit}>
            <textarea
              className="assistant-compose-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about efficiency, fault checks, charts, or operator actions..."
              disabled={loading}
            />
            <div className="assistant-compose-footer">
              <span className="assistant-subtle">
                Context sent: live conditions, optimization inputs, latest recommendation, and this conversation.
              </span>
              <button type="submit" className="assistant-save-btn" disabled={loading || !draft.trim()}>
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </>
    ),
    charts: (
      <div className="assistant-charts-grid">
        {visibleCharts.length ? (
          visibleCharts.map((chart, index) => <AssistantChart key={`${chart.title}-${index}`} chart={chart} />)
        ) : (
          <div className="assistant-empty-copy">Ask the assistant for a chart or run an optimization first.</div>
        )}
      </div>
    ),
    history: (
      <div className="assistant-history-grid">
        {threadHistoryItems.map((thread) => (
          <div key={thread.id} className="assistant-history-card">
            <div>
              <strong>{thread.title}</strong>
              <div className="assistant-history-meta">{thread.preview}</div>
            </div>
            <div className="assistant-history-meta">
              {new Date(thread.updatedAt).toLocaleString()}
              <br />
              {thread.messageCount} messages · {thread.chartCount} charts
            </div>
          </div>
        ))}
      </div>
    ),
    settings: (
      <form className="assistant-settings-grid" onSubmit={handleSaveSettings}>
        <div className="assistant-settings-card">
          <div className="assistant-setting-header">
            <div>
              <h4>Model Settings</h4>
              <div className="assistant-setting-note">
                Your OpenRouter API key belongs in Vercel environment variables, not in the browser.
              </div>
            </div>
          </div>
          <label>
            <span>Model</span>
            <input
              type="text"
              value={settings.model}
              onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}
              placeholder="openrouter/free"
            />
          </label>
          <label>
            <span>Assistant API URL</span>
            <input
              type="text"
              value={settings.apiUrl}
              onChange={(event) => setSettings((current) => ({ ...current, apiUrl: event.target.value }))}
              placeholder="/api/assistant"
            />
          </label>
          <label className="assistant-toggle">
            <input
              type="checkbox"
              checked={settings.autoOpenCharts}
              onChange={(event) => setSettings((current) => ({ ...current, autoOpenCharts: event.target.checked }))}
            />
            <span>Auto-open the Charts page when the assistant returns a chart</span>
          </label>
          <label className="assistant-toggle">
            <input
              type="checkbox"
              checked={settings.saveChats}
              onChange={(event) => setSettings((current) => ({ ...current, saveChats: event.target.checked }))}
            />
            <span>Save assistant chat history in IndexedDB on this device</span>
          </label>
        </div>

        <div className="assistant-settings-card">
          <h4>Vercel Environment Variables</h4>
          <div className="assistant-setting-note">Add these in Vercel for production:</div>
          <textarea
            rows={6}
            readOnly
            value={`OPENROUTER_API_KEY=your-openrouter-api-key\nOPENROUTER_MODEL=${settings.model || ASSISTANT_DEFAULT_MODEL}\nOPENROUTER_APP_URL=https://your-vercel-app.vercel.app\nOPENROUTER_APP_NAME=Chiller Energy Optimizer`}
          />
        </div>

        <button type="submit" className="assistant-save-btn">
          Save Assistant Settings
        </button>
      </form>
    ),
  };

  if (!ready || !activeThread) {
    return (
      <section className="glass-card panel-stack">
        <div className="assistant-loading">Loading assistant workspace...</div>
      </section>
    );
  }

  return (
    <section className="glass-card panel-stack">
      <div className="assistant-shell">
        <aside className="assistant-sidebar">
          <div className="assistant-brand">
            <p className="section-label">AI Assistant</p>
            <h3>Operator Messenger</h3>
            <p>Chat, charts, saved sessions, and settings for your plant assistant.</p>
          </div>

          <button type="button" className="assistant-create-btn" onClick={handleNewThread}>
            New Conversation
          </button>

          <nav className="assistant-nav">
            {initialSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={activeSection === section.id ? 'assistant-nav-btn active' : 'assistant-nav-btn'}
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="assistant-thread-list">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={thread.id === activeThreadId ? 'assistant-thread-btn active' : 'assistant-thread-btn'}
                onClick={() => {
                  setActiveThreadId(thread.id);
                  setActiveSection('chat');
                }}
              >
                <span className="assistant-thread-title">{thread.title}</span>
                <span className="assistant-thread-time">
                  {new Date(thread.updatedAt).toLocaleDateString()} · {thread.messages.length} msgs
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="assistant-panel-main">
          <div className="assistant-panel-header">
            <div>
              <p className="section-label">{activeSection}</p>
              <h3>{activeThread.title}</h3>
              <div className="assistant-subtle">{getThreadPreview(activeThread)}</div>
            </div>
            <div className="assistant-panel-header-actions">
              <span className="assistant-model-badge">{settings.model || ASSISTANT_DEFAULT_MODEL}</span>
              <button type="button" className="assistant-delete-btn" onClick={() => handleDeleteThread(activeThread.id)}>
                Delete
              </button>
            </div>
          </div>

          <div className="assistant-panel-body">
            {error ? <div className="assistant-error">{error}</div> : null}
            {sectionContent[activeSection]}
          </div>
        </div>
      </div>
    </section>
  );
}
