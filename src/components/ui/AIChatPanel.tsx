import React, { useState } from 'react';
import { Send, Bot, User, CheckCircle2, Sparkles, Database, ExternalLink } from 'lucide-react';
import { AIMessage } from '../../types/ehs';
import { cn } from '../../lib/utils';

interface AIChatPanelProps {
  messages: AIMessage[];
  onSendMessage: (query: string) => void;
  isLoading?: boolean;
  suggestedPrompts?: string[];
  className?: string;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading = false,
  suggestedPrompts = [
    'Analyze Ammonia refrigeration hazards in Building C',
    'Summarize overdue corrective actions for Plant Alpha',
    'Review OSHA 1910.147 LOTO compliance audit findings',
    'Calculate Lost Time Injury Frequency Rate (LTIFR) for Q3',
  ],
  className,
}) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-white border border-slate-200 rounded-md shadow-sm-subtle overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                EHS Safety Assistant
              </h3>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                REST Agent Connected
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Grounded to facility risk register & incident records</p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          Model: EHS-Industrial-v2
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isBot = msg.role === 'assistant';

          return (
            <div
              key={msg.id}
              className={cn(
                'flex items-start gap-3 text-xs leading-relaxed',
                !isBot && 'flex-row-reverse'
              )}
            >
              <div
                className={cn(
                  'w-7 h-7 rounded flex items-center justify-center shrink-0 text-xs font-semibold border',
                  isBot
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-900 text-white border-slate-900'
                )}
              >
                {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={cn(
                  'max-w-[85%] rounded-md p-3.5 border',
                  isBot
                    ? 'bg-slate-50/70 border-slate-200 text-slate-800'
                    : 'bg-blue-600 text-white border-blue-600'
                )}
              >
                {/* Tool execution badge if present */}
                {isBot && msg.toolExecution && (
                  <div className="mb-2.5 p-2 rounded bg-white border border-slate-200/80 text-[11px] font-mono flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-blue-600" />
                      <span>Executed: {msg.toolExecution.toolName}</span>
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                      {msg.toolExecution.status}
                    </span>
                  </div>
                )}

                {/* Main message text */}
                <div className="whitespace-pre-line font-normal">{msg.content}</div>

                {/* Citations & grounding tags */}
                {isBot && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1.5">
                      Verified Telemetry Citations
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                        >
                          <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                          <span>{c.label} ({c.id})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Followups */}
                {isBot && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                  <div className="mt-3 pt-2 flex flex-wrap gap-1.5">
                    {msg.suggestedQuestions.map((q: string, i: number) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onSendMessage(q)}
                        className="text-[11px] px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded transition-colors text-left font-medium"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={cn(
                    'mt-2 text-[10px] font-mono',
                    isBot ? 'text-slate-400' : 'text-blue-100 text-right'
                  )}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 text-xs">
            <div className="w-7 h-7 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-slate-500 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>Analyzing safety database and compiling risk synthesis...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompts Pill Tray */}
      <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 overflow-x-auto flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider shrink-0 mr-1">
          Quick queries:
        </span>
        {suggestedPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSendMessage(p)}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded transition-colors font-medium"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Composer Input Bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI Safety Assistant about hazards, OSHA regulations, CAPA actions..."
          disabled={isLoading}
          className="flex-1 text-xs h-9 px-3 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors focus-ring shrink-0 shadow-sm-subtle"
        >
          <span>Send</span>
          <Send className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
};
