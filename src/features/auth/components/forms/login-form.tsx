// src/features/auth/components/forms/login-form.tsx

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../../../../lib/utils';
import { Label } from '../../../../components/ui/label';
import { AuthCard } from '../shared/auth-card';
import { FormInput } from '../shared/form-input';
import { FormFooter } from '../shared/form-footer';
import { AuthButton } from '../shared/auth-button';
import { GoogleAuthButton } from '../shared/google-auth-button';
import { loginUser } from '../../lib/auth-utils';

/**
 * Props para el componente LoginForm.
 * @property className - Clases CSS adicionales
 */
interface LoginFormProps extends React.ComponentProps<'div'> {
  className?: string;
}

/**
 * Formulario de inicio de sesión.
 * Permite al usuario autenticarse con email y contraseña.
 * 
 * Incluye:
 * - Campo de email
 * - Campo de contraseña
 * - Link a "Olvidaste tu contraseña"
 * - Botón de submit
 * - Link a página de registro
 * 
 * @example
 * ```tsx
 * <LoginForm />
 * ```
 */
export function LoginForm({ className, ...props }: LoginFormProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setLoading(true);

    void (async () => {
      try {
        const result = await loginUser(email, password);

        if (!result.success) {
          toast.error('Email o contraseña incorrectos.');
          return;
        }

        toast.success('Has iniciado sesión correctamente.');
        setTimeout(() => {
          void navigate('/dashboard');
          window.location.reload();
        }, 500);
      } finally {
        setTimeout(() => setLoading(false), 500);
      }
    })();
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AuthCard
        title="Inicia sesión en tu cuenta"
        description="Ingresa tu correo electrónico a continuación para iniciar sesión en tu cuenta"
      >
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            <FormInput
              id="email"
              label="Correo Electrónico"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={setEmail}
              required
              autoComplete="email"
            />

            <div className="grid gap-3">
              <div className="flex items-center">
                <Label htmlFor="password">Contraseña</Label>
                <NavLink
                  to="/forgot-password"
                  className="ml-auto inline-block body-sm underline-offset-4 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </NavLink>
              </div>
              <FormInput
                id="password"
                label=""
                type="password"
                value={password}
                onChange={setPassword}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="flex flex-col gap-3">
              <AuthButton loading={loading}>Iniciar Sesión</AuthButton>

              <div className="flex items-center gap-3 my-1">
                <div className="h-px flex-1 bg-border/60" />
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  o continúa con
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              <GoogleAuthButton text="Continuar con Google" />
            </div>
          </div>

          <FormFooter
            text="¿No tienes una cuenta?"
            linkText="Crear cuenta"
            linkTo="/register"
          />
        </form>
      </AuthCard>
    </div>
  );
}
