// src/features/asset-detail/components/error-states/loading-error.tsx

import { Link } from 'react-router-dom';
import { useAuth } from '../../../../hooks/use-auth';
import { Button } from '../../../../components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * Props para el componente LoadingError.
 * @property errorMessage - Mensaje de error a mostrar
 */
interface LoadingErrorProps {
  errorMessage: string;
}

/**
 * Componente de error mostrado cuando falla la carga de datos del activo.
 * Incluye el mensaje de error y un botón para volver al dashboard.
 * 
 * @example
 * ```tsx
 * <LoadingError errorMessage="Error al cargar los datos del servidor" />
 * ```
 */
export function LoadingError({ errorMessage }: LoadingErrorProps) {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="text-center py-12 sm:py-20 px-4">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Este activo todavía no está disponible sin cuenta</h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">{errorMessage}</p>
        <div className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm"><Link to="/register">Crear cuenta gratis</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/screener">Ir al screener</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-12 sm:py-20 px-4">
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-destructive">
        Error al cargar el activo
      </h2>
      <p className="text-sm sm:text-base text-muted-foreground mt-2">{errorMessage}</p>
      <Button asChild className="mt-4 sm:mt-6" variant="outline" size="sm">
        <Link to="/dashboard">
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
          Volver al Dashboard
        </Link>
      </Button>
    </div>
  );
}
