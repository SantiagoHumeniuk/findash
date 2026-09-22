// src/features/auth/components/shared/auth-card.tsx

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';

/**
 * Props para el componente AuthCard.
 * @property title - Título de la tarjeta
 * @property description - Descripción bajo el título
 * @property children - Contenido de la tarjeta (formulario)
 */
interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

/**
 * Tarjeta reutilizable para formularios de autenticación.
 * Proporciona un diseño consistente con título, descripción y contenido.
 * 
 * @example
 * ```tsx
 * <AuthCard title="Iniciar sesión" description="Ingresa tus credenciales">
 *   <form>...</form>
 * </AuthCard>
 * ```
 */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md mx-auto backdrop-blur-xl bg-card/90 dark:bg-card/80 border border-border/60 shadow-2xl shadow-primary/5">
      <CardHeader className="space-y-1 px-4 sm:px-6 pt-6 pb-4">
        <CardTitle className="text-xl sm:text-2xl font-semibold text-center">
          {title}
        </CardTitle>
        <CardDescription className="text-sm sm:text-base text-center">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-6">{children}</CardContent>
    </Card>
  );
}
