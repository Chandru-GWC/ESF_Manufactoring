import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Building2,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ehsApi } from '../services/api';
import { useEhs } from '../context/EhsContext';
import { AIQueryResponse, DomoConnectivityStatus } from '../types/ehs';
import { RichText } from '../components/agent/RichText';
import { KpiCards } from '../components/agent/KpiCards';
import { ChartRenderer } from '../components/agent/ChartRenderer';
import { AgentTable } from '../components/agent/AgentTable';

/** The EHS Agent page: ask in plain words, the agent answers with text and, when it helps, KPIs, charts and a table. */

interface StarterQuestion {
  label: string;
  prompt: string;
}

const STARTERS: StarterQuestion[] = [
  { label: 'Overdue actions', prompt: 'Which corrective actions are overdue? Show the count, the owners and the areas.' },
  { label: 'Events by area', prompt: 'Show the number of events and open corrective actions for each plant area as a chart.' },
  { label: 'Hazard category share', prompt: 'What share of all events does each hazard category have? Show it as a donut chart.' },
];

type Message =
  | { id: string; role: 'user'; text: string; time: string }
  | { id: string; role: 'assistant'; prompt: string; status: 'pending'; startedAt: number }
  | { id: string; role: 'assistant'; prompt: string; status: 'done'; response: AIQueryResponse; time: string }
  | { id: string; role: 'assistant'; prompt: string; status: 'error'; error: string; time: string };

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
let counter = 0;
const nextId = () => `m${Date.now()}-${counter++}`;

const Working: React.FC<{ startedAt: number }> = ({ startedAt }) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSecs(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [startedAt]);
  return (
    <div className="rounded-2xl border border-line-subtle bg-canvas-surface px-4 py-3 flex items-center gap-3" role="status" aria-live="polite">
      <Loader2 className="w-4 h-4 animate-spin text-brand-orange shrink-0" aria-hidden="true" />
      <div className="text-sm">
        <span className="font-semibold text-ink-primary">EHS Agent is working…</span>
        <span className="text-ink-secondary"> It reads the tables, runs queries and prepares the answer. This can take up to a minute or two. </span>
        <span className="font-mono text-xs text-ink-muted">{secs}s</span>
      </div>
    </div>
  );
};

