import React from 'react';
import { RiskIndicator } from './RiskIndicator';
import { SeverityLevel } from '../../types/ehs';

interface SeverityIndicatorProps {
  level: SeverityLevel;
  className?: string;
  showLabel?: boolean;
}

export const SeverityIndicator: React.FC<SeverityIndicatorProps> = ({
  level,
  className,
  showLabel = true,
}) => {
  return <RiskIndicator level={level} showIcon={true} className={!showLabel ? 'px-1.5' : className} />;
};
