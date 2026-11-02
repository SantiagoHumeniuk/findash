// src/components/ui/live-value.tsx

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface LiveValueProps {
  value: number | null | undefined;
  children: ReactNode;
  className?: string;
}

/** Flashes green or red for a moment when the value changes (never on first render). */
export function LiveValue({ value, children, className }: LiveValueProps) {
  const previous = useRef(value);
  const [flash, setFlash] = useState<{ direction: 'up' | 'down'; id: number } | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (typeof before !== 'number' || typeof value !== 'number' || before === value) return;
    setFlash((current) => ({ direction: value > before ? 'up' : 'down', id: (current?.id ?? 0) + 1 }));
  }, [value]);

  return (
    <span
      key={flash?.id ?? 0}
      className={cn('rounded-sm', flash && `value-flash-${flash.direction}`, className)}
    >
      {children}
    </span>
  );
}
