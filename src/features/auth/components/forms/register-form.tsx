// src/features/auth/components/forms/register-form.tsx

import React from 'react';
import { toast } from 'sonner';
import { cn } from '../../../../lib/utils';
import { AuthCard } from '../shared/auth-card';
import { FormInput } from '../shared/form-input';
import { FormFooter } from '../shared/form-footer';
import { AuthButton } from '../shared/auth-button';
import { GoogleAuthButton } from '../shared/google-auth-button';
import { registerUser } from '../../lib/auth-utils';

/**
 * Props para el componente RegisterForm.
 * @property className - Clases CSS adicionales
 */
interface RegisterFormProps extends React.ComponentProps<'div'> {
  className?: string;
}

/**
 * Formulario de registro de nuevo usuario.
 * Permite crear una cuenta con email y contraseña.
 * 
 * Incluye:
 * - Campo de email
 * - Campo de contraseña
 * - Botón de submit
 * - Link a página de login
 * 
 * @example
 * ```tsx
 * <RegisterForm />
 * ```
 */
export function RegisterForm({ className, ...props }: RegisterFormProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setLoading(true);

    void (async () => {
      try {
        const result = await registerUser(email, password);

        if (!result.success) {
          toast.error('Error al crear la cuenta. Intenta nuevamente.');
          return;
        }

        toast.success('Has creado tu cuenta correctamente.');
        setTimeout(
          () =>
            toast.success(
              'Revisa tu correo electrónico para verificar tu cuenta.'
            ),
          1000
        );
      } finally {
        setTimeout(() => setLoading(false), 500);
      }
    })();
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AuthCard
        title="Crea tu cuenta"
        description="Ingresa tu correo electrónico a continuación para crear una cuenta"
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

            <FormInput
              id="password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={setPassword}
              required
              autoComplete="new-password"
            />

            <div className="flex flex-col gap-3">
              <AuthButton loading={loading}>Crear Cuenta</AuthButton>

              <div className="flex items-center gap-3 my-1">
                <div className="h-px flex-1 bg-border/60" />
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  o regístrate con
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              <GoogleAuthButton text="Registrarse con Google" />
            </div>
          </div>

          <FormFooter
            text="¿Ya tienes una cuenta?"
            linkText="Iniciar sesión"
            linkTo="/login"
          />
        </form>
      </AuthCard>
    </div>
  );
}
