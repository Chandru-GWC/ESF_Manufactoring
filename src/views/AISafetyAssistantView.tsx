import React, { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingSkeleton } from '../components/ui/LoadingState';
import { ehsApi } from '../services/api';
import { useEhs } from '../context/EhsContext';
import {
  AgentMetadata,
  AIMessage,
  DomoConnectivityStatus,
} from '../types/ehs';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  Info,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';

interface AgentExecutionRecord {
  agentKey: string;
  agentName: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  startTime: string | null;
  completionTime: string | null;
  durationMs: number | null;
  resultSummary: string | null;
  errorDetails: string | null;
  specialistsInvoked: string[];
  lastPrompt: string | null;
}

const DEFAULT_AGENT_PROMPTS: Record<string, string> = {
  orchestrator:
    'Provide a coordinated multi-agent briefing covering critical open hazards, overdue CAPAs, expired workforce training, and open P1 maintenance orders.',
  hazard_analysis:
    'Analyze hazard categories, CRITICAL/HIGH severity events, and recurring plant/area/shift hotspots requiring safety officer attention.',
  incident_analysis:
    'Summarize incidents, first aid events, near misses, and audit findings along with open investigation bottlenecks.',
  workforce_safety:
    'Summarize workforce attendance hours, overtime patterns, and expired safety training records.',
  maintenance_safety:
    'Analyze P1 priority maintenance work orders, dominant failure modes, statuses, and estimated downtime avoided.',
  capa_monitoring:
    'Identify overdue corrective actions based on due dates and current action status requiring urgent follow-up.',
  permit_compliance:
    'Review permit exception events, referenced permit IDs, and explain what can and cannot be verified about LOTO.',
  safety_intelligence:
    'Generate an executive plant safety intelligence summary across all verified ehs_core operational tables.',
};

const formatClockTime = (d: Date): string =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const QUICK_PROMPTS: { label: string; prompt: string; badge: string }[] = [
  {
    badge: 'Hazard',
    label: 'Critical hazards & area hotspots',
    prompt: 'Analyze hazard categories, CRITICAL/HIGH severity events, and recurring plant/area/shift hotspots requiring safety officer attention.',
  },
  {
    badge: 'CAPA',
    label: 'Overdue CAPA follow-up backlog',
    prompt: 'Identify overdue corrective actions based on due dates and current action status requiring urgent follow-up.',
  },
  {
    badge: 'Workforce',
    label: 'Expired training & overtime hours',
    prompt: 'Summarize workforce attendance hours, overtime patterns, and expired safety training records.',
  },
  {
    badge: 'Maintenance',
    label: 'P1 work orders & failure modes',
    prompt: 'Analyze P1 priority maintenance work orders, dominant failure modes, statuses, and estimated downtime avoided.',
  },
  {
    badge: 'Permits',
    label: 'Permit exceptions & LOTO limits',
    prompt: 'Review permit exception events, referenced permit IDs, and explain what can and cannot be verified about LOTO.',
  },
  {
    badge: 'Multi-Agent',
    label: 'Combined hazards, CAPAs & P1 brief',
    prompt: 'Provide a coordinated multi-agent briefing covering critical hazards, overdue CAPAs, expired workforce training, and open P1 maintenance orders.',
  },
];

