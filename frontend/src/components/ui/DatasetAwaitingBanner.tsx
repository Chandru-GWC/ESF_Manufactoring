import React from 'react';
import { Database } from 'lucide-react';
import { motion } from 'motion/react';

interface DatasetAwaitingBannerProps {
  datasetName: string;
  fileName: string;
  requiredFields: string[];
  purpose: string;
  onOpenDataDictionary?: () => void;
}

export const DatasetAwaitingBanner: React.FC<DatasetAwaitingBannerProps> = ({
  datasetName,
  fileName,
  requiredFields,
  purpose,
  onOpenDataDictionary,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-5 rounded-lg border border-brand-orange/30 bg-brand-peach-soft text-ink-primary shadow-sm"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-md bg-brand-orange/15 text-brand-orange shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-orange font-mono">
                Dataset Awaiting Ingestion
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-canvas-surface border border-line-subtle text-ink-secondary">
                {fileName}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-ink-primary mt-1">
              {datasetName} source records have not been supplied yet.
            </h4>
            <p className="text-xs text-ink-secondary mt-0.5 max-w-2xl">
              {purpose}. Under our strict zero-mock data policy, synthetic records are prohibited. This view will dynamically populate once the data team ingests the approved CSV file.
            </p>
          </div>
        </div>

        {onOpenDataDictionary && (
          <button
            onClick={onOpenDataDictionary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-canvas-surface border border-brand-orange/40 text-brand-orange hover:bg-brand-orange hover:text-white transition-colors shrink-0 shadow-sm-subtle"
          >
            <span>View Schema Specs</span>
          </button>
        )}
      </div>

      <div className="mt-4 pt-3.5 border-t border-brand-orange/20 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-ink-secondary">Required Ingestion Columns:</span>
        {requiredFields.map(field => (
          <code
            key={field}
            className="px-2 py-0.5 rounded bg-canvas-surface border border-line-subtle text-ink-primary font-mono text-[11px]"
          >
            {field}
          </code>
        ))}
      </div>
    </motion.div>
  );
};