const TraceSection: React.FC<{ r: AIQueryResponse }> = ({ r }) => {
  const trace = r.execution_trace ?? [];
  const evidence = r.supporting_evidence ?? [];
  if (trace.length === 0 && evidence.length === 0) return null;
  return (
    <details className="group rounded-xl border border-line-subtle bg-canvas-subtle/50">
      <summary className="flex items-center gap-1.5 cursor-pointer select-none px-3 py-2 text-xs font-semibold text-ink-secondary hover:text-ink-primary list-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
        How the agent got this
        <span className="font-mono font-normal text-ink-muted">
          · {trace.length} tool call{trace.length === 1 ? '' : 's'}
          {evidence.length > 0 ? ` · ${evidence.length} evidence item${evidence.length === 1 ? '' : 's'}` : ''}
        </span>
      </summary>
      <div className="px-3 pb-3 space-y-3 text-xs">
        {trace.length > 0 && (
          <ol className="space-y-1.5">
            {trace.map(t => (
              <li key={t.step} className="rounded-lg border border-line-subtle bg-canvas-surface px-2.5 py-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-mono font-bold text-red-600">{t.step}</span>
                  <span className="font-mono font-bold text-ink-primary">{t.tool_name}</span>
                  <span
                    className={`px-1.5 rounded text-[10px] font-mono font-bold ${
                      t.status === 'completed' ? 'bg-severity-success-bg text-severity-success-text' : t.status === 'error' ? 'bg-severity-critical-bg text-severity-critical-text' : 'bg-canvas-subtle text-ink-secondary'
                    }`}
                  >
                    {t.status}
                  </span>
                  <span className="font-mono text-ink-muted">{t.duration_ms} ms</span>
                  {t.records_examined > 0 && <span className="font-mono text-ink-muted">{t.records_examined} records</span>}
                </div>
                {t.summary && <p className="mt-0.5 font-mono text-[11px] text-ink-secondary break-words">{t.summary}</p>}
              </li>
            ))}
          </ol>
        )}
        {evidence.length > 0 && (
          <div>
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary mb-1">Evidence</h5>
            <ul className="flex flex-wrap gap-1.5">
              {evidence.slice(0, 24).map((e, i) => (
                <li key={`${e.id}-${i}`} className="font-mono text-[10.5px] rounded border border-line-subtle bg-canvas-surface px-1.5 py-0.5 text-ink-primary" title={[e.label, e.dataset_source, e.excerpt].filter(Boolean).join(' · ')}>
                  {e.id}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(r.data_sources ?? []).length > 0 && (
          <p className="text-ink-muted font-mono text-[10.5px] break-words">Data: {r.data_sources.join(', ')}</p>
        )}
        {(r.limitations ?? []).length > 0 && (
          <ul className="list-disc pl-4 text-[11px] text-ink-secondary space-y-0.5">
            {r.limitations.map(l => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
};

const AssistantAnswer: React.FC<{ r: AIQueryResponse; time: string }> = ({ r, time }) => {
  const [copied, setCopied] = useState(false);
  const text = r.content || r.summary || '';
  const charts = Array.isArray(r.charts) ? r.charts : [];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <article className="rounded-2xl border border-line-subtle bg-canvas-surface shadow-sm-subtle p-4 space-y-3.5" aria-label="EHS Agent answer">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-secondary">
          <span className="p-1.5 rounded-lg bg-brand-subtle text-brand-primary">
            <Bot className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <span className="text-ink-primary font-bold">EHS Agent</span>
          <span className="font-mono text-ink-muted">{time}</span>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-line-default text-[11px] font-semibold text-ink-primary hover:bg-canvas-subtle focus-ring"
        >
          {copied ? <Check className="w-3 h-3 text-severity-success-dot" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </header>

      <RichText content={text} />

      <KpiCards kpis={r.kpis} />

      {charts.length > 0 && (
        <div className={`grid gap-3 ${charts.length > 1 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 max-w-3xl'}`}>
          {charts.map((c, i) => (
            <ChartRenderer key={`${c?.title ?? 'chart'}-${i}`} spec={c} />
          ))}
        </div>
      )}

      {r.table && <AgentTable table={r.table} />}

      <TraceSection r={r} />

      {r.human_review_required && (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <ShieldCheck className="w-3.5 h-3.5 text-severity-success-dot shrink-0" aria-hidden="true" />
          Read-only answer from your data. A safety officer should review it before any action.
        </p>
      )}
    </article>
  );
};

export const EhsAgentView: React.FC = () => {
  const { facilityId } = useEhs();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [domo, setDomo] = useState<DomoConnectivityStatus | null>(null);
  const [probing, setProbing] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    ehsApi
      .getAiHealth(false)
      .then(res => !cancelled && setDomo(res))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const probe = async () => {
    if (probing) return;
    setProbing(true);
    try {
      setDomo(await ehsApi.getAiHealth(true));
    } catch (err: any) {
      setDomo(prev => ({
        configured: prev?.configured ?? false,
        connected: false,
        endpoint: prev?.endpoint ?? '',
        configured_model: prev?.configured_model ?? 'DomoGPT',
        latency_ms: 0,
        error_code: 'PROBE_FAILED',
        message: err?.message || 'Unable to verify DomoGPT connectivity.',
      }));
    } finally {
      setProbing(false);
    }
  };

  const run = useCallback(
    async (prompt: string, replaceId?: string) => {
      const q = prompt.trim();
      if (!q || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const answerId = replaceId ?? nextId();
      const pending: Message = { id: answerId, role: 'assistant', prompt: q, status: 'pending', startedAt: Date.now() };
      setMessages(prev =>
        replaceId ? prev.map(m => (m.id === replaceId ? pending : m)) : [...prev, { id: nextId(), role: 'user', text: q, time: clock() }, pending]
      );
      setInput('');
      try {
        const response = await ehsApi.queryAssistant(q, { plantId: facilityId });
        setMessages(prev => prev.map(m => (m.id === answerId ? { id: answerId, role: 'assistant', prompt: q, status: 'done', response, time: clock() } : m)));
      } catch (err: any) {
        const error = err?.message || 'The EHS Agent could not answer this question.';
        setMessages(prev => prev.map(m => (m.id === answerId ? { id: answerId, role: 'assistant', prompt: q, status: 'error', error, time: clock() } : m)));
      } finally {
        busyRef.current = false;
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [facilityId]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void run(input);
    }
  };

  const status = domo?.connected
    ? { label: domo.returned_model_id ? 'DomoGPT verified' : 'DomoGPT configured', cls: 'bg-severity-success-bg text-severity-success-text border-severity-success-border' }
    : domo && !domo.configured
    ? { label: 'DomoGPT not configured', cls: 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border' }
    : domo
    ? { label: 'DomoGPT unavailable', cls: 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border' }
    : { label: 'Checking DomoGPT…', cls: 'bg-canvas-subtle text-ink-secondary border-line-default' };

  return (
    <div className="w-full flex flex-col gap-3 lg:h-[calc(100vh-4rem)] lg:min-h-0">
      {/* Header */}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-secondary flex items-center gap-2">
            <span className="w-5 h-0.5 bg-brand-orange" aria-hidden="true" />
            EHS Agent
          </span>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary mt-1">Ask about your safety data</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-line-default bg-canvas-surface text-[11px] font-mono font-semibold text-ink-primary" title="The plant the agent reads (change it in the sidebar)">
            <Building2 className="w-3 h-3 text-brand-orange" aria-hidden="true" />
            {facilityId === 'ALL' ? 'All plants' : facilityId}
          </span>
          <button
            type="button"
            onClick={() => void probe()}
            disabled={probing}
            title={domo?.message ? `${domo.message}${domo.latency_ms > 0 ? ` (${domo.latency_ms} ms)` : ''} - click to verify` : 'Click to verify the connection'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-semibold focus-ring disabled:opacity-70 ${status.cls}`}
          >
            {probing ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
            {status.label}
          </button>
          <button
            type="button"
            onClick={() => setMessages([])}
            disabled={busy || messages.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-line-default bg-canvas-surface text-xs font-semibold text-ink-primary hover:bg-canvas-subtle disabled:opacity-50 focus-ring"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            New chat
          </button>
        </div>
      </header>

      {/* Thread */}
      <section className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-line-subtle bg-canvas-subtle/40 p-3 sm:p-4 space-y-3" aria-label="Conversation" aria-live="polite">
        {messages.length === 0 && (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center gap-3 px-4">
            <span className="p-3 rounded-2xl bg-brand-subtle text-brand-primary">
              <Sparkles className="w-6 h-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-primary">What would you like to know?</h2>
              <p className="text-sm text-ink-secondary mt-1 max-w-xl">
                Ask in plain words. The agent reads your incidents, attendance and maintenance data and answers with text, and with key figures, charts or a table when they help.
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 w-full max-w-3xl">
              {STARTERS.map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => void run(s.prompt)}
                  className="text-left rounded-xl border border-line-subtle bg-canvas-surface px-3 py-2.5 hover:border-brand-primary hover:shadow-sm-subtle transition-colors focus-ring"
                >
                  <span className="block text-xs font-bold text-ink-primary">{s.label}</span>
                  <span className="block text-[11px] text-ink-secondary mt-0.5 line-clamp-2">{s.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => {
          if (m.role === 'user')
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-md bg-brand-primary text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm-subtle">
                  {m.text}
                  <span className="block text-right text-[10px] font-mono opacity-70 mt-0.5">{m.time}</span>
                </div>
              </div>
            );
          if (m.status === 'pending') return <Working key={m.id} startedAt={m.startedAt} />;
          if (m.status === 'error')
            return (
              <div key={m.id} role="alert" className="rounded-2xl border border-severity-critical-border bg-severity-critical-bg px-4 py-3 flex flex-wrap items-start gap-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-severity-critical-text shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-severity-critical-text">The EHS Agent could not answer</p>
                  <p className="text-xs text-ink-secondary mt-0.5 break-words">{m.error}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(m.prompt, m.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-severity-critical-border bg-canvas-surface text-xs font-semibold text-severity-critical-text hover:bg-canvas-subtle disabled:opacity-50 focus-ring"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Retry
                </button>
              </div>
            );
          return <AssistantAnswer key={m.id} r={m.response} time={m.time} />;
        })}
        <div ref={endRef} />
      </section>

      {/* Starter questions + composer */}
      <div className="shrink-0 space-y-2">
        {messages.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" aria-label="Suggested questions">
            {STARTERS.map(s => (
              <button
                key={s.label}
                type="button"
                disabled={busy}
                onClick={() => void run(s.prompt)}
                title={s.prompt}
                className="shrink-0 px-2.5 py-1 rounded-full border border-line-default bg-canvas-surface text-[11.5px] font-medium text-ink-secondary hover:border-brand-primary hover:text-brand-primary disabled:opacity-50 focus-ring"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={e => {
            e.preventDefault();
            void run(input);
          }}
          className="flex items-end gap-2 rounded-2xl border border-line-default bg-canvas-surface p-2 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/15"
        >
          <label htmlFor="ehs-agent-input" className="sr-only">
            Ask the EHS Agent
          </label>
          <textarea
            id="ehs-agent-input"
            ref={inputRef}
            value={input}
            rows={1}
            maxLength={2000}
            onChange={e => {
              setInput(e.target.value);
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 110)}px`;
            }}
            onKeyDown={onKeyDown}
            placeholder="Ask about hazards, incidents, corrective actions, training or maintenance…  (Enter to send, Shift+Enter for a new line)"
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || input.trim().length < 2}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold disabled:bg-canvas-subtle disabled:text-ink-muted disabled:cursor-not-allowed focus-ring"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Send className="w-3.5 h-3.5" aria-hidden="true" />}
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
