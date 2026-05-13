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
import { Trash2, Plus, Send } from 'lucide-react';
import './assistant.css';

const initialSections = [
  { id: 'chat', label: 'Chat' },
  { id: 'charts', label: 'Charts' },
  { id: 'history', label: 'History' },
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
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`flex flex-col gap-1 max-w-xs lg:max-w-md`}>
        <span className="text-xs uppercase tracking-wider text-muted-foreground px-2">
          {message.role === 'user' ? 'Operator' : message.model ? `AI Assistant · ${message.model}` : 'AI Assistant'}
        </span>
        <div className={`px-4 py-2 rounded-lg border ${
          message.role === 'user'
            ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/24 text-cyan-50'
            : 'bg-white/5 border-white/8 text-white/90'
        }`}>
          {message.content}
        </div>
      </div>
    </div>
  );
}

export default function AIChatAssistant({ context = {}, onEnhancedSend }) {
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
      const timeout = setTimeout(() => {
        if (!ready) {
          console.warn('Assistant hydration timed out, forcing ready state');
          setReady(true);
        }
      }, 3000);

      try {
        const [savedThreads, savedSettings] = await Promise.all([loadAssistantThreads(), loadAssistantSettings()]);
        const nextThreads = savedThreads.length ? savedThreads : [createThread('Operator assistant')];
        setThreads(nextThreads);
        setActiveThreadId(nextThreads[0].id);
        setSettings(savedSettings);
      } catch (err) {
        console.error('Failed to hydrate assistant:', err);
        const fallbackThread = createThread('Operator assistant');
        setThreads([fallbackThread]);
        setActiveThreadId(fallbackThread.id);
      } finally {
        clearTimeout(timeout);
        setReady(true);
      }
    }

    hydrateAssistant();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThreadId, threads, loading, activeSection]);

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
      let response;
      if (onEnhancedSend) {
        response = await onEnhancedSend({
          question,
          context,
          settings,
          conversation: workingThread.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });
      } else {
        response = await sendAssistantMessage({
          question,
          context,
          settings,
          conversation: workingThread.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });
      }

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
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto space-y-2 px-4 py-3 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent">
          {activeThread?.messages.map((message) => <MessageBubble key={message.id} message={message} />)}
          {loading ? (
            <div className="text-sm text-muted-foreground animate-pulse px-4 py-2">Generating assistant response...</div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-white/8 bg-white/2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="text-xs px-3 py-1.5 rounded-full border border-cyan-500/14 bg-cyan-500/8 text-cyan-200 hover:bg-cyan-500/12 hover:border-cyan-500/32 transition-all disabled:opacity-50"
              onClick={() => setDraft(prompt)}
              disabled={loading}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="border-t border-white/8 bg-white/2 px-4 py-3">
          <form className="space-y-2" onSubmit={handleSubmit}>
            <textarea
              className="w-full min-h-11 max-h-24 resize-none px-3 py-2 rounded-lg border border-cyan-500/14 bg-slate-950/92 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/32 focus:ring-1 focus:ring-cyan-500/20 text-sm"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about efficiency, fault checks, charts, or operator actions..."
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex justify-between items-center gap-2 text-xs">
              <span className="text-muted-foreground hidden sm:inline">
                Context sent: live conditions, optimization, and conversation.
              </span>
              <button
                type="submit"
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/28 bg-gradient-to-r from-cyan-500/12 to-emerald-500/12 text-cyan-100 hover:from-cyan-500/18 hover:to-emerald-500/18 hover:border-cyan-500/40 transition-all disabled:opacity-50 text-sm font-medium"
                disabled={loading || !draft.trim()}
              >
                <Send size={14} />
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    ),
    charts: (
      <div className="flex-1 grid gap-4 p-4 overflow-y-auto">
        {visibleCharts.length ? (
          visibleCharts.map((chart, index) => <AssistantChart key={`${chart.title}-${index}`} chart={chart} />)
        ) : (
          <div className="text-sm text-muted-foreground">Ask the assistant for a chart or run an optimization first.</div>
        )}
      </div>
    ),
    history: (
      <div className="flex-1 grid gap-3 p-4 overflow-y-auto">
        {threadHistoryItems.map((thread) => (
          <div key={thread.id} className="p-3 rounded-lg border border-white/8 bg-white/3 hover:bg-white/5 transition-colors">
            <div className="flex justify-between gap-3">
              <div className="flex-1 min-w-0">
                <strong className="block text-sm text-white truncate">{thread.title}</strong>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{thread.preview}</div>
              </div>
              <div className="text-xs text-muted-foreground text-right flex-shrink-0">
                {new Date(thread.updatedAt).toLocaleString()}
                <br />
                {thread.messageCount} msgs · {thread.chartCount} charts
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
  };

  if (!ready || !activeThread) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground animate-pulse">Loading assistant workspace...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900/50 to-slate-950/30 rounded-xl border border-white/8 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 px-6 py-4 border-b border-white/8 bg-white/2 flex-shrink-0">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{activeSection}</p>
          <h3 className="text-lg font-semibold text-white">{activeThread.title}</h3>
          <div className="text-xs text-muted-foreground mt-1">{getThreadPreview(activeThread)}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/8 border border-cyan-500/16 text-cyan-200">
            {settings.model || ASSISTANT_DEFAULT_MODEL}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-500/24 bg-red-500/6 text-red-300 hover:bg-red-500/12 hover:border-red-500/40 transition-all text-xs font-medium"
            onClick={() => handleDeleteThread(activeThread.id)}
            title="Delete conversation"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {/* Sidebar + Content */}
      <div className="flex flex-1 min-h-0 gap-4 p-4">
        {/* Sidebar */}
        <aside className="w-56 flex flex-col gap-3 flex-shrink-0 border-r border-white/8 pr-4">
          <div className="pb-3 border-b border-white/8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">AI Assistant</p>
            <h4 className="text-base font-semibold text-cyan-400 mb-1">Operator Messenger</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">Chat, charts, saved sessions, and settings for your plant assistant.</p>
          </div>

          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-cyan-500/28 bg-gradient-to-r from-cyan-500/12 to-emerald-500/12 text-cyan-100 hover:from-cyan-500/18 hover:to-emerald-500/18 hover:border-cyan-500/40 transition-all text-sm font-medium"
            onClick={handleNewThread}
          >
            <Plus size={16} />
            New Conversation
          </button>

          <nav className="flex flex-col gap-1.5">
            {initialSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === section.id
                    ? 'bg-cyan-500/12 border border-cyan-500/32 text-cyan-300'
                    : 'bg-white/3 border border-white/8 text-white/70 hover:bg-white/5 hover:border-white/12'
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/2 rounded-lg border border-white/8 overflow-hidden">
          {error ? (
            <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/22 text-red-300 text-sm rounded-t-lg">
              {error}
            </div>
          ) : null}
          {sectionContent[activeSection]}
        </div>
      </div>
    </div>
  );
}
