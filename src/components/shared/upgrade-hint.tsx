// src/components/shared/upgrade-hint.tsx

import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../hooks/use-auth';

interface UpgradeHintProps {
  message: string;
  className?: string;
}

/** Explains what a paid plan unlocks; visitors without an account are sent to sign up first. */
export function UpgradeHint({ message, className = '' }: UpgradeHintProps) {
  const { user } = useAuth();
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 ${className}`}>
      <p className="flex min-w-0 flex-1 items-start gap-2 text-sm">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>{message}</span>
      </p>
      <Button asChild size="sm">
        <Link to={user ? '/plans' : '/register'}>{user ? 'Ver planes' : 'Crear cuenta gratis'}</Link>
      </Button>
    </div>
  );
}
