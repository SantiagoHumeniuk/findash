// src/features/asset-detail/components/metrics/key-metric-item.tsx

import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../components/ui/tooltip';

interface KeyMetricItemProps {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
  className?: string;
}

export function KeyMetricItem({ label, value, tooltip, className }: KeyMetricItemProps) {
  if (value === null || value === undefined || value === '') return null;

  return (
    <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>

        {tooltip && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground/50 hover:text-primary cursor-help transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs leading-snug">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <p className={`text-sm sm:text-base font-bold min-h-[1.5rem] flex items-center justify-center sm:justify-start ${className ?? 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}