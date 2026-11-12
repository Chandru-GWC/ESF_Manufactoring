import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  LayoutDashboard,
  Flame,
  AlertOctagon,
  Users,
  Wrench,
  CheckSquare,
  KeyRound,
  ClipboardList,
  HardHat,
  BookOpen,
  Bot,
  FileText,
  Settings,
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
  const { hazards, incidents, actions, permits, rawMaintenance } = useEhs();
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
    { id: 'hazards', label: 'Hazard Monitoring', group: 'Events & Incidents', icon: Flame },
    { id: 'incidents', label: 'Incident Management', group: 'Events & Incidents', icon: AlertOctagon },
    { id: 'risks', label: 'Risk Register', group: 'Events & Incidents', icon: HardHat },
    { id: 'actions', label: 'Corrective Actions (CAPA)', group: 'Prevention & CAPA', icon: CheckSquare },
    { id: 'permits', label: 'Permit & LOTO', group: 'Prevention & CAPA', icon: KeyRound },
    { id: 'inspections', label: 'Inspections & Audits', group: 'Prevention & CAPA', icon: ClipboardList },
    { id: 'workforce-shifts', label: 'Workforce & Shifts', group: 'Operations', icon: Users },
    { id: 'training', label: 'Training Matrix', group: 'Operations', icon: BookOpen },
    { id: 'maintenance-safety', label: 'Maintenance & Safety', group: 'Operations', icon: Wrench },
    { id: 'ai-assistant', label: 'AI Safety Assistant', group: 'Insights & Admin', icon: Bot },
    { id: 'reports', label: 'Reports & Export', group: 'Insights & Admin', icon: FileText },
    { id: 'settings', label: 'System Settings', group: 'Insights & Admin', icon: Settings },
  ];

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        pages: navigationItems.slice(0, 6),
        records: hazards.slice(0, 4).map(h => ({ id: h.id, title: h.title, target: 'hazards' as NavSection })),
      };
    }

    const filteredPages = navigationItems.filter(
      item => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
    );

    const filteredHazards = hazards
      .filter(h => h.id.toLowerCase().includes(q) || h.title.toLowerCase().includes(q) || h.location.toLowerCase().includes(q))
      .map(h => ({ id: h.id, title: h.title, target: 'hazards' as NavSection }));

    const filteredIncidents = incidents
      .filter(i => i.id.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
      .map(i => ({ id: i.id, title: i.title, target: 'incidents' as NavSection }));

    const filteredActions = actions
      .filter(a => a.id.toLowerCase().includes(q) || a.title.toLowerCase().includes(q))
      .map(a => ({ id: a.id, title: a.title, target: 'actions' as NavSection }));

    const filteredPermits = permits
      .filter(p => p.id.toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
      .map(p => ({ id: p.id, title: p.title, target: 'permits' as NavSection }));

    const filteredMaint = rawMaintenance
      .filter(m => m.work_order_id.toLowerCase().includes(q) || m.machine_id.toLowerCase().includes(q))
      .map(m => ({ id: m.work_order_id, title: `${m.machine_id} • ${m.failure_mode}`, target: 'maintenance-safety' as NavSection }));

    return {
      pages: filteredPages,
      records: [...filteredHazards, ...filteredIncidents, ...filteredActions, ...filteredPermits, ...filteredMaint].slice(0, 8),
    };
  }, [query, hazards, incidents, actions, permits, rawMaintenance]);

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
