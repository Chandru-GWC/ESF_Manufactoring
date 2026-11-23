import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FormField } from '../ui/FormField';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitObservation: (data: {
    type: 'hazard' | 'incident' | 'near-miss';
    title: string;
    location: string;
    equipment: string;
    severity: 'critical' | 'high' | 'warning' | 'info';
    description: string;
  }) => void;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  isOpen,
  onClose,
  onSubmitObservation,
}) => {
  const [type, setType] = useState<'hazard' | 'incident' | 'near-miss'>('hazard');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Building C - Cold Storage Mezzanine');
  const [equipment, setEquipment] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'warning' | 'info'>('warning');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmitObservation({
      type,
      title,
      location,
      equipment,
      severity,
      description,
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
      setTitle('');
      setEquipment('');
      setDescription('');
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-log-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg bg-white rounded-lg shadow-modal border border-slate-200 p-6 z-10"
          >
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="quick-log-title" className="text-sm font-bold text-slate-900">
                    Log EHS Safety Observation
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Record field hazard, unsafe condition, or near-miss incident
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-900">Observation Recorded</h4>
                <p className="text-xs text-slate-500">
                  Generated record ID HAZ-2026-090. Responsible supervisor notified.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Observation Type Selector */}
                <div className="flex gap-2">
                  {[
                    { id: 'hazard', label: 'Hazard / Unsafe Condition' },
                    { id: 'near-miss', label: 'Near Miss (Zero Harm)' },
                    { id: 'incident', label: 'Incident / Spill / Injury' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id as any)}
                      className={`flex-1 py-1.5 px-2 rounded text-[11px] font-semibold border transition-colors ${
                        type === t.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <FormField label="Observation Title" required>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Hydraulic leak near Conveyor 3 drive shaft"
                    className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded focus-ring"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Facility Location / Zone" required>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded focus-ring"
                    >
                      <option value="Building C - Cold Storage Mezzanine">Building C - Cold Storage</option>
                      <option value="Fabrication Hall 2 - Bay 4">Fabrication Hall 2</option>
                      <option value="Packaging Facility - Line 3">Packaging Facility</option>
                      <option value="Chemical Storage Shed - Room 102">Chemical Storage Shed</option>
                      <option value="Boiler House - Level 2">Boiler House</option>
                    </select>
                  </FormField>

                  <FormField label="Estimated Severity Level">
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as any)}
                      className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded focus-ring"
                    >
                      <option value="critical">Critical (Stop Work Required)</option>
                      <option value="high">High (Immediate Triage)</option>
                      <option value="warning">Medium (Standard Hazard)</option>
                      <option value="info">Low (Housekeeping / Minor)</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Equipment / Asset Tag (Optional)">
                  <input
                    type="text"
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                    placeholder="e.g. COMP-04 or PRESS-204"
                    className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded focus-ring font-mono"
                  />
                </FormField>

                <FormField label="Detailed Description & Temporary Controls Applied" required>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what was seen, environmental factors, sensor readings, or immediate physical barricades established."
                    className="p-2.5 text-xs bg-slate-50 border border-slate-300 rounded focus-ring"
                  />
                </FormField>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-sm-subtle"
                  >
                    Submit Record
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
