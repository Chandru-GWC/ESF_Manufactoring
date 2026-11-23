import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  LayoutDashboard,
  Users,
  Wrench,
  BookOpen,
  Bot,
  Database,
  ArrowRight,
  Box,
  Video,
} from 'lucide-react';
import { NavSection } from '../../types/ehs';
import { useEhs } from '../../context/EhsContext';
import { MODAL_VARIANTS } from '../../lib/motion';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: NavSection) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { rawMaintenance } = useEhs();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navigationItems: { id: NavSection; label: string; group: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Command Center', group: 'Command Center', icon: LayoutDashboard },
    { id: 'video-monitoring', label: 'Safety Video Intelligence', group: 'Safety Monitoring', icon: Video },
    { id: 'digital-twin', label: 'Industrial Digital Twin (3D)', group: 'Safety Monitoring', icon: Box },
    { id: 'workforce-shifts', label: 'Workforce & Shifts', group: 'Operations', icon: Users },
    { id: 'training', label: 'Training Matrix', group: 'Operations', icon: BookOpen },
    { id: 'maintenance-safety', label: 'Maintenance & Safety', group: 'Operations', icon: Wrench },
    { id: 'ai-assistant', label: 'EHS Agent', group: 'Assistant & Data', icon: Bot },
    { id: 'connectors', label: 'Enterprise Data Connectors', group: 'Assistant & Data', icon: Database },
  ];

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        pages: navigationItems.slice(0, 6),
        records: rawMaintenance.slice(0, 4).map(m => ({ id: m.work_order_id, title: `${m.machine_id} • ${m.failure_mode}`, target: 'maintenance-safety' as NavSection })),
      };
    }

    const filteredPages = navigationItems.filter(
      item => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
    );

    const filteredMaint = rawMaintenance
      .filter(m => m.work_order_id.toLowerCase().includes(q) || m.machine_id.toLowerCase().includes(q))
      .map(m => ({ id: m.work_order_id, title: `${m.machine_id} • ${m.failure_mode}`, target: 'maintenance-safety' as NavSection }));

    return {
      pages: filteredPages,
      records: filteredMaint.slice(0, 8),
    };
  }, [query, rawMaintenance]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Global Command Search"
            variants={MODAL_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-lg rounded-xl bg-canvas-surface border border-line-subtle shadow-modal overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line-subtle">
              <Search className="w-4 h-4 text-ink-muted shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Jump to module, hazard ID, machine, or permit..."
                className="w-full text-xs bg-transparent text-ink-primary placeholder:text-ink-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                className="px-1.5 py-0.5 text-[10px] font-mono text-ink-muted bg-canvas-subtle border border-line-subtle rounded"
              >
                ESC
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-3 space-y-4">
              {searchResults.pages.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    Workspace Modules & Tabs
                  </div>
                  {searchResults.pages.map(p => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onNavigate(p.id)}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-canvas-subtle text-ink-primary transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span className="font-medium truncate">{p.label}</span>
                        </div>
                        <span className="text-[10px] font-mono text-ink-muted shrink-0">{p.group}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {searchResults.records.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    Verified Safety Records
                  </div>
                  {searchResults.records.map(r => (
                    <button
                      key={`${r.target}-${r.id}`}
                      type="button"
                      onClick={() => onNavigate(r.target)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-canvas-subtle text-ink-primary transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-[11px] font-semibold text-brand-primary mr-2">
                          {r.id}
                        </span>
                        <span className="text-ink-secondary truncate">{r.title}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {searchResults.pages.length === 0 && searchResults.records.length === 0 && (
                <div className="py-8 text-center text-xs text-ink-muted">
                  No modules or records match "{query}".
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
