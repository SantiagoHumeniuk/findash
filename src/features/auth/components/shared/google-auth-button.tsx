// src/features/auth/components/shared/google-auth-button.tsx

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { loginWithGoogle } from '../../lib/auth-utils';
import { cn } from '../../../../lib/utils';

interface GoogleAuthButtonProps extends React.ComponentProps<typeof Button> {
  text?: string;
  redirectTo?: string;
}

/**
 * Icono oficial de Google en formato SVG con colores corporativos.
 */
export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

/**
 * Botón para iniciar sesión o registrarse con Google OAuth.
 */
export function GoogleAuthButton({
  text = 'Continuar con Google',
  redirectTo,
  className,
  ...props
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleGoogleClick = async () => {
    try {
      setLoading(true);
      const result = await loginWithGoogle(redirectTo);

      if (!result.success) {
        const errorLower = result.error?.toLowerCase() ?? '';
        if (
          errorLower.includes('not enabled') ||
          errorLower.includes('unsupported provider') ||
          errorLower.includes('validation_failed')
        ) {
          toast.error(
            'El inicio con Google aún no está configurado en el panel de Supabase.'
          );
        } else {
          toast.error(result.error || 'Error al conectar con Google.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      toast.error(msg);
    } finally {
      // Dejamos un breve delay antes de re-habilitar si no se redirigió
      setTimeout(() => setLoading(false), 1500);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      onClick={() => void handleGoogleClick()}
      className={cn(
        'w-full flex items-center justify-center gap-3 font-medium transition-all hover:bg-muted/80',
        className
      )}
      {...props}
    >
      <GoogleIcon />
      <span>{loading ? 'Conectando con Google...' : text}</span>
    </Button>
  );
}