export const AISafetyAssistantView: React.FC = () => {
  const { overviewSummary, facilityId } = useEhs();

  const totalRows = overviewSummary
    ? overviewSummary.total_ehs_events +
      overviewSummary.total_workforce_records +
      overviewSummary.total_maintenance_work_orders
    : null;

  const [agents, setAgents] = useState<AgentMetadata[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('orchestrator');

  const [domoStatus, setDomoStatus] = useState<DomoConnectivityStatus | null>(null);
  const [isProbingDomo, setIsProbingDomo] = useState(false);

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({});
  const [agentExecutions, setAgentExecutions] = useState<Record<string, AgentExecutionRecord>>({});
  const [runningAgentKeys, setRunningAgentKeys] = useState<Record<string, boolean>>({});

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const loadAiCapabilities = async () => {
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const [agentList, healthRes] = await Promise.all([
        ehsApi.getAiAgents(),
        ehsApi.getAiHealth(false),
      ]);
      setAgents(agentList);
      setDomoStatus(healthRes);
    } catch (err: any) {
      setAgentsError(err?.message || 'Unable to inspect backend AI orchestrator metadata.');
    } finally {
      setAgentsLoading(false);
    }
  };

  useEffect(() => {
    loadAiCapabilities();
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isProcessing]);

  const handleProbeDomo = async () => {
    if (isProbingDomo) return;
    setIsProbingDomo(true);
    try {
      const res = await ehsApi.getAiHealth(true);
      setDomoStatus(res);
    } catch (err: any) {
      setDomoStatus(prev => ({
        configured: prev?.configured ?? false,
        connected: false,
        endpoint: prev?.endpoint ?? '/api/ai/v1/text/generation',
        configured_model: prev?.configured_model ?? 'DomoGPT',
        latency_ms: 0,
        error_code: 'PROBE_FAILED',
        message: err?.message || 'Unable to verify DomoGPT connectivity.',
      }));
    } finally {
      setIsProbingDomo(false);
    }
  };

  const toggleTrace = (msgId: string) => {
    setExpandedTraceIds(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = async (textToSend?: string, overrideAgentKey?: string) => {
    const targetKey = overrideAgentKey ?? selectedAgent;
    const query = (textToSend ?? inputQuery).trim();
    if (!query || isProcessing || runningAgentKeys[targetKey]) return;

    const targetMeta = agents.find(a => a.agent_key === targetKey);
    const targetName = targetMeta?.agent_name ?? targetKey;
    const startedAtDate = new Date();
    const startedMs = performance.now();

    setQueryError(null);
    setLastFailedPrompt(null);
    setRunningAgentKeys(prev => ({ ...prev, [targetKey]: true }));
    setAgentExecutions(prev => ({
      ...prev,
      [targetKey]: {
        agentKey: targetKey,
        agentName: targetName,
        status: 'running',
        startTime: formatClockTime(startedAtDate),
        completionTime: null,
        durationMs: null,
        resultSummary: null,
        errorDetails: null,
        specialistsInvoked: [],
        lastPrompt: query,
      },
    }));

    const userMsg: AIMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: `[${targetName}] ${query}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');
    setIsProcessing(true);

    try {
      const res = await ehsApi.queryAssistant(query, {
        plantId: facilityId,
        targetAgent: targetKey,
      });

      const finishedAtDate = new Date();
      const elapsedMs = Math.round(performance.now() - startedMs);

      setAgentExecutions(prev => ({
        ...prev,
        [res.agent_key || targetKey]: {
          agentKey: res.agent_key || targetKey,
          agentName: res.agent_name || targetName,
          status: res.success ? 'success' : 'failed',
          startTime: formatClockTime(startedAtDate),
          completionTime: formatClockTime(finishedAtDate),
          durationMs: elapsedMs,
          resultSummary: res.summary || null,
          errorDetails: res.success ? null : res.error_code || 'Agent returned unsuccessful status.',
          specialistsInvoked: res.specialist_agents_invoked || [],
          lastPrompt: query,
        },
      }));

      const assistantMsg: AIMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.summary,
        timestamp: new Date(res.timestamp || Date.now()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        agentKey: res.agent_key,
        agentName: res.agent_name,
        plantScope: res.plant_scope,
        routingReason: res.routing_reason,
        specialistsInvoked: res.specialist_agents_invoked,
        keyFindings: res.key_findings,
        supportingEvidence: res.supporting_evidence,
        recommendations: res.recommendations,
        dataSources: res.data_sources,
        limitations: res.limitations,
        humanReviewRequired: res.human_review_required,
        modelId: res.model_id,
        sessionId: res.session_id,
        tokenUsage: res.token_usage,
        executionTrace: res.execution_trace,
        suggestedQuestions: res.suggested_questions,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const finishedAtDate = new Date();
      const elapsedMs = Math.round(performance.now() - startedMs);
      const msgText = err?.message || 'Failed to complete multi-agent safety analysis.';
      setAgentExecutions(prev => ({
        ...prev,
        [targetKey]: {
          agentKey: targetKey,
          agentName: targetName,
          status: 'failed',
          startTime: formatClockTime(startedAtDate),
          completionTime: formatClockTime(finishedAtDate),
          durationMs: elapsedMs,
          resultSummary: null,
          errorDetails: msgText,
          specialistsInvoked: [],
          lastPrompt: query,
        },
      }));
      setQueryError(msgText);
      setLastFailedPrompt(query);
    } finally {
      setRunningAgentKeys(prev => {
        const next = { ...prev };
        delete next[targetKey];
        return next;
      });
      setIsProcessing(false);
    }
  };

  const handleExecuteAgent = (agentKey: string, overridePrompt?: string) => {
    setSelectedAgent(agentKey);
    const prevRun = agentExecutions[agentKey];
    const prompt =
      overridePrompt ||
      prevRun?.lastPrompt ||
      inputQuery.trim() ||
      DEFAULT_AGENT_PROMPTS[agentKey] ||
      'Analyze verified safety telemetry in ehs_core for this operational domain.';
    handleSend(prompt, agentKey);
  };

  const handleClearChat = () => {
    setMessages([]);
    setQueryError(null);
    setLastFailedPrompt(null);
    setExpandedTraceIds({});
  };

  const activeAgentObj = agents.find(a => a.agent_key === selectedAgent);

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Safety Intelligence Assistant"
        description="Multi-agent EHS intelligence orchestrated via FastAPI, Neon PostgreSQL (ehs_core), and DomoGPT with human-in-the-loop safety guardrails."
        breadcrumbs={[
          { label: 'Intelligence' },
          { label: 'AI Safety Assistant', active: true },
        ]}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-brand-purple-soft text-brand-purple border border-brand-purple/30">
              <Bot className="w-3.5 h-3.5" aria-hidden="true" />
              8-Agent DomoGPT
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
                domoStatus?.connected
                  ? 'bg-severity-success-bg text-severity-success-text border-severity-success-border'
                  : domoStatus && !domoStatus.configured
                  ? 'bg-severity-warning-bg text-severity-warning-text border-severity-warning-border'
                  : 'bg-canvas-subtle text-ink-secondary border-line-default'
              }`}
            >
              <Cpu className="w-3 h-3" aria-hidden="true" />
              {domoStatus?.connected
                ? domoStatus.returned_model_id
                  ? 'DomoGPT Verified'
                  : 'DomoGPT Ready'
                : domoStatus
                ? 'DomoGPT Disconnected'
                : 'Checking DomoGPT'}
            </span>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={handleProbeDomo}
            disabled={isProbingDomo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-default bg-canvas-surface hover:bg-canvas-muted text-xs font-semibold text-ink-primary transition-colors disabled:opacity-50 focus-ring"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand-purple ${isProbingDomo ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isProbingDomo ? 'Probing DomoGPT...' : 'Verify DomoGPT'}</span>
          </button>
        }
      />

      {/* Split Workbench Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Control & Context Rail */}
        <aside className="lg:col-span-4 space-y-4 min-w-0">
          {/* Multi-Agent Specialist Selector */}
          <div className="p-4 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-line-subtle">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-purple shrink-0" aria-hidden="true" />
                <span>Agent Routing Mode</span>
              </h2>
              <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-purple-soft text-brand-purple">
                {agents.length > 0 ? `${agents.length} Active` : 'Registry'}
              </span>
            </div>

            {agentsLoading ? (
              <div className="space-y-2 py-1">
                <LoadingSkeleton count={4} className="h-8" />
              </div>
            ) : agentsError ? (
              <div role="alert" className="p-3 rounded-lg bg-severity-critical-bg/50 border border-severity-critical-border text-xs text-severity-critical-text space-y-2">
                <p>{agentsError}</p>
                <button
                  type="button"
                  onClick={loadAiCapabilities}
                  className="text-[11px] font-semibold underline hover:no-underline focus-ring"
                >
                  Retry Registry Load
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="agent-routing-select" className="sr-only">
                  Select target EHS specialist agent
                </label>
                <select
                  id="agent-routing-select"
                  value={selectedAgent}
                  onChange={e => setSelectedAgent(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-line-default bg-canvas-subtle text-xs font-semibold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-purple"
                >
                  {agents.map(agent => (
                    <option key={agent.agent_key} value={agent.agent_key}>
                      {agent.agent_key === 'orchestrator'
                        ? `Auto-Route • ${agent.agent_name}`
                        : agent.agent_name}
                    </option>
                  ))}
                </select>
                {activeAgentObj && (
                  <p className="text-[11px] text-ink-secondary leading-relaxed">
                    {activeAgentObj.role}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Grounded Neon Context & Model Metadata */}
          <div className="p-4 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-line-subtle gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary flex items-center gap-2 min-w-0">
                <Database className="w-4 h-4 text-brand-blue shrink-0" aria-hidden="true" />
                <span className="truncate">Neon Scope ({facilityId})</span>
              </h2>
              <span className="font-mono text-[11px] font-semibold text-severity-success-text shrink-0">
                {totalRows !== null ? `${totalRows.toLocaleString('en-IN')} rows` : 'Syncing'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-canvas-subtle border border-line-subtle flex justify-between gap-2">
                <span className="text-ink-secondary font-mono text-[11px] truncate">ehs_core.fact_ehs_event</span>
                <span className="font-mono font-bold text-ink-primary tabular-nums">
                  {overviewSummary?.total_ehs_events ?? '—'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-canvas-subtle border border-line-subtle flex justify-between gap-2">
                <span className="text-ink-secondary font-mono text-[11px] truncate">ehs_core.fact_workforce_attendance</span>
                <span className="font-mono font-bold text-ink-primary tabular-nums">
                  {overviewSummary?.total_workforce_records?.toLocaleString('en-IN') ?? '—'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-canvas-subtle border border-line-subtle flex justify-between gap-2">
                <span className="text-ink-secondary font-mono text-[11px] truncate">ehs_core.fact_maintenance_work_order</span>
                <span className="font-mono font-bold text-ink-primary tabular-nums">
                  {overviewSummary?.total_maintenance_work_orders ?? '—'}
                </span>
              </div>
            </div>

            {domoStatus && (
              <div className="p-2.5 rounded-lg bg-canvas-subtle border border-line-subtle text-[11px] space-y-1">
                <div className="flex items-center justify-between text-ink-muted">
                  <span>Configured LLM</span>
                  <span className="font-mono text-ink-primary truncate max-w-[190px]" title={domoStatus.configured_model}>
                    {domoStatus.returned_model_id || domoStatus.configured_model}
                  </span>
                </div>
                <div className="text-[10px] text-ink-secondary leading-snug">
                  {domoStatus.message}
                  {domoStatus.latency_ms > 0 ? ` (${domoStatus.latency_ms} ms)` : ''}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-line-subtle space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-brand-orange" aria-hidden="true" />
                <span>Specialist & Multi-Agent Prompts</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {QUICK_PROMPTS.map(item => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleSend(item.prompt)}
                    className="text-left px-3 py-2 rounded-lg border border-line-subtle bg-canvas-subtle hover:bg-canvas-muted hover:border-brand-purple/40 text-[11px] font-medium text-ink-primary transition-colors flex items-center justify-between gap-2 disabled:opacity-50 focus-ring"
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-canvas-surface border border-line-subtle text-brand-purple shrink-0">
                      {item.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Conversational Workbench */}
        <section className="lg:col-span-8 flex flex-col min-w-0 h-[620px] lg:h-[740px] rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle overflow-hidden">
          {/* Workbench Subheader */}
          <div className="px-4 py-3 border-b border-line-subtle bg-canvas-subtle flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-brand-purple shrink-0" aria-hidden="true" />
              <span className="text-xs font-bold text-ink-primary truncate">
                {activeAgentObj ? activeAgentObj.agent_name : 'EHS Orchestrator Agent'}
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded font-mono text-[10px] bg-canvas-surface border border-line-subtle text-ink-secondary">
                Scope: {facilityId}
              </span>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-line-default bg-canvas-surface hover:bg-canvas-muted text-[11px] font-medium text-ink-secondary transition-colors disabled:opacity-50 focus-ring"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Clear Thread</span>
              </button>
            )}
          </div>

          {/* Conversation Scroll Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.length === 0 && !isProcessing ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                <div className="w-11 h-11 rounded-xl bg-brand-purple-soft text-brand-purple border border-brand-purple/30 flex items-center justify-center mb-3">
                  <Bot className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-ink-primary">
                  Ask the EHS Multi-Agent Intelligence Platform
                </h3>
                <p className="text-xs text-ink-secondary max-w-lg mt-1.5 leading-relaxed">
                  Questions are routed by the <span className="font-semibold text-ink-primary">EHS Orchestrator</span> to
                  specialist Neon PostgreSQL tools and synthesized through <span className="font-semibold text-ink-primary">DomoGPT</span>.
                  Verified database facts and human-reviewed recommendations are always displayed separately.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-xl">
                  {QUICK_PROMPTS.slice(0, 4).map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleSend(item.prompt)}
                      className="px-3 py-1.5 rounded-lg border border-line-default bg-canvas-subtle hover:border-brand-purple text-xs font-medium text-ink-primary transition-colors focus-ring"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex gap-3 max-w-3xl ml-auto flex-row-reverse">
                      <div className="w-8 h-8 rounded-lg bg-brand-purple text-white flex items-center justify-center shrink-0">
                        <span className="font-mono text-xs font-bold">U</span>
                      </div>
                      <div className="rounded-xl px-4 py-3 text-xs leading-relaxed bg-brand-purple text-white space-y-1.5 min-w-0">
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        <div className="text-[10px] font-mono text-white/75">{msg.timestamp}</div>
                      </div>
                    </div>
                  );
                }

                const isTraceOpen = !!expandedTraceIds[msg.id];
                return (
                  <div key={msg.id} className="flex gap-3 max-w-full">
                    <div className="w-8 h-8 rounded-lg bg-brand-purple-soft text-brand-purple border border-brand-purple/30 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" aria-hidden="true" />
                    </div>

                    <div className="flex-1 min-w-0 rounded-xl p-4 bg-canvas-subtle border border-line-subtle text-ink-primary text-xs leading-relaxed space-y-3">
                      {/* Agent Metadata Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line-subtle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-brand-purple-soft text-brand-purple border border-brand-purple/30 font-semibold text-[11px]">
                            {msg.agentName || 'EHS Orchestrator Agent'}
                          </span>
                          {msg.plantScope && (
                            <span className="px-2 py-0.5 rounded-md bg-canvas-surface border border-line-subtle font-mono text-[10px] text-ink-secondary">
                              {msg.plantScope}
                            </span>
                          )}
                          {msg.specialistsInvoked && msg.specialistsInvoked.length > 1 && (
                            <span className="px-2 py-0.5 rounded-md bg-brand-blue-soft text-brand-blue font-mono text-[10px]">
                              {msg.specialistsInvoked.length} Specialists Collaborated
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[10px] text-ink-muted">
                          {msg.modelId && <span className="truncate max-w-[180px]">{msg.modelId}</span>}
                          {msg.tokenUsage?.total_tokens != null && (
                            <span className="px-1.5 py-0.5 rounded bg-canvas-surface border border-line-subtle">
                              {msg.tokenUsage.total_tokens} tok
                            </span>
                          )}
                        </div>
                      </div>

                      {msg.routingReason && (
                        <div className="text-[11px] text-ink-secondary italic">{msg.routingReason}</div>
                      )}

                      {/* Summary */}
                      <div className="whitespace-pre-wrap text-xs text-ink-primary font-medium leading-relaxed">
                        {msg.content}
                      </div>

                      {/* Key Findings (Verified Database Facts) */}
                      {msg.keyFindings && msg.keyFindings.length > 0 && (
                        <div className="p-3 rounded-lg bg-canvas-surface border border-line-subtle space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-severity-success-text flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Verified Database Findings</span>
                          </div>
                          <ul className="space-y-1 pl-1">
                            {msg.keyFindings.map((finding, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs text-ink-primary">
                                <span className="text-severity-success-text font-bold mt-0.5">•</span>
                                <span>{finding}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Supporting Evidence Citations */}
                      {msg.supportingEvidence && msg.supportingEvidence.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                            Supporting Neon Database Evidence ({msg.dataSources?.join(', ') || 'ehs_core'})
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.supportingEvidence.map((ev, idx) => (
                              <div
                                key={`${ev.id}-${idx}`}
                                className="p-2.5 rounded-lg bg-canvas-surface border border-line-subtle space-y-0.5 min-w-0"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-bold text-[11px] text-brand-purple truncate">
                                    {ev.id}
                                  </span>
                                  <span className="font-mono text-[10px] text-ink-muted truncate">
                                    {ev.dataset_source}
                                  </span>
                                </div>
                                <div className="text-[11px] font-semibold text-ink-primary truncate">{ev.label}</div>
                                {ev.value && (
                                  <div className="font-mono text-[10px] text-brand-blue font-semibold">{ev.value}</div>
                                )}
                                {ev.excerpt && (
                                  <div className="text-[10px] text-ink-secondary">{ev.excerpt}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Advisory Recommendations (Strictly Separated from Facts) */}
                      {msg.recommendations && msg.recommendations.length > 0 && (
                        <div className="p-3 rounded-lg bg-severity-warning-bg/40 border border-severity-warning-border space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-severity-warning-text flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>AI Advisory Recommendations</span>
                            </div>
                            {msg.humanReviewRequired && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-canvas-surface border border-severity-warning-border text-severity-warning-text">
                                <UserCheck className="w-3 h-3" aria-hidden="true" />
                                Human EHS Review Required
                              </span>
                            )}
                          </div>
                          <ul className="space-y-1 pl-1">
                            {msg.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs text-ink-primary">
                                <span className="text-brand-orange font-bold mt-0.5">→</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Dataset Boundary Disclosures */}
                      {msg.limitations && msg.limitations.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-canvas-surface border border-line-subtle flex items-start gap-2 text-[11px] text-ink-secondary">
                          <Info className="w-3.5 h-3.5 text-brand-blue shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="space-y-0.5">
                            <span className="font-semibold text-ink-primary">Dataset Boundaries: </span>
                            <span>{msg.limitations.join(' ')}</span>
                          </div>
                        </div>
                      )}

                      {/* Multi-Agent Execution Trace Toggle & Follow-ups */}
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          {msg.suggestedQuestions?.map(q => (
                            <button
                              key={q}
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleSend(q)}
                              className="text-left px-2.5 py-1 rounded-md border border-line-default bg-canvas-surface hover:border-brand-purple text-[11px] font-medium text-ink-primary transition-colors disabled:opacity-50 focus-ring"
                            >
                              {q}
                            </button>
                          ))}
                        </div>

                        {msg.executionTrace && msg.executionTrace.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleTrace(msg.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-brand-purple hover:underline focus-ring"
                          >
                            <span>Execution Trace ({msg.executionTrace.length} steps)</span>
                            {isTraceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>

                      {isTraceOpen && msg.executionTrace && (
                        <div className="p-2.5 rounded-lg bg-canvas-surface border border-line-subtle space-y-1.5 font-mono text-[10px]">
                          {msg.executionTrace.map(step => (
                            <div key={step.step} className="flex flex-wrap items-center justify-between gap-2 py-1 border-b last:border-b-0 border-line-subtle">
                              <div className="min-w-0">
                                <span className="font-bold text-ink-primary">
                                  #{step.step} {step.agent_name}
                                </span>{' '}
                                <span className="text-brand-blue">[{step.tool_name}]</span>
                                <div className="text-ink-secondary font-sans">{step.summary}</div>
                              </div>
                              <div className="text-ink-muted shrink-0 tabular-nums">
                                {step.records_examined > 0 ? `${step.records_examined.toLocaleString('en-IN')} rows • ` : ''}
                                {step.duration_ms} ms
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-ink-muted">{msg.timestamp}</div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Live Loading State */}
            {isProcessing && (
              <div className="flex gap-3 max-w-3xl" aria-live="polite">
                <div className="w-8 h-8 rounded-lg bg-brand-purple-soft text-brand-purple border border-brand-purple/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 animate-pulse" aria-hidden="true" />
                </div>
                <div className="flex-1 p-4 rounded-xl bg-canvas-subtle border border-line-subtle space-y-2.5">
                  <div className="text-xs font-semibold text-brand-purple flex items-center gap-2">
                    <span>EHS Orchestrator querying Neon PostgreSQL &amp; DomoGPT...</span>
                  </div>
                  <LoadingSkeleton className="h-3 w-3/4" />
                  <LoadingSkeleton className="h-3 w-1/2" />
                </div>
              </div>
            )}

            {/* Live Error State with Retry */}
            {queryError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-severity-critical-border bg-severity-critical-bg/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-severity-critical-text shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-severity-critical-text">AI Safety Query Failed</div>
                    <div className="text-ink-secondary">{queryError}</div>
                  </div>
                </div>
                {lastFailedPrompt && (
                  <button
                    type="button"
                    onClick={() => handleSend(lastFailedPrompt)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas-surface border border-line-default text-xs font-semibold text-ink-primary hover:bg-canvas-muted shrink-0 focus-ring"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Retry Query</span>
                  </button>
                )}
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3.5 border-t border-line-subtle bg-canvas-subtle flex items-center gap-2.5"
          >
            <label htmlFor="ai-assistant-input" className="sr-only">
              Ask EHS Safety Intelligence Assistant
            </label>
            <input
              id="ai-assistant-input"
              type="text"
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              disabled={isProcessing}
              placeholder="Ask about hazards, overdue CAPAs, expired training, P1 maintenance, or permit compliance..."
              className="flex-1 h-9 px-3.5 text-xs rounded-lg border border-line-default bg-canvas-surface text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-purple disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isProcessing}
              className="h-9 px-4 rounded-lg bg-brand-purple hover:bg-brand-hover text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 focus-ring"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isProcessing ? 'Analyzing...' : 'Ask Agents'}</span>
            </button>
          </form>
        </section>
      </div>

      {/* Individual 8-Agent Control Deck */}
      <section className="p-4 sm:p-5 rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line-subtle">
          <div>
            <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
              <Bot className="w-4 h-4 text-brand-purple shrink-0" aria-hidden="true" />
              <span>Specialist &amp; Orchestrator Execution Deck ({agents.length} Agents)</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Run any of the 8 registered DomoGPT + Neon agents individually to inspect live operational findings and execution telemetry.
            </p>
          </div>
          <span className="text-[11px] font-mono text-ink-secondary px-2.5 py-1 rounded-lg bg-canvas-subtle border border-line-subtle self-start sm:self-auto">
            Active Plant Scope: {facilityId}
          </span>
        </div>

        {agentsLoading ? (
          <LoadingSkeleton count={4} className="h-16" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {agents.map(agent => {
              const exec = agentExecutions[agent.agent_key];
              const isRunning = exec?.status === 'running' || Boolean(runningAgentKeys[agent.agent_key]);
              const isSelected = selectedAgent === agent.agent_key;

              return (
                <div
                  key={agent.agent_key}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'border-brand-purple bg-brand-purple-soft/20'
                      : 'border-line-subtle bg-canvas-subtle'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink-primary truncate" title={agent.agent_name}>
                          {agent.agent_name}
                        </div>
                        <div className="font-mono text-[10px] text-ink-muted truncate">
                          {agent.agent_key}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border shrink-0 ${
                          exec?.status === 'running'
                            ? 'bg-brand-purple-soft text-brand-purple border-brand-purple/30'
                            : exec?.status === 'success'
                            ? 'bg-severity-success-bg text-severity-success-text border-severity-success-border'
                            : exec?.status === 'failed'
                            ? 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border'
                            : 'bg-canvas-surface text-ink-muted border-line-default'
                        }`}
                      >
                        {exec?.status ? exec.status.toUpperCase() : 'IDLE'}
                      </span>
                    </div>

                    <p className="text-[11px] text-ink-secondary line-clamp-2 leading-relaxed">
                      {agent.role}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-line-subtle">
                    <span className="font-mono text-[10px] text-ink-muted truncate">
                      {exec?.durationMs != null ? `${exec.durationMs} ms` : agent.data_sources[0] ?? 'ehs_core'}
                    </span>
                    <button
                      type="button"
                      disabled={isProcessing || isRunning}
                      onClick={() => handleExecuteAgent(agent.agent_key)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 shrink-0 focus-ring ${
                        exec?.status === 'failed'
                          ? 'bg-severity-critical-bg text-severity-critical-text border border-severity-critical-border hover:opacity-90'
                          : 'bg-brand-purple hover:bg-brand-hover text-white'
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                          <span>Running...</span>
                        </>
                      ) : exec?.status === 'failed' ? (
                        <>
                          <RotateCcw className="w-3 h-3" aria-hidden="true" />
                          <span>Retry Agent</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" aria-hidden="true" />
                          <span>Execute</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Agent Execution Summary Table */}
      <section className="rounded-xl border border-line-subtle bg-canvas-surface shadow-sm-subtle overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-line-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-blue shrink-0" aria-hidden="true" />
              <span>Agent Execution Summary</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Live execution status, timestamps, grounded output summaries, and error diagnostics for every registered agent.
            </p>
          </div>
          <span className="font-mono text-[11px] text-ink-secondary">
            {Object.values(agentExecutions).filter(e => e.status === 'success').length} / {agents.length} Executed Successfully
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas-subtle border-b border-line-subtle text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                <th className="py-2.5 px-4 whitespace-nowrap">Agent Name</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Execution Status</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Start Time</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Completion Time</th>
                <th className="py-2.5 px-4 min-w-[260px]">Actual Result Summary</th>
                <th className="py-2.5 px-4 min-w-[180px]">Error Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {agents.map(agent => {
                const exec = agentExecutions[agent.agent_key];
                const status = exec?.status ?? 'idle';

                return (
                  <tr key={agent.agent_key} className="hover:bg-canvas-subtle/60 align-top">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-ink-primary whitespace-nowrap">{agent.agent_name}</div>
                      <div className="font-mono text-[10px] text-ink-muted">{agent.agent_key}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold border ${
                          status === 'running'
                            ? 'bg-brand-purple-soft text-brand-purple border-brand-purple/30'
                            : status === 'success'
                            ? 'bg-severity-success-bg text-severity-success-text border-severity-success-border'
                            : status === 'failed'
                            ? 'bg-severity-critical-bg text-severity-critical-text border-severity-critical-border'
                            : 'bg-canvas-subtle text-ink-muted border-line-default'
                        }`}
                      >
                        {status === 'running' && <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />}
                        {status === 'success' && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                        {status === 'failed' && <XCircle className="w-3 h-3" aria-hidden="true" />}
                        <span>{status.toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-ink-secondary whitespace-nowrap">
                      {exec?.startTime ?? '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-ink-secondary whitespace-nowrap">
                      {exec?.completionTime ?? '—'}
                      {exec?.durationMs != null ? ` (${exec.durationMs} ms)` : ''}
                    </td>
                    <td className="py-3 px-4 text-ink-secondary leading-relaxed">
                      {exec?.resultSummary ? (
                        <div className="space-y-1">
                          <p className="text-ink-primary">{exec.resultSummary}</p>
                          {exec.specialistsInvoked.length > 0 && (
                            <p className="font-mono text-[10px] text-brand-purple">
                              Delegated: {exec.specialistsInvoked.join(', ')}
                            </p>
                          )}
                        </div>
                      ) : status === 'running' ? (
                        <span className="text-brand-purple font-medium">Executing Neon SQL + DomoGPT analysis...</span>
                      ) : (
                        <span className="text-ink-muted">— Not executed yet</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {exec?.errorDetails ? (
                        <span className="text-severity-critical-text font-medium">{exec.errorDetails}</span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
